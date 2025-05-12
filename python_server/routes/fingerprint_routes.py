from flask import Blueprint, request, jsonify, send_file
from utils.fingerprint_processor import FingerprintProcessor
from utils.matcher import FingerprintMatcher
from utils.db import Database
from config import MATCH_THRESHOLD, MIN_ENROLLMENTS, MAX_ENROLLMENTS, STORE_ORIGINAL_IMAGE
import os
import base64
import cv2
import numpy as np
import io
import time
import functools
import threading

# Create a blueprint for fingerprint routes
fingerprint_bp = Blueprint('fingerprint', __name__, url_prefix='/api/fingerprint')

# Initialize database connection
db = Database()

# Global variable to control background syncing
background_sync_active = False
sync_interval = 300  # 5 minutes

# Simple in-memory cache for enrollment status (staffId -> status info)
enrollment_cache = {}
cache_lock = threading.Lock()
CACHE_TIMEOUT = 60  # seconds

def timed_lru_cache(seconds=120, maxsize=128):
    """Time-based cache decorator"""
    def decorator(func):
        @functools.lru_cache(maxsize=maxsize)
        def wrapper(*args, expire_time=None, **kwargs):
            now = time.time()
            if expire_time is None or now >= expire_time:
                result = func(*args, **kwargs)
                expire_time = now + seconds
                return (result, expire_time)
            return wrapper(*args, expire_time=expire_time, **kwargs)
        
        @functools.wraps(func)
        def inner(*args, **kwargs):
            result, _ = wrapper(*args, **kwargs)
            return result
            
        inner.cache_clear = wrapper.cache_clear
        
        return inner
    return decorator

