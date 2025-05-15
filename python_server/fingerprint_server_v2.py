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

def enhance_fingerprint(image):
    """Enhanced fingerprint preprocessing for better feature extraction"""
    # Convert to grayscale if needed
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    
    # Normalize
    normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    
    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(normalized)
    
    # Noise removal
    denoised = cv2.fastNlMeansDenoising(enhanced, None, 10, 7, 21)
    
    # Binarization using adaptive thresholding
    binary = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                  cv2.THRESH_BINARY_INV, 11, 2)
    
    # Morphological operations to improve ridge structure
    kernel = np.ones((3,3), np.uint8)
    processed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    
    # Thinning (skeletonization) for better minutiae extraction
    skeleton = get_skeleton(processed)
    
    return {
        'gray': gray,
        'enhanced': enhanced,
        'binary': binary,
        'skeleton': skeleton,
        'processed': processed
    }

def get_skeleton(binary):
    """Extract skeleton from binary image"""
    # Create an empty skeleton
    skeleton = np.zeros(binary.shape, np.uint8)
    
    # Get a copy of the image
    img = binary.copy()
    
    # Get a kernel for morphological operations
    kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3,3))
    
    # Iterate until the image is fully eroded
    while True:
        # Step 1: Open the image (erode then dilate)
        eroded = cv2.erode(img, kernel)
        temp = cv2.dilate(eroded, kernel)
        
        # Step 2: Subtract temp from the original image
        temp = cv2.subtract(img, temp)
        
        # Step 3: Add the result to the skeleton
        skeleton = cv2.bitwise_or(skeleton, temp)
        
        # Step 4: Set the eroded image for the next iteration
        img = eroded.copy()
        
        # Step 5: If there are no white pixels left, then we're done
        if cv2.countNonZero(img) == 0:
            break
    
    return skeleton

def extract_minutiae_points(processed_image):
    """Extract minutiae points using Harris corner detector"""
    # Extract key points using Harris corner detection
    corner_response = cv2.cornerHarris(processed_image, blockSize=2, ksize=3, k=0.04)
    
    # Threshold for corner response
    threshold = 0.01 * corner_response.max()
    corners = np.where(corner_response > threshold)
    
    # Convert to keypoints format
    keypoints = [cv2.KeyPoint(float(x), float(y), 1) for y, x in zip(corners[0], corners[1])]
    
    # Filter keypoints to avoid redundant ones
    filtered_keypoints = []
    min_distance = 10  # Minimum distance between keypoints
    
    for kp in keypoints:
        if all(np.sqrt((kp.pt[0] - existing_kp.pt[0])**2 + 
                      (kp.pt[1] - existing_kp.pt[1])**2) > min_distance 
               for existing_kp in filtered_keypoints):
            filtered_keypoints.append(kp)
    
    return filtered_keypoints

def extract_descriptors(processed_image, keypoints):
    """Extract feature descriptors using ORB"""
    # Create ORB descriptor
    orb = cv2.ORB_create(nfeatures=1500)
    
    # Compute descriptors
    _, descriptors = orb.compute(processed_image, keypoints)
    
    return descriptors

def match_fingerprints(descriptors1, descriptors2):
    """Match fingerprint descriptors using Brute-Force matcher with Hamming distance"""
    # Check if descriptors are valid
    if descriptors1 is None or descriptors2 is None:
        return 0, []
    if len(descriptors1) == 0 or len(descriptors2) == 0:
        return 0, []
    
    # Create BF matcher with Hamming distance
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    
    # Match descriptors
    matches = bf.match(descriptors1, descriptors2)
    
    # Sort matches by distance
    matches = sorted(matches, key=lambda x: x.distance)
    
    # Calculate match score
    if len(matches) > 0:
        # Use only good matches (low distance)
        max_distance = 100  # Maximum distance to consider
        good_matches = [m for m in matches if m.distance < max_distance]
        
        # Calculate matching score based on ratio of good matches to total keypoints
        match_ratio = len(good_matches) / min(len(descriptors1), len(descriptors2))
        
        # Normalize distances to 0-1 range (lower distances are better)
        if good_matches:
            avg_distance = np.mean([m.distance for m in good_matches])
            distance_score = max(0, 1 - (avg_distance / max_distance))
        else:
            distance_score = 0
        
        # Combined score (weighted average of ratio and distance score)
        match_score = 0.6 * match_ratio + 0.4 * distance_score
        
        return match_score, matches
    else:
        return 0, []

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

