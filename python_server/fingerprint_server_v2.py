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
import threading
import multiprocessing
import traceback
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Use half the CPU cores for parallel processing to avoid system slowdown
NUM_CORES = max(1, multiprocessing.cpu_count() // 2)

# Custom JSON encoder to handle NumPy types
class NumpyJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyJSONEncoder, self).default(obj)

app = Flask(__name__)
app.json_encoder = NumpyJSONEncoder
CORS(app)

# Directory for storing fingerprint images
BASE_ASSET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets'))
FINGERPRINT_DIR = os.path.join(BASE_ASSET_DIR, 'fingerprints')
os.makedirs(FINGERPRINT_DIR, exist_ok=True)

# Constants
MIN_MATCH_COUNT = 4  # Reduced for faster matching
MATCH_THRESHOLD = 0.45
QUALITY_THRESHOLD = 35

# Cache for templates
template_cache = {}

def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image - optimized"""
    try:
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)  # Direct grayscale conversion
        
        return img
    except Exception as e:
        logger.error(f"Error converting base64 to image: {e}")
        return None

def process_fingerprint(image_data):
    """Fast fingerprint processing - optimized for speed"""
    try:
        # Convert base64 to image
        img = base64_to_image(image_data)
        if img is None:
            logger.error("Failed to convert base64 to image")
            return None
        
        # Resize to smaller dimensions for faster processing
        height, width = img.shape
        if width > 300 or height > 400:  # Smaller size for faster processing
            scale = min(300 / width, 400 / height)
            img = cv2.resize(img, None, fx=scale, fy=scale)
        
        # Simple enhancement pipeline
        # 1. Normalization
        normalized = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
        
        # 2. Enhance contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(normalized)
        
        # 3. Fast denoise
        denoised = cv2.GaussianBlur(enhanced, (3, 3), 1)
        
        # 4. Binarization - simplified (faster)
        _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # 5. Get simplified minutiae
        minutiae = []
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Limit to first 25 contours for speed
        for contour in contours[:25]:
            M = cv2.moments(contour)
            if M["m00"] != 0:
                cX = int(M["m10"] / M["m00"])
                cY = int(M["m01"] / M["m00"])
                
                # Calculate contour area and perimeter
                area = cv2.contourArea(contour)
                perimeter = cv2.arcLength(contour, True)
                
                # Only add significant minutiae
                if area > 10 and perimeter > 10:
                    minutiae.append({
                        'x': int(cX),
                        'y': int(cY),
                        'type': 'bifurcation' if area/perimeter > 2 else 'ending'
                    })
        
        # 6. Extract ORB features (much faster than SIFT)
        orb = cv2.ORB_create(nfeatures=100)  # Limit to 100 features for speed
        keypoints, descriptors = orb.detectAndCompute(enhanced, None)
        
        # Convert keypoints to dictionary
        keypoints_list = []
        if keypoints:
            for kp in keypoints[:20]:  # Limit to top 20 keypoints
                keypoints_list.append({
                    'x': float(kp.pt[0]),
                    'y': float(kp.pt[1]),
                    'size': float(kp.size),
                    'angle': float(kp.angle) if kp.angle is not None else 0,
                    'response': float(kp.response),
                })
        
        # 7. Calculate image quality
        # Simplified quality assessment based on contrast and feature count
        contrast = float(np.std(enhanced))
        feature_count = len(keypoints) if keypoints else 0
        
        quality_score = min(100, (contrast / 2.5) * 0.7 + (min(feature_count, 50) / 50) * 30)
        
        # Prepare quality metrics
        quality = {
            'overall': float(quality_score),
            'contrast': float(contrast),
            'feature_count': int(feature_count),
        }
        
        # Prepare descriptor data in the right format
        descriptor_data = []
        if descriptors is not None:
            # Convert to regular Python lists for JSON serialization
            descriptor_data = descriptors.tolist()
            
            # Limit to 50 descriptors max to reduce size
            if len(descriptor_data) > 50:
                descriptor_data = descriptor_data[:50]
        
        # Return all features in a dictionary
        return {
            'minutiae': minutiae,
            'keypoints': keypoints_list,
            'descriptors': descriptor_data,
            'quality': quality,
            # Create binary image display for debugging if needed
            # 'binary_image': binary.tolist() if binary is not None else None
        }
    except Exception as e:
        logger.error(f"Error processing fingerprint: {e}")
        traceback.print_exc()
        return None

@app.route('/api/fingerprint/process-single', methods=['POST'])
def process_single_fingerprint():
    """Process a single fingerprint to create a template - optimized version"""
    start_time = time.time()
    data = request.json
    
    if not data:
        return jsonify({'success': False, 'message': 'Missing data'}), 400
    
    staff_id = data.get('staffId')
    fingerprint = data.get('fingerPrint')
    
    if not fingerprint:
        return jsonify({'success': False, 'message': 'Missing fingerprint data'}), 400
    
    if not staff_id:
        return jsonify({'success': False, 'message': 'Missing staff ID'}), 400
    
    # Process the fingerprint
    try:
        logger.info(f"Processing single fingerprint for staff ID: {staff_id}")
        features = process_fingerprint(fingerprint)
        
        if not features:
            return jsonify({'success': False, 'message': 'Failed to extract features from fingerprint'}), 500
        
        # Check quality
        quality = features.get('quality', {}).get('overall', 0)
        
        if quality < QUALITY_THRESHOLD:
            return jsonify({
                'success': False,
                'message': f'Poor quality fingerprint (score: {quality:.1f}). Please try again with better placement.',
                'quality_score': float(quality)
            }), 400
        
        # Create template with reduced size
        template = {
            'minutiae': features.get('minutiae', [])[:15],  # Limit minutiae points
            'descriptors': features.get('descriptors', [])[:30],  # Limit descriptors
            'keypoints': features.get('keypoints', [])[:15],  # Limit keypoints
            'quality': features.get('quality', {})
        }
        
        # Store in cache for faster matching
        template_cache[staff_id] = template
        
        processing_time = time.time() - start_time
        logger.info(f"Processed single fingerprint in {processing_time:.3f}s")
        
        return jsonify({
            'success': True,
            'template': template,
            'quality_score': float(quality),
            'processing_time': float(processing_time)
        })
        
    except Exception as e:
        logger.error(f"Error processing fingerprint: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error processing fingerprint: {str(e)}'}), 500

class SimpleFingerprintMatcher:
    """Fast fingerprint matcher focused on speed"""
    
    @staticmethod
    def match_minutiae(probe_minutiae, template_minutiae):
        """Match fingerprints based on minutiae points - simplified"""
        if not probe_minutiae or not template_minutiae:
            return 0
        
        match_count = 0
        matched_indices = set()
        
        # Convert to numpy arrays for faster processing
        probe_points = np.array([[m['x'], m['y']] for m in probe_minutiae])
        template_points = np.array([[m['x'], m['y']] for m in template_minutiae])
        
        # Simple distance-based matching
        for i, p_point in enumerate(probe_points):
            distances = np.sqrt(np.sum((template_points - p_point)**2, axis=1))
            if distances.size > 0:
                min_idx = np.argmin(distances)
                min_dist = distances[min_idx]
                
                # Consider a match if distance is below threshold
                if min_dist < 20 and min_idx not in matched_indices:
                    match_count += 1
                    matched_indices.add(min_idx)
        
        # Calculate score based on matches
        total_points = max(len(probe_minutiae), len(template_minutiae))
        if total_points == 0:
            return 0
            
        score = match_count / total_points
        return score
    
    @staticmethod
    def match_descriptors(probe_descriptors, template_descriptors):
        """Simplified descriptor matching"""
        if not probe_descriptors or not template_descriptors:
            return 0
        
        # Convert to numpy arrays if needed
        if isinstance(probe_descriptors, list):
            probe_descriptors = np.array(probe_descriptors, dtype=np.uint8)
        
        if isinstance(template_descriptors, list):
            template_descriptors = np.array(template_descriptors, dtype=np.uint8)
        
        # Use simple Hamming distance
        min_rows = min(probe_descriptors.shape[0], template_descriptors.shape[0])
        min_cols = min(probe_descriptors.shape[1], template_descriptors.shape[1])
        
        # Truncate to make arrays same size
        p_desc = probe_descriptors[:min_rows, :min_cols]
        t_desc = template_descriptors[:min_rows, :min_cols]
        
        # Calculate bit-wise differences
        bit_diffs = np.bitwise_xor(p_desc, t_desc)
        bit_matches = np.count_nonzero(bit_diffs == 0)
        total_bits = p_desc.size * 8
        
        # Score based on matching bits
        if total_bits == 0:
            return 0
        
        score = bit_matches / total_bits
        return min(1.0, score * 2)  # Scale up for better matching
    
    @staticmethod
    def match_combined(probe_features, template_features):
        """Fast combined matcher"""
        scores = []
        weights = []
        
        # Match minutiae
        if probe_features.get('minutiae') and template_features.get('minutiae'):
            minutiae_score = SimpleFingerprintMatcher.match_minutiae(
                probe_features['minutiae'], 
                template_features['minutiae']
            )
            scores.append(minutiae_score)
            weights.append(0.6)
        
        # Match descriptors
        if probe_features.get('descriptors') and template_features.get('descriptors'):
            desc_score = SimpleFingerprintMatcher.match_descriptors(
                probe_features['descriptors'],
                template_features['descriptors']
            )
            scores.append(desc_score)
            weights.append(0.4)
        
        # Calculate weighted score
        if not scores:
            return 0
        
        weights_sum = sum(weights)
        if weights_sum == 0:
            return 0
        
        normalized_weights = [w / weights_sum for w in weights]
        combined_score = sum(s * w for s, w in zip(scores, normalized_weights))
        
        return combined_score

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
    """Match a fingerprint against stored templates - optimized for speed"""
    start_time = time.time()
    data = request.json
    
    if not data or 'fingerPrint' not in data:
        return jsonify({'success': False, 'message': 'Missing fingerprint data'}), 400
    
    try:
        # Process the query fingerprint
        features = process_fingerprint(data['fingerPrint'])
        
        if not features:
            return jsonify({
                'success': False,
                'matched': False,
                'message': 'Could not extract features from fingerprint'
            }), 400
        
        # Check quality
        quality = features.get('quality', {}).get('overall', 0)
        if quality < QUALITY_THRESHOLD:
            return jsonify({
                'success': False,
                'matched': False,
                'message': f'Poor quality fingerprint (score: {quality:.1f}). Please try again with better placement.',
                'quality_score': float(quality)
            }), 400
        
        if 'templates' not in data or not data['templates']:
            return jsonify({'success': False, 'message': 'No templates provided'}), 400
            
        # Match against all templates
        match_results = []
        
        for t in data['templates']:
            staff_id = t.get('staffId')
            template = t.get('template', {})
            
            if not staff_id or not template:
                continue
                
            # Check cache first
            if staff_id in template_cache:
                template = template_cache[staff_id]
                
            # Match using simplified algorithm
            score = SimpleFingerprintMatcher.match_combined(features, template)
            
            match_results.append({
                'staffId': staff_id,
                'score': float(score)
            })
        
        # Sort by score
        match_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Determine match
        if match_results and match_results[0]['score'] >= MATCH_THRESHOLD:
            top_match = match_results[0]
            
            # Determine confidence level
            confidence = "low"
            if top_match['score'] >= 0.7:
                confidence = "high"
            elif top_match['score'] >= 0.5:
                confidence = "medium"
            
            processing_time = time.time() - start_time
            
            return jsonify({
                'success': True,
                'matched': True,
                'staffId': top_match['staffId'],
                'score': float(top_match['score']),
                'confidence': confidence,
                'processing_time': float(processing_time)
            })
        else:
            processing_time = time.time() - start_time
            
            return jsonify({
                'success': False,
                'matched': False,
                'message': 'No matching fingerprint found',
                'bestScore': float(match_results[0]['score']) if match_results else 0,
                'processing_time': float(processing_time)
            })
    
    except Exception as e:
        logger.error(f"Error in fingerprint matching: {e}")
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'matched': False,
            'message': f'Error processing fingerprint: {str(e)}',
            'error': str(e)
        }), 500

@app.route('/api/fingerprint/verify', methods=['POST'])
def verify_fingerprint():
    """Verify a fingerprint against a specific staff ID - optimized for speed"""
    start_time = time.time()
    data = request.json
    
    if not data or 'fingerPrint' not in data or 'staffId' not in data:
        return jsonify({
            'success': False, 
            'message': 'Missing fingerprint data or staff ID'
        }), 400
    
    try:
        staff_id = data['staffId']
        
        # Process the fingerprint
        features = process_fingerprint(data['fingerPrint'])
        
        if not features:
            return jsonify({
                'success': False,
                'verified': False,
                'message': 'Could not extract features from fingerprint'
            }), 400
        
        # Check quality
        quality = features.get('quality', {}).get('overall', 0)
        if quality < QUALITY_THRESHOLD:
            return jsonify({
                'success': False,
                'verified': False,
                'message': f'Poor quality fingerprint (score: {quality:.1f}). Please try again with better placement.',
                'quality_score': float(quality)
            }), 400
        
        if 'templates' not in data or not data['templates']:
            return jsonify({'success': False, 'message': 'No templates provided'}), 400
        
        # Find templates for this staff ID
        staff_templates = []
        for t in data['templates']:
            if t.get('staffId') == staff_id and 'template' in t:
                # Check if in cache first
                if staff_id in template_cache:
                    staff_templates.append(template_cache[staff_id])
                else:
                    staff_templates.append(t['template'])
                    template_cache[staff_id] = t['template']  # Add to cache
        
        if not staff_templates:
            return jsonify({
                'success': False,
                'verified': False,
                'message': 'No templates found for this staff ID'
            }), 404
        
        # Match against each template and get best score
        best_score = 0
        for template in staff_templates:
            score = SimpleFingerprintMatcher.match_combined(features, template)
            best_score = max(best_score, score)
        
        # Determine if verified
        verified = best_score >= MATCH_THRESHOLD
        
        # Determine confidence level
        confidence = "low"
        if best_score >= 0.7:
            confidence = "high"
        elif best_score >= 0.5:
            confidence = "medium"
        
        processing_time = time.time() - start_time
        
        return jsonify({
            'success': True,
            'verified': verified,
            'staffId': staff_id,
            'score': float(best_score),
            'confidence': confidence,
            'processing_time': float(processing_time)
        })
    
    except Exception as e:
        logger.error(f"Error in fingerprint verification: {e}")
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'verified': False,
            'message': f'Error processing fingerprint: {str(e)}',
            'error': str(e)
        }), 500

@app.route('/api/status', methods=['GET'])
def server_status():
    return jsonify({
        'status': 'running',
        'version': '4.0',  # Optimized version
        'uptime': time.time(),
        'cores': NUM_CORES,
        'cached_templates': len(template_cache)
    })

if __name__ == '__main__':
    print(f"Starting optimized fingerprint server on port 5500 using {NUM_CORES} cores")
    app.run(host='0.0.0.0', port=5500, debug=False, threaded=True, processes=1)