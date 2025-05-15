import cv2
import numpy as np
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import io
from PIL import Image
import os
import json
import time

# Maximum template size (bytes) to limit processing time
MAX_TEMPLATE_SIZE = 5000

# Flag to toggle verbose logging
VERBOSE_LOGGING = False

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Base directory for fingerprint images
BASE_ASSET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets'))
FINGERPRINT_DIR = os.path.join(BASE_ASSET_DIR, 'fingerprints')
os.makedirs(FINGERPRINT_DIR, exist_ok=True)

# Lightweight fingerprint preprocessing for speed
def process_fingerprint_fast(img):
    """Ultra-fast fingerprint preprocessing"""
    start = time.time()
    
    # Resize to smaller dimensions for speed (128x128)
    if img.shape[0] > 128 or img.shape[1] > 128:
        img = cv2.resize(img, (128, 128))
    
    # Convert to grayscale if needed
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
    
    # Simple contrast stretching (much faster than CLAHE)
    min_val, max_val = np.min(gray), np.max(gray)
    if max_val > min_val:
        enhanced = np.uint8(255 * ((gray - min_val) / (max_val - min_val)))
    else:
        enhanced = gray
    
    # Simple threshold (faster than adaptive)
    _, binary = cv2.threshold(enhanced, 127, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    
    if VERBOSE_LOGGING:
        print(f"Fast preprocessing: {time.time() - start:.3f}s")
    
    return binary

# Convert base64 to OpenCV image
def base64_to_image(base64_string):
    try:
        # Handle data URL format
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        img_data = base64.b64decode(base64_string)
        
        # Convert to PIL Image then to OpenCV format
        img = Image.open(io.BytesIO(img_data))
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        print(f"Error converting base64 to image: {e}")
        raise

# Save fingerprint image to file system
def save_fingerprint_image(staff_id, image_data, scan_index=0):
    try:
        # Create user directory
        user_dir = os.path.join(FINGERPRINT_DIR, str(staff_id))
        os.makedirs(user_dir, exist_ok=True)
        
        # Create filename
        timestamp = int(time.time())
        filename = f"fp_{timestamp}_{scan_index}.png"
        filepath = os.path.join(user_dir, filename)
        
        # Save image data directly to file
        if isinstance(image_data, str) and ',' in image_data:
            image_data = image_data.split(',')[1]
            
            with open(filepath, 'wb') as f:
                f.write(base64.b64decode(image_data))
        elif isinstance(image_data, np.ndarray):
            # Save OpenCV image
            cv2.imwrite(filepath, image_data)
        
        # Return relative path from assets directory
        return os.path.relpath(filepath, BASE_ASSET_DIR)
    except Exception as e:
        print(f"Error saving fingerprint image: {e}")
        return None

# Extract minimal feature set for template
def extract_minimal_features(binary_img):
    """Extract only essential features for faster processing"""
    # 1. Calculate a simple perceptual hash
    small_img = cv2.resize(binary_img, (16, 16))
    avg = np.mean(small_img)
    img_hash = ''.join(['1' if px > avg else '0' for px in small_img.flatten()])
    
    # 2. Get a few key points for rough alignment
    key_points = []
    h, w = binary_img.shape
    step = 16  # Sample every 16 pixels
    
    for y in range(0, h, step):
        for x in range(0, w, step):
            if x+step <= w and y+step <= h:
                region = binary_img[y:y+step, x:x+step]
                if np.mean(region) > 127:  # If region is mostly white
                    key_points.append([x+step//2, y+step//2])
    
    # Limit key points to 16 maximum
    if len(key_points) > 16:
        key_points = key_points[:16]
    
    # 3. Get overall image stats
    stats = {
        'mean': float(np.mean(binary_img)),
        'std': float(np.std(binary_img)),
        'size': [binary_img.shape[1], binary_img.shape[0]]
    }
    
    # Combined template
    template = {
        'hash': img_hash,
        'key_points': key_points,
        'stats': stats
    }
    
    return template

# Combine multiple templates into one
def combine_templates_simple(templates):
    """Simplified template combination focusing on hash and key points"""
    if not templates or len(templates) == 0:
        return None
    
    # Start with the first template
    master = templates[0].copy()
    
    # If only one template, just return it
    if len(templates) == 1:
        return master
    
    # For multiple templates, combine hashes by frequency (most common bit wins)
    if all('hash' in t for t in templates):
        hash_length = len(templates[0]['hash'])
        combined_hash = ""
        
        for i in range(hash_length):
            bits = [t['hash'][i] for t in templates]
            # Count 1s and 0s
            ones = bits.count('1')
            zeros = bits.count('0')
            # Choose most common
            combined_hash += '1' if ones >= zeros else '0'
        
        master['hash'] = combined_hash
    
    # Combine key points by taking a selection from each template
    all_key_points = []
    for t in templates:
        if 'key_points' in t and t['key_points']:
            all_key_points.extend(t['key_points'][:5])  # Take first 5 points from each
    
    # If we have key points, limit to 20 total
    if all_key_points:
        master['key_points'] = all_key_points[:20]
    
    # Done
    return master

# Fast hash comparison for matching
def compare_hashes(hash1, hash2):
    """Compare two hashes using Hamming distance"""
    if len(hash1) != len(hash2):
        return 0.0
    
    # Calculate bit differences
    diff = sum(h1 != h2 for h1, h2 in zip(hash1, hash2))
    
    # Convert to similarity score (0-1)
    return 1.0 - (diff / len(hash1))

@app.route('/api/fingerprint/process-multiple', methods=['POST'])
def process_multiple_fingerprints():
    """Ultra-fast processing of multiple fingerprints"""
    start_time = time.time()
    data = request.json
    
    # Validate input
    if not data:
        return jsonify({'success': False, 'message': 'Missing data'}), 400
    
    staff_id = data.get('staffId')
    
    # Get fingerprint data
    fingerprints = []
    if 'fingerprints' in data and data['fingerprints']:
        fingerprints = data['fingerprints']
    elif 'filePaths' in data and data['filePaths']:
        # Load images from file paths
        for filepath in data['filePaths']:
            try:
                img = cv2.imread(filepath)
                if img is not None:
                    # Convert to base64 for consistency
                    _, buffer = cv2.imencode('.png', img)
                    fingerprints.append(base64.b64encode(buffer).decode('utf-8'))
            except Exception as e:
                print(f"Error reading file {filepath}: {e}")
    
    if len(fingerprints) < 2:
        return jsonify({'success': False, 'message': 'At least 2 fingerprints required'}), 400
    
    # Process only the first 4 fingerprints for speed
    if len(fingerprints) > 4:
        fingerprints = fingerprints[:4]
    
    # Process each fingerprint
    templates = []
    saved_files = []
    
    for i, fp_data in enumerate(fingerprints):
        try:
            # Convert to image
            img = base64_to_image(fp_data)
            
            # Fast preprocessing
            binary = process_fingerprint_fast(img)
            
            # Extract minimal features
            template = extract_minimal_features(binary)
            templates.append(template)
            
            # Save image if staff_id provided
            if staff_id:
                filepath = save_fingerprint_image(staff_id, fp_data, i)
                if filepath:
                    saved_files.append(filepath)
        except Exception as e:
            print(f"Error processing fingerprint {i}: {e}")
    
    # Combine templates
    if not templates:
        return jsonify({'success': False, 'message': 'Failed to process fingerprints'}), 500
    
    combined = combine_templates_simple(templates)
    
    # Return result
    processing_time = time.time() - start_time
    if VERBOSE_LOGGING:
        print(f"Total processing time: {processing_time:.3f}s")
    
    return jsonify({
        'success': True,
        'template': combined,
        'original_template': templates[0],
        'quality_score': 0.8,  # Fixed quality score for simplicity
        'saved_files': saved_files,
        'processing_time': processing_time
    })

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
    """Fast fingerprint matching"""
    start_time = time.time()
    data = request.json
    
    # Validate input
    if not data or 'fingerPrint' not in data:
        return jsonify({'success': False, 'message': 'Missing fingerprint data'}), 400
    
    # Process the probe fingerprint
    try:
        img = base64_to_image(data['fingerPrint'])
        binary = process_fingerprint_fast(img)
        probe_template = extract_minimal_features(binary)
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error processing probe: {e}'}), 500
    
    # Get templates to match against
    templates = []
    
    if 'templates' in data and data['templates']:
        # Group templates by staff ID
        staff_templates = {}
        
        for t in data['templates']:
            staff_id = t.get('staffId')
            if not staff_id:
                continue
                
            if staff_id not in staff_templates:
                staff_templates[staff_id] = []
                
            if 'template' in t:
                staff_templates[staff_id].append(t['template'])
    else:
        return jsonify({'success': False, 'message': 'No templates provided'}), 400
    
    # Match against each staff's templates
    best_match = {'staffId': None, 'score': 0}
    
    for staff_id, staff_temps in staff_templates.items():
        best_staff_score = 0
        
        for template in staff_temps:
            # Quick hash comparison
            if 'hash' in probe_template and 'hash' in template:
                hash_score = compare_hashes(probe_template['hash'], template['hash'])
                
                # Only do detailed matching if hash score is promising
                if hash_score > 0.6:
                    # For simplicity, just use the hash score
                    score = hash_score
                else:
                    score = hash_score * 0.5  # Penalty for low hash match
                
                if score > best_staff_score:
                    best_staff_score = score
        
        # Update overall best match
        if best_staff_score > best_match['score']:
            best_match['staffId'] = staff_id
            best_match['score'] = best_staff_score
    
    # Determine confidence level
    confidence = "low"
    if best_match['score'] >= 0.75:
        confidence = "high"
    elif best_match['score'] >= 0.65:
        confidence = "medium"
    
    # Return result
    processing_time = time.time() - start_time
    
    if best_match['score'] >= 0.60:  # Adjusted threshold
        return jsonify({
            'success': True,
            'matched': True,
            'staffId': best_match['staffId'],
            'score': best_match['score'],
            'confidence': confidence,
            'processing_time': processing_time
        })
    else:
        return jsonify({
            'success': False,
            'matched': False,
            'message': 'No matching fingerprint found',
            'bestScore': best_match['score'],
            'processing_time': processing_time
        })

# Server information endpoint
@app.route('/api/status', methods=['GET'])
def server_status():
    return jsonify({
        'status': 'running',
        'version': '2.0-optimized',
        'uptime': time.time()
    })

# Test endpoint for troubleshooting
@app.route('/test', methods=['GET'])
def test():
    return "Fingerprint server is running"

if __name__ == '__main__':
    print("Starting optimized fingerprint server on port 5500")
    app.run(host='0.0.0.0', port=5500, debug=True, use_reloader=False)