@fingerprint_bp.route('/enroll', methods=['POST'])
def enroll_fingerprint():
    """Enroll a new fingerprint template for a staff ID."""
    start_time = time.time()
    try:
        print("Starting fingerprint enrollment...")
        data = request.json
        if not data or 'staffId' not in data or 'fingerPrint' not in data:
            return jsonify({
                'success': False,
                'message': 'Missing staffId or fingerPrint data'
            }), 400
        
        staff_id = data['staffId']
        fingerprint_data = data['fingerPrint']
        
        print(f"Processing fingerprint for enrollment (Staff ID: {staff_id})...")
        
        # Get current template count (with caching for performance)
        with cache_lock:
            # Check if we have a cached enrollment status
            if staff_id in enrollment_cache:
                cache_entry = enrollment_cache[staff_id]
                # If cache is still valid, use it
                if time.time() - cache_entry['timestamp'] < CACHE_TIMEOUT:
                    current_count = cache_entry['count']
                    print(f"Using cached template count: {current_count}")
                else:
                    # Cache expired, get fresh count
                    current_count = db.get_template_count_for_staff_id(staff_id)
                    # Update cache
                    enrollment_cache[staff_id] = {
                        'count': current_count,
                        'timestamp': time.time()
                    }
            else:
                # No cache entry, get fresh count
                current_count = db.get_template_count_for_staff_id(staff_id)
                # Create cache entry
                enrollment_cache[staff_id] = {
                    'count': current_count,
                    'timestamp': time.time()
                }
        
        print(f"Current template count for {staff_id}: {current_count}")
        
        # Check if max enrollments reached
        if current_count >= MAX_ENROLLMENTS:
            return jsonify({
                'success': False,
                'message': f'Maximum enrollment limit reached ({MAX_ENROLLMENTS})',
                'enrollCount': current_count,
                'maxEnrollments': MAX_ENROLLMENTS
            }), 400
        
        # Convert base64 to image
        feature_start = time.time()
        img = FingerprintProcessor.base64_to_image(fingerprint_data)
        
        # Extract features with enhanced processor
        template = FingerprintProcessor.extract_fingerprint_features(img)
        feature_time = time.time() - feature_start
        print(f"Feature extraction took {feature_time:.2f} seconds")
        
        # Check feature quality
        minutiae_count = len(template.get('minutiae', []))
        keypoint_count = len(template.get('keypoints', []))
        print(f"Extracted {minutiae_count} minutiae points and {keypoint_count} keypoints")
        
        if minutiae_count < 10 or keypoint_count < 50:
            return jsonify({
                'success': False,
                'message': 'Low quality fingerprint image. Please try again.',
                'enrollCount': current_count,
                'minutiaeCount': minutiae_count,
                'keypointCount': keypoint_count,
                'minEnrollments': MIN_ENROLLMENTS
            }), 400
        
        # Store original image only if configured to do so
        original_data = fingerprint_data if STORE_ORIGINAL_IMAGE else None
        
        # Add new template (don't replace existing ones)
        db_start = time.time()
        success, new_count = db.add_fingerprint_template(staff_id, template, original_data)
        db_time = time.time() - db_start
        print(f"Database operation took {db_time:.2f} seconds")
        
        # Update cache with new count
        with cache_lock:
            enrollment_cache[staff_id] = {
                'count': new_count,
                'timestamp': time.time()
            }
        
        if success:
            enrollment_status = "complete" if new_count >= MIN_ENROLLMENTS else "incomplete"
            remaining = max(0, MIN_ENROLLMENTS - new_count)
            
            message = f"Fingerprint template enrolled successfully! ({new_count}/{MIN_ENROLLMENTS})"
            if remaining > 0:
                message += f" {remaining} more sample(s) recommended."
            else:
                message += " Enrollment complete."
            
            total_time = time.time() - start_time
            print(f"Total enrollment time: {total_time:.2f} seconds")
                
            return jsonify({
                'success': True,
                'message': message,
                'enrollCount': new_count,
                'enrollStatus': enrollment_status,
                'maxEnrollments': MAX_ENROLLMENTS,
                'minEnrollments': MIN_ENROLLMENTS,
                'remaining': remaining,
                'minutiaeCount': minutiae_count,
                'keypointCount': keypoint_count,
                'processingTime': total_time
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to enroll fingerprint template',
                'enrollCount': current_count
            }), 500
        
    except ValueError as ve:
        print(f"Enrollment validation error: {str(ve)}")
        return jsonify({
            'success': False,
            'message': f'Validation error: {str(ve)}'
        }), 400
    except Exception as e:
        print(f"Enrollment error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Enrollment error: {str(e)}'
        }), 500

