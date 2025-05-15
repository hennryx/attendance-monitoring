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

MAX_TEMPLATE_SIZE = 5000
VERBOSE_LOGGING = False

app = Flask(__name__)
CORS(app)

BASE_ASSET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets'))
FINGERPRINT_DIR = os.path.join(BASE_ASSET_DIR, 'fingerprints')
os.makedirs(FINGERPRINT_DIR, exist_ok=True)

def process_fingerprint_fast(img):
    """Ultra-fast fingerprint preprocessing"""
    start = time.time()
    
    if img.shape[0] > 128 or img.shape[1] > 128:
        img = cv2.resize(img, (128, 128))
    
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
    
    min_val, max_val = np.min(gray), np.max(gray)
    if max_val > min_val:
        enhanced = np.uint8(255 * ((gray - min_val) / (max_val - min_val)))
    else:
        enhanced = gray
    
    _, binary = cv2.threshold(enhanced, 127, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    
    if VERBOSE_LOGGING:
        print(f"Fast preprocessing: {time.time() - start:.3f}s")
    
    return binary

def base64_to_image(base64_string):
    try:
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        img_data = base64.b64decode(base64_string)
        
        img = Image.open(io.BytesIO(img_data))
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        print(f"Error converting base64 to image: {e}")
        raise

def save_fingerprint_image(staff_id, image_data, scan_index=0):
    try:
        user_dir = os.path.join(FINGERPRINT_DIR, str(staff_id))
        os.makedirs(user_dir, exist_ok=True)
        
        timestamp = int(time.time())
        filename = f"fp_{timestamp}_{scan_index}.png"
        filepath = os.path.join(user_dir, filename)
        
        if isinstance(image_data, str) and ',' in image_data:
            image_data = image_data.split(',')[1]
            
            with open(filepath, 'wb') as f:
                f.write(base64.b64decode(image_data))
        elif isinstance(image_data, np.ndarray):
            cv2.imwrite(filepath, image_data)
        
        return os.path.relpath(filepath, BASE_ASSET_DIR)
    except Exception as e:
        print(f"Error saving fingerprint image: {e}")
        return None

def extract_minimal_features(binary_img):
    """Extract only essential features for faster processing"""
    small_img = cv2.resize(binary_img, (16, 16))
    avg = np.mean(small_img)
    img_hash = ''.join(['1' if px > avg else '0' for px in small_img.flatten()])
    
    key_points = []
    h, w = binary_img.shape
    step = 16   
    
    for y in range(0, h, step):
        for x in range(0, w, step):
            if x+step <= w and y+step <= h:
                region = binary_img[y:y+step, x:x+step]
                if np.mean(region) > 127: 
                    key_points.append([x+step//2, y+step//2])
    
    if len(key_points) > 16:
        key_points = key_points[:16]
    
    stats = {
        'mean': float(np.mean(binary_img)),
        'std': float(np.std(binary_img)),
        'size': [binary_img.shape[1], binary_img.shape[0]]
    }
    
    template = {
        'hash': img_hash,
        'key_points': key_points,
        'stats': stats
    }
    
    return template

def combine_templates_simple(templates):
    """Simplified template combination focusing on hash and key points"""
    if not templates or len(templates) == 0:
        return None
    
    master = templates[0].copy()
    
    if len(templates) == 1:
        return master
    
    if all('hash' in t for t in templates):
        hash_length = len(templates[0]['hash'])
        combined_hash = ""
        
        for i in range(hash_length):
            bits = [t['hash'][i] for t in templates]
            ones = bits.count('1')
            zeros = bits.count('0')
            combined_hash += '1' if ones >= zeros else '0'
        
        master['hash'] = combined_hash
    
    all_key_points = []
    for t in templates:
        if 'key_points' in t and t['key_points']:
            all_key_points.extend(t['key_points'][:5]) 
    
    if all_key_points:
        master['key_points'] = all_key_points[:20]
    
    return master

def compare_hashes(hash1, hash2):
    """Compare two hashes using Hamming distance"""
    if len(hash1) != len(hash2):
        return 0.0
    
    diff = sum(h1 != h2 for h1, h2 in zip(hash1, hash2))
    
    return 1.0 - (diff / len(hash1))

@app.route('/api/fingerprint/process-multiple', methods=['POST'])
def process_multiple_fingerprints():
    """Ultra-fast processing of multiple fingerprints"""
    start_time = time.time()
    data = request.json
    
    if not data:
        return jsonify({'success': False, 'message': 'Missing data'}), 400
    
    staff_id = data.get('staffId')
    
    fingerprints = []
    if 'fingerprints' in data and data['fingerprints']:
        fingerprints = data['fingerprints']
    elif 'filePaths' in data and data['filePaths']:
        for filepath in data['filePaths']:
            try:
                img = cv2.imread(filepath)
                if img is not None:
                    _, buffer = cv2.imencode('.png', img)
                    fingerprints.append(base64.b64encode(buffer).decode('utf-8'))
            except Exception as e:
                print(f"Error reading file {filepath}: {e}")
    
    if len(fingerprints) < 2:
        return jsonify({'success': False, 'message': 'At least 2 fingerprints required'}), 400
    
    if len(fingerprints) > 4:
        fingerprints = fingerprints[:4]
    
    templates = []
    saved_files = []
    
    for i, fp_data in enumerate(fingerprints):
        try:
            img = base64_to_image(fp_data)
            
            binary = process_fingerprint_fast(img)
            
            template = extract_minimal_features(binary)
            templates.append(template)
            
            if staff_id:
                filepath = save_fingerprint_image(staff_id, fp_data, i)
                if filepath:
                    saved_files.append(filepath)
        except Exception as e:
            print(f"Error processing fingerprint {i}: {e}")
    
    if not templates:
        return jsonify({'success': False, 'message': 'Failed to process fingerprints'}), 500
    
    combined = combine_templates_simple(templates)
    
    processing_time = time.time() - start_time
    if VERBOSE_LOGGING:
        print(f"Total processing time: {processing_time:.3f}s")
    
    return jsonify({
        'success': True,
        'template': combined,
        'original_template': templates[0],
        'quality_score': 0.8,
        'saved_files': saved_files,
        'processing_time': processing_time
    })

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
    """Fast fingerprint matching"""
    start_time = time.time()
    data = request.json
    
    if not data or 'fingerPrint' not in data:
        return jsonify({'success': False, 'message': 'Missing fingerprint data'}), 400
    
    try:
        img = base64_to_image(data['fingerPrint'])
        binary = process_fingerprint_fast(img)
        probe_template = extract_minimal_features(binary)
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error processing probe: {e}'}), 500
    
    templates = []
    
    if 'templates' in data and data['templates']:
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
    
    best_match = {'staffId': None, 'score': 0}
    
    for staff_id, staff_temps in staff_templates.items():
        best_staff_score = 0
        
        for template in staff_temps:
            if 'hash' in probe_template and 'hash' in template:
                hash_score = compare_hashes(probe_template['hash'], template['hash'])
                
                if hash_score > 0.6:
                    score = hash_score
                else:
                    # Penalty for low hash match
                    score = hash_score * 0.5  
                
                if score > best_staff_score:
                    best_staff_score = score
        
        if best_staff_score > best_match['score']:
            best_match['staffId'] = staff_id
            best_match['score'] = best_staff_score
    
    confidence = "low"
    if best_match['score'] >= 0.75:
        confidence = "high"
    elif best_match['score'] >= 0.65:
        confidence = "medium"
    
    processing_time = time.time() - start_time
    
    #threshold adjust nalang pag di accurate
    if best_match['score'] >= 0.60:
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