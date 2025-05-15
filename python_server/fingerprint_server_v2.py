from flask import Flask, request, jsonify
import cv2
import numpy as np
import base64
from PIL import Image
import io
import os
import json
import datetime
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from scipy import ndimage
import shutil
import threading
import time

# Multithreading lock for file operations
file_lock = threading.Lock()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# MongoDB connection
MONGO_URI = "mongodb+srv://hennryx101:OIXs7TPJhxHX9o8F@cluster0.croadpx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "Cluster0"

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
fingerprint_collection = db["fingerprints"]

# Base directory for storing fingerprint images
BASE_ASSET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets'))
FINGERPRINT_DIR = os.path.join(BASE_ASSET_DIR, 'fingerprints')

# Ensure directory exists
os.makedirs(FINGERPRINT_DIR, exist_ok=True)

# Cache for storing frequently accessed templates (in-memory LRU cache)
template_cache = {}
MAX_CACHE_SIZE = 100

def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    img_data = base64.b64decode(base64_string)
    img = Image.open(io.BytesIO(img_data))
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

def get_user_directory(staff_id, email=None):
    """Create and return user-specific directory for storing fingerprints"""
    # Create a sanitized directory name
    dir_name = f"{staff_id}"
    if email:
        # Remove any unsafe characters from email
        safe_email = "".join(c for c in email if c.isalnum() or c in ['.', '_', '-', '@'])
        dir_name = f"{safe_email}_{staff_id}"
    
    user_dir = os.path.join(FINGERPRINT_DIR, dir_name)
    os.makedirs(user_dir, exist_ok=True)
    
    return user_dir

def save_fingerprint_image(staff_id, image_data, scan_index=0, email=None):
    """Save fingerprint image to filesystem and return the filename"""
    with file_lock:
        user_dir = get_user_directory(staff_id, email)
        
        # Generate filename with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"fingerprint_{timestamp}_{scan_index}.png"
        filepath = os.path.join(user_dir, filename)
        
        # Convert base64 to image and save
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        img_data = base64.b64decode(image_data)
        
        with open(filepath, 'wb') as f:
            f.write(img_data)
        
        # Return relative path from assets directory
        rel_path = os.path.relpath(filepath, BASE_ASSET_DIR)
        return rel_path

def preprocess_fingerprint(img):
    """Optimized fingerprint preprocessing using NumPy operations"""
    # Convert to grayscale if not already
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
    
    # Resize to standard size (smaller is faster)
    gray = cv2.resize(gray, (320, 320))
    
    # Normalize to improve contrast
    normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    
    # Apply CLAHE for better ridge-valley contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(normalized)
    
    # Reduce noise with a fast Gaussian blur
    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
    
    # Adaptive thresholding - more reliable than global
    binary = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                  cv2.THRESH_BINARY, 11, 2)
    
    # Skeletonization/thinning for more consistent matching
    try:
        # Try to use ximgproc if available
        thinned = cv2.ximgproc.thinning(binary)
        return thinned
    except:
        # Fallback to basic processing
        kernel = np.ones((3,3), np.uint8)
        clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        return clean

def extract_minutiae(img):
    """Extract minutiae points using crossing number method"""
    # Ensure binary image
    if np.max(img) > 1:
        _, binary = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
    else:
        binary = img.copy()
    
    # Ensure ridges are white
    if np.mean(binary) > 127:
        binary = 255 - binary
    
    # Thin/skeletonize if not already
    try:
        skeleton = cv2.ximgproc.thinning(binary)
    except:
        skeleton = binary
    
    # Crossing number method
    minutiae = []
    h, w = skeleton.shape
    
    # Convert to 0/1 binary
    binary_img = (skeleton > 0).astype(np.uint8)
    
    # Padding to avoid border issues
    padded = np.pad(binary_img, ((1, 1), (1, 1)), mode='constant')
    
    # Define 8-neighbors positions (clockwise)
    neighbors = [(0,1), (-1,1), (-1,0), (-1,-1), (0,-1), (1,-1), (1,0), (1,1)]
    
    # Iterate through interior pixels (ignore 1-pixel boundary)
    for i in range(1, h+1):
        for j in range(1, w+1):
            if padded[i, j] == 1:  # Ridge pixel
                # Get 8-connected neighbors
                values = [padded[i + n[0], j + n[1]] for n in neighbors]
                
                # Calculate crossing number (transitions from 0 to 1)
                crossings = 0
                for k in range(8):
                    crossings += abs(int(values[k]) - int(values[(k+1) % 8]))
                crossings //= 2
                
                # CN=1: Ridge ending, CN=3: Bifurcation
                if crossings == 1 or crossings == 3:
                    minutiae.append({
                        'x': j-1,  # Adjust back from padded coordinates
                        'y': i-1,
                        'type': 'ending' if crossings == 1 else 'bifurcation'
                    })
    
    return minutiae

