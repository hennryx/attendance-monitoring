from flask import Flask, request, jsonify
import cv2
import numpy as np
import base64
from PIL import Image
import io
import os
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# MongoDB connection
MONGO_URI = "mongodb+srv://hennryx101:OIXs7TPJhxHX9o8F@cluster0.croadpx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "Cluster0"

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
fingerprint_collection = db["fingerprints"]

def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    img_data = base64.b64decode(base64_string)
    img = Image.open(io.BytesIO(img_data))
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

def preprocess_fingerprint(img):
    """Process fingerprint image to enhance features"""
    # Convert to grayscale if not already
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
    
    # Resize to standardize
    gray = cv2.resize(gray, (500, 500))
    
    # Enhance contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)
    
    # Binary thresholding
    _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Thinning/skeletonization (simplified version)
    kernel = np.ones((3,3), np.uint8)
    skeleton = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    
    # Check image quality 
    quality = cv2.Laplacian(enhanced, cv2.CV_64F).var()
    
    return skeleton, quality

def extract_fingerprint_features(img):
    """Extract features using SIFT or ORB"""
    # Preprocess the image
    processed_img, quality = preprocess_fingerprint(img)
    
    # Use ORB (replacement for SIFT which is patented)
    orb = cv2.ORB_create(nfeatures=1000)
    keypoints, descriptors = orb.detectAndCompute(processed_img, None)
    
    # If no descriptors were found, return None
    if descriptors is None:
        return None, keypoints, quality
    
    return descriptors, keypoints, quality

def compare_fingerprints(probe_descriptors, probe_keypoints, candidate_descriptors, candidate_keypoints):
    """Compare two fingerprint descriptors and return a similarity score"""
    # If either descriptors are None, no match
    if probe_descriptors is None or candidate_descriptors is None:
        return 0
    
    # Create a brute force matcher
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    
    # Find matches
    matches = bf.match(probe_descriptors, candidate_descriptors)
    
    # Sort matches by distance (lower is better)
    matches = sorted(matches, key=lambda x: x.distance)
    
    # Calculate a similarity score
    if len(matches) > 0:
        # Get average distance
        avg_distance = sum(m.distance for m in matches) / len(matches)
        
        # Convert to a score (lower distance = higher score)
        score = max(0, 100 - avg_distance)
        
        # Consider the number of good matches
        good_matches = [m for m in matches if m.distance < 50]  # Threshold for good matches
        match_ratio = len(good_matches) / min(len(probe_keypoints), len(candidate_keypoints))
        
        # Combined score
        final_score = (score * 0.7 + match_ratio * 100 * 0.3)
    else:
        final_score = 0
    
    return final_score

@app.route('/api/fingerprint/enroll', methods=['POST'])
def enroll_fingerprint():
    data = request.json
    if not data or 'staffId' not in data or 'fingerPrint' not in data:
        return jsonify({
            'success': False,
            'message': 'Missing staffId or fingerPrint data'
        }), 400
    
    staff_id = data['staffId']
    fingerprint_data = data['fingerPrint']
    
    try:
        # Convert ObjectId string to ObjectId if necessary
        if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
            staff_id_obj = ObjectId(staff_id)
        else:
            staff_id_obj = staff_id
            
        # Convert base64 to image
        img = base64_to_image(fingerprint_data)
        
        # Extract features
        descriptors, keypoints, quality = extract_fingerprint_features(img)
        
        if descriptors is None:
            return jsonify({
                'success': False,
                'message': 'Failed to extract features from fingerprint image'
            }), 400
        
        # Check quality
        if quality < 100:  # Adjust threshold based on your needs
            return jsonify({
                'success': False,
                'message': f'Poor fingerprint quality ({quality:.2f}). Please try again with a clearer scan.'
            }), 400
        
        # Serialize keypoints and descriptors for storage
        serialized_keypoints = []
        for kp in keypoints:
            serialized_keypoints.append({
                'x': float(kp.pt[0]),
                'y': float(kp.pt[1]),
                'size': float(kp.size),
                'angle': float(kp.angle),
                'response': float(kp.response),
                'octave': int(kp.octave),
                'class_id': int(kp.class_id) if kp.class_id is not None else -1
            })
        
        serialized_descriptors = descriptors.tolist() if descriptors is not None else []
        
        # Check if staff ID already exists in the fingerprint collection
        existing_record = fingerprint_collection.find_one({"staffId": staff_id_obj})
        
        template = {
            "keypoints": serialized_keypoints,
            "descriptors": serialized_descriptors,
            "quality": float(quality)
        }
        
        if existing_record:
            # Update existing record
            fingerprint_collection.update_one(
                {"staffId": staff_id_obj},
                {"$set": {
                    "template": template,
                    "original": fingerprint_data,
                }}
            )
            message = "Fingerprint updated successfully!"
        else:
            # Create new record
            fingerprint_collection.insert_one({
                "staffId": staff_id_obj,
                "template": template,
                "original": fingerprint_data,
            })
            message = "Fingerprint enrolled successfully!"
        
        return jsonify({
            'success': True,
            'message': message
        })
        
    except Exception as e:
        print(f"Error enrolling fingerprint: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Enrollment error: {str(e)}'
        }), 500