@fingerprint_bp.route('/match', methods=['POST'])
def match_fingerprint():
    """Match a fingerprint against the database with multi-enrollment support."""
    try:
        data = request.json
        if not data or 'fingerPrint' not in data:
            return jsonify({
                'success': False,
                'message': 'Missing fingerPrint data'
            }), 400
        
        print("Processing fingerprint for matching...")
        
        # Extract custom threshold if provided
        custom_threshold = float(data.get('threshold', MATCH_THRESHOLD))
        
        # Convert base64 to image
        start_time = time.time()
        img = FingerprintProcessor.base64_to_image(data['fingerPrint'])
        
        # Extract features with enhanced processor
        probe_template = FingerprintProcessor.extract_fingerprint_features(img)
        feature_time = time.time() - start_time
        
        print(f"Feature extraction took {feature_time:.2f} seconds")
        print(f"Extracted {len(probe_template.get('minutiae', []))} minutiae points")
        print(f"Extracted {len(probe_template.get('keypoints', []))} keypoints")
        
        # Get all fingerprint records
        fingerprint_records = db.get_all_fingerprints()
        
        if not fingerprint_records:
            return jsonify({
                'success': False,
                'message': 'No fingerprint records available for matching',
                'matched': False
            })
        
        # Match against database with improved matcher
        start_time = time.time()
        match_result = FingerprintMatcher.match_against_database(
            probe_template, 
            fingerprint_records,
            match_threshold=custom_threshold
        )
        match_time = time.time() - start_time
        
        print(f"Matching took {match_time:.2f} seconds")
        
        # Get template count information
        template_count = match_result["template_count"]
        min_enrollments_met = template_count >= MIN_ENROLLMENTS
        
        if match_result["matched"]:
            print(f"Match found: {match_result['staffId']} with score {match_result['score']:.4f} "
                  f"(confidence: {match_result['confidence']})")
            
            # Include enrollment status in response
            return jsonify({
                'success': True,
                'matched': True,
                'staffId': str(match_result["staffId"]),
                'score': match_result["score"],
                'confidence': match_result["confidence"],
                'threshold': custom_threshold,
                'templateCount': template_count,
                'enrollmentComplete': min_enrollments_met,
                'minutiaeCount': len(probe_template.get('minutiae', [])),
                'keypointCount': len(probe_template.get('keypoints', []))
            })
        else:
            print(f"No match found. Best score: {match_result['score']:.4f}")
            return jsonify({
                'success': True,
                'matched': False,
                'bestScore': match_result["score"],
                'threshold': custom_threshold,
                'minutiaeCount': len(probe_template.get('minutiae', [])),
                'keypointCount': len(probe_template.get('keypoints', []))
            })
            
    except ValueError as ve:
        print(f"Matching validation error: {str(ve)}")
        return jsonify({
            'success': False,
            'message': f'Validation error: {str(ve)}'
        }), 400
    except Exception as e:
        print(f"Matching error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Matching error: {str(e)}'
        }), 500

@fingerprint_bp.route('/templates/<staff_id>', methods=['GET'])
def get_templates(staff_id):
    """Get enrollment status and template count for a staff ID.
    This endpoint is critical for the frontend to display enrollment progress."""
    start_time = time.time()
    try:
        print(f"Getting template status for staff ID: {staff_id}")
        
        # Check cache first for quick response
        with cache_lock:
            if staff_id in enrollment_cache:
                cache_entry = enrollment_cache[staff_id]
                # If cache is still valid, use it
                if time.time() - cache_entry['timestamp'] < CACHE_TIMEOUT:
                    template_count = cache_entry['count']
                    print(f"Using cached template count: {template_count}")
                    
                    # Use cached count to determine status
                    enrollment_status = "complete" if template_count >= MIN_ENROLLMENTS else "incomplete"
                    remaining = max(0, MIN_ENROLLMENTS - template_count)
                    
                    response_time = time.time() - start_time
                    print(f"Response time (cached): {response_time:.4f} seconds")
                    
                    return jsonify({
                        'success': True,
                        'staffId': staff_id,
                        'templateCount': template_count,
                        'enrollmentStatus': enrollment_status,
                        'minEnrollments': MIN_ENROLLMENTS,
                        'maxEnrollments': MAX_ENROLLMENTS,
                        'remaining': remaining,
                        'fromCache': True,
                        'responseTime': response_time
                    })
        
        # Cache miss or expired, get actual data
        print("Cache miss, getting templates from database")
        db_start = time.time()
        templates = db.get_fingerprint_templates_by_staff_id(staff_id)
        db_time = time.time() - db_start
        print(f"Database query took {db_time:.4f} seconds")
        
        template_count = len(templates)
        
        # Update cache with fresh count
        with cache_lock:
            enrollment_cache[staff_id] = {
                'count': template_count,
                'timestamp': time.time()
            }
        
        enrollment_status = "complete" if template_count >= MIN_ENROLLMENTS else "incomplete"
        remaining = max(0, MIN_ENROLLMENTS - template_count)
        
        response_time = time.time() - start_time
        print(f"Total response time: {response_time:.4f} seconds")
        
        return jsonify({
            'success': True,
            'staffId': staff_id,
            'templateCount': template_count,
            'enrollmentStatus': enrollment_status,
            'minEnrollments': MIN_ENROLLMENTS,
            'maxEnrollments': MAX_ENROLLMENTS,
            'remaining': remaining,
            'fromCache': False,
            'responseTime': response_time
        })
        
    except Exception as e:
        error_time = time.time() - start_time
        print(f"Error getting templates: {str(e)}")
        print(f"Error occurred after {error_time:.4f} seconds")
        
        # Still provide a valid response with defaults
        return jsonify({
            'success': True,  # Return success=true to avoid frontend errors
            'staffId': staff_id,
            'templateCount': 0,
            'enrollmentStatus': "incomplete",
            'minEnrollments': MIN_ENROLLMENTS,
            'maxEnrollments': MAX_ENROLLMENTS,
            'remaining': MIN_ENROLLMENTS,
            'fromCache': False,
            'error': str(e),
            'message': "Using default values due to error"
        })

