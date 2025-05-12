import cv2
import numpy as np
from scipy.spatial import distance
from scipy.optimize import linear_sum_assignment

class FingerprintMatcher:
    """Enhanced fingerprint template matching with multi-enrollment support."""
    
    @staticmethod
    def compare_fingerprints(probe, candidate, match_threshold=0.36):
        """Compare fingerprints with a balance between leniency and selectivity.
        
        Args:
            probe (dict): Probe fingerprint template
            candidate (dict): Candidate fingerprint template
            match_threshold (float): Threshold for match determination
            
        Returns:
            float: Similarity score between 0 and 1
        """
        try:
            print("\n========== DETAILED MATCHING DEBUG ==========")
            print(f"Probe template keys: {list(probe.keys())}")
            print(f"Candidate template keys: {list(candidate.keys())}")
            
            # Check for keypoints and descriptors
            probe_keypoints_count = len(probe.get('keypoints', []))
            candidate_keypoints_count = len(candidate.get('keypoints', []))
            print(f"Probe keypoints: {probe_keypoints_count}")
            print(f"Candidate keypoints: {candidate_keypoints_count}")
            
            probe_descriptors_count = len(probe.get('descriptors', []))
            candidate_descriptors_count = len(candidate.get('descriptors', []))
            if probe_descriptors_count > 0 and candidate_descriptors_count > 0:
                print(f"Probe descriptors: {probe_descriptors_count}")
                print(f"Candidate descriptors: {candidate_descriptors_count}")
            else:
                print("WARNING: Empty descriptors found")
            
            probe_minutiae_count = len(probe.get('minutiae', []))
            candidate_minutiae_count = len(candidate.get('minutiae', []))
            print(f"Probe minutiae: {probe_minutiae_count}")
            print(f"Candidate minutiae: {candidate_minutiae_count}")
            
            # SPECIAL CHECK: If candidate has no features but probe does,
            # base match ONLY on hash similarity with higher weight
            if ((candidate_keypoints_count == 0 or candidate_minutiae_count == 0) and 
                (probe_keypoints_count > 0 and probe_minutiae_count > 0)):
                print("SPECIAL CASE: Candidate has no features - using hash-based matching")
                
                # Calculate hash similarity with high priority
                hash_similarity = FingerprintMatcher._compare_hashes(probe, candidate)
                print(f"Hash similarity: {hash_similarity:.4f}")
                
                # Return a modest score for empty templates - not too high
                enhanced_score = hash_similarity * 0.4  # Scale down significantly
                
                print(f"Final score (hash-based): {enhanced_score:.4f}")
                print(f"Match threshold: {match_threshold:.4f}")
                print(f"Match result: {'Match' if enhanced_score >= match_threshold else 'No match'}")
                print("==============================================\n")
                
                return enhanced_score
            
            # Define weights for different comparison methods
            weights = {
                'hash': 0.1,              # Reduced importance for hash
                'descriptors': 0.4,       # Increased descriptors weight
                'minutiae': 0.4,          # Increased minutiae weight
                'texture': 0.05,          # Less importance for texture
                'pattern': 0.05           # Less importance for pattern
            }
            
            print(f"Using weights: {weights}")
            
            # 1. Hash comparison - used primarily as a quick filter
            hash_similarity = FingerprintMatcher._compare_hashes(probe, candidate)
            print(f"Hash similarity: {hash_similarity:.4f}")
            
            # 2. Descriptor matching (keypoints)
            descriptor_similarity = FingerprintMatcher._compare_descriptors(probe, candidate)
            print(f"Descriptor similarity: {descriptor_similarity:.4f}")
            
            # 3. Minutiae point matching (most important)
            minutiae_similarity = FingerprintMatcher._compare_minutiae(probe, candidate)
            print(f"Minutiae similarity: {minutiae_similarity:.4f}")
            
            # 4. Texture pattern comparison
            texture_similarity = FingerprintMatcher._compare_textures(probe, candidate)
            print(f"Texture similarity: {texture_similarity:.4f}")
            
            # 5. Global pattern comparison
            pattern_similarity = FingerprintMatcher._compare_patterns(probe, candidate)
            print(f"Pattern similarity: {pattern_similarity:.4f}")
            
            # Calculate weighted score
            final_score = (
                hash_similarity * weights['hash'] +
                descriptor_similarity * weights['descriptors'] +
                minutiae_similarity * weights['minutiae'] +
                texture_similarity * weights['texture'] +
                pattern_similarity * weights['pattern']
            )
            
            # Balanced score enhancement that doesn't over-boost
            enhanced_score = FingerprintMatcher._apply_balanced_score_enhancement(final_score)
            
            print(f"Final score (raw): {final_score:.4f}")
            print(f"Final score (enhanced): {enhanced_score:.4f}")
            print(f"Match threshold: {match_threshold:.4f}")
            print(f"Match result: {'Match' if enhanced_score >= match_threshold else 'No match'}")
            print("==============================================\n")
            
            return enhanced_score
            
        except Exception as e:
            print(f"Error in fingerprint comparison: {str(e)}")
            return 0.0
    
    @staticmethod
    def _apply_balanced_score_enhancement(score):
        """Apply a balanced non-linear transformation to enhance matching."""
        # Moderate enhancement that doesn't over-boost low scores
        if score < 0.4:
            # Modest increase for lower scores
            return score * 1.1
        else:
            # Moderate boost for higher scores
            return 0.4 + ((score - 0.4) * 1.5)
    
    @staticmethod
    def _compare_hashes(probe, candidate):
        """Compare perceptual hashes."""
        try:
            if 'hash' in probe and 'hash' in candidate and probe['hash'] and candidate['hash']:
                # Ensure equal length by truncating the longer hash if necessary
                min_len = min(len(probe['hash']), len(candidate['hash']))
                # Only compare the first min_len bits
                hash1 = np.array([int(bit) for bit in probe['hash'][:min_len]])
                hash2 = np.array([int(bit) for bit in candidate['hash'][:min_len]])
                
                # Hamming distance (use NumPy for vectorized XOR)
                hash_similarity = 1.0 - np.mean(np.logical_xor(hash1, hash2))
                return hash_similarity
            return 0.0  # Return 0 for missing hash - be more strict
        except Exception as e:
            print(f"Hash comparison error: {str(e)}")
            return 0.0
    
    @staticmethod
    def _compare_descriptors(probe, candidate):
        """Enhanced descriptor matching with a balance between leniency and selectivity."""
        try:
            # Check if both templates have descriptors and keypoints
            if ('descriptors' in probe and 'descriptors' in candidate and 
                    probe['descriptors'] and candidate['descriptors'] and
                    'keypoints' in probe and 'keypoints' in candidate and
                    probe['keypoints'] and candidate['keypoints']):
                
                # Convert lists back to numpy arrays
                desc1 = np.array(probe['descriptors'], dtype=np.uint8)
                desc2 = np.array(candidate['descriptors'], dtype=np.uint8)
                
                if desc1.size == 0 or desc2.size == 0:
                    print("Empty descriptors detected")
                    return 0.0  # Return 0 - be more strict
                
                # Create BFMatcher with Hamming distance
                bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
                
                try:
                    # Match descriptors with k=2 for ratio test
                    matches = bf.knnMatch(desc1, desc2, k=2)
                    
                    # Apply balanced ratio test
                    good_matches = []
                    for match_pair in matches:
                        if len(match_pair) == 2:  # Ensure we have two matches for ratio test
                            m, n = match_pair
                            # Using a balanced ratio (0.8 is standard)
                            if m.distance < 0.8 * n.distance:  
                                good_matches.append(m)
                    
                    if not good_matches:
                        print("No good matches found in descriptors")
                        return 0.0
                    
                    print(f"Good matches: {len(good_matches)} out of {len(matches)}")
                    
                    # Calculate match ratio with balanced scoring
                    match_ratio = len(good_matches) / min(len(probe['keypoints']), len(candidate['keypoints']))
                    
                    # Calculate average distance with balanced normalization
                    distances = np.array([m.distance for m in good_matches])
                    avg_distance = np.mean(distances)
                    # Balanced distance normalization
                    norm_distance = max(0, 1 - (avg_distance / 100))  
                    
                    print(f"Match ratio: {match_ratio:.4f}, Norm distance: {norm_distance:.4f}")
                    
                    # 3. Check spatial consistency if enough matches
                    inlier_ratio = 0.0
                    if len(good_matches) >= 4:  # Minimum needed for homography
                        try:
                            # Extract source and destination points
                            src_pts = np.float32([
                                [probe['keypoints'][m.queryIdx]['x'], probe['keypoints'][m.queryIdx]['y']] 
                                for m in good_matches
                            ]).reshape(-1, 1, 2)
                            
                            dst_pts = np.float32([
                                [candidate['keypoints'][m.trainIdx]['x'], candidate['keypoints'][m.trainIdx]['y']] 
                                for m in good_matches
                            ]).reshape(-1, 1, 2)
                            
                            # Find homography with balanced RANSAC threshold
                            M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)  # Standard value
                            
                            if M is not None:
                                # Count inliers
                                inlier_count = np.sum(mask)
                                inlier_ratio = inlier_count / len(good_matches) if len(good_matches) > 0 else 0
                                print(f"Inlier ratio: {inlier_ratio:.4f} ({inlier_count} inliers)")
                            else:
                                print("No homography found")
                        except Exception as e:
                            print(f"Homography calculation error: {str(e)}")
                    
                    # Combine factors with balanced weights
                    descriptor_similarity = (
                        match_ratio * 0.4 +
                        norm_distance * 0.3 + 
                        inlier_ratio * 0.3
                    )
                    
                    # No additional boost - keep original score
                    return descriptor_similarity
                    
                except Exception as e:
                    print(f"BFMatcher error: {str(e)}")
                    return 0.0
            
            return 0.0  # Return 0 when descriptors are missing - be more strict
        except Exception as e:
            print(f"Descriptor comparison error: {str(e)}")
            return 0.0
    
    @staticmethod
    def _compare_minutiae(probe, candidate):
        """Compare minutiae points with balanced strictness."""
        try:
            if 'minutiae' in probe and 'minutiae' in candidate:
                minutiae1 = probe['minutiae']
                minutiae2 = candidate['minutiae']
                
                if not minutiae1 or not minutiae2:
                    print("No minutiae points found in at least one template")
                    return 0.0  # Return 0 - be more strict
                
                print(f"Comparing {len(minutiae1)} vs {len(minutiae2)} minutiae points")
                
                # Step 1: Create cost matrix for matching
                cost_matrix = np.zeros((len(minutiae1), len(minutiae2)))
                
                for i, m1 in enumerate(minutiae1):
                    for j, m2 in enumerate(minutiae2):
                        # Calculate spatial distance
                        spatial_dist = np.sqrt((m1['x'] - m2['x'])**2 + (m1['y'] - m2['y'])**2)
                        
                        # Calculate directional distance (if direction is available)
                        if 'direction' in m1 and 'direction' in m2:
                            # Handle angular difference (considering the circular nature)
                            dir1 = m1['direction'] % 360
                            dir2 = m2['direction'] % 360
                            direction_diff = min(abs(dir1 - dir2), 360 - abs(dir1 - dir2))
                            norm_direction_diff = direction_diff / 180.0  # Normalize to 0-1
                        else:
                            norm_direction_diff = 0.5  # Default if direction not available
                        
                        # Calculate type difference
                        type_diff = 0.0 if m1['type'] == m2['type'] else 1.0
                        
                        # Combine differences with weights
                        # Using balanced spatial tolerance
                        max_dist = 500.0  # Standard value
                        norm_spatial_dist = min(spatial_dist / max_dist, 1.0)
                        
                        # Combined cost with balanced weights
                        combined_cost = (
                            norm_spatial_dist * 0.7 +
                            norm_direction_diff * 0.2 +
                            type_diff * 0.1
                        )
                        
                        cost_matrix[i, j] = combined_cost
                
                # Step 2: Apply Hungarian algorithm for optimal assignment
                row_ind, col_ind = linear_sum_assignment(cost_matrix)
                
                # Step 3: Calculate matching score based on assignments
                match_costs = cost_matrix[row_ind, col_ind]
                
                # Step 4: Use balanced threshold for good matches
                good_match_threshold = 0.4  # Standard value
                good_matches = match_costs < good_match_threshold
                num_good_matches = np.sum(good_matches)
                
                print(f"Found {num_good_matches} good minutiae matches out of {len(match_costs)}")
                
                # Calculate matching score
                # 1. Ratio of good matches to total minutiae
                match_ratio = num_good_matches / max(len(minutiae1), len(minutiae2))
                
                # 2. Quality of matches (inverse of average cost)
                if num_good_matches > 0:
                    avg_match_cost = np.mean(match_costs[good_matches])
                    quality_score = 1.0 - avg_match_cost
                    print(f"Average match cost: {avg_match_cost:.4f}, Quality score: {quality_score:.4f}")
                else:
                    quality_score = 0.0
                
                # 3. Size ratio (balanced importance)
                size_ratio = min(len(minutiae1), len(minutiae2)) / max(len(minutiae1), len(minutiae2)) if max(len(minutiae1), len(minutiae2)) > 0 else 0
                print(f"Size ratio: {size_ratio:.4f}")
                
                # Combine scores with balanced weights
                minutiae_similarity = (
                    match_ratio * 0.6 +
                    quality_score * 0.2 + 
                    size_ratio * 0.2
                )
                
                # No additional boost - keep original score
                return minutiae_similarity
            
            return 0.0  # Return 0 when minutiae are missing - be more strict
        except Exception as e:
            print(f"Minutiae comparison error: {str(e)}")
            return 0.0
    
    @staticmethod
    def _compare_textures(probe, candidate):
        """Compare texture features with balanced strictness."""
        try:
            if 'texture' in probe and 'texture' in candidate:
                texture1 = probe['texture']
                texture2 = candidate['texture']
                
                if not texture1 or not texture2:
                    print("Empty texture features")
                    return 0.0  # Return 0 - be more strict
                
                # Try to convert to numpy arrays
                try:
                    texture1 = np.array(texture1)
                    texture2 = np.array(texture2)
                    print(f"Texture features: {texture1.shape} vs {texture2.shape}")
                    
                    # Check for compatible shapes
                    if texture1.shape != texture2.shape:
                        print(f"Incompatible texture shapes: {texture1.shape} vs {texture2.shape}")
                        return 0.0  # Return 0 for incompatible shapes
                    
                    # Calculate correlation
                    if texture1.ndim == 2:
                        # Flatten 2D arrays
                        t1_flat = texture1.flatten()
                        t2_flat = texture2.flatten()
                        
                        # Calculate correlation
                        if np.std(t1_flat) > 0 and np.std(t2_flat) > 0:
                            correlation = np.corrcoef(t1_flat, t2_flat)[0, 1]
                            if not np.isnan(correlation):
                                # Scale to 0-1 range
                                return (correlation + 1) / 2
                    
                    # Simple fallback - mean absolute difference
                    diff = np.abs(texture1 - texture2)
                    similarity = 1.0 - np.mean(diff) / np.max(diff) if np.max(diff) > 0 else 1.0
                    return similarity
                    
                except Exception as shape_error:
                    print(f"Texture shape error: {str(shape_error)}")
            
            return 0.0  # Return 0 for missing textures - be more strict
        except Exception as e:
            print(f"Texture comparison error: {str(e)}")
            return 0.0
    
    @staticmethod
    def _compare_patterns(probe, candidate):
        """Compare pattern features with balanced strictness."""
        try:
            if 'pattern' in probe and 'pattern' in candidate:
                pattern1 = probe['pattern']
                pattern2 = candidate['pattern']
                
                if not pattern1 or not pattern2:
                    print("Empty pattern features")
                    return 0.0  # Return 0 - be more strict
                
                # Extract basic pattern features in a robust way
                if (isinstance(pattern1, list) and pattern1 and 
                    isinstance(pattern2, list) and pattern2):
                    
                    # Just use the first row as a sample if available
                    if (isinstance(pattern1[0], list) and pattern1[0] and
                        isinstance(pattern2[0], list) and pattern2[0]):
                        
                        # Extract first element of each list for comparison
                        if ('ridge_density' in pattern1[0][0] and 'ridge_density' in pattern2[0][0]):
                            # Compare ridge densities
                            density1 = [item['ridge_density'] for row in pattern1 for item in row 
                                       if 'ridge_density' in item]
                            density2 = [item['ridge_density'] for row in pattern2 for item in row 
                                       if 'ridge_density' in item]
                            
                            if density1 and density2:
                                # Truncate to shortest length
                                min_len = min(len(density1), len(density2))
                                density1 = density1[:min_len]
                                density2 = density2[:min_len]
                                
                                # Calculate correlation
                                try:
                                    correlation = np.corrcoef(density1, density2)[0, 1]
                                    if not np.isnan(correlation):
                                        return (correlation + 1) / 2  # Scale to 0-1
                                except:
                                    pass
            
            return 0.0  # Return 0 for missing patterns - be more strict
        except Exception as e:
            print(f"Pattern comparison error: {str(e)}")
            return 0.0
    
    @staticmethod
    def match_against_database(probe_template, database_records, match_threshold=0.36):
        """Match a probe fingerprint against database with multi-enrollment support.
        
        This version compares the probe against all templates for each staff ID and
        returns the best match result.
        
        Args:
            probe_template (dict): Probe fingerprint template
            database_records (list): List of database fingerprint records
            match_threshold (float): Threshold for match determination
            
        Returns:
            dict: Match result with best match information
        """
        try:
            # Group templates by staff ID
            staff_templates = {}
            
            for record in database_records:
                if 'template' in record and 'staffId' in record:
                    staff_id = record['staffId']
                    
                    # Convert ObjectId to string if needed
                    if not isinstance(staff_id, str):
                        staff_id = str(staff_id)
                    
                    # Initialize if this is the first template for this staff ID
                    if staff_id not in staff_templates:
                        staff_templates[staff_id] = []
                    
                    # Add this template to the list
                    staff_templates[staff_id].append(record['template'])
            
            # Initialize results
            best_match = {
                "staffId": None,
                "score": 0,
                "matched": False,
                "confidence": "None",
                "template_index": -1,
                "template_count": 0
            }
            
            # Track all scores for statistical analysis
            all_scores = []
            all_ids = []
            
            print(f"Comparing against templates for {len(staff_templates)} staff IDs...")
            
            # Compare against each staff ID's templates
            for staff_id, templates in staff_templates.items():
                print(f"Staff ID {staff_id} has {len(templates)} templates")
                
                # Track best score for this staff ID
                staff_best_score = 0
                staff_best_index = -1
                
                # Compare against each template
                for i, template in enumerate(templates):
                    score = FingerprintMatcher.compare_fingerprints(
                        probe_template, template, match_threshold
                    )
                    print(f"  Template {i+1}: score {score:.4f}")
                    
                    # Update best score for this staff ID
                    if score > staff_best_score:
                        staff_best_score = score
                        staff_best_index = i
                
                # Record best score for this staff ID
                all_scores.append(staff_best_score)
                all_ids.append(staff_id)
                
                print(f"Best score for staff ID {staff_id}: {staff_best_score:.4f} (template {staff_best_index+1})")
                
                # Update overall best match
                if staff_best_score > best_match["score"]:
                    best_match["staffId"] = staff_id
                    best_match["score"] = staff_best_score
                    best_match["template_index"] = staff_best_index
                    best_match["template_count"] = len(templates)
            
            # Analyze score distribution and determine match with confidence
            if len(all_scores) > 1:
                scores_array = np.array(all_scores)
                
                # Only look at actual match if it exceeds threshold
                if best_match["score"] >= match_threshold:
                    # Sort scores in descending order
                    sorted_indices = np.argsort(scores_array)[::-1]
                    sorted_scores = scores_array[sorted_indices]
                    
                    # Calculate confidence based on gap between best and second-best score
                    if len(sorted_scores) >= 2:
                        score_gap = sorted_scores[0] - sorted_scores[1]
                        
                        # Assign confidence level with balanced thresholds
                        if score_gap > 0.2:
                            confidence = "High"
                        elif score_gap > 0.1:
                            confidence = "Medium"
                        else:
                            confidence = "Low"
                    else:
                        confidence = "Medium"  # Only one staff ID in DB
                    
                    best_match["matched"] = True
                    best_match["confidence"] = confidence
                else:
                    best_match["matched"] = False
            else:
                # If only one staff ID, just use threshold
                best_match["matched"] = best_match["score"] >= match_threshold
                if best_match["matched"]:
                    best_match["confidence"] = "Medium"  # Only one staff ID in DB
            
            return best_match
        except Exception as e:
            print(f"Error in database matching: {str(e)}")
            return {
                "staffId": None,
                "score": 0,
                "matched": False,
                "confidence": "None",
                "template_index": -1,
                "template_count": 0
            }
        
    @staticmethod
    def adaptive_threshold_match(probe, staff_templates, base_threshold=0.36):
        """
        Use adaptive thresholds based on template quality and quantity.
        
        Args:
            probe: The probe fingerprint template
            staff_templates: List of templates for a specific staff ID
            base_threshold: Base match threshold
            
        Returns:
            dict: Best match details with confidence and score
        """
        # If no templates, return no match
        if not staff_templates:
            return {
                "match": False,
                "score": 0.0,
                "template_index": -1,
                "confidence": "None"
            }
        
        # Calculate quality metrics for the probe
        probe_quality = FingerprintMatcher._assess_template_quality(probe)
        print(f"Probe quality assessment: {probe_quality['quality_score']:.4f} ({probe_quality['quality']})")
        
        # Record all scores
        scores = []
        template_qualities = []
        
        # Compare against each template and record scores
        for i, template in enumerate(staff_templates):
            # Assess template quality
            template_quality = FingerprintMatcher._assess_template_quality(template)
            template_qualities.append(template_quality)
            
            print(f"Template {i} quality: {template_quality['quality_score']:.4f} ({template_quality['quality']})")
            
            # Calculate matching score
            score = FingerprintMatcher.compare_fingerprints(probe, template)
            scores.append(score)
            
            print(f"Template {i} match score: {score:.4f}")
        
        # Find the best score and index
        best_score = max(scores) if scores else 0.0
        best_index = scores.index(best_score) if scores else -1
        
        # Adapt threshold based on template quantity and quality
        template_count = len(staff_templates)
        avg_template_quality = sum(q['quality_score'] for q in template_qualities) / template_count if template_count > 0 else 0
        
        # Adjust threshold based on template quality and quantity
        adjusted_threshold = base_threshold
        
        # Lower threshold slightly if we have multiple good templates
        if template_count >= 3 and avg_template_quality > 0.7:
            adjusted_threshold *= 0.9
            print(f"Lowering threshold due to multiple high-quality templates: {adjusted_threshold:.4f}")
        
        # Raise threshold for low quality templates
        elif avg_template_quality < 0.5:
            adjusted_threshold *= 1.1
            print(f"Raising threshold due to low quality templates: {adjusted_threshold:.4f}")
        
        # Determine if we have a match
        match = best_score >= adjusted_threshold
        
        # Calculate confidence
        if match:
            # Base confidence on score gap and template quality
            if best_score > adjusted_threshold * 1.2:
                confidence = "High"
            elif best_score > adjusted_threshold * 1.1:
                confidence = "Medium"
            else:
                confidence = "Low"
        else:
            confidence = "None"
        
        return {
            "match": match,
            "score": best_score,
            "template_index": best_index,
            "adjusted_threshold": adjusted_threshold,
            "base_threshold": base_threshold,
            "confidence": confidence
        }

    @staticmethod
    def _assess_template_quality(template):
        """
        Assess the quality of a fingerprint template.
        
        Args:
            template: The fingerprint template to assess
            
        Returns:
            dict: Quality assessment data
        """
        quality_score = 0.0
        factors = []
        
        # Check minutiae count and distribution
        minutiae = template.get('minutiae', [])
        minutiae_count = len(minutiae)
        
        if minutiae_count >= 40:
            quality_score += 0.3
            factors.append("Excellent minutiae count")
        elif minutiae_count >= 25:
            quality_score += 0.2
            factors.append("Good minutiae count")
        elif minutiae_count >= 15:
            quality_score += 0.1
            factors.append("Adequate minutiae count")
        else:
            factors.append("Low minutiae count")
        
        # Check keypoint count
        keypoints = template.get('keypoints', [])
        keypoint_count = len(keypoints)
        
        if keypoint_count >= 100:
            quality_score += 0.3
            factors.append("Excellent keypoint count")
        elif keypoint_count >= 50:
            quality_score += 0.2
            factors.append("Good keypoint count")
        elif keypoint_count >= 25:
            quality_score += 0.1
            factors.append("Adequate keypoint count")
        else:
            factors.append("Low keypoint count")
        
        # Check descriptor quality
        descriptors = template.get('descriptors', [])
        if descriptors and len(descriptors) > 0:
            descriptor_entropy = FingerprintMatcher._calculate_descriptor_entropy(descriptors)
            
            if descriptor_entropy > 0.7:
                quality_score += 0.2
                factors.append("High descriptor entropy")
            elif descriptor_entropy > 0.5:
                quality_score += 0.1
                factors.append("Medium descriptor entropy")
            else:
                factors.append("Low descriptor entropy")
        else:
            factors.append("No descriptors")
        
        # Check texture and pattern features
        if template.get('texture') and len(template.get('texture', [])) > 0:
            quality_score += 0.1
            factors.append("Has texture features")
        
        if template.get('pattern') and len(template.get('pattern', [])) > 0:
            quality_score += 0.1
            factors.append("Has pattern features")
        
        # Determine overall quality
        if quality_score >= 0.8:
            quality = "Excellent"
        elif quality_score >= 0.6:
            quality = "Good"
        elif quality_score >= 0.4:
            quality = "Average"
        elif quality_score >= 0.2:
            quality = "Poor"
        else:
            quality = "Very Poor"
        
        return {
            "quality_score": quality_score,
            "quality": quality,
            "factors": factors
        }

    @staticmethod
    def _calculate_descriptor_entropy(descriptors):
        """Calculate entropy (diversity) of descriptor values."""
        try:
            # Sample a subset of descriptors
            sample_size = min(len(descriptors), 10)
            sampled_descriptors = descriptors[:sample_size]
            
            # Flatten the descriptors
            flattened = []
            for desc in sampled_descriptors:
                if hasattr(desc, '__iter__'):
                    flattened.extend(desc)
                else:
                    flattened.append(desc)
            
            # Convert to numpy array
            array = np.array(flattened)
            
            # Calculate histogram
            hist, _ = np.histogram(array, bins=16, density=True)
            
            # Calculate entropy
            entropy = 0.0
            for p in hist:
                if p > 0:
                    entropy -= p * np.log2(p)
                    
            # Normalize entropy to 0-1 range (max entropy for 16 bins is 4)
            normalized_entropy = entropy / 4.0
            
            return normalized_entropy
            
        except Exception as e:
            print(f"Error calculating descriptor entropy: {str(e)}")
            return 0.5  # Default medium entropy
        
    @fingerprint_bp.route('/match', methods=['POST'])
    def match_fingerprint():
        """Match a fingerprint against the database with adaptive thresholds for better accuracy."""
        try:
            data = request.json
            if not data or 'fingerPrint' not in data:
                return jsonify({
                    'success': False,
                    'message': 'Missing fingerPrint data'
                }), 400

            print("Processing fingerprint for matching...")

            # Extract custom threshold if provided (used as base threshold)
            base_threshold = float(data.get('threshold', MATCH_THRESHOLD))

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

            # Group templates by staff ID for more efficient processing
            staff_templates = {}
            for record in fingerprint_records:
                if 'template' in record and 'staffId' in record:
                    staff_id = record['staffId']
                    if not isinstance(staff_id, str):
                        staff_id = str(staff_id)
                    
                    if staff_id not in staff_templates:
                        staff_templates[staff_id] = []
                    
                    staff_templates[staff_id].append(record['template'])

            # Find the best match across all staff IDs
            start_time = time.time()
            
            best_match = {
                "staffId": None,
                "score": 0,
                "matched": False,
                "confidence": "None",
                "template_index": -1,
                "template_count": 0,
                "adjusted_threshold": base_threshold
            }

            # Process each staff ID
            for staff_id, templates in staff_templates.items():
                print(f"Comparing with staff ID {staff_id} ({len(templates)} templates)")
                
                # Use adaptive threshold matching
                match_result = FingerprintMatcher.adaptive_threshold_match(
                    probe_template, 
                    templates, 
                    base_threshold
                )
                
                if match_result["match"] and match_result["score"] > best_match["score"]:
                    best_match["staffId"] = staff_id
                    best_match["score"] = match_result["score"]
                    best_match["matched"] = True
                    best_match["confidence"] = match_result["confidence"]
                    best_match["template_index"] = match_result["template_index"]
                    best_match["template_count"] = len(templates)
                    best_match["adjusted_threshold"] = match_result["adjusted_threshold"]

            match_time = time.time() - start_time
            print(f"Matching took {match_time:.2f} seconds")

            if best_match["matched"]:
                print(f"Match found: {best_match['staffId']} with score {best_match['score']:.4f} "
                    f"(confidence: {best_match['confidence']})")

                return jsonify({
                    'success': True,
                    'matched': True,
                    'staffId': str(best_match["staffId"]),
                    'score': best_match["score"],
                    'confidence': best_match["confidence"],
                    'baseThreshold': base_threshold,
                    'adjustedThreshold': best_match["adjusted_threshold"],
                    'templateCount': best_match["template_count"],
                    'minutiaeCount': len(probe_template.get('minutiae', [])),
                    'keypointCount': len(probe_template.get('keypoints', []))
                })
            else:
                print(f"No match found. Best score: {best_match['score']:.4f}")
                return jsonify({
                    'success': True,
                    'matched': False,
                    'bestScore': best_match["score"],
                    'threshold': base_threshold,
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