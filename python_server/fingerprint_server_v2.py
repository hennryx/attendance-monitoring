# Refactored fingerprint_server.py with improved accuracy and folder cleanup
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
import shutil
from scipy.spatial.distance import hamming, euclidean
from skimage.feature import local_binary_pattern, hog
from skimage.measure import compare_ssim

app = Flask(__name__)
CORS(app)

# Configuration
MAX_TEMPLATE_SIZE = 5000
VERBOSE_LOGGING = True
MATCH_THRESHOLD = 0.75  # Increased from 0.60 for better precision
HIGH_CONFIDENCE_THRESHOLD = 0.85  # Increased from 0.80 to 0.82
MEDIUM_CONFIDENCE_THRESHOLD = 0.75  # Increased from 0.70 to 0.72

# Directory setup
BASE_ASSET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets'))
FINGERPRINT_DIR = os.path.join(BASE_ASSET_DIR, 'fingerprints')
os.makedirs(FINGERPRINT_DIR, exist_ok=True)

def clean_staff_directory(staff_id):
    """Delete all existing fingerprint files for a staff member before saving new ones"""
    try:
        staff_dir = os.path.join(FINGERPRINT_DIR, str(staff_id))
        if os.path.exists(staff_dir):
            print(f"Cleaning directory for staff {staff_id}")
            # Option 1: Delete and recreate directory
            # shutil.rmtree(staff_dir)
            # os.makedirs(staff_dir, exist_ok=True)
            
            # Option 2 (alternative): Delete files but keep directory
            for file_name in os.listdir(staff_dir):
                file_path = os.path.join(staff_dir, file_name)
                if os.path.isfile(file_path):
                    os.unlink(file_path)
        else:
            os.makedirs(staff_dir, exist_ok=True)
        
        return True
    except Exception as e:
        print(f"Error cleaning staff directory: {e}")
        return False

def enhanced_preprocessing(img):
    """Enhanced fingerprint preprocessing for better feature extraction"""
    start = time.time()
    
    # Standardize image size while preserving aspect ratio
    max_dimension = 256
    h, w = img.shape[0], img.shape[1]
    if max(h, w) > max_dimension:
        if h > w:
            new_h, new_w = max_dimension, int(w * max_dimension / h)
        else:
            new_h, new_w = int(h * max_dimension / w), max_dimension
        img = cv2.resize(img, (new_w, new_h))
    
    # Convert to grayscale if needed
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
    
    # Step 1: Normalize brightness and contrast
    normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    
    # Step 2: Enhanced contrast using CLAHE with larger grid
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(normalized)
    
    # Step 3: Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
    
    # Step 4: Adaptive thresholding with larger window
    binary = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 13, 3
    )
    
    # Step 5: Morphological operations to enhance ridges
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    morphed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    
    # Step 6: Remove small noise artifacts
    denoised = cv2.medianBlur(morphed, 3)
    
    if VERBOSE_LOGGING:
        print(f"Enhanced preprocessing: {time.time() - start:.3f}s")
    
    return denoised

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

