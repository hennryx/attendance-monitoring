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
import uuid
import hashlib
from functools import lru_cache

# Configure logging with rotating file handler
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('fingerprint_server.log')
    ]
)
logger = logging.getLogger(__name__)

# Use 75% of CPU cores for parallel processing to balance performance and system resources
NUM_CORES = max(1, int(multiprocessing.cpu_count() * 0.75))
logger.info(f"Using {NUM_CORES} CPU cores for processing")

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

# Constants - consolidated in one place for easy tuning
class Config:
    QUALITY_THRESHOLD = 35  # Minimum quality score needed for acceptance
    MATCH_THRESHOLD = 0.45  # Score threshold for fingerprint matching
    MIN_MATCH_COUNT = 4     # Minimum number of feature matches 
    CACHE_SIZE = 100        # LRU cache size for templates
    REQUEST_TIMEOUT = 60    # Default request timeout in seconds
    MAX_TEMPLATE_SIZE = 50  # Maximum number of descriptors to store
    MAX_IMAGE_SIZE = 400    # Maximum image dimension for processing
    DEBUG_MODE = os.environ.get('DEBUG_MODE', 'false').lower() == 'true'

# Create an in-memory cache with LRU policy for fingerprint templates
@lru_cache(maxsize=Config.CACHE_SIZE)
def get_cached_template(template_id):
    """Retrieve a template from cache by ID"""
    return template_cache.get(template_id)

# Template cache as dictionary
template_cache = {}

