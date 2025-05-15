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
from scipy import signal

# Try to import ximgproc for thinning
try:
    from cv2 import ximgproc
except ImportError:
    print("OpenCV ximgproc module not available. Using basic processing instead.")

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# MongoDB connection
MONGO_URI = "mongodb+srv://hennryx101:OIXs7TPJhxHX9o8F@cluster0.croadpx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "Cluster0"

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
fingerprint_collection = db["fingerprints"]

def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    img_data = base64.b64decode(base64_string)
    img = Image.open(io.BytesIO(img_data))
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

def preprocess_fingerprint(img):
    """Enhanced fingerprint preprocessing using NumPy operations"""
    # Convert to grayscale if not already
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
    
    # Standardize size
    gray = cv2.resize(gray, (400, 400))
    
    # Apply Gaussian blur to reduce noise
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Enhance contrast using CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blur)
    
    # Normalize the image using NumPy - ensure we get uint8 output
    normalized = cv2.normalize(enhanced, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    
    # Apply binary thresholding
    _, binary = cv2.threshold(normalized, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Improve ridge-valley contrast using morphological operations
    kernel = np.ones((3, 3), np.uint8)
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
    
    # Use advanced skeletonization if available
    try:
        thinned = cv2.ximgproc.thinning(cleaned)
        return thinned.astype(np.uint8)
    except:
        return cleaned.astype(np.uint8)

def calculate_orientation_field(img, block_size=16, smooth_sigma=5):
    """Calculate ridge orientation field using NumPy operations"""
    # Apply Sobel filters to get gradients
    sobelx = cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(img, cv2.CV_64F, 0, 1, ksize=3)
    
    # Calculate gradient square matrices
    gxx = np.square(sobelx)
    gyy = np.square(sobely)
    gxy = sobelx * sobely
    
    # Block processing to estimate local orientation
    shape = img.shape
    orientation = np.zeros(shape)
    
    # Iterate through blocks
    for i in range(0, shape[0] - block_size, block_size):
        for j in range(0, shape[1] - block_size, block_size):
            # Extract block
            gxx_block = gxx[i:i+block_size, j:j+block_size]
            gyy_block = gyy[i:i+block_size, j:j+block_size]
            gxy_block = gxy[i:i+block_size, j:j+block_size]
            
            # Calculate average gradients for the block
            gxx_sum = np.sum(gxx_block)
            gyy_sum = np.sum(gyy_block)
            gxy_sum = np.sum(gxy_block)
            
            # Calculate orientation angle
            angle = 0.5 * np.arctan2(2 * gxy_sum, gxx_sum - gyy_sum) + np.pi/2
            
            # Fill block with orientation value
            orientation[i:i+block_size, j:j+block_size] = angle
    
    # Smooth orientation field with Gaussian filter
    orientation_x = np.cos(2 * orientation)
    orientation_y = np.sin(2 * orientation)
    
    smooth_x = ndimage.gaussian_filter(orientation_x, sigma=smooth_sigma)
    smooth_y = ndimage.gaussian_filter(orientation_y, sigma=smooth_sigma)
    
    smooth_orientation = 0.5 * np.arctan2(smooth_y, smooth_x)
    
    return smooth_orientation

def compute_gabor_features(img, orientation, freq=1/8, sigma_x=4.0, sigma_y=4.0):
    """Apply Gabor filtering based on ridge orientation"""
    height, width = img.shape
    enhanced_img = np.zeros_like(img, dtype=np.float32)
    
    # Create Gabor filter bank
    num_filters = 8
    filters = []
    for i in range(num_filters):
        angle = i * np.pi / num_filters
        gabor_kernel = cv2.getGaborKernel((15, 15), sigma_x, angle, freq, 0.5, 0, ktype=cv2.CV_32F)
        filters.append(gabor_kernel)
    
    # Apply filters based on local orientation
    for i in range(0, height, 16):
        for j in range(0, width, 16):
            block_end_i = min(i + 16, height)
            block_end_j = min(j + 16, width)
            
            if i < height and j < width:
                local_orientation = np.mean(orientation[i:block_end_i, j:block_end_j])
                # Find the closest filter
                filter_idx = int(np.round((local_orientation % np.pi) / (np.pi / num_filters))) % num_filters
                
                # Apply the appropriate filter
                block = img[i:block_end_i, j:block_end_j].astype(np.float32)
                filtered_block = cv2.filter2D(block, cv2.CV_32F, filters[filter_idx])
                enhanced_img[i:block_end_i, j:block_end_j] = filtered_block
    
    # Normalize and convert to uint8 before thresholding
    enhanced_norm = cv2.normalize(enhanced_img, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    
    # Apply thresholding on uint8 image
    _, enhanced_binary = cv2.threshold(enhanced_norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return enhanced_binary

def extract_minutiae(img):
    """Extract minutiae points (ridge endings and bifurcations)"""
    # Ensure binary image
    if len(img.shape) > 2:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    if np.max(img) > 1:
        _, img = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
    
    # Invert if needed (ridges should be white)
    if np.mean(img) > 127:
        img = 255 - img
    
    # Thin the image if not already thinned
    try:
        skeleton = cv2.ximgproc.thinning(img)
    except:
        # Use morphological operations as fallback
        kernel = np.ones((3,3), np.uint8)
        skeleton = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel)
    
    # Find minutiae using crossing number method
    minutiae = []
    h, w = skeleton.shape
    
    # Convert to binary 0/1
    binary = skeleton / 255
    
    # Padding to avoid border issues
    padded = np.pad(binary, ((1, 1), (1, 1)), mode='constant')
    
    # Define 8-neighbors positions (clockwise)
    neighbors = [(0,1), (-1,1), (-1,0), (-1,-1), (0,-1), (1,-1), (1,0), (1,1)]
    
    # Iterate through inner pixels
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

def extract_fingerprint_features(img):
    """Extract enhanced fingerprint features using NumPy and OpenCV"""
    try:
        # Process image
        processed = preprocess_fingerprint(img)
        
        # For safety, ensure processed image is uint8
        processed = processed.astype(np.uint8)
        
        # Try to calculate orientation field and enhance with Gabor filters
        try:
            orientation = calculate_orientation_field(processed)
            enhanced = compute_gabor_features(processed, orientation)
        except Exception as e:
            print(f"Orientation/Gabor enhancement failed: {str(e)}. Using basic processing.")
            enhanced = processed  # Fallback to basic processing
        
        # Extract keypoints and descriptors using ORB
        orb = cv2.ORB_create(nfeatures=500)
        keypoints, descriptors = orb.detectAndCompute(enhanced, None)
        
        # Extract minutiae points
        try:
            minutiae = extract_minutiae(enhanced)
        except Exception as e:
            print(f"Minutiae extraction failed: {str(e)}")
            minutiae = []
        
        # Generate perceptual hash for quick comparison
        resized = cv2.resize(processed, (16, 16))
        avg_val = np.mean(resized)
        img_hash = ''.join(['1' if pixel > avg_val else '0' for pixel in resized.flatten()])
        
        # Extract block features for grid-based matching
        block_size = 32
        blocks = []
        
        h, w = processed.shape
        for i in range(0, h - block_size + 1, block_size):
            for j in range(0, w - block_size + 1, block_size):
                block = processed[i:i+block_size, j:j+block_size]
                blocks.append(float(np.mean(block)))
        
        # Compute global image statistics
        hist, _ = np.histogram(processed, bins=8, range=(0, 256))
        if np.sum(hist) > 0:  # Avoid division by zero
            hist = hist / np.sum(hist)  # Normalize
        
        # Compute LBP-like texture features
        lbp_features = []
        for y in range(0, h-8, 8):
            for x in range(0, w-8, 8):
                if y+8 <= h and x+8 <= w:
                    patch = processed[y:y+8, x:x+8]
                    # Simple variance as texture feature
                    lbp_features.append(float(np.var(patch)))
        
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
        
        # More features generally means better quality (up to a point)
        quality_score = min(1.0, (num_keypoints / 200) * 0.5 + (num_minutiae / 50) * 0.5)
        
        # Return both original and new template formats
        return {
            'template': {
                'keypoints': serialized_keypoints,
                'descriptors': serialized_descriptors,
                'hash': img_hash,
                'blocks': blocks,
                'histogram': hist.tolist(),
                'lbp_features': lbp_features,
                'minutiae': minutiae
            },
            'original_template': {
                'keypoints': serialized_keypoints,
                'descriptors': serialized_descriptors
            },
            'quality_score': float(quality_score)
        }
    except Exception as e:
        print(f"Feature extraction error: {str(e)}")
        # Fallback to basic features
        orb = cv2.ORB_create(nfeatures=500)
        keypoints, descriptors = orb.detectAndCompute(img, None)
        
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
        
        # Return simplified templates with lower quality score
        return {
            'template': {
                'keypoints': serialized_keypoints,
                'descriptors': serialized_descriptors,
                'hash': '',
                'blocks': [],
                'histogram': [],
                'lbp_features': [],
                'minutiae': []
            },
            'original_template': {
                'keypoints': serialized_keypoints,
                'descriptors': serialized_descriptors
            },
            'quality_score': 0.2  # Low score for fallback method
        }

def compare_fingerprints(probe, candidate):
    """Compare two fingerprint templates using multiple metrics"""
    # Calculate overall similarity score using weighted factors
    
    # 1. Hash comparison
    hash_similarity = 0.0
    if 'hash' in probe and 'hash' in candidate:
        hash1 = np.array([int(bit) for bit in probe['hash']])
        hash2 = np.array([int(bit) for bit in candidate['hash']])
        if len(hash1) == len(hash2):
            # Hamming distance (use NumPy for vectorized XOR)
            hash_similarity = 1.0 - np.mean(np.logical_xor(hash1, hash2))
    
    # Early rejection for obvious non-matches
    if hash_similarity < 0.4:
        return {
            'score': hash_similarity * 0.5,
            'confidence': 'low',
            'components': {'hash': hash_similarity}
        }
    
    # 2. Histogram comparison
    hist_similarity = 0.0
    if 'histogram' in probe and 'histogram' in candidate:
        hist1 = np.array(probe['histogram'])
        hist2 = np.array(candidate['histogram'])
        
        # Intersection method
        intersection = np.sum(np.minimum(hist1, hist2))
        hist_similarity = intersection
        
        # Additionally, correlation
        if np.std(hist1) > 0 and np.std(hist2) > 0:
            correlation = np.corrcoef(hist1, hist2)[0, 1]
            if not np.isnan(correlation):
                hist_similarity = max(hist_similarity, correlation)
    
    # 3. Block pattern comparison
    block_similarity = 0.0
    if 'blocks' in probe and 'blocks' in candidate:
        blocks1 = np.array(probe['blocks'])
        blocks2 = np.array(candidate['blocks'])
        
        if len(blocks1) > 0 and len(blocks2) > 0:
            # Normalize blocks
            if np.max(blocks1) > 0:
                blocks1 = blocks1 / np.max(blocks1)
            if np.max(blocks2) > 0:
                blocks2 = blocks2 / np.max(blocks2)
            
            # Calculate correlation
            min_len = min(len(blocks1), len(blocks2))
            if min_len > 0:
                # Truncate to same length
                blocks1_truncated = blocks1[:min_len]
                blocks2_truncated = blocks2[:min_len]
                
                # Calculate correlation
                if np.std(blocks1_truncated) > 0 and np.std(blocks2_truncated) > 0:
                    correlation = np.corrcoef(blocks1_truncated, blocks2_truncated)[0, 1]
                    if not np.isnan(correlation):
                        block_similarity = max(0, correlation)
    
    # 4. LBP texture comparison
    texture_similarity = 0.0
    if 'lbp_features' in probe and 'lbp_features' in candidate:
        lbp1 = np.array(probe['lbp_features'])
        lbp2 = np.array(candidate['lbp_features'])
        
        if len(lbp1) > 0 and len(lbp2) > 0:
            # Normalize
            if np.max(lbp1) > 0:
                lbp1 = lbp1 / np.max(lbp1)
            if np.max(lbp2) > 0:
                lbp2 = lbp2 / np.max(lbp2)
            
            # Use minimum length
            min_len = min(len(lbp1), len(lbp2))
            if min_len > 0:
                # Calculate cosine similarity
                lbp1_truncated = lbp1[:min_len]
                lbp2_truncated = lbp2[:min_len]
                
                # Avoid division by zero
                norm1 = np.linalg.norm(lbp1_truncated)
                norm2 = np.linalg.norm(lbp2_truncated)
                
                if norm1 > 0 and norm2 > 0:
                    cosine_sim = np.dot(lbp1_truncated, lbp2_truncated) / (norm1 * norm2)
                    texture_similarity = max(0, cosine_sim)
    
    # 5. Minutiae comparison
    minutiae_similarity = 0.0
    if 'minutiae' in probe and 'minutiae' in candidate:
        min1 = probe['minutiae']
        min2 = candidate['minutiae']
        
        if min1 and min2:
            # Count matched minutiae using spatial proximity
            matched_count = 0
            tolerance_distance = 10  # Pixel distance for matching
            
            for m1 in min1:
                for m2 in min2:
                    dist = np.sqrt((m1['x'] - m2['x'])**2 + (m1['y'] - m2['y'])**2)
                    if dist <= tolerance_distance and m1['type'] == m2['type']:
                        matched_count += 1
                        break
            
            # Calculate similarity based on ratio of matches
            minutiae_similarity = matched_count / min(len(min1), len(min2)) if min(len(min1), len(min2)) > 0 else 0
    
    # 6. Descriptor matching (keypoint comparison)
    descriptor_similarity = 0.0
    if ('descriptors' in probe and 'descriptors' in candidate and 
            probe['descriptors'] and candidate['descriptors']):
        
        # Convert lists back to numpy arrays
        desc1 = np.array(probe['descriptors'], dtype=np.uint8)
        desc2 = np.array(candidate['descriptors'], dtype=np.uint8)
        
        if desc1.size > 0 and desc2.size > 0:
            # Create BFMatcher with Hamming distance
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
            
            # Match descriptors
            matches = bf.match(desc1, desc2)
            
            if len(matches) > 0:
                # Sort by distance
                matches = sorted(matches, key=lambda x: x.distance)
                
                # Get average distance (lower is better)
                distances = np.array([m.distance for m in matches])
                
                # Calculate statistical properties
                avg_distance = np.mean(distances)
                median_distance = np.median(distances)
                min_distance = np.min(distances) if len(distances) > 0 else 0
                
                # Convert to similarity score (0-1)
                base_similarity = max(0, 1 - (avg_distance / 100))
                
                # Calculate ratio of good matches
                good_match_threshold = 50  # Distance threshold for good matches
                good_matches = np.sum(distances < good_match_threshold)
                match_ratio = len(matches) / min(len(probe['keypoints']), len(candidate['keypoints']))
                good_match_ratio = good_matches / len(matches) if len(matches) > 0 else 0
                
                descriptor_similarity = base_similarity * 0.5 + match_ratio * 0.3 + good_match_ratio * 0.2
    
    # Combine all similarity scores with appropriate weights
    weights = {
        'hash': 0.1,
        'histogram': 0.05,
        'blocks': 0.2,
        'texture': 0.1,
        'minutiae': 0.25,
        'descriptors': 0.3
    }
    
    # Calculate the final score
    final_score = (
        hash_similarity * weights['hash'] +
        hist_similarity * weights['histogram'] +
        block_similarity * weights['blocks'] +
        texture_similarity * weights['texture'] +
        minutiae_similarity * weights['minutiae'] +
        descriptor_similarity * weights['descriptors']
    )
    
    # Determine confidence level
    confidence = 'low'
    if final_score > 0.75:
        confidence = 'high'
    elif final_score > 0.6:
        confidence = 'medium'
    
    # Return score with additional information
    return {
        'score': min(1.0, max(0.0, final_score)),
        'confidence': confidence,
        'components': {
            'hash': hash_similarity,
            'histogram': hist_similarity,
            'blocks': block_similarity,
            'texture': texture_similarity,
            'minutiae': minutiae_similarity,
            'descriptors': descriptor_similarity
        }
    }

@app.route('/api/fingerprint/process', methods=['POST'])
def process_fingerprint():
    """Process fingerprint for templates without storing (used by enrollFingerprint in service)"""
    data = request.json
    if not data or 'fingerPrint' not in data:
        return jsonify({
            'success': False,
            'message': 'Missing fingerPrint data'
        }), 400
    
    try:
        # Get fingerprint image data
        fingerprint_data = data['fingerPrint']
        
        # Convert base64 to image
        img = base64_to_image(fingerprint_data)
        
        # Extract templates
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

@app.route('/api/fingerprint/enroll', methods=['POST'])
def enroll_fingerprint():
    """Enroll fingerprint directly to database (legacy endpoint)"""
    data = request.json
    if not data or 'staffId' not in data or 'fingerPrint' not in data:
        return jsonify({
            'success': False,
            'message': 'Missing staffId or fingerPrint data'
        }), 400
    
    staff_id = data['staffId']
    fingerprint_data = data['fingerPrint']
    
    try:
        # Convert ObjectId string to ObjectId if necessary
        if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
            staff_id_obj = ObjectId(staff_id)
        else:
            staff_id_obj = staff_id
            
        # Convert base64 to image
        img = base64_to_image(fingerprint_data)
        
        # Extract features
        result = extract_fingerprint_features(img)
        template = result['template']
        original_template = result['original_template']
        quality_score = result['quality_score']
        
        # Check if staff ID already exists in the fingerprint collection
        existing_record = fingerprint_collection.find_one({"staffId": staff_id_obj})
        
        if existing_record:
            # Update existing record
            fingerprint_collection.update_one(
                {"staffId": staff_id_obj},
                {"$set": {
                    "template": template,
                    "original_template": original_template,
                    "original": fingerprint_data,
                    "quality_score": quality_score,
                    "updated_at": datetime.datetime.now()
                }}
            )
            message = "Fingerprint updated successfully!"
        else:
            # Create new record
            fingerprint_collection.insert_one({
                "staffId": staff_id_obj,
                "template": template,
                "original_template": original_template,
                "original": fingerprint_data,
                "quality_score": quality_score,
                "enrolled_at": datetime.datetime.now()
            })
            message = "Fingerprint enrolled successfully!"
        
        return jsonify({
            'success': True,
            'message': message,
            'quality_score': quality_score
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
            'message': 'Missing fingerPrint data'
        }), 400
    
    try:
        print("Processing fingerprint for matching...")
        
        # Convert base64 to image
        img = base64_to_image(data['fingerPrint'])
        
        # Extract features
        result = extract_fingerprint_features(img)
        probe_template = result['template']
        
        # Match against provided templates or database
        best_match = {"staffId": None, "score": 0, "confidence": "low"}
        MATCH_THRESHOLD = 0.55  # Slightly higher threshold for better accuracy
        
        # Option 1: Match against provided templates (preferred by fingerprintService)
        if 'templates' in data and data['templates']:
            templates = data['templates']
            print(f"Comparing against {len(templates)} provided templates...")
            
            for template_data in templates:
                staff_id = template_data.get('staffId')
                template = template_data.get('template')
                
                if staff_id and template:
                    match_result = compare_fingerprints(probe_template, template)
                    score = match_result['score']
                    confidence = match_result['confidence']
                    
                    print(f"Score with user {staff_id}: {score} ({confidence} confidence)")
                    
                    if score > best_match["score"]:
                        best_match["staffId"] = staff_id
                        best_match["score"] = score
                        best_match["confidence"] = confidence
        
        # Option 2: Match against database (legacy/fallback)
        else:
            # Get all fingerprint records from the database
            fingerprint_records = list(fingerprint_collection.find())
            print(f"Comparing against {len(fingerprint_records)} stored fingerprints...")
            
            for record in fingerprint_records:
                if 'template' in record:
                    staff_id = record['staffId']
                    template = record['template']
                    
                    match_result = compare_fingerprints(probe_template, template)
                    score = match_result['score']
                    confidence = match_result['confidence']
                    
                    print(f"Score with user {staff_id}: {score} ({confidence} confidence)")
                    
                    if score > best_match["score"]:
                        best_match["staffId"] = staff_id
                        best_match["score"] = score
                        best_match["confidence"] = confidence
        
        # Decision based on score and confidence
        if best_match["score"] >= MATCH_THRESHOLD:
            print(f"Match found: {best_match['staffId']} with score {best_match['score']} ({best_match['confidence']} confidence)")
            return jsonify({
                'success': True,
                'matched': True,
                'staffId': str(best_match["staffId"]),  # Convert ObjectId to string
                'score': best_match["score"],
                'confidence': best_match["confidence"]
            })
        else:
            print(f"No match found. Best score: {best_match['score']}")
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
    """Update all fingerprint templates in the database"""
    try:
        # Get all fingerprint records
        fingerprint_records = list(fingerprint_collection.find())
        
        updated_count = 0
        error_count = 0
        
        for record in fingerprint_records:
            try:
                # Skip records without original fingerprint data
                if 'original' not in record:
                    error_count += 1
                    continue
                
                # Process the fingerprint
                img = base64_to_image(record['original'])
                result = extract_fingerprint_features(img)
                
                # Update the record
                fingerprint_collection.update_one(
                    {"_id": record["_id"]},
                    {"$set": {
                        "template": result['template'],
                        "original_template": result['original_template'],
                        "quality_score": result['quality_score'],
                        "updated_at": datetime.datetime.now()
                    }}
                )
                
                updated_count += 1
                
            except Exception as e:
                print(f"Error updating template for {record['_id']}: {str(e)}")
                error_count += 1
        
        return jsonify({
            'success': True,
            'message': f"Updated {updated_count} fingerprint templates. {error_count} errors.",
            'updatedCount': updated_count,
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