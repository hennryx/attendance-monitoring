from flask import Flask, request, jsonify
import cv2
import numpy as np
import base64
from PIL import Image
import io
import os
import json
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from scipy import ndimage
from scipy import signal

# Check if cv2.ximgproc is available (for thinning)
try:
    from cv2 import ximgproc
except ImportError:
    print("OpenCV ximgproc module not available. Using basic processing instead.")

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# MongoDB connection - same as your original code
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
    
    # Simpler skeletonization approach
    skeleton = cleaned.copy()
    
    # Optional: more advanced skeletonization if needed
    # Using a safer approach without distance transform
    thinned = cv2.ximgproc.thinning(cleaned) if hasattr(cv2, 'ximgproc') else cleaned
    
    return thinned.astype(np.uint8)

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

def extract_fingerprint_features(img):
    """Extract enhanced fingerprint features using NumPy and OpenCV"""
    try:
        # Process image
        processed = preprocess_fingerprint(img)
        
        # For safety, ensure processed image is uint8
        processed = processed.astype(np.uint8)
        
        # Try to calculate orientation field
        try:
            orientation = calculate_orientation_field(processed)
            # Apply Gabor filtering for enhancement if orientation field calculation succeeded
            enhanced = compute_gabor_features(processed, orientation)
        except Exception as e:
            print(f"Orientation or Gabor filtering failed: {str(e)}. Using basic processing.")
            enhanced = processed  # Fallback to basic processing
        
        # Extract keypoints and descriptors using ORB
        orb = cv2.ORB_create(nfeatures=500)
        keypoints, descriptors = orb.detectAndCompute(enhanced, None)
        
        # Generate perceptual hash for quick comparison
        resized = cv2.resize(processed, (16, 16))
        avg_val = np.mean(resized)
        img_hash = ''.join(['1' if pixel > avg_val else '0' for pixel in resized.flatten()])
        
        # Extract block features using NumPy operations
        block_size = 32
        blocks = []
        
        # Use a simpler approach for block extraction that's less likely to fail
        h, w = processed.shape
        for i in range(0, h - block_size + 1, block_size):
            for j in range(0, w - block_size + 1, block_size):
                block = processed[i:i+block_size, j:j+block_size]
                blocks.append(float(np.mean(block)))
        
        # Calculate texture features for global matching
        lbp_features = []
        for y in range(0, h-8, 8):
            for x in range(0, w-8, 8):
                if y+8 <= h and x+8 <= w:  # Check bounds
                    patch = processed[y:y+8, x:x+8]
                    # Simple variance as texture feature
                    lbp_features.append(float(np.var(patch)))
        
        # Compute global image statistics
        hist, _ = np.histogram(processed, bins=8, range=(0, 256))
        if np.sum(hist) > 0:  # Avoid division by zero
            hist = hist / np.sum(hist)  # Normalize
        
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
        
        return {
            'keypoints': serialized_keypoints,
            'descriptors': serialized_descriptors,
            'hash': img_hash,
            'blocks': blocks,
            'histogram': hist.tolist(),
            'lbp_features': lbp_features
        }
    except Exception as e:
        print(f"Feature extraction error: {str(e)}")
        # Fallback to basic features if advanced processing fails
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
        
        return {
            'keypoints': serialized_keypoints,
            'descriptors': serialized_descriptors,
            'hash': '',  # Empty hash
            'blocks': [],
            'histogram': [],
            'lbp_features': []
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
        return hash_similarity * 0.5
    
    # 2. Histogram comparison
    hist_similarity = 0.0
    if 'histogram' in probe and 'histogram' in candidate:
        hist1 = np.array(probe['histogram'])
        hist2 = np.array(candidate['histogram'])
        
        # Intersection method
        intersection = np.sum(np.minimum(hist1, hist2))
        hist_similarity = intersection
        
        # Alternatively, correlation
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
            # Normalize blocks using NumPy
            if np.max(blocks1) > 0:
                blocks1 = blocks1 / np.max(blocks1)
            if np.max(blocks2) > 0:
                blocks2 = blocks2 / np.max(blocks2)
            
            # Calculate correlation using NumPy
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
                
                # Add small epsilon to avoid division by zero
                norm1 = np.linalg.norm(lbp1_truncated)
                norm2 = np.linalg.norm(lbp2_truncated)
                
                if norm1 > 0 and norm2 > 0:
                    cosine_sim = np.dot(lbp1_truncated, lbp2_truncated) / (norm1 * norm2)
                    texture_similarity = max(0, cosine_sim)
    
    # 5. Descriptor matching (keypoint comparison)
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
                
                # Calculate statistical properties of distances using NumPy
                avg_distance = np.mean(distances)
                median_distance = np.median(distances)
                min_distance = np.min(distances)
                
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
        'hash': 0.15,
        'histogram': 0.10,
        'blocks': 0.25,
        'texture': 0.15,
        'descriptors': 0.35
    }
    
    final_score = (
        hash_similarity * weights['hash'] +
        hist_similarity * weights['histogram'] +
        block_similarity * weights['blocks'] +
        texture_similarity * weights['texture'] +
        descriptor_similarity * weights['descriptors']
    )
    
    return min(1.0, max(0.0, final_score))

