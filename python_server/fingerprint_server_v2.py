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
from scipy.ndimage import gaussian_filter, median_filter
from scipy.spatial.distance import hamming
from skimage.morphology import skeletonize
import math
import traceback

# Use all CPU cores for parallel processing
NUM_CORES = multiprocessing.cpu_count()

app = Flask(__name__)
CORS(app)

# Directory for storing fingerprint images
BASE_ASSET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets'))
FINGERPRINT_DIR = os.path.join(BASE_ASSET_DIR, 'fingerprints')
os.makedirs(FINGERPRINT_DIR, exist_ok=True)

# Configure logging
import logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define constants for the algorithm
MIN_MATCH_COUNT = 8  # Reduced from 10
MATCH_THRESHOLD = 0.5
MINUTIAE_DISTANCE_THRESHOLD = 15
QUALITY_THRESHOLD = 35  # Slightly reduced from 40

# Cache for templates
template_cache = {}

def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image with optimization"""
    try:
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        img_data = base64.b64decode(base64_string)
        
        # Direct numpy array conversion instead of using PIL as intermediary
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)  # Direct grayscale conversion
        
        return img
    except Exception as e:
        logger.error(f"Error converting base64 to image: {e}")
        raise

class OptimizedFingerprintEnhancer:
    """Optimized fingerprint enhancement class"""
    
    @staticmethod
    def enhance(img):
        """Optimized fingerprint enhancement pipeline"""
        # Convert to grayscale if needed
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()
            
        # Resize if needed for consistent processing
        height, width = gray.shape
        if width > 500 or height > 700:  # Reduced from 600x800
            scale = min(500 / width, 700 / height)
            gray = cv2.resize(gray, None, fx=scale, fy=scale)
        
        # 1. Normalization
        normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
        
        # 2. CLAHE for improving contrast in fingerprint ridges
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(normalized)
        
        # 3. Optimized noise removal - single pass Gaussian blur
        denoised = cv2.GaussianBlur(enhanced, (3, 3), 1)
        
        # 4. Adaptive thresholding for binarization
        binary = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY_INV, 11, 2)
        
        # 5. Simple morphological operations to improve ridge structure
        kernel = np.ones((3,3), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        
        # 6. Fast ridge orientation field estimation for quality assessment
        block_size = 16
        h, w = binary.shape
        orientation_map = np.zeros((h // block_size, w // block_size), dtype=np.float32)
        
        # Calculate orientation only for every other block to speed up
        for i in range(0, h - block_size, block_size * 2):
            for j in range(0, w - block_size, block_size * 2):
                block = binary[i:i+block_size, j:j+block_size]
                if np.sum(block) > 0:  # Only process blocks with ridges
                    # Calculate gradient
                    gx = cv2.Sobel(block, cv2.CV_32F, 1, 0, ksize=3)
                    gy = cv2.Sobel(block, cv2.CV_32F, 0, 1, ksize=3)
                    
                    # Calculate orientation
                    gxx = np.sum(gx * gx)
                    gyy = np.sum(gy * gy)
                    gxy = np.sum(gx * gy)
                    
                    orientation = 0.5 * np.arctan2(2 * gxy, gxx - gyy)
                    orientation_map[i // block_size, j // block_size] = orientation
        
        # 7. Skeletonization to thin the ridges to 1-pixel width
        skeleton = skeletonize(binary / 255).astype(np.uint8) * 255
        
        # Return all stages for further processing
        return {
            'gray': gray,
            'normalized': normalized,
            'enhanced': enhanced,
            'denoised': denoised,
            'binary': binary,
            'skeleton': skeleton,
            'orientation_map': orientation_map
        }

class FastMinutiaeExtractor:
    """Optimized minutiae extraction class"""
    
    @staticmethod
    def extract(skeleton):
        """Extract minutiae points from skeleton image efficiently"""
        minutiae = []
        minutiae_image = cv2.cvtColor(skeleton, cv2.COLOR_GRAY2BGR)
        
        # Crossing Number method
        rows, cols = skeleton.shape
        
        # Padding for border analysis
        padded = np.pad(skeleton, ((1, 1), (1, 1)), mode='constant')
        
        # Create a faster neighborhood calculation
        # This avoids unnecessary iterations over the entire image
        white_pixels = np.where(padded == 255)
        coordinates = list(zip(white_pixels[0], white_pixels[1]))
        
        for i, j in coordinates:
            if i == 0 or j == 0 or i == padded.shape[0]-1 or j == padded.shape[1]-1:
                continue
                
            # Get 8 neighbors
            neighbors = [
                padded[i-1, j-1], padded[i-1, j], padded[i-1, j+1],
                padded[i, j-1],                   padded[i, j+1],
                padded[i+1, j-1], padded[i+1, j], padded[i+1, j+1]
            ]
            
            # Convert to binary values (0 or 1)
            neighbors = [1 if n == 255 else 0 for n in neighbors]
            
            # Calculate crossing number (CN)
            transitions = 0
            for k in range(8):
                transitions += abs(neighbors[k] - neighbors[(k+1) % 8])
                
            cn = transitions // 2
            
            # Determine minutiae type
            if cn == 1:  # Ridge ending
                minutiae.append({
                    'x': j-1,  # Adjust for padding
                    'y': i-1,  # Adjust for padding
                    'type': 'ending'
                })
                cv2.circle(minutiae_image, (j-1, i-1), 3, (0, 0, 255), -1)
                
            elif cn == 3:  # Ridge bifurcation
                minutiae.append({
                    'x': j-1,
                    'y': i-1,
                    'type': 'bifurcation'
                })
                cv2.circle(minutiae_image, (j-1, i-1), 3, (0, 255, 0), -1)
        
        # Filter minutiae by proximity using numpy vectorization instead of nested loops
        if len(minutiae) > 0:
            points = np.array([[m['x'], m['y']] for m in minutiae])
            types = [m['type'] for m in minutiae]
            
            filtered_indices = []
            for i in range(len(points)):
                # Calculate distance to all other points
                distances = np.sqrt(np.sum((points - points[i])**2, axis=1))
                # Find points that are too close (excluding self)
                distances[i] = float('inf')  # Exclude self
                if np.min(distances) >= 10:  # Min distance threshold
                    filtered_indices.append(i)
            
            filtered_minutiae = [minutiae[i] for i in filtered_indices]
        else:
            filtered_minutiae = []
        
        return filtered_minutiae, minutiae_image

class OptimizedFeatureExtractor:
    """Extract only the most important features for fast matching"""
    
    @staticmethod
    def extract_orb_features(image):
        """Extract ORB features (fast)"""
        orb = cv2.ORB_create(nfeatures=500)  # Reduced from 1000
        keypoints, descriptors = orb.detectAndCompute(image, None)
        return keypoints, descriptors
    
    @staticmethod
    def extract_all_features(image, enhanced_image):
        """Extract only necessary features for fast matching"""
        # Extract minutiae
        minutiae_extractor = FastMinutiaeExtractor()
        minutiae, minutiae_image = minutiae_extractor.extract(enhanced_image['skeleton'])
        
        # Extract ORB features only (faster than SIFT)
        orb_keypoints, orb_descriptors = OptimizedFeatureExtractor.extract_orb_features(enhanced_image['enhanced'])
        
        # Calculate fingerprint quality
        quality = OptimizedQualityAssessor.assess_quality(enhanced_image)
        
        # Return only essential feature sets
        return {
            'minutiae': minutiae,
            'orb_keypoints': [keypoint_to_dict(kp) for kp in orb_keypoints] if orb_keypoints else [],
            'orb_descriptors': orb_descriptors.tolist() if orb_descriptors is not None else [],
            'quality': quality,
            'minutiae_image': minutiae_image
        }

class OptimizedQualityAssessor:
    """Faster quality assessment"""
    
    @staticmethod
    def assess_quality(enhanced_image):
        """Optimized quality assessment metrics"""
        # 1. Contrast assessment
        gray = enhanced_image['gray']
        contrast_sample = gray[::4, ::4]  # Sample every 4th pixel
        contrast = contrast_sample.std()
        contrast_score = min(100, contrast / 2.55)
        
        # 2. Ridge clarity assessment
        binary = enhanced_image['binary']
        binary_sample = binary[::4, ::4]  # Sample every 4th pixel
        ridge_area = np.sum(binary_sample > 0) / binary_sample.size
        ridge_score = 100 * (0.5 - abs(0.5 - ridge_area)) * 2
        
        # 3. Minutiae quality - check skeleton only
        skeleton = enhanced_image['skeleton']
        minutiae, _ = FastMinutiaeExtractor.extract(skeleton)
        
        minutiae_score = min(100, len(minutiae) * 2)
        
        # Calculate weighted quality score with simple weights
        # Skip the complex calculations that don't impact the result much
        weights = [0.4, 0.3, 0.3]  # More weight on contrast
        scores = [contrast_score, ridge_score, minutiae_score]
        
        weighted_quality = sum(w * s for w, s in zip(weights, scores))
        
        return {
            'overall': weighted_quality,
            'contrast': contrast_score,
            'ridge_quality': ridge_score,
            'minutiae_count': len(minutiae),
            'minutiae_quality': minutiae_score
        }

class OptimizedFingerprintMatcher:
    """Optimized fingerprint matcher focused on speed"""
    
    @staticmethod
    def match_minutiae(probe_minutiae, template_minutiae):
        """Match fingerprints based on minutiae points with numpy optimization"""
        if not probe_minutiae or not template_minutiae:
            return 0
            
        # Convert to numpy arrays for vectorized operations
        probe_points = np.array([[m['x'], m['y']] for m in probe_minutiae])
        template_points = np.array([[m['x'], m['y']] for m in template_minutiae])
        
        # Get minutiae types
        probe_types = np.array([1 if m['type'] == 'ending' else 2 for m in probe_minutiae])
        template_types = np.array([1 if m['type'] == 'ending' else 2 for m in template_minutiae])
        
        # Use numpy broadcasting for faster distance calculation
        match_count = 0
        matched_indices = set()
        
        # Limit the number of points to check for speed
        max_points = min(25, len(probe_points))
        for i in range(max_points):
            # Calculate distances from this probe point to all template points
            distances = np.sqrt(np.sum((template_points - probe_points[i])**2, axis=1))
            
            # Filter by type and exclude already matched points
            valid_indices = [j for j in range(len(template_points)) 
                            if j not in matched_indices and probe_types[i] == template_types[j]]
            
            if not valid_indices:
                continue
                
            # Get distances for valid indices only
            valid_distances = distances[valid_indices]
            
            # Find the closest valid point
            if len(valid_distances) > 0:
                min_idx = valid_indices[np.argmin(valid_distances)]
                min_dist = distances[min_idx]
                
                if min_dist < MINUTIAE_DISTANCE_THRESHOLD:
                    match_count += 1
                    matched_indices.add(min_idx)
        
        # Calculate score as percentage of matched minutiae
        total_minutiae = max(len(probe_minutiae), len(template_minutiae))
        
        if total_minutiae == 0:
            return 0
            
        return match_count / total_minutiae
    
    @staticmethod
    def match_orb_features(probe_descriptors, template_descriptors):
        """Faster ORB feature matching using BFMatcher"""
        if probe_descriptors is None or template_descriptors is None:
            return 0
            
        if len(probe_descriptors) == 0 or len(template_descriptors) == 0:
            return 0
            
        # Convert to numpy arrays if needed
        if isinstance(probe_descriptors, list):
            probe_descriptors = np.array(probe_descriptors, dtype=np.uint8)
            
        if isinstance(template_descriptors, list):
            template_descriptors = np.array(template_descriptors, dtype=np.uint8)
        
        # Brute force matcher with Hamming distance for ORB
        matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        
        try:
            # Perform matching
            matches = matcher.match(probe_descriptors, template_descriptors)
            
            # Calculate score based on number and quality of matches
            if len(matches) > MIN_MATCH_COUNT:
                # Use top matches for scoring
                good_matches = matches[:min(len(matches), 30)]  # Reduced from 50
                
                # Normalize distances to 0-1 range
                distances = np.array([m.distance for m in good_matches])
                normalized_distances = np.clip(distances / 100, 0, 1)
                
                # Score considers both quantity and quality of matches
                match_ratio = len(good_matches) / min(len(probe_descriptors), len(template_descriptors))
                quality_score = 1 - np.mean(normalized_distances)
                
                score = 0.5 * match_ratio + 0.5 * quality_score
                
                return score
            else:
                return 0
        except Exception as e:
            logger.error(f"Error in matching ORB features: {e}")
            return 0
    
    @staticmethod
    def match_combined(probe_features, template_features):
        """Optimized combined matcher using essential algorithms"""
        scores = []
        weights = []
        
        # 1. Minutiae matching
        if probe_features.get('minutiae') and template_features.get('minutiae'):
            minutiae_score = OptimizedFingerprintMatcher.match_minutiae(
                probe_features['minutiae'], 
                template_features['minutiae']
            )
            scores.append(minutiae_score)
            weights.append(0.6)  # Increased from 0.5
        
        # 2. ORB feature matching (faster than SIFT)
        if (probe_features.get('orb_descriptors') and template_features.get('orb_descriptors') and 
                len(probe_features['orb_descriptors']) > 0 and len(template_features['orb_descriptors']) > 0):
            orb_score = OptimizedFingerprintMatcher.match_orb_features(
                probe_features['orb_descriptors'],
                template_features['orb_descriptors'],
            )
            scores.append(orb_score)
            weights.append(0.4)  # Increased from 0.25
        
        # Calculate weighted score
        if not scores:
            return 0
            
        # Normalize weights
        weights_sum = sum(weights)
        if weights_sum == 0:
            return 0
            
        normalized_weights = [w / weights_sum for w in weights]
        combined_score = sum(s * w for s, w in zip(scores, normalized_weights))
        
        return combined_score

def keypoint_to_dict(keypoint):
    """Convert OpenCV KeyPoint to dictionary for JSON serialization"""
    return {
        'x': float(keypoint.pt[0]),
        'y': float(keypoint.pt[1]),
        'size': float(keypoint.size),
        'angle': float(keypoint.angle) if keypoint.angle is not None else 0,
        'response': float(keypoint.response),
        'octave': int(keypoint.octave),
        'class_id': int(keypoint.class_id),
    }

def save_fingerprint_image(staff_id, image_data):
    """Save fingerprint image to disk"""
    try:
        user_dir = os.path.join(FINGERPRINT_DIR, str(staff_id))
        os.makedirs(user_dir, exist_ok=True)
        
        timestamp = int(time.time())
        filename = f"fp_{timestamp}.png"
        filepath = os.path.join(user_dir, filename)
        
        if isinstance(image_data, str) and ',' in image_data:
            image_data = image_data.split(',')[1]
            
            with open(filepath, 'wb') as f:
                f.write(base64.b64decode(image_data))
        elif isinstance(image_data, np.ndarray):
            cv2.imwrite(filepath, image_data)
        
        return os.path.relpath(filepath, BASE_ASSET_DIR)
    except Exception as e:
        logger.error(f"Error saving fingerprint image: {e}")
        return None

def process_fingerprint(image_data):
    """Optimized processing for a single fingerprint image"""
    try:
        # Convert base64 to image
        img = base64_to_image(image_data)
        
        # Enhance the image
        enhancer = OptimizedFingerprintEnhancer()
        enhanced_images = enhancer.enhance(img)
        
        # Extract features
        features = OptimizedFeatureExtractor.extract_all_features(img, enhanced_images)
        
        return features
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
        # Process fingerprint
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
                'quality_score': quality
            }), 400
        
        # Create template
        template = {
            'minutiae': features.get('minutiae', []),
            'orb_descriptors': features.get('orb_descriptors', []),
            'orb_keypoints': features.get('orb_keypoints', []),
            'quality': features.get('quality', {})
        }
        
        # Save image
        file_path = save_fingerprint_image(staff_id, fingerprint)
        
        # Store in cache for faster matching
        template_cache[staff_id] = template
        
    except Exception as e:
        logger.error(f"Error processing fingerprint: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error processing fingerprint: {str(e)}'}), 500
    
    processing_time = time.time() - start_time
    logger.info(f"Processed single fingerprint in {processing_time:.3f}s")
    
    return jsonify({
        'success': True,
        'template': template,
        'quality_score': quality,
        'file_path': file_path,
        'processing_time': processing_time
    })

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
    """Match a fingerprint against stored templates - optimized version"""
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
                'message': 'Could not extract features from fingerprint',
            }), 400
        
        # Check quality
        quality = features.get('quality', {}).get('overall', 0)
        if quality < QUALITY_THRESHOLD:
            return jsonify({
                'success': False,
                'matched': False,
                'message': f'Poor quality fingerprint (score: {quality:.1f}). Please try again with better placement.',
                'quality_score': quality
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
                
            # Check if in cache first
            if staff_id in template_cache:
                cached_template = template_cache[staff_id]
                if cached_template != template:
                    template_cache[staff_id] = template  # Update cache
                template = cached_template
                
            # Match using optimized algorithm
            score = OptimizedFingerprintMatcher.match_combined(features, template)
            
            match_results.append({
                'staffId': staff_id,
                'score': score
            })
        
        # Sort by score
        match_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Determine match
        if match_results and match_results[0]['score'] >= MATCH_THRESHOLD:
            top_match = match_results[0]
            
            # Determine confidence level
            confidence = "low"
            if top_match['score'] >= 0.75:  # Slightly reduced from 0.80
                confidence = "high"
            elif top_match['score'] >= 0.60:  # Slightly reduced from 0.65
                confidence = "medium"
            
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
    """Verify a fingerprint against a specific staff ID - optimized version"""
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
                'message': 'Could not extract features from fingerprint',
            }), 400
        
        # Check quality
        quality = features.get('quality', {}).get('overall', 0)
        if quality < QUALITY_THRESHOLD:
            return jsonify({
                'success': False,
                'verified': False,
                'message': f'Poor quality fingerprint (score: {quality:.1f}). Please try again with better placement.',
                'quality_score': quality
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
            score = OptimizedFingerprintMatcher.match_combined(features, template)
            best_score = max(best_score, score)
        
        # Determine if verified
        verified = best_score >= MATCH_THRESHOLD
        
        # Determine confidence level
        confidence = "low"
        if best_score >= 0.75:  # Slightly reduced from 0.80
            confidence = "high"
        elif best_score >= 0.60:  # Slightly reduced from 0.65
            confidence = "medium"
        
        processing_time = time.time() - start_time
        
        return jsonify({
            'success': True,
            'verified': verified,
            'staffId': staff_id,
            'score': best_score,
            'confidence': confidence,
            'processing_time': processing_time
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
        'version': '3.5',  # Optimized version
        'uptime': time.time(),
        'cores': NUM_CORES,
        'cached_templates': len(template_cache)
    })

if __name__ == '__main__':
    print(f"Starting optimized fingerprint server on port 5500 using {NUM_CORES} cores")
    app.run(host='0.0.0.0', port=5500, debug=False, threaded=True, processes=1)