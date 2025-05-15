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

# For parallel processing
NUM_CORES = max(1, multiprocessing.cpu_count() - 1)

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
MIN_MATCH_COUNT = 10
MATCH_THRESHOLD = 0.5
MINUTIAE_DISTANCE_THRESHOLD = 15
QUALITY_THRESHOLD = 40

def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image"""
    try:
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        img_data = base64.b64decode(base64_string)
        img = Image.open(io.BytesIO(img_data))
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        logger.error(f"Error converting base64 to image: {e}")
        raise

class FingerprintEnhancer:
    """Advanced fingerprint enhancement class"""
    
    @staticmethod
    def enhance(img):
        """Multi-stage fingerprint enhancement"""
        # Start with grayscale conversion
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()
            
        # Resize if needed for consistent processing
        height, width = gray.shape
        if width > 600 or height > 800:
            scale = min(600 / width, 800 / height)
            gray = cv2.resize(gray, None, fx=scale, fy=scale)
        
        # 1. Normalization
        normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
        
        # 2. CLAHE for improving contrast in fingerprint ridges
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(normalized)
        
        # 3. Noise removal with Gaussian and median hybrid filtering
        denoised = median_filter(enhanced, size=3)
        denoised = gaussian_filter(denoised, sigma=1)
        denoised = np.array(denoised, dtype=np.uint8)
        
        # 4. Adaptive thresholding for binarization
        binary = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY_INV, 11, 2)
        
        # 5. Morphological operations to improve ridge structure
        kernel = np.ones((3,3), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        
        # 6. Ridge orientation field estimation (for quality assessment)
        # This helps in determining the local ridge orientation
        block_size = 16
        h, w = binary.shape
        orientation_map = np.zeros((h // block_size, w // block_size), dtype=np.float32)
        
        for i in range(0, h - block_size, block_size):
            for j in range(0, w - block_size, block_size):
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
        # This is important for accurate minutiae extraction
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
    
    @staticmethod
    def orientation_field(binary, block_size=16):
        """Calculate orientation field of fingerprint"""
        h, w = binary.shape
        orientation_img = np.zeros((h, w, 3), dtype=np.uint8)
        orientation_img.fill(255)  # White background
        
        # For each block, calculate orientation
        for i in range(0, h - block_size, block_size):
            for j in range(0, w - block_size, block_size):
                block = binary[i:i+block_size, j:j+block_size]
                
                # Calculate gradient
                gx = cv2.Sobel(block, cv2.CV_32F, 1, 0)
                gy = cv2.Sobel(block, cv2.CV_32F, 0, 1)
                
                # Calculate orientation
                gxx = np.sum(gx * gx)
                gyy = np.sum(gy * gy)
                gxy = np.sum(gx * gy)
                
                # Avoid division by zero
                if gxx == gyy and gxy == 0:
                    continue
                    
                orientation = 0.5 * np.arctan2(2 * gxy, gxx - gyy)
                
                # Draw orientation line
                center_x = j + block_size // 2
                center_y = i + block_size // 2
                length = block_size // 2
                cos_o = np.cos(orientation)
                sin_o = np.sin(orientation)
                
                p1_x = int(center_x - length * cos_o)
                p1_y = int(center_y - length * sin_o)
                p2_x = int(center_x + length * cos_o)
                p2_y = int(center_y + length * sin_o)
                
                cv2.line(orientation_img, (p1_x, p1_y), (p2_x, p2_y), (0, 0, 255), 1)
                
        return orientation_img

class MinutiaeExtractor:
    """Minutiae extraction class using crossing number method"""
    
    @staticmethod
    def extract(skeleton):
        """Extract minutiae points from skeleton image"""
        minutiae = []
        minutiae_image = cv2.cvtColor(skeleton, cv2.COLOR_GRAY2BGR)
        
        # Crossing Number method
        rows, cols = skeleton.shape
        
        # Padding for border analysis
        padded = np.pad(skeleton, ((1, 1), (1, 1)), mode='constant')
        
        for i in range(1, rows + 1):
            for j in range(1, cols + 1):
                if padded[i, j] == 255:  # Foreground pixel
                    # Get 8 neighbors
                    neighbors = [
                        padded[i-1, j-1], padded[i-1, j], padded[i-1, j+1],
                        padded[i, j-1],                   padded[i, j+1],
                        padded[i+1, j-1], padded[i+1, j], padded[i+1, j+1]
                    ]
                    
                    # Convert to binary values (0 or 1)
                    neighbors = [1 if n == 255 else 0 for n in neighbors]
                    
                    # Calculate crossing number (CN)
                    # CN = 0.5 * sum(|P_{i} - P_{i+1}|) for i=1 to 8, with P_9 = P_1
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
                        cv2.circle(minutiae_image, (j-1, i-1), 3, (0, 0, 255), -1)  # Red for endings
                        
                    elif cn == 3:  # Ridge bifurcation
                        minutiae.append({
                            'x': j-1,  # Adjust for padding
                            'y': i-1,  # Adjust for padding
                            'type': 'bifurcation'
                        })
                        cv2.circle(minutiae_image, (j-1, i-1), 3, (0, 255, 0), -1)  # Green for bifurcations
        
        # Filter minutiae by proximity to reduce duplicates
        filtered_minutiae = []
        min_distance = 10  # Minimum distance between minutiae
        
        for m in minutiae:
            too_close = False
            for fm in filtered_minutiae:
                dist = np.sqrt((m['x'] - fm['x'])**2 + (m['y'] - fm['y'])**2)
                if dist < min_distance:
                    too_close = True
                    break
            
            if not too_close:
                filtered_minutiae.append(m)
        
        return filtered_minutiae, minutiae_image

class FeatureExtractor:
    """Extract multiple feature types for robust matching"""
    
    @staticmethod
    def extract_sift_features(image):
        """Extract SIFT features (scale-invariant)"""
        try:
            # Try using SIFT (if OpenCV built with it)
            sift = cv2.SIFT_create()
            keypoints, descriptors = sift.detectAndCompute(image, None)
            return keypoints, descriptors
        except:
            # Fall back to ORB if SIFT not available
            logger.warning("SIFT not available, falling back to ORB")
            return FeatureExtractor.extract_orb_features(image)
    
    @staticmethod
    def extract_orb_features(image):
        """Extract ORB features (fast but less invariant)"""
        orb = cv2.ORB_create(nfeatures=1000)
        keypoints, descriptors = orb.detectAndCompute(image, None)
        return keypoints, descriptors
    
    @staticmethod
    def extract_harris_keypoints(image):
        """Extract Harris corner keypoints"""
        gray = image.copy()
        if len(gray.shape) > 2:
            gray = cv2.cvtColor(gray, cv2.COLOR_BGR2GRAY)
            
        # Detect corners using Harris
        corners = cv2.cornerHarris(gray, blockSize=2, ksize=3, k=0.04)
        
        # Normalize and threshold
        corners = cv2.dilate(corners, None)
        _, corners = cv2.threshold(corners, 0.01 * corners.max(), 255, 0)
        corners = np.uint8(corners)
        
        # Find centroids
        _, _, _, centroids = cv2.connectedComponentsWithStats(corners)
        
        # Define criteria and refine corners
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.001)
        corners = cv2.cornerSubPix(gray, np.float32(centroids), (5, 5), (-1, -1), criteria)
        
        # Convert to keypoints
        keypoints = [cv2.KeyPoint(float(x[0]), float(x[1]), 1) for x in corners]
        
        return keypoints
    
    @staticmethod
    def extract_all_features(image, enhanced_image):
        """Extract multiple feature types for fusion matching"""
        # Extract minutiae
        minutiae_extractor = MinutiaeExtractor()
        minutiae, minutiae_image = minutiae_extractor.extract(enhanced_image['skeleton'])
        
        # Extract SIFT/ORB features for global matching
        try:
            sift_keypoints, sift_descriptors = FeatureExtractor.extract_sift_features(enhanced_image['enhanced'])
        except:
            sift_keypoints, sift_descriptors = [], None
            
        # Extract ORB features as backup
        orb_keypoints, orb_descriptors = FeatureExtractor.extract_orb_features(enhanced_image['enhanced'])
        
        # Harris corners with ORB descriptors as third method
        harris_keypoints = FeatureExtractor.extract_harris_keypoints(enhanced_image['enhanced'])
        
        # If we have Harris keypoints, compute ORB descriptors for them
        harris_descriptors = None
        if harris_keypoints:
            orb = cv2.ORB_create()
            _, harris_descriptors = orb.compute(enhanced_image['enhanced'], harris_keypoints)
        
        # Calculate fingerprint quality
        quality = QualityAssessor.assess_quality(enhanced_image)
        
        # Return all feature sets
        return {
            'minutiae': minutiae,
            'sift_keypoints': [keypoint_to_dict(kp) for kp in sift_keypoints] if sift_keypoints else [],
            'sift_descriptors': sift_descriptors.tolist() if sift_descriptors is not None else [],
            'orb_keypoints': [keypoint_to_dict(kp) for kp in orb_keypoints] if orb_keypoints else [],
            'orb_descriptors': orb_descriptors.tolist() if orb_descriptors is not None else [],
            'harris_keypoints': [keypoint_to_dict(kp) for kp in harris_keypoints] if harris_keypoints else [],
            'harris_descriptors': harris_descriptors.tolist() if harris_descriptors is not None else [],
            'quality': quality,
            'minutiae_image': minutiae_image  # For visualization
        }

class QualityAssessor:
    """Assess fingerprint image quality"""
    
    @staticmethod
    def assess_quality(enhanced_image):
        """Comprehensive quality assessment metrics"""
        # 1. Contrast assessment
        gray = enhanced_image['gray']
        contrast = gray.std()
        contrast_score = min(100, contrast / 2.55)
        
        # 2. Ridge clarity assessment
        binary = enhanced_image['binary']
        ridge_area = np.sum(binary > 0) / binary.size
        ridge_score = 100 * (0.5 - abs(0.5 - ridge_area)) * 2  # Best if around 50% of the image
        
        # 3. Ridge orientation coherence
        orientation_map = enhanced_image['orientation_map']
        if orientation_map.size > 0:
            # Calculate coherence (consistency of orientation)
            coherence_score = 50  # Default value
            
            # Simple measure: consistency of adjacent orientation blocks
            if orientation_map.shape[0] > 1 and orientation_map.shape[1] > 1:
                diffs = []
                for i in range(orientation_map.shape[0] - 1):
                    for j in range(orientation_map.shape[1] - 1):
                        # Calculate differences with neighbors
                        center = orientation_map[i, j]
                        right = orientation_map[i, j + 1]
                        bottom = orientation_map[i + 1, j]
                        
                        # Only consider valid orientations
                        if center != 0 and right != 0:
                            angle_diff = min(abs(center - right), np.pi - abs(center - right))
                            diffs.append(angle_diff)
                        
                        if center != 0 and bottom != 0:
                            angle_diff = min(abs(center - bottom), np.pi - abs(center - bottom))
                            diffs.append(angle_diff)
                
                if diffs:
                    avg_diff = np.mean(diffs)
                    coherence_score = 100 * (1 - avg_diff / (np.pi / 2))
        else:
            coherence_score = 50
        
        # 4. Minutiae quality
        skeleton = enhanced_image['skeleton']
        minutiae, _ = MinutiaeExtractor.extract(skeleton)
        
        minutiae_score = min(100, len(minutiae) * 2)  # More minutiae is better, up to a point
        
        # 5. Clarity via Sobel gradient
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        gradient_mag = cv2.magnitude(sobelx, sobely)
        clarity_score = min(100, np.mean(gradient_mag) / 2)
        
        # Calculate weighted quality score
        weights = [0.2, 0.2, 0.2, 0.2, 0.2]  # Equal weights
        scores = [contrast_score, ridge_score, coherence_score, minutiae_score, clarity_score]
        
        weighted_quality = sum(w * s for w, s in zip(weights, scores))
        
        return {
            'overall': weighted_quality,
            'contrast': contrast_score,
            'ridge_quality': ridge_score,
            'coherence': coherence_score,
            'minutiae_count': len(minutiae),
            'minutiae_quality': minutiae_score,
            'clarity': clarity_score
        }

class FingerprintMatcher:
    """Multi-algorithm fingerprint matcher"""
    
    @staticmethod
    def match_minutiae(probe_minutiae, template_minutiae):
        """Match fingerprints based on minutiae points"""
        if not probe_minutiae or not template_minutiae:
            return 0
            
        # Convert to numpy arrays for vectorized operations
        probe_points = np.array([[m['x'], m['y']] for m in probe_minutiae])
        template_points = np.array([[m['x'], m['y']] for m in template_minutiae])
        
        # Get minutiae types
        probe_types = [m['type'] for m in probe_minutiae]
        template_types = [m['type'] for m in template_minutiae]
        
        # Count matches
        match_count = 0
        matched_template_indices = set()
        
        for i, (p_point, p_type) in enumerate(zip(probe_points, probe_types)):
            best_distance = float('inf')
            best_idx = -1
            
            for j, (t_point, t_type) in enumerate(zip(template_points, template_types)):
                if j in matched_template_indices:
                    continue
                    
                # Only match same types (bifurcation with bifurcation, ending with ending)
                if p_type != t_type:
                    continue
                    
                # Calculate Euclidean distance
                distance = np.sqrt(((p_point - t_point) ** 2).sum())
                
                if distance < MINUTIAE_DISTANCE_THRESHOLD and distance < best_distance:
                    best_distance = distance
                    best_idx = j
            
            if best_idx != -1:
                match_count += 1
                matched_template_indices.add(best_idx)
        
        # Calculate score as percentage of matched minutiae
        total_minutiae = max(len(probe_minutiae), len(template_minutiae))
        
        if total_minutiae == 0:
            return 0
            
        return match_count / total_minutiae
    
    @staticmethod
    def match_features(probe_descriptors, template_descriptors, descriptor_type='orb'):
        """Match feature descriptors (SIFT or ORB)"""
        if probe_descriptors is None or template_descriptors is None:
            return 0, []
            
        if len(probe_descriptors) == 0 or len(template_descriptors) == 0:
            return 0, []
            
        # Convert to numpy arrays if needed
        if isinstance(probe_descriptors, list):
            probe_descriptors = np.array(probe_descriptors, dtype=np.float32 if descriptor_type == 'sift' else np.uint8)
            
        if isinstance(template_descriptors, list):
            template_descriptors = np.array(template_descriptors, dtype=np.float32 if descriptor_type == 'sift' else np.uint8)
        
        # Choose matcher based on descriptor type
        if descriptor_type == 'sift':
            # FLANN based matcher for SIFT
            FLANN_INDEX_KDTREE = 1
            index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
            search_params = dict(checks=50)
            matcher = cv2.FlannBasedMatcher(index_params, search_params)
        else:
            # Brute force matcher with Hamming distance for ORB
            matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        
        try:
            # Perform matching
            matches = matcher.match(probe_descriptors, template_descriptors)
            
            # Filter and sort matches
            matches = sorted(matches, key=lambda x: x.distance)
            
            # Calculate score based on number and quality of matches
            if len(matches) > MIN_MATCH_COUNT:
                # Use top matches for scoring
                good_matches = matches[:min(len(matches), 50)]
                
                # Normalize distances to 0-1 range
                max_distance = 100 if descriptor_type == 'orb' else 500  # Different scales for ORB vs SIFT
                distances = np.array([m.distance for m in good_matches])
                normalized_distances = np.clip(distances / max_distance, 0, 1)
                
                # Score considers both quantity and quality of matches
                match_ratio = len(good_matches) / min(len(probe_descriptors), len(template_descriptors))
                quality_score = 1 - np.mean(normalized_distances)
                
                score = 0.5 * match_ratio + 0.5 * quality_score
                
                return score, matches
            else:
                return 0, []
        except Exception as e:
            logger.error(f"Error in matching {descriptor_type} features: {e}")
            return 0, []
    
    @staticmethod
    def match_combined(probe_features, template_features):
        """Combined matcher using multiple algorithms for higher accuracy"""
        scores = []
        weights = []
        
        # 1. Minutiae matching (highest weight)
        if probe_features.get('minutiae') and template_features.get('minutiae'):
            minutiae_score = FingerprintMatcher.match_minutiae(
                probe_features['minutiae'], 
                template_features['minutiae']
            )
            scores.append(minutiae_score)
            weights.append(0.5)  # 50% weight for minutiae
        
        # 2. SIFT feature matching
        if (probe_features.get('sift_descriptors') and template_features.get('sift_descriptors') and 
                len(probe_features['sift_descriptors']) > 0 and len(template_features['sift_descriptors']) > 0):
            sift_score, _ = FingerprintMatcher.match_features(
                probe_features['sift_descriptors'],
                template_features['sift_descriptors'],
                'sift'
            )
            scores.append(sift_score)
            weights.append(0.25)  # 25% weight for SIFT
        
        # 3. ORB feature matching
        if (probe_features.get('orb_descriptors') and template_features.get('orb_descriptors') and 
                len(probe_features['orb_descriptors']) > 0 and len(template_features['orb_descriptors']) > 0):
            orb_score, _ = FingerprintMatcher.match_features(
                probe_features['orb_descriptors'],
                template_features['orb_descriptors'],
                'orb'
            )
            scores.append(orb_score)
            weights.append(0.25)  # 25% weight for ORB
        
        # If we have no scores, try Harris features as fallback
        if not scores and (probe_features.get('harris_descriptors') and template_features.get('harris_descriptors') and 
                len(probe_features['harris_descriptors']) > 0 and len(template_features['harris_descriptors']) > 0):
            harris_score, _ = FingerprintMatcher.match_features(
                probe_features['harris_descriptors'],
                template_features['harris_descriptors'],
                'orb'  # Harris uses ORB descriptors
            )
            scores.append(harris_score)
            weights.append(1.0)  # 100% weight if it's our only score
        
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

def save_fingerprint_image(staff_id, image_data, scan_index=0):
    """Save fingerprint image to disk"""
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
        logger.error(f"Error saving fingerprint image: {e}")
        return None

def process_fingerprint(image_data):
    """Process a single fingerprint image and extract features"""
    try:
        # Convert base64 to image
        img = base64_to_image(image_data)
        
        # Enhance the image
        enhancer = FingerprintEnhancer()
        enhanced_images = enhancer.enhance(img)
        
        # Extract features
        features = FeatureExtractor.extract_all_features(img, enhanced_images)
        
        return features
    except Exception as e:
        logger.error(f"Error processing fingerprint: {e}")
        traceback.print_exc()
        return None

def process_fingerprints_parallel(fingerprints):
    """Process multiple fingerprints in parallel"""
    with multiprocessing.Pool(processes=NUM_CORES) as pool:
        results = pool.map(process_fingerprint, fingerprints)
    return results

def combine_fingerprint_features(features_list):
    """Combine features from multiple fingerprint scans"""
    if not features_list:
        return None
        
    # Filter out None values
    valid_features = [f for f in features_list if f is not None]
    
    if not valid_features:
        return None
        
    # Start with first feature set
    combined = valid_features[0].copy()
    
    # Combine minutiae sets (with deduplication)
    all_minutiae = []
    for features in valid_features:
        minutiae = features.get('minutiae', [])
        all_minutiae.extend(minutiae)
    
    # Deduplicate minutiae
    deduplicated_minutiae = []
    for minutia in all_minutiae:
        # Check if similar minutia already exists
        is_duplicate = False
        for existing in deduplicated_minutiae:
            if (abs(minutia['x'] - existing['x']) < 10 and 
                abs(minutia['y'] - existing['y']) < 10 and
                minutia['type'] == existing['type']):
                is_duplicate = True
                break
        
        if not is_duplicate:
            deduplicated_minutiae.append(minutia)
    
    combined['minutiae'] = deduplicated_minutiae
    
    # Combine feature descriptors - take best quality from each set
    best_quality = 0
    best_quality_index = 0
    
    for i, features in enumerate(valid_features):
        quality = features.get('quality', {}).get('overall', 0)
        if quality > best_quality:
            best_quality = quality
            best_quality_index = i
    
    # Use the feature descriptors from the best quality scan
    best_features = valid_features[best_quality_index]
    combined['sift_descriptors'] = best_features.get('sift_descriptors', [])
    combined['sift_keypoints'] = best_features.get('sift_keypoints', [])
    combined['orb_descriptors'] = best_features.get('orb_descriptors', [])
    combined['orb_keypoints'] = best_features.get('orb_keypoints', [])
    combined['harris_descriptors'] = best_features.get('harris_descriptors', [])
    combined['harris_keypoints'] = best_features.get('harris_keypoints', [])
    
    # Use the highest quality score
    combined['quality'] = {'overall': best_quality}
    
    return combined

@app.route('/api/fingerprint/process-multiple', methods=['POST'])
def process_multiple_fingerprints():
    """Process multiple fingerprints to create a combined template"""
    start_time = time.time()
    data = request.json
    
    if not data:
        return jsonify({'success': False, 'message': 'Missing data'}), 400
    
    staff_id = data.get('staffId')
    fingerprints = []
    
    # Get fingerprints from either direct data or file paths
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
                logger.error(f"Error reading file {filepath}: {e}")
    
    if len(fingerprints) < 2:
        return jsonify({'success': False, 'message': 'At least 2 fingerprints required'}), 400
    
    # Process fingerprints in parallel for efficiency
    try:
        # Process fingerprints
        logger.info(f"Processing {len(fingerprints)} fingerprints in parallel")
        features_list = process_fingerprints_parallel(fingerprints)
        
        # Combine features
        combined_features = combine_fingerprint_features(features_list)
        
        if not combined_features:
            return jsonify({'success': False, 'message': 'Failed to extract features from fingerprints'}), 500
        
        # Create template
        template = {
            'minutiae': combined_features.get('minutiae', []),
            'sift_descriptors': combined_features.get('sift_descriptors', []),
            'sift_keypoints': combined_features.get('sift_keypoints', []),
            'orb_descriptors': combined_features.get('orb_descriptors', []),
            'orb_keypoints': combined_features.get('orb_keypoints', []),
            'harris_descriptors': combined_features.get('harris_descriptors', []),
            'harris_keypoints': combined_features.get('harris_keypoints', []),
            'quality': combined_features.get('quality', {})
        }
        
        # Save images
        saved_files = []
        if staff_id:
            for i, fp_data in enumerate(fingerprints):
                filepath = save_fingerprint_image(staff_id, fp_data, i)
                if filepath:
                    saved_files.append(filepath)
    except Exception as e:
        logger.error(f"Error processing fingerprints: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error processing fingerprints: {str(e)}'}), 500
    
    processing_time = time.time() - start_time
    logger.info(f"Processed {len(fingerprints)} fingerprints in {processing_time:.3f}s")
    
    return jsonify({
        'success': True,
        'template': template,
        'original_template': template,  # Keep the same format as before
        'quality_score': combined_features.get('quality', {}).get('overall', 0),
        'saved_files': saved_files,
        'processing_time': processing_time
    })

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
    """Match a fingerprint against stored templates"""
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
                
            # Match using combined algorithm
            score = FingerprintMatcher.match_combined(features, template)
            
            match_results.append({
                'staffId': staff_id,
                'score': score,
                'templateCount': 1
            })
        
        # Sort by score
        match_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Determine match
        if match_results and match_results[0]['score'] >= MATCH_THRESHOLD:
            top_match = match_results[0]
            
            # Determine confidence level
            confidence = "low"
            if top_match['score'] >= 0.80:
                confidence = "high"
            elif top_match['score'] >= 0.65:
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
    """Verify a fingerprint against a specific staff ID"""
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
                staff_templates.append(t['template'])
        
        if not staff_templates:
            return jsonify({
                'success': False,
                'verified': False,
                'message': 'No templates found for this staff ID'
            }), 404
        
        # Match against each template and get best score
        best_score = 0
        for template in staff_templates:
            score = FingerprintMatcher.match_combined(features, template)
            best_score = max(best_score, score)
        
        # Determine if verified
        verified = best_score >= MATCH_THRESHOLD
        
        # Determine confidence level
        confidence = "low"
        if best_score >= 0.80:
            confidence = "high"
        elif best_score >= 0.65:
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
        'version': '3.0',
        'uptime': time.time(),
        'cores': NUM_CORES
    })

if __name__ == '__main__':
    print(f"Starting high-accuracy fingerprint server on port 5500 using {NUM_CORES} cores")
    app.run(host='0.0.0.0', port=5500, debug=False, threaded=True)