def create_template(images):
    """Process multiple fingerprint images and create a template"""
    if not images or len(images) == 0:
        return None
    
    all_keypoints = []
    all_descriptors = []
    
    for img_data in images:
        try:
            # Convert base64 to image
            img = base64_to_image(img_data)
            
            # Process the image
            processed = enhance_fingerprint(img)
            
            # Extract keypoints
            keypoints = extract_minutiae_points(processed['skeleton'])
            
            # Extract descriptors
            descriptors = extract_descriptors(processed['enhanced'], keypoints)
            
            if keypoints and descriptors is not None:
                # Convert keypoints to dictionaries
                keypoints_dict = [keypoint_to_dict(kp) for kp in keypoints]
                
                all_keypoints.append(keypoints_dict)
                all_descriptors.append(descriptors.tolist() if descriptors is not None else [])
        except Exception as e:
            logger.error(f"Error processing fingerprint image: {e}")
    
    # Create composite template
    template = {
        'keypoints': [kp for sublist in all_keypoints for kp in sublist],
        'descriptors': np.vstack(all_descriptors).tolist() if all_descriptors else []
    }
    
    return template

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
    
    # Process fingerprints
    template = create_template(fingerprints)
    
    if template is None:
        return jsonify({'success': False, 'message': 'Failed to create template'}), 500
    
    # Save images
    saved_files = []
    if staff_id:
        for i, fp_data in enumerate(fingerprints):
            filepath = save_fingerprint_image(staff_id, fp_data, i)
            if filepath:
                saved_files.append(filepath)
    
    processing_time = time.time() - start_time
    logger.info(f"Processed {len(fingerprints)} fingerprints in {processing_time:.3f}s")
    
    return jsonify({
        'success': True,
        'template': template,
        'quality_score': 0.85,  # This is a placeholder, implement real quality assessment if needed
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
        # Convert base64 to image
        img = base64_to_image(data['fingerPrint'])
        
        # Process the fingerprint
        processed = enhance_fingerprint(img)
        
        # Check quality
        quality_score = assess_image_quality(processed['enhanced'])
        if quality_score < 30:
            return jsonify({
                'success': False,
                'matched': False,
                'message': f'Poor quality fingerprint image (score: {quality_score}). Please try again.',
                'quality_score': quality_score
            }), 400
        
        # Extract features
        query_keypoints = extract_minutiae_points(processed['skeleton'])
        query_descriptors = extract_descriptors(processed['enhanced'], query_keypoints)
        
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
        
        # Match against all templates
        match_results = []
        
        for staff_id, templates in staff_templates.items():
            best_staff_score = 0
            
            for template in templates:
                # Check if template has valid descriptors and keypoints
                if ('descriptors' not in template or 
                    not template['descriptors'] or 
                    len(template['descriptors']) == 0):
                    continue
                
                template_descriptors = np.array(template['descriptors'], dtype=np.uint8)
                
                # Match descriptors
                score, _ = match_fingerprints(query_descriptors, template_descriptors)
                
                # Update best score for this staff
                best_staff_score = max(best_staff_score, score)
            
            # Add to results if there was a valid score
            if best_staff_score > 0:
                match_results.append({
                    'staffId': staff_id,
                    'score': best_staff_score,
                    'templateCount': len(templates)
                })
        
        # Sort by score
        match_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Determine match
        if match_results and match_results[0]['score'] >= 0.45:  # Threshold can be tuned
            top_match = match_results[0]
            
            # Determine confidence level
            confidence = "low"
            if top_match['score'] >= 0.65:
                confidence = "high"
            elif top_match['score'] >= 0.55:
                confidence = "medium"
            
            processing_time = time.time() - start_time
            logger.info(f"Matched fingerprint to staff ID {top_match['staffId']} with score {top_match['score']:.2f} in {processing_time:.3f}s")
            
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
            
            best_score = match_results[0]['score'] if match_results else 0
            logger.info(f"No match found for fingerprint. Best score: {best_score:.2f} in {processing_time:.3f}s")
            
            return jsonify({
                'success': False,
                'matched': False,
                'message': 'No matching fingerprint found',
                'bestScore': best_score,
                'processing_time': processing_time
            })
    
    except Exception as e:
        logger.error(f"Error in fingerprint matching: {e}")
        import traceback
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
        
        # Convert base64 to image
        img = base64_to_image(data['fingerPrint'])
        
        # Process the fingerprint
        processed = enhance_fingerprint(img)
        
        # Extract features
        query_keypoints = extract_minutiae_points(processed['skeleton'])
        query_descriptors = extract_descriptors(processed['enhanced'], query_keypoints)
        
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
        
        # Match against each template
        best_score = 0
        for template in staff_templates:
            if 'descriptors' not in template or not template['descriptors']:
                continue
                
            template_descriptors = np.array(template['descriptors'], dtype=np.uint8)
            
            # Match descriptors
            score, _ = match_fingerprints(query_descriptors, template_descriptors)
            
            # Update best score
            best_score = max(best_score, score)
        
        # Determine if verified
        verified = best_score >= 0.45  # Threshold can be tuned
        
        # Determine confidence level
        confidence = "low"
        if best_score >= 0.65:
            confidence = "high"
        elif best_score >= 0.55:
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
        
        return jsonify({
            'success': False,
            'verified': False,
            'message': f'Error processing fingerprint: {str(e)}',
            'error': str(e)
        }), 500

def assess_image_quality(img):
    """Assess fingerprint image quality (0-100)"""
    # Check contrast
    contrast = img.std()
    contrast_score = min(100, contrast / 2.55)
    
    # Check foreground/background separation
    otsu_threshold, _ = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    foreground = np.sum(img > otsu_threshold) / img.size
    foreground_score = 100 * (0.5 - abs(0.5 - foreground)) * 2
    
    # Check clarity (using gradient magnitude)
    sobelx = cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(img, cv2.CV_64F, 0, 1, ksize=3)
    gradient_mag = np.sqrt(sobelx**2 + sobely**2)
    clarity_score = min(100, np.mean(gradient_mag) / 2)
    
    # Weighted quality score
    quality_score = (contrast_score * 0.3) + (foreground_score * 0.2) + (clarity_score * 0.5)
    
    return round(quality_score)

@app.route('/api/status', methods=['GET'])
def server_status():
    return jsonify({
        'status': 'running',
        'version': '2.0',
        'uptime': time.time()
    })

if __name__ == '__main__':
    print("Starting enhanced fingerprint server on port 5500")
    app.run(host='0.0.0.0', port=5500, debug=True)