def extract_fingerprint_features(img, enhanced_only=False):
    """Optimized feature extraction focused on the most discriminative features"""
    # Preprocess the image
    processed = preprocess_fingerprint(img)
    
    # If only enhanced image is needed (for storing reference)
    if enhanced_only:
        return {
            'preprocessed': processed,
            'quality_score': 0.7  # Default quality score
        }
    
    # 1. Extract minutiae points (most discriminative feature)
    minutiae = extract_minutiae(processed)
    
    # 2. ORB features - fast and rotation invariant
    orb = cv2.ORB_create(nfeatures=250)  # Reduce feature count for speed
    keypoints, descriptors = orb.detectAndCompute(processed, None)
    
    # 3. Perceptual hash - fast global fingerprint
    resized = cv2.resize(processed, (32, 32))  # Larger for better discrimination
    avg_val = np.mean(resized)
    img_hash = ''.join(['1' if pixel > avg_val else '0' for pixel in resized.flatten()])
    
    # 4. Block statistics - capture local ridge patterns
    block_size = 32
    blocks = []
    
    h, w = processed.shape
    for i in range(0, h - block_size + 1, block_size // 2):  # Overlapping blocks
        for j in range(0, w - block_size + 1, block_size // 2):
            block = processed[i:i+block_size, j:j+block_size]
            
            # Get block statistics
            if np.sum(block) > 0:  # Ignore empty blocks
                mean_val = np.mean(block)
                std_val = np.std(block)
                blocks.append({
                    'pos': [i, j],
                    'mean': float(mean_val),
                    'std': float(std_val)
                })
    
    # Convert keypoints to serializable format
    serialized_keypoints = []
    for kp in keypoints:
        serialized_keypoints.append({
            'x': float(kp.pt[0]),
            'y': float(kp.pt[1]),
            'size': float(kp.size),
            'angle': float(kp.angle),
            'response': float(kp.response),
            'octave': int(kp.octave)
        })
    
    # Convert descriptors to serializable list
    serialized_descriptors = []
    if descriptors is not None:
        serialized_descriptors = descriptors.tolist()
    
    # Calculate quality score based on feature metrics
    num_keypoints = len(keypoints) if keypoints is not None else 0
    num_minutiae = len(minutiae)
    
    # More features generally means better quality
    quality_score = min(1.0, (num_keypoints / 100) * 0.4 + (num_minutiae / 20) * 0.6)
    
    # Return enhanced template
    return {
        'template': {
            'keypoints': serialized_keypoints,
            'descriptors': serialized_descriptors,
            'hash': img_hash,
            'blocks': blocks,
            'minutiae': minutiae,
            'quality_score': quality_score
        },
        'original_template': {
            'keypoints': serialized_keypoints,
            'descriptors': serialized_descriptors
        },
        'quality_score': quality_score,
        'preprocessed': processed
    }

def combine_templates(templates):
    """Combine multiple templates from different scans into a master template"""
    if not templates or len(templates) == 0:
        return None
    
    # Initialize with first template
    master_template = templates[0].copy()
    
    # Combine unique minutiae across all templates
    all_minutiae = []
    for template in templates:
        if 'minutiae' in template:
            all_minutiae.extend(template['minutiae'])
    
    # Group similar minutiae (those within a certain distance of each other)
    grouped_minutiae = []
    DISTANCE_THRESHOLD = 10
    
    for minutia in all_minutiae:
        matched = False
        for group in grouped_minutiae:
            for m in group:
                dist = np.sqrt((minutia['x'] - m['x'])**2 + (minutia['y'] - m['y'])**2)
                if dist < DISTANCE_THRESHOLD and minutia['type'] == m['type']:
                    group.append(minutia)
                    matched = True
                    break
            if matched:
                break
        
        if not matched:
            grouped_minutiae.append([minutia])
    
    # Get the most reliable minutiae (those that appear in multiple templates)
    reliable_minutiae = []
    for group in grouped_minutiae:
        if len(group) >= 2:  # Minutia appears in at least 2 templates
            # Calculate average position
            avg_x = sum(m['x'] for m in group) / len(group)
            avg_y = sum(m['y'] for m in group) / len(group)
            minutia_type = group[0]['type']  # Use type from first instance
            
            reliable_minutiae.append({
                'x': avg_x,
                'y': avg_y,
                'type': minutia_type
            })
    
    # Update the master template
    master_template['minutiae'] = reliable_minutiae
    
    # Collect all keypoints and descriptors
    all_keypoints = []
    all_descriptors = []
    
    for template in templates:
        if 'keypoints' in template and 'descriptors' in template:
            all_keypoints.extend(template['keypoints'])
            if template['descriptors']:
                all_descriptors.extend(template['descriptors'])
    
    # Select the most reliable keypoints (those with highest response)
    keypoint_dict = {}
    for kp in all_keypoints:
        # Create a grid-based key for grouping nearby keypoints
        grid_x = int(kp['x'] // 10)
        grid_y = int(kp['y'] // 10)
        key = f"{grid_x}_{grid_y}"
        
        if key not in keypoint_dict or kp['response'] > keypoint_dict[key]['response']:
            keypoint_dict[key] = kp
    
    # Update keypoints in master template
    master_template['keypoints'] = list(keypoint_dict.values())
    
    # Set descriptors to the most comprehensive set
    if all_descriptors:
        master_template['descriptors'] = all_descriptors[:min(300, len(all_descriptors))]
    
    # Combine block statistics
    if 'blocks' in templates[0]:
        master_blocks = {}
        block_counts = {}
        
        for template in templates:
            if 'blocks' in template:
                for block in template['blocks']:
                    key = f"{block['pos'][0]}_{block['pos'][1]}"
                    
                    if key not in master_blocks:
                        master_blocks[key] = {'mean': 0, 'std': 0, 'pos': block['pos']}
                        block_counts[key] = 0
                    
                    master_blocks[key]['mean'] += block['mean']
                    master_blocks[key]['std'] += block['std']
                    block_counts[key] += 1
        
        # Average the block statistics
        for key in master_blocks:
            if block_counts[key] > 0:
                master_blocks[key]['mean'] /= block_counts[key]
                master_blocks[key]['std'] /= block_counts[key]
        
        master_template['blocks'] = list(master_blocks.values())
    
    # Calculate a better quality score based on consistency
    master_template['quality_score'] = min(1.0, 0.5 + (len(reliable_minutiae) / 30) * 0.5)
    
    return master_template

def compare_fingerprints(probe, candidate, cached_results=None):
    """Optimized fingerprint comparison focused on most discriminative features"""
    # Check if we have cached results for this comparison
    if cached_results:
        return cached_results
    
    # Initialize scoring components
    minutiae_score = 0.0
    descriptors_score = 0.0
    hash_score = 0.0
    blocks_score = 0.0
    
    # 1. Compare minutiae points (most discriminative feature)
    if 'minutiae' in probe and 'minutiae' in candidate:
        probe_minutiae = probe['minutiae']
        candidate_minutiae = candidate['minutiae']
        
        if probe_minutiae and candidate_minutiae:
            # Count matched minutiae using spatial proximity
            matched_count = 0
            DISTANCE_THRESHOLD = 15  # Increased tolerance for better matching
            
            for p_minutia in probe_minutiae:
                best_distance = float('inf')
                for c_minutia in candidate_minutiae:
                    if p_minutia['type'] == c_minutia['type']:
                        dist = np.sqrt((p_minutia['x'] - c_minutia['x'])**2 + 
                                      (p_minutia['y'] - c_minutia['y'])**2)
                        if dist < best_distance:
                            best_distance = dist
                
                if best_distance <= DISTANCE_THRESHOLD:
                    matched_count += 1
            
            # Calculate similarity based on matched percentage
            if len(probe_minutiae) > 0 and len(candidate_minutiae) > 0:
                match_percent = matched_count / min(len(probe_minutiae), len(candidate_minutiae))
                minutiae_score = match_percent
    
    # Early rejection for obviously different fingerprints
    if minutiae_score < 0.1:
        return {
            'score': minutiae_score * 0.5,
            'confidence': 'very low',
            'components': {'minutiae': minutiae_score}
        }
    
    # 2. Compare hash codes (quick global check)
    if 'hash' in probe and 'hash' in candidate:
        probe_hash = probe['hash']
        candidate_hash = candidate['hash']
        
        if probe_hash and candidate_hash and len(probe_hash) == len(candidate_hash):
            # Calculate Hamming distance
            hamming_distance = sum(p != c for p, c in zip(probe_hash, candidate_hash))
            hash_score = 1.0 - (hamming_distance / len(probe_hash))
    
    # 3. Compare descriptors if hash is promising
    if hash_score >= 0.3 and 'descriptors' in probe and 'descriptors' in candidate:
        probe_descriptors = probe['descriptors']
        candidate_descriptors = candidate['descriptors']
        
        if probe_descriptors and candidate_descriptors:
            # Convert to numpy arrays
            probe_desc = np.array(probe_descriptors, dtype=np.uint8)
            candidate_desc = np.array(candidate_descriptors, dtype=np.uint8)
            
            # Use BFMatcher for descriptor matching
            if len(probe_desc) > 0 and len(candidate_desc) > 0:
                # Create BFMatcher with Hamming distance (binary descriptors)
                bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
                
                # Match descriptors with k=2 for ratio test
                matches = bf.knnMatch(probe_desc, candidate_desc, k=2) if len(candidate_desc) >= 2 else []
                
                # Apply ratio test to filter good matches
                good_matches = []
                for match in matches:
                    if len(match) == 2:
                        m, n = match
                        if m.distance < 0.75 * n.distance:
                            good_matches.append(m)
                    elif len(match) == 1:
                        good_matches.append(match[0])
                
                # Calculate score based on percentage of good matches
                if len(good_matches) > 0:
                    match_percent = len(good_matches) / min(len(probe_desc), len(candidate_desc))
                    descriptors_score = match_percent
    
    # 4. Compare block statistics if minutiae and descriptors are promising
    if minutiae_score >= 0.3 and 'blocks' in probe and 'blocks' in candidate:
        probe_blocks = probe['blocks']
        candidate_blocks = candidate['blocks']
        
        if probe_blocks and candidate_blocks:
            matched_blocks = 0
            total_blocks = min(len(probe_blocks), len(candidate_blocks))
            
            for p_block in probe_blocks:
                p_pos = p_block['pos']
                p_mean = p_block['mean']
                p_std = p_block['std']
                
                for c_block in candidate_blocks:
                    c_pos = c_block['pos']
                    c_mean = c_block['mean']
                    c_std = c_block['std']
                    
                    # Check if block positions are close
                    if abs(p_pos[0] - c_pos[0]) <= 16 and abs(p_pos[1] - c_pos[1]) <= 16:
                        # Compare block statistics
                        mean_diff = abs(p_mean - c_mean)
                        std_diff = abs(p_std - c_std)
                        
                        if mean_diff <= 30 and std_diff <= 20:
                            matched_blocks += 1
                            break
            
            if total_blocks > 0:
                blocks_score = matched_blocks / total_blocks
    
    # Calculate final score with weighted components
    weights = {
        'minutiae': 0.55,  # Most important feature
        'descriptors': 0.25,
        'hash': 0.1,
        'blocks': 0.1
    }
    
    final_score = (
        minutiae_score * weights['minutiae'] +
        descriptors_score * weights['descriptors'] +
        hash_score * weights['hash'] +
        blocks_score * weights['blocks']
    )
    
    # Determine confidence level
    confidence = 'low'
    if final_score >= 0.7:
        confidence = 'high'
    elif final_score >= 0.5:
        confidence = 'medium'
    
    # Cache the result for future use
    result = {
        'score': min(1.0, max(0.0, final_score)),
        'confidence': confidence,
        'components': {
            'minutiae': minutiae_score,
            'descriptors': descriptors_score,
            'hash': hash_score,
            'blocks': blocks_score
        }
    }
    
    return result

def add_to_cache(key, value):
    """Add an item to the LRU cache"""
    # Remove oldest item if cache is full
    if len(template_cache) >= MAX_CACHE_SIZE:
        oldest_key = next(iter(template_cache))
        del template_cache[oldest_key]
    
    template_cache[key] = {
        'value': value,
        'timestamp': time.time()
    }

def get_from_cache(key):
    """Get an item from the LRU cache if it exists and is not expired"""
    if key in template_cache:
        # Update timestamp to mark as recently used
        template_cache[key]['timestamp'] = time.time()
        return template_cache[key]['value']
    
    return None

@app.route('/api/fingerprint/process', methods=['POST'])
def process_fingerprint():
    """Process a single fingerprint scan without enrollment"""
    data = request.json
    if not data or 'fingerPrint' not in data:
        return jsonify({
            'success': False,
            'message': 'Missing fingerprint data'
        }), 400
    
    try:
        # Get fingerprint image data
        fingerprint_data = data['fingerPrint']
        
        # Convert base64 to image
        img = base64_to_image(fingerprint_data)
        
        # Extract features
        result = extract_fingerprint_features(img)
        
        return jsonify({
            'success': True,
            'template': result['template'],
            'original_template': result['original_template'],
            'quality_score': result['quality_score']
        })
        
    except Exception as e:
        print(f"Error processing fingerprint: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Processing error: {str(e)}'
        }), 500

@app.route('/api/fingerprint/process-multiple', methods=['POST'])
def process_multiple_fingerprints():
    """Process multiple fingerprint scans and generate a combined template"""
    data = request.json
    
    if not data or 'fingerprints' not in data or not data['fingerprints']:
        return jsonify({
            'success': False,
            'message': 'Missing fingerprint data'
        }), 400
    
    try:
        fingerprint_list = data['fingerprints']
        staff_id = data.get('staffId')
        email = data.get('email')
        
        if len(fingerprint_list) < 2:
            return jsonify({
                'success': False,
                'message': 'At least 2 fingerprint scans are required'
            }), 400
        
        # Process each fingerprint
        templates = []
        saved_files = []
        
        for i, fingerprint_data in enumerate(fingerprint_list):
            # Convert base64 to image
            img = base64_to_image(fingerprint_data)
            
            # Extract features
            result = extract_fingerprint_features(img)
            
            # Save image to file system if staff_id is provided
            if staff_id:
                filepath = save_fingerprint_image(staff_id, fingerprint_data, i, email)
                saved_files.append(filepath)
            
            templates.append(result['template'])
        
        # Combine templates into a master template
        master_template = combine_templates(templates)
        
        # Return combined template and saved file paths
        return jsonify({
            'success': True,
            'template': master_template,
            'original_template': templates[0], # Use first template as original
            'quality_score': master_template.get('quality_score', 0.7),
            'saved_files': saved_files if staff_id else []
        })
        
    except Exception as e:
        print(f"Error processing multiple fingerprints: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Processing error: {str(e)}'
        }), 500

@app.route('/api/fingerprint/enroll', methods=['POST'])
def enroll_fingerprint():
    """Enroll fingerprint using multiple scans"""
    data = request.json
    
    if not data or 'staffId' not in data:
        return jsonify({
            'success': False,
            'message': 'Missing staff ID'
        }), 400
    
    if 'fingerprints' not in data or not data['fingerprints']:
        return jsonify({
            'success': False,
            'message': 'Missing fingerprint scans'
        }), 400
    
    staff_id = data['staffId']
    email = data.get('email')
    fingerprint_list = data['fingerprints']
    
    try:
        # Check if staff ID already exists in fingerprint collection
        existing_record = fingerprint_collection.find_one({"staffId": ObjectId(staff_id)})
        
        # Process fingerprints and create master template
        templates = []
        saved_files = []
        
        for i, fingerprint_data in enumerate(fingerprint_list):
            # Convert base64 to image
            img = base64_to_image(fingerprint_data)
            
            # Extract features
            result = extract_fingerprint_features(img)
            
            # Save image to file system
            filepath = save_fingerprint_image(staff_id, fingerprint_data, i, email)
            saved_files.append(filepath)
            
            templates.append(result['template'])
        
        # Combine templates into a master template
        master_template = combine_templates(templates)
        
        # Prepare database record
        fingerprint_record = {
            "staffId": ObjectId(staff_id),
            "template": master_template,
            "original_template": templates[0],  # Use first template as original
            "quality_score": master_template.get('quality_score', 0.7),
            "file_paths": saved_files,
            "scan_count": len(fingerprint_list),
            "updated_at": datetime.datetime.now()
        }
        
        if email:
            fingerprint_record["email"] = email
        
        if existing_record:
            # Update existing record
            fingerprint_collection.update_one(
                {"staffId": ObjectId(staff_id)},
                {"$set": fingerprint_record}
            )
            message = "Fingerprint updated successfully!"
        else:
            # Create new record
            fingerprint_record["enrolled_at"] = datetime.datetime.now()
            fingerprint_collection.insert_one(fingerprint_record)
            message = "Fingerprint enrolled successfully!"
        
        # Add to cache for faster retrieval
        add_to_cache(str(staff_id), master_template)
        
        return jsonify({
            'success': True,
            'message': message,
            'quality_score': master_template.get('quality_score', 0.7),
            'file_paths': saved_files
        })
        
    except Exception as e:
        print(f"Error enrolling fingerprint: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Enrollment error: {str(e)}'
        }), 500

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
    """Match fingerprint against provided templates or database"""
    data = request.json
    
    if not data or 'fingerPrint' not in data:
        return jsonify({
            'success': False,
            'message': 'Missing fingerprint data'
        }), 400
    
    try:
        # Convert base64 to image
        img = base64_to_image(data['fingerPrint'])
        
        # Extract features from probe fingerprint
        result = extract_fingerprint_features(img)
        probe_template = result['template']
        
        # Initialize best match
        best_match = {"staffId": None, "score": 0, "confidence": "low"}
        MATCH_THRESHOLD = 0.45  # Lower threshold for better recall
        
        # Process based on provided templates or database lookup
        if 'templates' in data and data['templates']:
            # Match against provided templates
            templates = data['templates']
            
            for template_data in templates:
                staff_id = template_data.get('staffId')
                template = template_data.get('template')
                
                if staff_id and template:
                    # Check cache first
                    cache_key = f"{staff_id}_{hash(str(probe_template))}"
                    cached_result = get_from_cache(cache_key)
                    
                    # Perform comparison if not in cache
                    match_result = compare_fingerprints(probe_template, template, cached_result)
                    
                    # Cache the result
                    if not cached_result:
                        add_to_cache(cache_key, match_result)
                    
                    score = match_result['score']
                    confidence = match_result['confidence']
                    
                    if score > best_match["score"]:
                        best_match["staffId"] = staff_id
                        best_match["score"] = score
                        best_match["confidence"] = confidence
        else:
            # Match against database
            fingerprint_records = list(fingerprint_collection.find())
            
            for record in fingerprint_records:
                if 'template' in record:
                    staff_id = record['staffId']
                    template = record['template']
                    
                    # Check cache first
                    cache_key = f"{staff_id}_{hash(str(probe_template))}"
                    cached_result = get_from_cache(cache_key)
                    
                    # Perform comparison if not in cache
                    match_result = compare_fingerprints(probe_template, template, cached_result)
                    
                    # Cache the result
                    if not cached_result:
                        add_to_cache(cache_key, match_result)
                    
                    score = match_result['score']
                    confidence = match_result['confidence']
                    
                    if score > best_match["score"]:
                        best_match["staffId"] = staff_id
                        best_match["score"] = score
                        best_match["confidence"] = confidence
        
        # Decision based on score threshold
        if best_match["score"] >= MATCH_THRESHOLD:
            return jsonify({
                'success': True,
                'matched': True,
                'staffId': str(best_match["staffId"]),
                'score': best_match["score"],
                'confidence': best_match["confidence"]
            })
        else:
            return jsonify({
                'success': False,
                'matched': False,
                'message': "No matching fingerprint found",
                'bestScore': best_match["score"]
            })
            
    except Exception as e:
        print(f"Error matching fingerprint: {str(e)}")
        return jsonify({
            'success': False,
            'matched': False,
            'message': f'Matching error: {str(e)}'
        }), 500

@app.route('/api/fingerprint/update-templates', methods=['POST'])
def update_all_templates():
    """Update all fingerprint templates in the database using new algorithms"""
    try:
        # Get all fingerprint records
        fingerprint_records = list(fingerprint_collection.find())
        
        updated_count = 0
        error_count = 0
        migrated_count = 0
        
        for record in fingerprint_records:
            try:
                # Check if record has file paths (already migrated to file storage)
                if 'file_paths' in record and record['file_paths']:
                    # Record is already using file storage system
                    # Just update the template using the latest algorithm
                    
                    file_paths = record['file_paths']
                    templates = []
                    
                    for file_path in file_paths:
                        full_path = os.path.join(BASE_ASSET_DIR, file_path)
                        
                        if os.path.exists(full_path):
                            # Read image from file
                            img = cv2.imread(full_path)
                            
                            # Extract features
                            result = extract_fingerprint_features(img)
                            templates.append(result['template'])
                    
                    if templates:
                        # Combine templates
                        master_template = combine_templates(templates)
                        
                        # Update record
                        fingerprint_collection.update_one(
                            {"_id": record["_id"]},
                            {"$set": {
                                "template": master_template,
                                "quality_score": master_template.get('quality_score', 0.7),
                                "updated_at": datetime.datetime.now()
                            }}
                        )
                        
                        updated_count += 1
                        
                elif 'original' in record:
                    # Record uses old storage format (base64 in MongoDB)
                    # Migrate to file storage and update template
                    
                    staff_id = record['staffId']
                    fingerprint_data = record['original']
                    email = record.get('email')
                    
                    # Convert base64 to image
                    img = base64_to_image(fingerprint_data)
                    
                    # Save to file system
                    filepath = save_fingerprint_image(staff_id, fingerprint_data, 0, email)
                    
                    # Extract features
                    result = extract_fingerprint_features(img)
                    
                    # Update record
                    fingerprint_collection.update_one(
                        {"_id": record["_id"]},
                        {"$set": {
                            "template": result['template'],
                            "original_template": result['original_template'],
                            "file_paths": [filepath],
                            "scan_count": 1,
                            "quality_score": result['quality_score'],
                            "updated_at": datetime.datetime.now()
                        },
                        "$unset": {
                            "original": ""  # Remove base64 data
                        }}
                    )
                    
                    migrated_count += 1
                
            except Exception as e:
                print(f"Error updating template for {record['_id']}: {str(e)}")
                error_count += 1
        
        return jsonify({
            'success': True,
            'message': f"Updated {updated_count} templates, migrated {migrated_count} to file storage. {error_count} errors.",
            'updatedCount': updated_count,
            'migratedCount': migrated_count,
            'errorCount': error_count
        })
        
    except Exception as e:
        print(f"Error updating templates: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Template update error: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5500, debug=True)