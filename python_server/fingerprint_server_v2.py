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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('fingerprint_server.log')
    ]
)
logger = logging.getLogger(__name__)

NUM_CORES = max(1, int(multiprocessing.cpu_count() * 0.75))
logger.info(f"Using {NUM_CORES} CPU cores for processing")

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

class Config:
    # IMPORTANT: Lowered quality threshold to accept more fingerprints
    QUALITY_THRESHOLD = 15  # Reduced from 35 to accept more prints
    
    # IMPORTANT: Lowered match threshold for better acceptance rate
    MATCH_THRESHOLD = 0.35  # Reduced from 0.45 to improve matching
    
    MIN_MATCH_COUNT = 3     # Reduced from 4 to allow matching with fewer features
    CACHE_SIZE = 100        # LRU cache size for templates
    REQUEST_TIMEOUT = 60    # Default request timeout in seconds
    MAX_TEMPLATE_SIZE = 100 # Increased from 50 to store more descriptors
    MAX_IMAGE_SIZE = 500    # Increased from 400 for more detailed processing
    DEBUG_MODE = os.environ.get('DEBUG_MODE', 'false').lower() == 'true'

@lru_cache(maxsize=Config.CACHE_SIZE)
def get_cached_template(template_id):
    """Retrieve a template from cache by ID"""
    return template_cache.get(template_id)

template_cache = {}

def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image - robust version"""
    try:
        if isinstance(base64_string, str):
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
            
            if not all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for c in base64_string):
                logger.warning("Invalid base64 character detected")
                return None
        
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        
        if img is None or img.size == 0:
            color_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if color_img is not None:
                img = cv2.cvtColor(color_img, cv2.COLOR_BGR2GRAY)
        
        if img is None or img.size == 0:
            logger.warning("Decoded image is empty or invalid")
            return None
            
        return img
    except Exception as e:
        logger.error(f"Error converting base64 to image: {e}")
        return None

def enhance_fingerprint_image(img):
    """Enhanced preprocessing specific for the device's fingerprint output"""
    if img is None:
        return None
    
    height, width = img.shape
    if width > Config.MAX_IMAGE_SIZE or height > Config.MAX_IMAGE_SIZE:
        scale = min(Config.MAX_IMAGE_SIZE / width, Config.MAX_IMAGE_SIZE / height)
        img = cv2.resize(img, None, fx=scale, fy=scale)
    
    hist_eq = cv2.equalizeHist(img)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    enhanced = clahe.apply(hist_eq)
    blurred = cv2.GaussianBlur(enhanced, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 19, 2
    )
    kernel = np.ones((3,3), np.uint8)
    morph = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    
    return {
        'original': img,
        'enhanced': enhanced,
        'binary': binary,
        'morph': morph
    }

