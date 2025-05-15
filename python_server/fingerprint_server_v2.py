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
from scipy.spatial.distance import hamming, euclidean
from skimage.feature import local_binary_pattern
from skimage.measure import compare_ssim

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
    
    # Enhanced contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)
    
    # Adaptive thresholding for better results in various lighting
    binary = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                  cv2.THRESH_BINARY_INV, 11, 2)
    
    # Add some denoising
    binary = cv2.medianBlur(binary, 3)
    
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

def extract_enhanced_features(binary_img):
    """Extract multiple types of features for robust matching"""
    # Resize for consistency
    normalized_img = cv2.resize(binary_img, (128, 128))
    
    # 1. Improved perceptual hash (64-bit)
    small_img = cv2.resize(normalized_img, (16, 16))
    img_mean = np.mean(small_img)
    img_hash = ''.join(['1' if px > img_mean else '0' for px in small_img.flatten()])
    
    # 2. Region-based hashes (divide image into 9 regions)
    region_hashes = []
    h, w = normalized_img.shape
    step_h, step_w = h // 3, w // 3
    
    for y in range(0, h, step_h):
        for x in range(0, w, step_w):
            if y + step_h <= h and x + step_w <= w:
                region = normalized_img[y:y+step_h, x:x+step_w]
                region_mean = np.mean(region)
                region_hash = ''.join(['1' if px > region_mean else '0' for px in region.flatten()])
                region_hashes.append(region_hash[:16])  # Keep first 16 bits for efficiency
    
    # 3. Key points - find significant points
    key_points = []
    _, thresh = cv2.threshold(normalized_img, 127, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    # Get centers of the top contours by area
    significant_contours = sorted(contours, key=cv2.contourArea, reverse=True)[:20]
    for contour in significant_contours:
        M = cv2.moments(contour)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            key_points.append([cx, cy])
    
    # 4. Local texture patterns for 4 main regions
    texture_features = []
    regions = [
        normalized_img[:h//2, :w//2],           # Top-left
        normalized_img[:h//2, w//2:],           # Top-right
        normalized_img[h//2:, :w//2],           # Bottom-left
        normalized_img[h//2:, w//2:]            # Bottom-right
    ]
    
    for region in regions:
        if region.size > 0:  # Make sure region is not empty
            # Calculate histogram of local binary patterns
            small_region = cv2.resize(region, (32, 32))
            lbp = local_binary_pattern(small_region, 8, 1, method='uniform')
            hist, _ = np.histogram(lbp, bins=10, range=(0, 10), density=True)
            texture_features.extend(hist.tolist())
    
    # 5. Image statistics
    stats = {
        'mean': float(np.mean(normalized_img)),
        'std': float(np.std(normalized_img)),
        'size': [normalized_img.shape[1], normalized_img.shape[0]],
        'white_ratio': float(np.sum(normalized_img > 127) / normalized_img.size),
        'entropy': float(cv2.calcHist([normalized_img], [0], None, [256], [0, 256]).flatten().std())
    }
    
    return {
        'hash': img_hash,
        'region_hashes': region_hashes,
        'key_points': key_points[:10],  # Limit to 10 points
        'texture_features': texture_features,
        'stats': stats
    }

def calculate_similarity(probe_features, template):
    """Calculate similarity score between probe and template"""
    if not probe_features or not template:
        return 0.0
    
    scores = []
    weights = []
    
    # 1. Compare main hash (30% weight)
    if 'hash' in probe_features and 'hash' in template:
        hash_similarity = 1.0 - hamming(
            list(map(int, probe_features['hash'])), 
            list(map(int, template['hash']))
        )
        scores.append(hash_similarity)
        weights.append(0.3)
    
    # 2. Compare region hashes (25% weight)
    if 'region_hashes' in probe_features and 'region_hashes' in template:
        probe_regions = probe_features['region_hashes']
        template_regions = template['region_hashes']
        
        # Match the minimum number of available regions
        region_count = min(len(probe_regions), len(template_regions))
        if region_count > 0:
            region_similarities = []
            for i in range(region_count):
                try:
                    p_region = probe_regions[i]
                    t_region = template_regions[i]
                    if p_region and t_region and len(p_region) == len(t_region):
                        region_sim = 1.0 - hamming(
                            list(map(int, p_region)), 
                            list(map(int, t_region))
                        )
                        region_similarities.append(region_sim)
                except (IndexError, ValueError) as e:
                    continue
                    
            if region_similarities:
                # Average of top 3 region similarities
                top_regions = sorted(region_similarities, reverse=True)[:3]
                region_similarity = sum(top_regions) / len(top_regions)
                scores.append(region_similarity)
                weights.append(0.25)
    
    # 3. Compare key points (20% weight)
    if ('key_points' in probe_features and 'key_points' in template and 
            probe_features['key_points'] and template['key_points']):
        
        probe_points = np.array(probe_features['key_points'])
        template_points = np.array(template['key_points'])
        
        # Simple point matching algorithm
        min_distances = []
        
        for p_point in probe_points:
            distances = [np.linalg.norm(p_point - t_point) for t_point in template_points]
            if distances:
                min_distances.append(min(distances))
        
        if min_distances:
            # Normalize distances (lower is better)
            normalized_distances = [max(0, 1 - (d / 30)) for d in min_distances]  # 30 pixels is max distance
            keypoint_similarity = sum(normalized_distances) / len(normalized_distances)
            scores.append(keypoint_similarity)
            weights.append(0.2)
    
    # 4. Compare texture features (15% weight)
    if ('texture_features' in probe_features and 'texture_features' in template and
            probe_features['texture_features'] and template['texture_features']):
        
        p_texture = np.array(probe_features['texture_features'])
        t_texture = np.array(template['texture_features'])
        
        # Make sure arrays are the same length
        min_length = min(len(p_texture), len(t_texture))
        if min_length > 0:
            # Cosine similarity
            p_norm = np.linalg.norm(p_texture[:min_length])
            t_norm = np.linalg.norm(t_texture[:min_length])
            
            if p_norm > 0 and t_norm > 0:
                texture_similarity = np.dot(p_texture[:min_length], t_texture[:min_length]) / (p_norm * t_norm)
                scores.append(texture_similarity)
                weights.append(0.15)
    
    # 5. Compare statistics (10% weight)
    if 'stats' in probe_features and 'stats' in template:
        p_stats = probe_features['stats']
        t_stats = template['stats']
        
        # Compare only a few key statistics
        stat_diffs = []
        
        if 'mean' in p_stats and 'mean' in t_stats:
            mean_diff = abs(p_stats['mean'] - t_stats['mean']) / 255.0
            stat_diffs.append(1.0 - mean_diff)
            
        if 'white_ratio' in p_stats and 'white_ratio' in t_stats:
            ratio_diff = abs(p_stats['white_ratio'] - t_stats['white_ratio'])
            stat_diffs.append(1.0 - ratio_diff)
        
        if stat_diffs:
            stat_similarity = sum(stat_diffs) / len(stat_diffs)
            scores.append(stat_similarity)
            weights.append(0.1)
    
    # Calculate weighted average
    if scores and weights:
        total_weight = sum(weights)
        if total_weight > 0:
            weighted_score = sum(s * w for s, w in zip(scores, weights)) / total_weight
            return weighted_score
    
    return 0.0

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
    
    # Combine region hashes if present
    if all('region_hashes' in t for t in templates):
        region_count = min(len(t['region_hashes']) for t in templates)
        combined_regions = []
        
        for i in range(region_count):
            region_bits = [t['region_hashes'][i] for t in templates]
            region_length = min(len(r) for r in region_bits)
            
            combined_region = ""
            for j in range(region_length):
                bits = [r[j] for r in region_bits]
                ones = bits.count('1')
                zeros = bits.count('0')
                combined_region += '1' if ones >= zeros else '0'
                
            combined_regions.append(combined_region)
            
        master['region_hashes'] = combined_regions
    
    # Collect all key points
    all_key_points = []
    for t in templates:
        if 'key_points' in t and t['key_points']:
            all_key_points.extend(t['key_points'][:5])
    
    if all_key_points:
        # Instead of simply keeping all points, cluster similar ones
        master['key_points'] = cluster_keypoints(all_key_points, 15)[:20]
    
    # Average texture features
    if all('texture_features' in t for t in templates):
        feature_length = min(len(t['texture_features']) for t in templates)
        
        if feature_length > 0:
            averaged_features = []
            
            for i in range(feature_length):
                values = [t['texture_features'][i] for t in templates]
                averaged_features.append(sum(values) / len(values))
                
            master['texture_features'] = averaged_features
    
    # Average statistics
    if all('stats' in t for t in templates):
        combined_stats = {}
        
        for key in ['mean', 'std', 'white_ratio', 'entropy']:
            if all(key in t['stats'] for t in templates):
                values = [t['stats'][key] for t in templates]
                combined_stats[key] = sum(values) / len(values)
        
        if 'size' in templates[0]['stats']:
            combined_stats['size'] = templates[0]['stats']['size']
            
        master['stats'] = combined_stats
    
    return master

def cluster_keypoints(keypoints, threshold=15):
    """Group similar keypoints and return cluster centers"""
    if not keypoints or len(keypoints) <= 1:
        return keypoints
    
    # Convert to numpy array for easier computation
    points = np.array(keypoints)
    
    clusters = []
    assigned = np.zeros(len(points), dtype=bool)
    
    for i in range(len(points)):
        if assigned[i]:
            continue
            
        cluster = [points[i]]
        assigned[i] = True
        
        for j in range(i+1, len(points)):
            if not assigned[j]:
                distance = np.linalg.norm(points[i] - points[j])
                if distance < threshold:
                    cluster.append(points[j])
                    assigned[j] = True
        
        # Add cluster center (average of points in cluster)
        if cluster:
            cluster_center = np.mean(cluster, axis=0).astype(int).tolist()
            clusters.append(cluster_center)
    
    return clusters

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
            
            template = extract_enhanced_features(binary)
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
    """Enhanced fingerprint matching with multi-level verification"""
    start_time = time.time()
    data = request.json
    
    if not data or 'fingerPrint' not in data:
        return jsonify({'success': False, 'message': 'Missing fingerprint data'}), 400
    
    try:
        # Process the probe fingerprint
        img = base64_to_image(data['fingerPrint'])
        binary = process_fingerprint_fast(img)
        
        # Extract multiple feature types for more robust matching
        probe_features = extract_enhanced_features(binary)
        
        if 'templates' not in data or not data['templates']:
            return jsonify({'success': False, 'message': 'No templates provided'}), 400
            
        # Organize templates by staff ID
        staff_templates = {}
        for t in data['templates']:
            staff_id = t.get('staffId')
            if not staff_id:
                continue
            
            if staff_id not in staff_templates:
                staff_templates[staff_id] = []
                
            if 'template' in t:
                staff_templates[staff_id].append(t['template'])
        
        # Multi-level matching results
        match_results = []
        
        # For each staff member, calculate a composite match score
        for staff_id, templates in staff_templates.items():
            best_template_score = 0
            template_scores = []
            
            for template in templates:
                # Calculate multiple similarity scores
                similarity = calculate_similarity(probe_features, template)
                
                if similarity > best_template_score:
                    best_template_score = similarity
                
                template_scores.append(similarity)
            
            # Calculate average and variance of scores for confidence estimation
            avg_score = sum(template_scores) / len(template_scores) if template_scores else 0
            variance = sum((s - avg_score) ** 2 for s in template_scores) / len(template_scores) if len(template_scores) > 1 else 0
            
            match_results.append({
                'staffId': staff_id,
                'score': best_template_score,
                'avgScore': avg_score,
                'variance': variance,
                'templateCount': len(templates)
            })
        
        # Sort results by score
        match_results.sort(key=lambda x: x['score'], reverse=True)
        
        # If we have matches
        if match_results and match_results[0]['score'] >= 0.60:  # Lower threshold for improved recall
            top_match = match_results[0]
            
            # Determine confidence level
            confidence = "low"
            if top_match['score'] >= 0.80:
                confidence = "high"
            elif top_match['score'] >= 0.70:
                confidence = "medium"
            
            # Apply additional checks for increased security
            # If variance is high, reduce confidence
            if top_match['variance'] > 0.1:
                confidence = "low"
            
            # Template count boosts confidence
            if top_match['templateCount'] >= 3 and top_match['score'] >= 0.60:
                confidence = "medium" if confidence == "low" else confidence
            
            processing_time = time.time() - start_time
            
            return jsonify({
                'success': True,
                'matched': True,
                'staffId': top_match['staffId'],
                'score': top_match['score'],
                'confidence': confidence,
                'processing_time': processing_time
            })
        else:
            processing_time = time.time() - start_time
            
            return jsonify({
                'success': False,
                'matched': False,
                'message': 'No matching fingerprint found',
                'bestScore': match_results[0]['score'] if match_results else 0,
                'processing_time': processing_time
            })
    
    except Exception as e:
        print(f"Error in fingerprint matching: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'matched': False,
            'message': f'Error processing fingerprint: {str(e)}',
            'error': str(e)
        }), 500

@app.route('/api/status', methods=['GET'])
def server_status():
    return jsonify({
        'status': 'running',
        'version': '2.0-enhanced',
        'uptime': time.time()
    })

# Test endpoint for troubleshooting
@app.route('/test', methods=['GET'])
def test():
    return "Fingerprint server is running"

if __name__ == '__main__':
    print("Starting enhanced fingerprint server on port 5500")
    app.run(host='0.0.0.0', port=5500, debug=True, use_reloader=False)