@app.route('/api/fingerprint/match', methods=['POST'])
def match_fingerprint():
    data = request.json
    if not data or 'fingerPrint' not in data:
        return jsonify({
            'success': False,
            'message': 'Missing fingerPrint data'
        }), 400
    
    try:
        print("Processing fingerprint for matching...")
        
        # Convert base64 to image
        img = base64_to_image(data['fingerPrint'])
        
        # Extract features
        probe_descriptors, probe_keypoints, quality = extract_fingerprint_features(img)
        
        if probe_descriptors is None:
            return jsonify({
                'success': False,
                'message': 'Failed to extract features from fingerprint image'
            }), 400
        
        if quality < 100:  # Adjust threshold based on your needs
            return jsonify({
                'success': False,
                'message': f'Poor fingerprint quality ({quality:.2f}). Please try again with a clearer scan.'
            }), 400
        
        # Match against database
        best_match = {"staffId": None, "score": 0}
        MATCH_THRESHOLD = 60  # Adjust based on your testing
        
        # Get all fingerprint records from the database
        fingerprint_records = list(fingerprint_collection.find())
        
        print(f"Comparing against {len(fingerprint_records)} stored fingerprints...")
        
        for record in fingerprint_records:
            if 'template' in record:
                staff_id = record['staffId']
                template = record['template']
                
                try:
                    # Rebuild keypoints and descriptors
                    candidate_keypoints = []
                    for kp_data in template['keypoints']:
                        kp = cv2.KeyPoint(
                            x=kp_data['x'],
                            y=kp_data['y'],
                            size=kp_data['size'],
                            angle=kp_data['angle'],
                            response=kp_data['response'],
                            octave=kp_data['octave'],
                            class_id=kp_data['class_id'] if kp_data['class_id'] != -1 else None
                        )
                        candidate_keypoints.append(kp)
                    
                    candidate_descriptors = np.array(template['descriptors'], dtype=np.uint8)
                    
                    # Compare fingerprints
                    score = compare_fingerprints(
                        probe_descriptors, 
                        probe_keypoints, 
                        candidate_descriptors, 
                        candidate_keypoints
                    )
                    
                    print(f"Score with user {staff_id}: {score}")
                    
                    if score > best_match["score"]:
                        best_match["staffId"] = staff_id
                        best_match["score"] = score
                except Exception as e:
                    print(f"Error matching with template for {staff_id}: {str(e)}")
        
        if best_match["score"] >= MATCH_THRESHOLD:
            print(f"Match found: {best_match['staffId']} with score {best_match['score']}")
            return jsonify({
                'success': True,
                'matched': True,
                'staffId': str(best_match["staffId"]),
                'score': float(best_match["score"])
            })
        else:
            print(f"No match found. Best score: {best_match['score']}")
            return jsonify({
                'success': False,
                'matched': False,
                'staffId': str(best_match["staffId"]),
                'bestScore': float(best_match["score"])
            })
            
    except Exception as e:
        print(f"Error matching fingerprint: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Matching error: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5500, debug=True)