def process_fingerprint(image_data):
    """Enhanced fingerprint processing with more robust feature extraction"""
    try:
        img = base64_to_image(image_data)
        if img is None:
            logger.error("Failed to convert base64 to image")
            return None
        
        processed = enhance_fingerprint_image(img)
        if processed is None:
            return None
        
        minutiae_points = []
        
        binary = processed['binary']
        morph = processed['morph']
        
        contours, _ = cv2.findContours(
            morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours[:50]:  
            if len(contour) > 3:  
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    cX = int(M["m10"] / M["m00"])
                    cY = int(M["m01"] / M["m00"])
                    
                    area = cv2.contourArea(contour)
                    perimeter = cv2.arcLength(contour, True)
                    
                    if area > 8: 
                        minutiae_points.append({
                            'x': cX,
                            'y': cY,
                            'type': 'bifurcation' if area/perimeter > 1.5 else 'ending',
                            'area': float(area)
                        })
        
        contours, _ = cv2.findContours(
            processed['binary'], 
            cv2.RETR_EXTERNAL, 
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        for contour in contours:
            if len(contour) > 5: 
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    cX = int(M["m10"] / M["m00"])
                    cY = int(M["m01"] / M["m00"])
                    area = cv2.contourArea(contour)
                    
                    if area > 10:
                        minutiae_points.append({
                            'x': cX,
                            'y': cY,
                            'type': 'contour',
                            'area': float(area)
                        })
        
        filtered_minutiae = []
        used_positions = set()
        
        for m in minutiae_points:
            pos_key = f"{m['x']//5}_{m['y']//5}" 
            if pos_key not in used_positions:
                filtered_minutiae.append(m)
                used_positions.add(pos_key)
        
        if len(filtered_minutiae) > 40:
            filtered_minutiae = filtered_minutiae[:40]
        
        orb = cv2.ORB_create(nfeatures=200, scaleFactor=1.2, WTA_K=3)
        orb_keypoints, orb_descriptors = orb.detectAndCompute(processed['enhanced'], None)
        akaze = cv2.AKAZE_create()
        akaze_keypoints, akaze_descriptors = akaze.detectAndCompute(processed['enhanced'], None)
        
        combined_keypoints = []
        
        if orb_keypoints:
            for kp in orb_keypoints[:30]: 
                combined_keypoints.append({
                    'x': float(kp.pt[0]),
                    'y': float(kp.pt[1]),
                    'size': float(kp.size),
                    'angle': float(kp.angle) if kp.angle is not None else 0,
                    'response': float(kp.response),
                    'detector': 'orb'
                })
        
        if akaze_keypoints:
            for kp in akaze_keypoints[:30]: 
                combined_keypoints.append({
                    'x': float(kp.pt[0]),
                    'y': float(kp.pt[1]),
                    'size': float(kp.size),
                    'angle': float(kp.angle) if kp.angle is not None else 0,
                    'response': float(kp.response),
                    'detector': 'akaze'
                })
        
        orb_desc_list = []
        if orb_descriptors is not None:
            orb_desc_list = orb_descriptors.tolist()
            
        akaze_desc_list = []
        if akaze_descriptors is not None:
            akaze_desc_list = akaze_descriptors.tolist()
        
        contrast = float(np.std(processed['enhanced']))
        feature_count = len(combined_keypoints)
        minutiae_count = len(filtered_minutiae)
        
        quality_score = min(100, (contrast / 2.5) * 0.3 + 
                          (min(feature_count, 100) / 100) * 0.4 + 
                          (min(minutiae_count, 20) / 20) * 0.3)
        
        quality = {
            'overall': float(quality_score),
            'contrast': float(contrast),
            'feature_count': int(feature_count),
            'minutiae_count': int(minutiae_count)
        }
        
        return {
            'minutiae': filtered_minutiae,
            'keypoints': combined_keypoints,
            'orb_descriptors': orb_desc_list[:Config.MAX_TEMPLATE_SIZE],
            'akaze_descriptors': akaze_desc_list[:Config.MAX_TEMPLATE_SIZE],
            'quality': quality,
        }
    except Exception as e:
        logger.error(f"Error processing fingerprint: {e}")
        traceback.print_exc()
        return None

@app.route('/api/fingerprint/process-single', methods=['POST'])
def process_single_fingerprint():
    """Process a single fingerprint to create a template"""
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
        
        quality = features.get('quality', {}).get('overall', 0)
        
        template = {
            'minutiae': features.get('minutiae', [])[:30], 
            'keypoints': features.get('keypoints', [])[:40],
            'orb_descriptors': features.get('orb_descriptors', [])[:Config.MAX_TEMPLATE_SIZE],
            'akaze_descriptors': features.get('akaze_descriptors', [])[:Config.MAX_TEMPLATE_SIZE],
            'quality': features.get('quality', {})
        }
        
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

class ImprovedFingerprintMatcher:
    """Advanced fingerprint matcher with multiple adaptive matching strategies"""
    
    @staticmethod
    def match_minutiae(probe_minutiae, template_minutiae):
        """Improved minutiae matching with spatial bucketing"""
        if not probe_minutiae or not template_minutiae:
            return 0
        
        DISTANCE_THRESHOLD = 30 
        
        bucket_size = 50  
        template_buckets = {}
        
        for i, m in enumerate(template_minutiae):
            bucket_x = m['x'] // bucket_size
            bucket_y = m['y'] // bucket_size
            bucket_key = f"{bucket_x}_{bucket_y}"
            
            if bucket_key not in template_buckets:
                template_buckets[bucket_key] = []
            
            template_buckets[bucket_key].append((i, m))
        
        match_count = 0
        matched_indices = set()
        
        for i, p_minutia in enumerate(probe_minutiae):
            p_bucket_x = p_minutia['x'] // bucket_size
            p_bucket_y = p_minutia['y'] // bucket_size
            
            candidates = []
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    bucket_key = f"{p_bucket_x + dx}_{p_bucket_y + dy}"
                    if bucket_key in template_buckets:
                        candidates.extend(template_buckets[bucket_key])
            
            best_match_idx = -1
            best_match_dist = float('inf')
            
            for t_idx, t_minutia in candidates:
                if t_idx in matched_indices:
                    continue
                
                dist = np.sqrt((p_minutia['x'] - t_minutia['x'])**2 + 
                               (p_minutia['y'] - t_minutia['y'])**2)
                
                if dist < best_match_dist and dist < DISTANCE_THRESHOLD:
                    best_match_dist = dist
                    best_match_idx = t_idx
            
            if best_match_idx >= 0:
                match_score = 1.0
                
                if ('type' in p_minutia and 
                    'type' in template_minutiae[best_match_idx]):
                    
                    if p_minutia['type'] == template_minutiae[best_match_idx]['type']:
                        match_score = 1.2
                
                match_count += match_score
                matched_indices.add(best_match_idx)
        
        total_points = max(len(probe_minutiae), len(template_minutiae))
        if total_points == 0:
            return 0
            
        score = match_count / total_points
        return min(1.0, score)  
    
    @staticmethod
    def match_descriptors(probe_orb, template_orb, probe_akaze=None, template_akaze=None):
        """Improved descriptor matching using both ORB and AKAZE features"""
        score = 0
        score_count = 0
        
        if probe_orb and template_orb:
            if isinstance(probe_orb, list):
                probe_orb = np.array(probe_orb, dtype=np.uint8)
            
            if isinstance(template_orb, list):
                template_orb = np.array(template_orb, dtype=np.uint8)
            
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
            
            if len(probe_orb.shape) == 1:
                probe_orb = probe_orb.reshape(1, -1)
            if len(template_orb.shape) == 1:
                template_orb = template_orb.reshape(1, -1)
                
            if probe_orb.shape[0] > 0 and template_orb.shape[0] > 0:
                min_cols = min(probe_orb.shape[1], template_orb.shape[1])
                p_orb = probe_orb[:, :min_cols]
                t_orb = template_orb[:, :min_cols]
                matches = bf.match(p_orb, t_orb)
                matches = sorted(matches, key=lambda x: x.distance) 
                good_matches = [m for m in matches if m.distance < 70]  
                orb_score = len(good_matches) / max(len(p_orb), len(t_orb))
                score += orb_score
                score_count += 1
        
        if probe_akaze and template_akaze:
            if isinstance(probe_akaze, list):
                probe_akaze = np.array(probe_akaze, dtype=np.float32)
            
            if isinstance(template_akaze, list):
                template_akaze = np.array(template_akaze, dtype=np.float32)
            
            if len(probe_akaze.shape) == 1:
                probe_akaze = probe_akaze.reshape(1, -1)
            if len(template_akaze.shape) == 1:
                template_akaze = template_akaze.reshape(1, -1)
                
            if probe_akaze.shape[0] > 0 and template_akaze.shape[0] > 0:
                min_cols = min(probe_akaze.shape[1], template_akaze.shape[1])
                p_akaze = probe_akaze[:, :min_cols]
                t_akaze = template_akaze[:, :min_cols]
                bf_akaze = cv2.BFMatcher(cv2.NORM_L2, crossCheck=True) 
                akaze_matches = bf_akaze.match(p_akaze, t_akaze) 
                akaze_matches = sorted(akaze_matches, key=lambda x: x.distance) 
                good_akaze_matches = [m for m in akaze_matches if m.distance < 0.8]
                akaze_score = len(good_akaze_matches) / max(len(p_akaze), len(t_akaze))
                score += akaze_score
                score_count += 1
        
        return (score / score_count) if score_count > 0 else 0
    
    @staticmethod
    def match_keypoints(probe_keypoints, template_keypoints):
        """Match based on keypoint distribution patterns"""
        if not probe_keypoints or not template_keypoints:
            return 0
        
        DISTANCE_THRESHOLD = 35 
        
        p_by_detector = {}
        t_by_detector = {}
        
        for kp in probe_keypoints:
            detector = kp.get('detector', 'unknown')
            if detector not in p_by_detector:
                p_by_detector[detector] = []
            p_by_detector[detector].append(kp)
            
        for kp in template_keypoints:
            detector = kp.get('detector', 'unknown')
            if detector not in t_by_detector:
                t_by_detector[detector] = []
            t_by_detector[detector].append(kp)
        
        scores = []
        
        for detector in set(list(p_by_detector.keys()) + list(t_by_detector.keys())):
            p_kps = p_by_detector.get(detector, [])
            t_kps = t_by_detector.get(detector, [])
            
            if not p_kps or not t_kps:
                continue
            
            match_count = 0
            matched_indices = set()
            
            for i, p_kp in enumerate(p_kps):
                best_match_idx = -1
                best_match_dist = float('inf')
                
                for j, t_kp in enumerate(t_kps):
                    if j in matched_indices:
                        continue
                    
                    pos_dist = np.sqrt((p_kp['x'] - t_kp['x'])**2 + (p_kp['y'] - t_kp['y'])**2)
                    
                    size_diff = abs(p_kp['size'] - t_kp['size']) / max(p_kp['size'], t_kp['size'])
                    angle_diff = min(abs(p_kp['angle'] - t_kp['angle']), 
                                     360 - abs(p_kp['angle'] - t_kp['angle'])) / 180
                    
                    combined_dist = pos_dist * 0.7 + size_diff * 0.2 + angle_diff * 0.1
                    
                    if combined_dist < best_match_dist:
                        best_match_dist = combined_dist
                        best_match_idx = j
                
                if best_match_idx != -1 and best_match_dist < DISTANCE_THRESHOLD:
                    match_count += 1
                    matched_indices.add(best_match_idx)
            
            detector_score = match_count / max(len(p_kps), len(t_kps))
            scores.append(detector_score)
        
        return sum(scores) / len(scores) if scores else 0
    
    @staticmethod
    def match_combined(probe_features, template_features):
        """Combined matcher with improved weights and partial matching"""
        scores = []
        weights = []
        
        if probe_features.get('minutiae') and template_features.get('minutiae'):
            minutiae_score = ImprovedFingerprintMatcher.match_minutiae(
                probe_features['minutiae'], 
                template_features['minutiae']
            )
            scores.append(minutiae_score)
            weights.append(0.45) 
        
        if ((probe_features.get('orb_descriptors') and template_features.get('orb_descriptors')) or
            (probe_features.get('akaze_descriptors') and template_features.get('akaze_descriptors'))):
            
            desc_score = ImprovedFingerprintMatcher.match_descriptors(
                probe_features.get('orb_descriptors', []),
                template_features.get('orb_descriptors', []),
                probe_features.get('akaze_descriptors', []),
                template_features.get('akaze_descriptors', [])
            )
            scores.append(desc_score)
            weights.append(0.35)
        
        if probe_features.get('keypoints') and template_features.get('keypoints'):
            kp_score = ImprovedFingerprintMatcher.match_keypoints(
                probe_features['keypoints'],
                template_features['keypoints']
            )
            scores.append(kp_score)
            weights.append(0.20)
        
        p_quality = probe_features.get('quality', {}).get('overall', 50)
        t_quality = template_features.get('quality', {}).get('overall', 50)
        
        quality_factor = (p_quality + t_quality) / 200 
        
        if not scores:
            return 0
        
        weights_sum = sum(weights)
        if weights_sum == 0:
            return 0
        
        normalized_weights = [w / weights_sum for w in weights]
        combined_score = sum(s * w for s, w in zip(scores, normalized_weights))
        
        if quality_factor < 0.6: 
            quality_boost = 1 + (0.6 - quality_factor) * 0.5
            combined_score *= quality_boost
        
        return min(1.0, combined_score)

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
    """Match a fingerprint against stored templates - enhanced version"""
    start_time = time.time()
    data = request.json
    
    if not data or 'fingerPrint' not in data:
        return jsonify({'success': False, 'message': 'Missing fingerprint data'}), 400
    
    try:
        features = process_fingerprint(data['fingerPrint'])
        
        if not features:
            return jsonify({
                'success': False,
                'matched': False,
                'message': 'Could not extract features from fingerprint'
            }), 400
        
        # Quality check - with more lenient threshold
        # quality = features.get('quality', {}).get('overall', 0)
        # if quality < Config.QUALITY_THRESHOLD:
        #     return jsonify({
        #         'success': False,
        #         'matched': False,
        #         'message': f'Poor quality fingerprint (score: {quality:.1f}). Please try again with better placement.',
        #         'quality_score': float(quality)
        #     }), 400
        
        if 'templates' not in data or not data['templates']:
            return jsonify({'success': False, 'message': 'No templates provided'}), 400
            
        match_results = []
        matcher = ImprovedFingerprintMatcher()
        
        logger.info(f"Matching fingerprint against {len(data['templates'])} templates")
        
        for t in data['templates']:
            staff_id = t.get('staffId')
            template = t.get('template', {})
            
            if not staff_id or not template:
                continue
                
            template_id = t.get('template_id')
            if template_id and template_id in template_cache:
                template = template_cache[template_id]
                
            score = matcher.match_combined(features, template)
            
            match_results.append({
                'staffId': staff_id,
                'score': float(score),
                'quality': template.get('quality', {}).get('overall', 0)
            })
        
        match_results.sort(key=lambda x: x['score'], reverse=True)
        
        if match_results and match_results[0]['score'] >= Config.MATCH_THRESHOLD:
            top_match = match_results[0]
            
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
        
        features = process_fingerprint(data['fingerPrint'])
        
        if not features:
            return jsonify({
                'success': False,
                'verified': False,
                'message': 'Could not extract features from fingerprint'
            }), 400
        
        quality = features.get('quality', {}).get('overall', 0)
        if quality < (Config.QUALITY_THRESHOLD * 0.8): 
            return jsonify({
                'success': False,
                'verified': False,
                'message': f'Poor quality fingerprint (score: {quality:.1f}). Please try again with better placement.',
                'quality_score': float(quality)
            }), 400
        
        if 'templates' not in data or not data['templates']:
            return jsonify({'success': False, 'message': 'No templates provided'}), 400
        
        staff_templates = []
        for t in data['templates']:
            if t.get('staffId') == staff_id and 'template' in t:
                template_id = t.get('template_id')
                if template_id and template_id in template_cache:
                    staff_templates.append(template_cache[template_id])
                else:
                    staff_templates.append(t['template'])
                    
                    if not template_id:
                        template_id = f"{staff_id}_{uuid.uuid4().hex[:8]}"
                    template_cache[template_id] = t['template']
        
        if not staff_templates:
            return jsonify({
                'success': False,
                'verified': False,
                'message': 'No templates found for this staff ID'
            }), 404
        
        matcher = ImprovedFingerprintMatcher()
        best_score = 0
        
        for template in staff_templates:
            score = matcher.match_combined(features, template)
            best_score = max(best_score, score)
        
        verification_threshold = Config.MATCH_THRESHOLD * 0.9 
        verified = best_score >= verification_threshold
        
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
        'version': '5.0',  
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
    logger.info(f"Starting improved fingerprint server on port 5500 using {NUM_CORES} cores")
    app.run(host='0.0.0.0', port=5500, debug=Config.DEBUG_MODE, threaded=True)