@app.route('/api/fingerprint/enroll', methods=['POST'])
def enroll_fingerprint():
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
        template = extract_fingerprint_features(img)
        
        # Check if staff ID already exists in the fingerprint collection
        existing_record = fingerprint_collection.find_one({"staffId": staff_id_obj})
        
        if existing_record:
            # Update existing record
            fingerprint_collection.update_one(
                {"staffId": staff_id_obj},
                {"$set": {
                    "template": template,
                    "original": fingerprint_data,
                }}
            )
            message = "Fingerprint updated successfully!"
        else:
            # Create new record
            fingerprint_collection.insert_one({
                "staffId": staff_id_obj,
                "template": template,
                "original": fingerprint_data,
            })
            message = "Fingerprint enrolled successfully!"
        
        return jsonify({
            'success': True,
            'message': message
        })
        
    except Exception as e:
        print(f"Error enrolling fingerprint: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Enrollment error: {str(e)}'
        }), 500

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
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
        probe_template = extract_fingerprint_features(img)
        
        # Match against database
        best_match = {"staffId": None, "score": 0}
        MATCH_THRESHOLD = 0.5
        
        # Get all fingerprint records from the database
        fingerprint_records = list(fingerprint_collection.find())
        
        print(f"Comparing against {len(fingerprint_records)} stored fingerprints...")
        
        # Vectorized comparison if possible
        all_scores = []
        all_ids = []
        
        for record in fingerprint_records:
            if 'template' in record:
                staff_id = record['staffId']
                template = record['template']
                
                score = compare_fingerprints(probe_template, template)
                print(f"Score with user {staff_id}: {score}")
                
                all_scores.append(score)
                all_ids.append(staff_id)
                
                if score > best_match["score"]:
                    best_match["staffId"] = staff_id
                    best_match["score"] = score
        
        # Optional: Use NumPy to analyze the score distribution
        if len(all_scores) > 0:
            scores_array = np.array(all_scores)
            print(f"Score statistics - Mean: {np.mean(scores_array)}, Std: {np.std(scores_array)}, Max: {np.max(scores_array)}")
            
            # Adaptive threshold based on score distribution
            if len(scores_array) > 1:
                mean = np.mean(scores_array)
                std_dev = np.std(scores_array)
                if std_dev > 0:
                    z_scores = (scores_array - mean) / std_dev
                    # If highest score is significant outlier, it's likely a match
                    max_z_score = np.max(z_scores)
                    if max_z_score > 2.0:  # More than 2 standard deviations away
                        print(f"Found likely match with z-score: {max_z_score}")
                        # Could adjust threshold based on this information
        
        if best_match["score"] >= MATCH_THRESHOLD:
            print(f"Match found: {best_match['staffId']} with score {best_match['score']}")
            return jsonify({
                'success': True,
                'matched': True,
                'staffId': str(best_match["staffId"]),  # Convert ObjectId to string
                'score': best_match["score"]
            })
        else:
            print(f"No match found. Best score: {best_match['score']}")
            return jsonify({
                'success': False,
                'matched': False,
                'bestScore': best_match["score"]
            })
            
    except Exception as e:
        print(f"Error matching fingerprint: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Matching error: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5500, debug=True)