def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image - optimized and secured"""
    try:
        # Handle different base64 formats
        if isinstance(base64_string, str):
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
            
            # Basic validation to ensure this is base64
            if not all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for c in base64_string):
                logger.warning("Invalid base64 character detected")
                return None
        
        # Convert to bytes and decode
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)  # Direct grayscale conversion
        
        if img is None or img.size == 0:
            logger.warning("Decoded image is empty or invalid")
            return None
            
        return img
    except Exception as e:
        logger.error(f"Error converting base64 to image: {e}")
        return None

def process_fingerprint(image_data):
    """Enhanced fingerprint processing with quality checks"""
    try:
        # Convert base64 to image
        img = base64_to_image(image_data)
        if img is None:
            logger.error("Failed to convert base64 to image")
            return None
        
        # Resize to smaller dimensions for faster processing
        height, width = img.shape
        if width > Config.MAX_IMAGE_SIZE or height > Config.MAX_IMAGE_SIZE:
            scale = min(Config.MAX_IMAGE_SIZE / width, Config.MAX_IMAGE_SIZE / height)
            img = cv2.resize(img, None, fx=scale, fy=scale)
        
        # Enhanced image processing pipeline
        # 1. Normalization
        normalized = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
        
        # 2. Enhance contrast with CLAHE
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(normalized)
        
        # 3. Denoise with Gaussian blur
        denoised = cv2.GaussianBlur(enhanced, (3, 3), 1)
        
        # 4. Binarization using adaptive thresholding
        binary = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY_INV, 11, 2)
        
        # 5. Extract minutiae points from the binary image
        minutiae = []
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Process meaningful contours for minutiae extraction
        for contour in contours[:30]:  # Limit to first 30 contours for speed
            M = cv2.moments(contour)
            if M["m00"] != 0:
                cX = int(M["m10"] / M["m00"])
                cY = int(M["m01"] / M["m00"])
                
                # Calculate contour properties
                area = cv2.contourArea(contour)
                perimeter = cv2.arcLength(contour, True)
                
                # Only include significant minutiae
                if area > 12 and perimeter > 12:
                    minutiae.append({
                        'x': int(cX),
                        'y': int(cY),
                        'type': 'bifurcation' if area/perimeter > 2 else 'ending',
                        'area': float(area),
                        'perimeter': float(perimeter)
                    })
        
        # 6. Extract features using ORB (faster than SIFT/SURF)
        orb = cv2.ORB_create(nfeatures=150)  # Increased for better matching
        keypoints, descriptors = orb.detectAndCompute(enhanced, None)
        
        # Convert keypoints to a serializable format
        keypoints_list = []
        if keypoints:
            for kp in keypoints[:25]:  # Limit to top 25 keypoints
                keypoints_list.append({
                    'x': float(kp.pt[0]),
                    'y': float(kp.pt[1]),
                    'size': float(kp.size),
                    'angle': float(kp.angle) if kp.angle is not None else 0,
                    'response': float(kp.response),
                })
        
        # 7. Calculate image quality metrics
        # Improved quality assessment with multiple factors
        contrast = float(np.std(enhanced))
        feature_count = len(keypoints) if keypoints else 0
        minutiae_count = len(minutiae)
        
        # Combined quality score weighted by importance
        quality_score = min(100, (contrast / 3.0) * 0.4 + 
                           (min(feature_count, 100) / 100) * 0.4 + 
                           (min(minutiae_count, 20) / 20) * 0.2)
        
        # Quality metrics dictionary
        quality = {
            'overall': float(quality_score),
            'contrast': float(contrast),
            'feature_count': int(feature_count),
            'minutiae_count': int(minutiae_count)
        }
        
        # Format descriptors for response
        descriptor_data = []
        if descriptors is not None:
            descriptor_data = descriptors.tolist()
            
            # Limit descriptor count to avoid oversized templates
            if len(descriptor_data) > Config.MAX_TEMPLATE_SIZE:
                descriptor_data = descriptor_data[:Config.MAX_TEMPLATE_SIZE]
        
        # Return template with all features
        return {
            'minutiae': minutiae,
            'keypoints': keypoints_list,
            'descriptors': descriptor_data,
            'quality': quality,
        }
    except Exception as e:
        logger.error(f"Error processing fingerprint: {e}")
        traceback.print_exc()
        return None

@app.route('/api/fingerprint/process-single', methods=['POST'])
def process_single_fingerprint():
    """Process a single fingerprint to create a template - enhanced version"""
    print("----")
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
    
    try:
        logger.info(f"Processing fingerprint for staff ID: {staff_id}")
        features = process_fingerprint(fingerprint)
        
        if not features:
            return jsonify({'success': False, 'message': 'Failed to extract features from fingerprint'}), 500
        
        # Check quality
        quality = features.get('quality', {}).get('overall', 0)
        
        # Create optimized template
        template = {
            'minutiae': features.get('minutiae', [])[:20],  # Limit minutiae points
            'descriptors': features.get('descriptors', [])[:Config.MAX_TEMPLATE_SIZE],
            'keypoints': features.get('keypoints', [])[:20],
            'quality': features.get('quality', {})
        }
        
        # Generate template ID and store in cache
        template_id = f"{staff_id}_{hashlib.md5(str(template).encode()).hexdigest()[:8]}"
        template_cache[template_id] = template
        
        processing_time = time.time() - start_time
        logger.info(f"Processed fingerprint in {processing_time:.3f}s with quality {quality:.1f}")
        
        return jsonify({
            'success': True,
            'template': template,
            'template_id': template_id,
            'quality_score': float(quality),
            'processing_time': float(processing_time)
        })
        
    except Exception as e:
        logger.error(f"Error processing fingerprint: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error processing fingerprint: {str(e)}'}), 500

class EnhancedFingerprintMatcher:
    """Improved fingerprint matcher with multiple matching strategies"""
    
    @staticmethod
    def match_minutiae(probe_minutiae, template_minutiae):
        """Match fingerprints based on minutiae points"""
        if not probe_minutiae or not template_minutiae:
            return 0
        
        match_count = 0
        matched_indices = set()
        
        # Convert to numpy arrays for faster processing
        probe_points = np.array([[m['x'], m['y']] for m in probe_minutiae])
        template_points = np.array([[m['x'], m['y']] for m in template_minutiae])
        
        # Use spatial matching with distance threshold
        for i, p_point in enumerate(probe_points):
            # Calculate Euclidean distances between this point and all template points
            distances = np.sqrt(np.sum((template_points - p_point)**2, axis=1))
            
            if distances.size > 0:
                min_idx = np.argmin(distances)
                min_dist = distances[min_idx]
                
                # Consider a match if distance is below threshold
                if min_dist < 25 and min_idx not in matched_indices:
                    # Check minutiae type if available
                    if (i < len(probe_minutiae) and min_idx < len(template_minutiae) and
                        'type' in probe_minutiae[i] and 'type' in template_minutiae[min_idx]):
                        
                        # If types match, provide higher score
                        if probe_minutiae[i]['type'] == template_minutiae[min_idx]['type']:
                            match_count += 1.2
                        else:
                            match_count += 0.8
                    else:
                        match_count += 1
                        
                    matched_indices.add(min_idx)
        
        # Calculate score based on matches
        total_points = max(len(probe_minutiae), len(template_minutiae))
        if total_points == 0:
            return 0
            
        score = match_count / total_points
        return min(1.0, score)  # Cap at 1.0
    
    @staticmethod
    def match_descriptors(probe_descriptors, template_descriptors):
        """Optimized descriptor matching using Hamming distance"""
        if not probe_descriptors or not template_descriptors:
            return 0
        
        # Convert to numpy arrays if needed
        if isinstance(probe_descriptors, list):
            probe_descriptors = np.array(probe_descriptors, dtype=np.uint8)
        
        if isinstance(template_descriptors, list):
            template_descriptors = np.array(template_descriptors, dtype=np.uint8)
        
        # Ensure arrays have compatible shapes
        min_rows = min(probe_descriptors.shape[0], template_descriptors.shape[0])
        min_cols = min(probe_descriptors.shape[1], template_descriptors.shape[1])
        
        # Use smaller arrays for comparison
        p_desc = probe_descriptors[:min_rows, :min_cols]
        t_desc = template_descriptors[:min_rows, :min_cols]
        
        # Calculate matching using bit-wise operations (Hamming distance)
        bit_diffs = np.bitwise_xor(p_desc, t_desc)
        hamming_distances = np.sum(np.unpackbits(bit_diffs, axis=1), axis=1)
        
        # Find best matches - lowest Hamming distance
        match_count = np.sum(hamming_distances < (min_cols * 8 * 0.25))  # Match if less than 25% bits differ
        
        # Score based on match ratio
        score = match_count / min_rows if min_rows > 0 else 0
        return min(1.0, score * 1.5)  # Scale up but cap at 1.0
    
    @staticmethod
    def match_keypoints(probe_keypoints, template_keypoints):
        """Match based on keypoint locations and attributes"""
        if not probe_keypoints or not template_keypoints:
            return 0
            
        match_count = 0
        matched_indices = set()
        
        # For each probe keypoint, find closest template keypoint
        for i, p_kp in enumerate(probe_keypoints):
            best_match_idx = -1
            best_match_dist = float('inf')
            
            # Find closest keypoint by position and attribute similarity
            for j, t_kp in enumerate(template_keypoints):
                if j in matched_indices:
                    continue
                    
                # Calculate position distance
                pos_dist = np.sqrt((p_kp['x'] - t_kp['x'])**2 + (p_kp['y'] - t_kp['y'])**2)
                
                # Calculate attribute similarity
                size_diff = abs(p_kp['size'] - t_kp['size']) / max(p_kp['size'], t_kp['size'])
                angle_diff = min(abs(p_kp['angle'] - t_kp['angle']), 360 - abs(p_kp['angle'] - t_kp['angle'])) / 180
                
                # Combined distance metric
                combined_dist = pos_dist * 0.6 + size_diff * 0.2 + angle_diff * 0.2
                
                if combined_dist < best_match_dist:
                    best_match_dist = combined_dist
                    best_match_idx = j
            
            # Count as match if distance is below threshold
            if best_match_idx != -1 and best_match_dist < 30:
                match_count += 1
                matched_indices.add(best_match_idx)
        
        # Calculate score
        total_keypoints = max(len(probe_keypoints), len(template_keypoints))
        if total_keypoints == 0:
            return 0
            
        score = match_count / total_keypoints
        return min(1.0, score)
    
    @staticmethod
    def match_combined(probe_features, template_features):
        """Combined matcher using weighted average of multiple strategies"""
        scores = []
        weights = []
        
        # Match minutiae points
        if probe_features.get('minutiae') and template_features.get('minutiae'):
            minutiae_score = EnhancedFingerprintMatcher.match_minutiae(
                probe_features['minutiae'], 
                template_features['minutiae']
            )
            scores.append(minutiae_score)
            weights.append(0.5)  # Minutiae are important
        
        # Match descriptors
        if probe_features.get('descriptors') and template_features.get('descriptors'):
            desc_score = EnhancedFingerprintMatcher.match_descriptors(
                probe_features['descriptors'],
                template_features['descriptors']
            )
            scores.append(desc_score)
            weights.append(0.35)  # Descriptors provide good discrimination
        
        # Match keypoints
        if probe_features.get('keypoints') and template_features.get('keypoints'):
            kp_score = EnhancedFingerprintMatcher.match_keypoints(
                probe_features['keypoints'],
                template_features['keypoints']
            )
            scores.append(kp_score)
            weights.append(0.15)  # Keypoints provide additional context
        
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
    """Match a fingerprint against stored templates - enhanced version"""
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
        if quality < Config.QUALITY_THRESHOLD:
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
        matcher = EnhancedFingerprintMatcher()
        
        logger.info(f"Matching fingerprint against {len(data['templates'])} templates")
        
        for t in data['templates']:
            staff_id = t.get('staffId')
            template = t.get('template', {})
            
            if not staff_id or not template:
                continue
                
            # Check cache for this template
            template_id = t.get('template_id')
            if template_id and template_id in template_cache:
                template = template_cache[template_id]
                
            # Match using enhanced algorithm
            score = matcher.match_combined(features, template)
            
            match_results.append({
                'staffId': staff_id,
                'score': float(score)
            })
        
        # Sort by score
        match_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Determine match
        if match_results and match_results[0]['score'] >= Config.MATCH_THRESHOLD:
            top_match = match_results[0]
            
            # Determine confidence level
            confidence = "low"
            if top_match['score'] >= 0.7:
                confidence = "high"
            elif top_match['score'] >= 0.55:
                confidence = "medium"
            
            processing_time = time.time() - start_time
            logger.info(f"Match found for staffId {top_match['staffId']} with score {top_match['score']:.3f}")
            
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
            logger.info(f"No match found. Best score: {match_results[0]['score'] if match_results else 0:.3f}")
            
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
    """Verify a fingerprint against a specific staff ID - enhanced version"""
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
        if quality < Config.QUALITY_THRESHOLD:
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
                # Check cache first
                template_id = t.get('template_id')
                if template_id and template_id in template_cache:
                    staff_templates.append(template_cache[template_id])
                else:
                    staff_templates.append(t['template'])
                    
                    # Update cache
                    if not template_id:
                        template_id = f"{staff_id}_{uuid.uuid4().hex[:8]}"
                    template_cache[template_id] = t['template']
        
        if not staff_templates:
            return jsonify({
                'success': False,
                'verified': False,
                'message': 'No templates found for this staff ID'
            }), 404
        
        # Match against each template and get best score
        matcher = EnhancedFingerprintMatcher()
        best_score = 0
        
        for template in staff_templates:
            score = matcher.match_combined(features, template)
            best_score = max(best_score, score)
        
        # Determine if verified
        verified = best_score >= Config.MATCH_THRESHOLD
        
        # Determine confidence level
        confidence = "low"
        if best_score >= 0.7:
            confidence = "high"
        elif best_score >= 0.55:
            confidence = "medium"
        
        processing_time = time.time() - start_time
        
        if verified:
            logger.info(f"Fingerprint verified for staffId {staff_id} with score {best_score:.3f}")
        else:
            logger.info(f"Verification failed for staffId {staff_id}. Score: {best_score:.3f}")
        
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
    """Get server status and statistics"""
    return jsonify({
        'status': 'running',
        'version': '4.2',  # Enhanced version
        'uptime': time.time(),
        'cores': NUM_CORES,
        'cached_templates': len(template_cache),
        'quality_threshold': Config.QUALITY_THRESHOLD,
        'match_threshold': Config.MATCH_THRESHOLD,
        'debug_mode': Config.DEBUG_MODE
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({'status': 'ok', 'timestamp': time.time()})

if __name__ == '__main__':
    logger.info(f"Starting enhanced fingerprint server on port 5500 using {NUM_CORES} cores")
    app.run(host='0.0.0.0', port=5500, debug=Config.DEBUG_MODE, threaded=True)