def extract_advanced_features(binary_img):
    """Extract more robust features for improved matching"""
    # Resize for consistency
    normalized_img = cv2.resize(binary_img, (192, 192))
    
    # 1. Multiple-scale perceptual hash
    phashes = []
    for size in [32, 16, 8]:
        small_img = cv2.resize(normalized_img, (size, size))
        img_mean = np.mean(small_img)
        img_hash = ''.join(['1' if px > img_mean else '0' for px in small_img.flatten()])
        phashes.append(img_hash)
    
    # 2. Multi-level region-based hashes (divide image into grids of different sizes)
    region_hashes = []
    # 3x3 grid
    grid_size = 3
    h, w = normalized_img.shape
    step_h, step_w = h // grid_size, w // grid_size
    
    for y in range(0, h, step_h):
        if y + step_h > h:
            continue
        for x in range(0, w, step_w):
            if x + step_w > w:
                continue
            region = normalized_img[y:y+step_h, x:x+step_w]
            region_mean = np.mean(region)
            region_hash = ''.join(['1' if px > region_mean else '0' for px in region.flatten()])
            region_hashes.append(region_hash[:24])  # Keep first 24 bits
    
    # 4x4 grid for center regions
    center_y, center_x = h // 4, w // 4
    center_region = normalized_img[center_y:center_y+h//2, center_x:center_x+w//2]
    if center_region.size > 0:
        # Divide center into smaller regions
        c_h, c_w = center_region.shape
        c_step_h, c_step_w = c_h // 4, c_w // 4
        
        for y in range(0, c_h, c_step_h):
            if y + c_step_h > c_h:
                continue
            for x in range(0, c_w, c_step_w):
                if x + c_step_w > c_w:
                    continue
                c_region = center_region[y:y+c_step_h, x:x+c_step_w]
                c_region_mean = np.mean(c_region)
                c_region_hash = ''.join(['1' if px > c_region_mean else '0' for px in c_region.flatten()])
                region_hashes.append(c_region_hash[:16])
    
    # 3. Improved key points detection
    key_points = []
    # Use both contour detection and corner detection
    # Contour centers
    _, thresh = cv2.threshold(normalized_img, 127, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    # Get centers of the top contours by area
    significant_contours = sorted(contours, key=cv2.contourArea, reverse=True)[:15]
    for contour in significant_contours:
        M = cv2.moments(contour)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            key_points.append([cx, cy])
    
    # Add Harris corners for more robust key points
    try:
        harris_corners = cv2.cornerHarris(normalized_img.astype(np.float32), 3, 3, 0.04)
        _, harris_thresh = cv2.threshold(harris_corners, 0.01 * harris_corners.max(), 255, 0)
        harris_thresh = np.uint8(harris_thresh)
        # Find centroids of Harris corner regions
        _, labels, stats, centroids = cv2.connectedComponentsWithStats(harris_thresh)
        # Filter valid centroids
        for i in range(1, len(centroids)):
            if stats[i, cv2.CC_STAT_AREA] > 10:  # Min area threshold
                key_points.append([int(centroids[i][0]), int(centroids[i][1])])
    except Exception as e:
        print(f"Error detecting Harris corners: {e}")
    
    # 4. Texture features using HOG and LBP
    texture_features = []
    
    # Use HOG features for part of the image
    try:
        hog_img = cv2.resize(normalized_img, (64, 64))
        hog_features = hog(
            hog_img, 
            orientations=8, 
            pixels_per_cell=(8, 8),
            cells_per_block=(2, 2), 
            visualize=False
        )
        # Take subset of HOG features
        texture_features.extend(hog_features[:64].tolist())
    except Exception as e:
        print(f"Error computing HOG features: {e}")
    
    # LBP for texture analysis
    regions = [
        normalized_img[:h//2, :w//2],           # Top-left
        normalized_img[:h//2, w//2:],           # Top-right
        normalized_img[h//2:, :w//2],           # Bottom-left
        normalized_img[h//2:, w//2:]            # Bottom-right
    ]
    
    for region in regions:
        if region.size > 0:
            try:
                small_region = cv2.resize(region, (32, 32))
                lbp = local_binary_pattern(small_region, 8, 1, method='uniform')
                hist, _ = np.histogram(lbp, bins=10, range=(0, 10), density=True)
                texture_features.extend(hist.tolist())
            except Exception as e:
                print(f"Error computing LBP features: {e}")
    
    # 5. Image statistics
    stats = {
        'mean': float(np.mean(normalized_img)),
        'std': float(np.std(normalized_img)),
        'size': [normalized_img.shape[1], normalized_img.shape[0]],
        'white_ratio': float(np.sum(normalized_img > 127) / normalized_img.size),
        'entropy': float(cv2.calcHist([normalized_img], [0], None, [256], [0, 256]).flatten().std()),
        # Additional stats
        'contrast': float(normalized_img.max() - normalized_img.min()),
        'energy': float((normalized_img ** 2).sum() / normalized_img.size)
    }
    
    # 6. Ridge orientation and density (simplified)
    try:
        # Simple orientation estimate
        gradients = np.gradient(normalized_img)
        orientation = np.arctan2(gradients[0], gradients[1]) * 180 / np.pi
        # Calculate histogram of orientations
        orient_hist, _ = np.histogram(orientation, bins=8, range=(-180, 180))
        orient_hist = orient_hist / orient_hist.sum() if orient_hist.sum() > 0 else orient_hist
        
        stats['ridge_orientation'] = orient_hist.tolist()
    except Exception as e:
        print(f"Error computing ridge orientation: {e}")
        stats['ridge_orientation'] = []
    
    return {
        'phashes': phashes,
        'region_hashes': region_hashes,
        'key_points': key_points[:20],  # Limit to 20 points
        'texture_features': texture_features,
        'stats': stats
    }

def calculate_enhanced_similarity(probe_features, template):
    """Calculate improved similarity with multi-factor comparison"""
    if not probe_features or not template:
        return 0.0
    
    scores = []
    weights = []
    
    # 1. Multi-scale perceptual hash comparison (35% weight)
    if 'phashes' in probe_features and 'phashes' in template:
        probe_hashes = probe_features['phashes']
        template_hashes = template['phashes']
        
        hash_similarities = []
        for i in range(min(len(probe_hashes), len(template_hashes))):
            p_hash = probe_hashes[i]
            t_hash = template_hashes[i]
            
            if len(p_hash) == len(t_hash):
                hash_sim = 1.0 - hamming(
                    list(map(int, p_hash)), 
                    list(map(int, t_hash))
                )
                # Weight different scales
                scale_weight = 1.0 if i == 0 else (0.7 if i == 1 else 0.5)
                hash_similarities.append(hash_sim * scale_weight)
        
        if hash_similarities:
            avg_hash_sim = sum(hash_similarities) / sum(1.0 if i == 0 else (0.7 if i == 1 else 0.5) 
                                                 for i in range(len(hash_similarities)))
            scores.append(avg_hash_sim)
            weights.append(0.35)
    
    # 2. Region hashes comparison (25% weight)
    if 'region_hashes' in probe_features and 'region_hashes' in template:
        probe_regions = probe_features['region_hashes']
        template_regions = template['region_hashes']
        
        # Match regions (allowing for some displacement)
        region_similarities = []
        for p_region in probe_regions:
            best_region_sim = 0
            for t_region in template_regions:
                # Compare regions with compatible lengths
                min_len = min(len(p_region), len(t_region))
                if min_len > 8:  # Minimum meaningful hash length
                    region_sim = 1.0 - hamming(
                        list(map(int, p_region[:min_len])), 
                        list(map(int, t_region[:min_len]))
                    )
                    best_region_sim = max(best_region_sim, region_sim)
            
            if best_region_sim > 0:
                region_similarities.append(best_region_sim)
        
        if region_similarities:
            # Use average of top 40% of region similarities
            region_similarities.sort(reverse=True)
            top_count = max(1, int(len(region_similarities) * 0.4))
            region_similarity = sum(region_similarities[:top_count]) / top_count
            scores.append(region_similarity)
            weights.append(0.25)
    
    # 3. Key points comparison (20% weight)
    if ('key_points' in probe_features and 'key_points' in template and 
            probe_features['key_points'] and template['key_points']):
        
        probe_points = np.array(probe_features['key_points'])
        template_points = np.array(template['key_points'])
        
        # Advanced point matching algorithm considering spatial distribution
        match_scores = []
        
        for p_point in probe_points:
            distances = [np.linalg.norm(p_point - t_point) for t_point in template_points]
            if distances:
                # Convert distance to similarity score (lower distance = higher similarity)
                min_dist = min(distances)
                match_score = max(0, 1 - (min_dist / 40))  # 40 pixels is max distance
                match_scores.append(match_score)
        
        if match_scores:
            # Weight match scores by their quality (higher scores get higher weight)
            weighted_scores = [score**2 for score in match_scores]  # Square for emphasis
            keypoint_similarity = sum(weighted_scores) / sum(1 for _ in weighted_scores)
            scores.append(keypoint_similarity)
            weights.append(0.20)
    
    # 4. Texture features comparison (15% weight)
    if ('texture_features' in probe_features and 'texture_features' in template and
            probe_features['texture_features'] and template['texture_features']):
        
        p_texture = np.array(probe_features['texture_features'])
        t_texture = np.array(template['texture_features'])
        
        # Make sure arrays are the same length
        min_length = min(len(p_texture), len(t_texture))
        if min_length > 0:
            try:
                # Cosine similarity
                p_norm = np.linalg.norm(p_texture[:min_length])
                t_norm = np.linalg.norm(t_texture[:min_length])
                
                if p_norm > 0 and t_norm > 0:
                    texture_similarity = np.dot(p_texture[:min_length], t_texture[:min_length]) / (p_norm * t_norm)
                    scores.append(max(0, min(1, texture_similarity)))  # Clamp between 0 and 1
                    weights.append(0.15)
            except Exception as e:
                print(f"Error computing texture similarity: {e}")
    
    # 5. Statistics comparison (10% weight)
    if 'stats' in probe_features and 'stats' in template:
        p_stats = probe_features['stats']
        t_stats = template['stats']
        
        # Compare statistics with weighted importance
        stat_scores = []
        
        # Essential stats have higher weight
        essential_stats = ['mean', 'white_ratio']
        extra_stats = ['std', 'contrast', 'energy']
        
        # Compare essential stats
        for key in essential_stats:
            if key in p_stats and key in t_stats:
                diff = abs(p_stats[key] - t_stats[key])
                norm_value = 255.0 if key == 'mean' else 1.0
                stat_score = max(0, 1.0 - (diff / norm_value))
                stat_scores.append((stat_score, 1.0))  # Full weight
        
        # Compare extra stats
        for key in extra_stats:
            if key in p_stats and key in t_stats:
                diff = abs(p_stats[key] - t_stats[key])
                
                # Normalize difference based on stat type
                if key == 'std' or key == 'contrast':
                    norm_value = 100.0  # Typical max std/contrast
                elif key == 'energy':
                    norm_value = 65025.0  # 255^2 max energy per pixel
                else:
                    norm_value = 1.0
                
                stat_score = max(0, 1.0 - (diff / norm_value))
                stat_scores.append((stat_score, 0.5))  # Half weight
        
        # Compare ridge orientation histogram if available
        if ('ridge_orientation' in p_stats and 'ridge_orientation' in t_stats and
                p_stats['ridge_orientation'] and t_stats['ridge_orientation']):
            
            p_orient = np.array(p_stats['ridge_orientation'])
            t_orient = np.array(t_stats['ridge_orientation'])
            
            if len(p_orient) == len(t_orient) and len(p_orient) > 0:
                # Chi-square distance for histogram comparison
                chi_square = 0.5 * np.sum(
                    ((p_orient - t_orient) ** 2) / (p_orient + t_orient + 1e-10)
                )
                orient_score = max(0, 1.0 - (chi_square / 2.0))
                stat_scores.append((orient_score, 1.5))  # Higher weight for orientation
        
        if stat_scores:
            weighted_sum = sum(score * weight for score, weight in stat_scores)
            total_weight = sum(weight for _, weight in stat_scores)
            
            if total_weight > 0:
                stats_similarity = weighted_sum / total_weight
                scores.append(stats_similarity)
                weights.append(0.10)
    
    # Calculate final weighted score
    if scores and weights:
        total_weight = sum(weights)
        if total_weight > 0:
            weighted_score = sum(s * w for s, w in zip(scores, weights)) / total_weight
            
            # Apply confidence boost for multiple high scores
            high_score_count = sum(1 for s in scores if s > 0.8)
            confidence_boost = min(0.05, 0.01 * high_score_count)
            
            return min(1.0, weighted_score + confidence_boost)
    
    return 0.0

def combine_templates_advanced(templates):
    """Advanced template combination using quality-weighted features"""
    if not templates or len(templates) == 0:
        return None
    
    if len(templates) == 1:
        return templates[0].copy()
    
    # Start with a clean template
    master = {}
    
    # 1. Combine multi-scale perceptual hashes
    if all('phashes' in t for t in templates):
        hash_scales = len(templates[0]['phashes'])
        combined_phashes = []
        
        for scale in range(hash_scales):
            if all(scale < len(t['phashes']) for t in templates):
                hash_length = min(len(t['phashes'][scale]) for t in templates)
                combined_hash = ""
                
                for i in range(hash_length):
                    bits = [t['phashes'][scale][i] for t in templates]
                    ones = bits.count('1')
                    zeros = bits.count('0')
                    combined_hash += '1' if ones >= zeros else '0'
                
                combined_phashes.append(combined_hash)
        
        master['phashes'] = combined_phashes
    
    # 2. Select best region hashes based on quality
    if all('region_hashes' in t for t in templates):
        # Collect all region hashes
        all_regions = []
        for t in templates:
            all_regions.extend(t['region_hashes'])
        
        # Group similar region hashes
        unique_regions = []
        for region in all_regions:
            # Check if this region is already represented
            is_unique = True
            for unique_region in unique_regions:
                # Compare first 16 bits to see if they're similar
                if len(region) >= 16 and len(unique_region) >= 16:
                    similar_bits = sum(1 for a, b in zip(region[:16], unique_region[:16]) if a == b)
                    if similar_bits >= 14:  # Over 85% similar
                        is_unique = False
                        break
            
            if is_unique:
                unique_regions.append(region)
        
        # Keep the top 20 unique regions
        master['region_hashes'] = unique_regions[:20]
    
    # 3. Combine key points using improved clustering
    all_key_points = []
    for t in templates:
        if 'key_points' in t and t['key_points']:
            all_key_points.extend(t['key_points'])
    
    if all_key_points:
        # Cluster key points with a more robust algorithm
        master['key_points'] = advanced_keypoint_clustering(all_key_points)
    
    # 4. Combine texture features with quality-based weighting
    if all('texture_features' in t for t in templates):
        feature_length = min(len(t['texture_features']) for t in templates)
        
        if feature_length > 0:
            # Compute texture quality for each template
            texture_quality = []
            for t in templates:
                # Estimate quality based on entropy and variance
                features = np.array(t['texture_features'][:feature_length])
                quality = np.std(features) / (np.mean(features) + 1e-5)
                texture_quality.append(max(0.1, min(1.0, quality)))
            
            # Normalize quality weights
            total_quality = sum(texture_quality)
            if total_quality > 0:
                weights = [q / total_quality for q in texture_quality]
                
                # Weighted average of texture features
                weighted_features = []
                for i in range(feature_length):
                    weighted_sum = sum(
                        templates[j]['texture_features'][i] * weights[j] 
                        for j in range(len(templates))
                    )
                    weighted_features.append(weighted_sum)
                
                master['texture_features'] = weighted_features
    
    # 5. Combine statistics with simple averaging
    if all('stats' in t for t in templates):
        combined_stats = {}
        
        # Find all stats keys across templates
        all_keys = set()
        for t in templates:
            all_keys.update(t['stats'].keys())
        
        # Combine numeric stats with averaging
        for key in all_keys:
            if key in ['size']:  # Use first template for size
                if key in templates[0]['stats']:
                    combined_stats[key] = templates[0]['stats'][key]
            elif all(key in t['stats'] for t in templates):
                # Check if it's a numeric or list value
                if isinstance(templates[0]['stats'][key], (int, float)):
                    # Average numeric values
                    values = [t['stats'][key] for t in templates]
                    combined_stats[key] = sum(values) / len(values)
                elif isinstance(templates[0]['stats'][key], list):
                    # Average lists element-wise if they have the same length
                    lists = [t['stats'][key] for t in templates]
                    if all(len(lst) == len(lists[0]) for lst in lists):
                        combined_list = []
                        for i in range(len(lists[0])):
                            combined_list.append(
                                sum(lst[i] for lst in lists) / len(lists)
                            )
                        combined_stats[key] = combined_list
        
        master['stats'] = combined_stats
    
    return master

def advanced_keypoint_clustering(keypoints, min_distance=10, max_clusters=20):
    """Advanced clustering algorithm for key points with adaptive distance"""
    if not keypoints or len(keypoints) <= 1:
        return keypoints
    
    points = np.array(keypoints)
    clusters = []
    
    # Sort points by density (number of neighbors)
    point_density = []
    for i, p in enumerate(points):
        neighbors = sum(1 for j, q in enumerate(points) if i != j and np.linalg.norm(p - q) < min_distance * 2)
        point_density.append((i, neighbors))
    
    # Process points from highest to lowest density
    for i, density in sorted(point_density, key=lambda x: x[1], reverse=True):
        if len(clusters) >= max_clusters:
            break
            
        p = points[i]
        
        # Check if point is too close to existing clusters
        too_close = False
        for cluster_center in clusters:
            if np.linalg.norm(p - cluster_center) < min_distance:
                too_close = True
                break
                
        if not too_close:
            # Create new cluster centered on this point
            cluster_points = [p]
            
            # Find nearby points
            for j, q in enumerate(points):
                if i != j and np.linalg.norm(p - q) < min_distance:
                    cluster_points.append(q)
            
            # Add weighted cluster center (original point has higher weight)
            if len(cluster_points) > 1:
                weights = [3.0 if np.array_equal(cp, p) else 1.0 for cp in cluster_points]
                weighted_sum = sum(cp * w for cp, w in zip(cluster_points, weights))
                center = (weighted_sum / sum(weights)).astype(int).tolist()
            else:
                center = p.tolist()
                
            clusters.append(center)
    
    return clusters

@app.route('/api/fingerprint/process-multiple', methods=['POST'])
def process_multiple_fingerprints():
    """Process multiple fingerprints with improved algorithms and directory cleanup"""
    start_time = time.time()
    data = request.json
    
    if not data:
        return jsonify({'success': False, 'message': 'Missing data'}), 400
    
    staff_id = data.get('staffId')
    if not staff_id:
        return jsonify({'success': False, 'message': 'Missing staff ID'}), 400
    
    # IMPORTANT: Clean the staff directory before processing new fingerprints
    if not clean_staff_directory(staff_id):
        print(f"Warning: Could not clean directory for staff {staff_id}")
    
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
    
    if len(fingerprints) > 5:  # Allow more fingerprints for better accuracy
        fingerprints = fingerprints[:5]
    
    templates = []
    saved_files = []
    quality_scores = []
    
    for i, fp_data in enumerate(fingerprints):
        try:
            img = base64_to_image(fp_data)
            
            # Enhanced preprocessing
            binary = enhanced_preprocessing(img)
            
            # Extract more robust features
            template = extract_advanced_features(binary)
            templates.append(template)
            
            # Calculate simple quality score based on contrast and ridge clarity
            try:
                contrast = float(template['stats']['contrast']) / 255.0
                white_ratio = float(template['stats']['white_ratio'])
                # Ideal white ratio is around 0.4-0.6
                ratio_quality = 1.0 - 2.0 * abs(white_ratio - 0.5)
                
                # A good fingerprint has decent contrast and balanced white/black areas
                quality = 0.5 * contrast + 0.5 * ratio_quality
                quality_scores.append(min(1.0, max(0.0, quality)))
            except Exception as e:
                print(f"Error calculating quality score: {e}")
                quality_scores.append(0.5)  # Default quality
            
            # Save to staff directory
            filepath = save_fingerprint_image(staff_id, fp_data, i)
            if filepath:
                saved_files.append(filepath)
        except Exception as e:
            print(f"Error processing fingerprint {i}: {e}")
    
    if not templates:
        return jsonify({'success': False, 'message': 'Failed to process fingerprints'}), 500
    
    # Use advanced template combination
    combined = combine_templates_advanced(templates)
    
    # Calculate average quality score
    avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0.7
    
    processing_time = time.time() - start_time
    if VERBOSE_LOGGING:
        print(f"Total processing time: {processing_time:.3f}s")
        print(f"Processed {len(templates)} fingerprints with avg quality: {avg_quality:.2f}")
    
    return jsonify({
        'success': True,
        'template': combined,
        'original_template': templates[0],
        'quality_score': avg_quality,
        'saved_files': saved_files,
        'processing_time': processing_time
    })

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
    """Enhanced fingerprint matching with improved accuracy"""
    start_time = time.time()
    data = request.json
    
    if not data or 'fingerPrint' not in data:
        return jsonify({'success': False, 'message': 'Missing fingerprint data'}), 400
    
    try:
        # Process the probe fingerprint
        img = base64_to_image(data['fingerPrint'])
        binary = enhanced_preprocessing(img)
        
        # Extract advanced features for more robust matching
        probe_features = extract_advanced_features(binary)
        
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
                # Calculate similarity with enhanced algorithm
                similarity = calculate_enhanced_similarity(probe_features, template)
                
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
        if match_results and match_results[0]['score'] >= MATCH_THRESHOLD:
            top_match = match_results[0]
            
            # Determine confidence level with more nuanced thresholds
            confidence = "low"
            if top_match['score'] >= HIGH_CONFIDENCE_THRESHOLD:
                confidence = "high"
            elif top_match['score'] >= MEDIUM_CONFIDENCE_THRESHOLD:
                confidence = "medium"
            
            # Apply additional checks for increased security
            # If variance is high, reduce confidence
            if top_match['variance'] > 0.1:
                confidence = "low"
            
            # Template count boosts confidence
            if top_match['templateCount'] >= 3 and top_match['score'] >= MEDIUM_CONFIDENCE_THRESHOLD:
                confidence = "medium" if confidence == "low" else confidence
            
            # If we have a second match, check if it's too close (could indicate false positive)
            if len(match_results) > 1:
                second_match = match_results[1]
                score_difference = top_match['score'] - second_match['score']
                
                # If top two scores are too close, reduce confidence
                if score_difference < 0.1 and second_match['score'] > 0.6:
                    confidence = "low"
            
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

if __name__ == '__main__':
    print("Starting enhanced fingerprint server on port 5500")
    app.run(host='0.0.0.0', port=5500, debug=False, use_reloader=False)