@fingerprint_bp.route('/templates/<staff_id>', methods=['DELETE'])
def delete_templates(staff_id):
    """Delete all templates for a staff ID."""
    try:
        print(f"Deleting templates for staff ID: {staff_id}")
        deleted_count = db.delete_fingerprint_templates(staff_id)
        
        # Clear cache entry
        with cache_lock:
            if staff_id in enrollment_cache:
                del enrollment_cache[staff_id]
        
        return jsonify({
            'success': True,
            'staffId': staff_id,
            'deletedCount': deleted_count,
            'message': f'Deleted {deleted_count} templates for staff ID {staff_id}'
        })
        
    except Exception as e:
        print(f"Error deleting templates: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error deleting templates: {str(e)}'
        }), 500

@fingerprint_bp.route('/debug', methods=['POST'])
def debug_fingerprint():
    """Debug endpoint to visualize fingerprint processing."""
    try:
        data = request.json
        if not data or 'fingerPrint' not in data:
            return jsonify({
                'success': False,
                'message': 'Missing fingerPrint data'
            }), 400
        
        # Convert base64 to image
        img = FingerprintProcessor.base64_to_image(data['fingerPrint'])
        
        # Process and visualize
        processed_img = FingerprintProcessor.preprocess_fingerprint(img)
        
        # Extract features
        template = FingerprintProcessor.extract_fingerprint_features(img)
        
        # Create a color visualization of the processed image
        height, width = processed_img.shape
        visual = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Copy processed image to all channels
        visual[:,:,0] = processed_img
        visual[:,:,1] = processed_img
        visual[:,:,2] = processed_img
        
        # Draw minutiae points for visualization
        for minutia in template.get('minutiae', []):
            x, y = int(minutia['x']), int(minutia['y'])
            if 0 <= x < width and 0 <= y < height:
                # Draw bifurcations in green, endings in red
                color = (0, 255, 0) if minutia['type'] == 'bifurcation' else (0, 0, 255)
                cv2.circle(visual, (x, y), 5, color, -1)
        
        # Draw keypoints
        for keypoint in template.get('keypoints', [])[:50]:  # Limit to 50 keypoints to avoid clutter
            x, y = int(keypoint['x']), int(keypoint['y'])
            if 0 <= x < width and 0 <= y < height:
                cv2.circle(visual, (x, y), 3, (255, 0, 0), -1)
        
        # Convert the visualization to base64
        _, buffer = cv2.imencode('.png', visual)
        visual_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Return debug information
        return jsonify({
            'success': True,
            'visualization': f"data:image/png;base64,{visual_base64}",
            'minutiaeCount': len(template.get('minutiae', [])),
            'keypointCount': len(template.get('keypoints', [])),
            'hashLength': len(template.get('hash', '')),
            'descriptorCount': len(template.get('descriptors', [])),
            'textureFeatureCount': len(template.get('texture', [])),
            'patternGridSize': len(template.get('pattern', []))
        })
        
    except Exception as e:
        print(f"Debug error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Debug error: {str(e)}'
        }), 500

@fingerprint_bp.route('/test', methods=['GET'])
def test_connection():
    """Test route to verify API is working"""
    try:
        # Test database connection
        db_status = "Connected"
        try:
            db._ensure_connection()
            if db.client:
                db.fingerprint_collection.find_one({})
            else:
                db_status = "Disconnected: No client"
        except Exception as e:
            db_status = f"Disconnected: {str(e)}"
        
        # Get local storage info
        local_templates = {}
        for staff_id, templates in db.local_cache.items():
            local_templates[staff_id] = len(templates)
        
        # Get cache info
        cache_info = {}
        with cache_lock:
            for staff_id, entry in enrollment_cache.items():
                cache_info[staff_id] = {
                    'count': entry['count'],
                    'age': time.time() - entry['timestamp']
                }
        
        return jsonify({
            'success': True,
            'message': 'Fingerprint API is running!',
            'version': '3.1',
            'database_status': db_status,
            'match_threshold': MATCH_THRESHOLD,
            'min_enrollments': MIN_ENROLLMENTS,
            'max_enrollments': MAX_ENROLLMENTS,
            'store_original_image': STORE_ORIGINAL_IMAGE,
            'local_templates': local_templates,
            'cache_info': cache_info
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Test error: {str(e)}',
            'version': '3.1'
        })

@fingerprint_bp.route('/sync', methods=['POST'])
def sync_to_mongodb():
    """Sync local data to MongoDB."""
    try:
        synced_count = db.sync_to_mongodb()
        
        return jsonify({
            'success': True,
            'message': f'Synced {synced_count} templates to MongoDB',
            'syncedCount': synced_count
        })
        
    except Exception as e:
        print(f"Sync error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Sync error: {str(e)}'
        }), 500

@fingerprint_bp.route('/clear-cache', methods=['POST'])
def clear_cache():
    """Clear the enrollment cache."""
    try:
        with cache_lock:
            cache_size = len(enrollment_cache)
            enrollment_cache.clear()
        
        return jsonify({
            'success': True,
            'message': f'Cleared cache with {cache_size} entries'
        })
        
    except Exception as e:
        print(f"Cache clear error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Cache clear error: {str(e)}'
        }), 500

def background_sync_task():
    """Background task to synchronize local data to MongoDB periodically."""
    global background_sync_active
    
    while background_sync_active:
        try:
            print("Running background sync...")
            result = db.sync_to_mongodb()
            print(f"Background sync completed: {result}")
        except Exception as e:
            print(f"Background sync error: {str(e)}")
        
        # Sleep for the sync interval
        time.sleep(sync_interval)

@fingerprint_bp.route('/background-sync/start', methods=['POST'])
def start_background_sync():
    """Start the background sync process."""
    global background_sync_active
    
    try:
        data = request.json
        interval = data.get('interval', 300)  # Default 5 minutes
        
        if background_sync_active:
            return jsonify({
                'success': False,
                'message': 'Background sync is already running'
            })
        
        # Set the interval and activate
        global sync_interval
        sync_interval = max(60, interval)  # Minimum 1 minute
        background_sync_active = True
        
        # Start the background thread
        sync_thread = threading.Thread(target=background_sync_task)
        sync_thread.daemon = True
        sync_thread.start()
        
        return jsonify({
            'success': True,
            'message': f'Background sync started with interval of {sync_interval} seconds'
        })
        
    except Exception as e:
        print(f"Error starting background sync: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error starting background sync: {str(e)}'
        }), 500

@fingerprint_bp.route('/background-sync/stop', methods=['POST'])
def stop_background_sync():
    """Stop the background sync process."""
    global background_sync_active
    
    try:
        if not background_sync_active:
            return jsonify({
                'success': False,
                'message': 'Background sync is not running'
            })
        
        background_sync_active = False
        
        return jsonify({
            'success': True,
            'message': 'Background sync stopped'
        })
        
    except Exception as e:
        print(f"Error stopping background sync: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error stopping background sync: {str(e)}'
        }), 500