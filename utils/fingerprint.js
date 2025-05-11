const cv = require("@techstark/opencv-js");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const sharp = require("sharp");
const { createCanvas } = require("canvas");

// Initialize OpenCV
let cvReady = false;

// Set up DOM environment for OpenCV.js
function setupDOM() {
  const dom = new JSDOM();
  global.document = dom.window.document;
  global.window = dom.window;
}

// Wait for OpenCV to initialize
function waitForOpenCV() {
  return new Promise((resolve) => {
    if (cv.getBuildInformation) {
      cvReady = true;
      resolve();
    } else {
      cv.onRuntimeInitialized = () => {
        cvReady = true;
        resolve();
      };
    }
  });
}

// Process fingerprint to enhance image using optimized techniques
async function processFingerprint(base64Image) {
  try {
    // Wait for OpenCV to be ready
    if (!cvReady) {
      setupDOM();
      await waitForOpenCV();
    }

    // Performance timers
    const startTime = Date.now();
    let lastTime = startTime;
    const logTime = (label) => {
      const now = Date.now();
      console.log(`${label}: ${now - lastTime}ms`);
      lastTime = now;
    };

    // Remove data URL prefix if present
    const base64Data = base64Image.includes(",")
      ? base64Image.split(",")[1]
      : base64Image;

    // Create a buffer from base64 string
    const buffer = Buffer.from(base64Data, "base64");

    // Use sharp to convert to raw grayscale pixel data
    const { data, info } = await sharp(buffer)
      .greyscale()
      .resize(320, 320, { fit: "contain" }) // Smaller size is faster
      .raw()
      .toBuffer({ resolveWithObject: true });

    logTime("Image loading and resizing");

    // Create OpenCV Mat from raw data
    const src = new cv.Mat(info.height, info.width, cv.CV_8UC1);
    const dataU8 = new Uint8Array(data);
    src.data.set(dataU8);

    // OPTIMIZED PREPROCESSING - fewer operations

    // 1. Normalize image
    const normalized = new cv.Mat();
    cv.normalize(src, normalized, 0, 255, cv.NORM_MINMAX);

    // 2. Apply CLAHE for contrast enhancement
    const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
    const enhanced = new cv.Mat();
    clahe.apply(normalized, enhanced);

    // 3. Reduce noise with a fast Gaussian blur
    const blurred = new cv.Mat();
    cv.GaussianBlur(enhanced, blurred, new cv.Size(3, 3), 0);

    // 4. Single adaptive threshold - found to be most reliable
    const binary = new cv.Mat();
    cv.adaptiveThreshold(
      blurred,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      11,
      2
    );

    logTime("Image preprocessing");

    // 5. Create focused patch set (fewer patches with less overlap)
    const patches = [];
    const patchSize = 80; // Larger patches = fewer patches
    const stepSize = 60; // Less overlap = fewer patches

    // Only take patches from the central region (80% of image)
    const startX = Math.floor(binary.cols * 0.1);
    const endX = Math.floor(binary.cols * 0.9);
    const startY = Math.floor(binary.rows * 0.1);
    const endY = Math.floor(binary.rows * 0.9);

    for (let y = startY; y <= endY - patchSize; y += stepSize) {
      for (let x = startX; x <= endX - patchSize; x += stepSize) {
        const rect = new cv.Rect(x, y, patchSize, patchSize);

        // Extract patch from binary image only
        const patch = new cv.Mat();
        binary.roi(rect).copyTo(patch);

        // Calculate a quick hash for the patch
        const hash = calculateFastHash(patch);

        patches.push({
          x,
          y,
          binary: patch,
          hash: hash,
        });
      }
    }

    logTime("Patch extraction");

    // 6. Extract global descriptors with ORB
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();
    const orb = new cv.ORB(200); // Fewer features = faster

    orb.detect(binary, keypoints);
    orb.compute(binary, keypoints, descriptors);

    logTime("Feature extraction");

    // 7. Calculate global image hash (just one hash for speed)
    const globalHash = calculateFastHash(binary);

    // 8. Create compact template for faster storage and retrieval
    const template = {
      globalBinary: binary,
      globalHash: globalHash,
      patches: patches,
      keypoints: keypointsToArray(keypoints),
      descriptors: descriptorsToArray(descriptors),
      stats: {
        width: binary.cols,
        height: binary.rows,
        mean: cv.mean(src)[0],
        stdDev: cv.meanStdDev(src)[1][0],
      },
    };

    // Cleanup non-patch resources (patches will be cleaned during comparison)
    src.delete();
    normalized.delete();
    enhanced.delete();
    blurred.delete();
    keypoints.delete();
    descriptors.delete();

    logTime("Template creation");
    console.log(`Total processing time: ${Date.now() - startTime}ms`);

    return template;
  } catch (error) {
    console.error("Error processing fingerprint image:", error);
    throw error;
  }
}

// Fast image hash calculation
function calculateFastHash(img) {
  // Resize to 8x8
  const resized = new cv.Mat();
  cv.resize(img, resized, new cv.Size(8, 8), 0, 0, cv.INTER_AREA);

  // Calculate average pixel value
  const mean = cv.mean(resized)[0];

  // Compute 64-bit hash (1 for pixels above average, 0 for below)
  let hash = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      hash += resized.ucharAt(y, x) >= mean ? "1" : "0";
    }
  }

  // Clean up
  resized.delete();

  return hash;
}

// Convert keypoints to serializable array
function keypointsToArray(keypoints) {
  const result = [];
  for (let i = 0; i < keypoints.size(); i++) {
    const kp = keypoints.get(i);
    result.push({
      x: kp.pt.x,
      y: kp.pt.y,
      size: kp.size,
      angle: kp.angle,
      response: kp.response,
      octave: kp.octave,
    });
  }
  return result;
}

// Convert descriptors to serializable array
function descriptorsToArray(descriptors) {
  if (!descriptors || descriptors.rows === 0) return [];

  const result = [];
  for (let i = 0; i < descriptors.rows; i++) {
    const row = [];
    for (let j = 0; j < descriptors.cols; j++) {
      row.push(descriptors.ucharAt(i, j));
    }
    result.push(row);
  }
  return result;
}

// Fast Hamming distance calculation
function hammingDistance(str1, str2) {
  if (str1.length !== str2.length) return str1.length; // Return max distance if lengths differ

  let distance = 0;
  for (let i = 0; i < str1.length; i++) {
    if (str1[i] !== str2[i]) distance++;
  }
  return distance;
}

// Optimized fingerprint comparison
async function compareFingerprints(probe, candidate) {
  try {
    // Wait for OpenCV to be ready
    if (!cvReady) {
      await waitForOpenCV();
    }

    // Performance timers
    const startTime = Date.now();
    let lastTime = startTime;
    const logTime = (label) => {
      const now = Date.now();
      console.log(`${label}: ${now - lastTime}ms`);
      lastTime = now;
    };

    // Validate inputs
    if (!probe || !candidate) {
      console.log("Invalid fingerprint templates for comparison");
      return 0;
    }

    // 1. Global hash comparison - fast early check
    const hashDistance = hammingDistance(
      probe.globalHash,
      candidate.globalHash
    );
    const hashSimilarity = 1 - hashDistance / 64;

    console.log(`Global hash similarity: ${hashSimilarity.toFixed(4)}`);

    // Early rejection for obvious non-matches
    if (hashSimilarity < 0.35) {
      console.log("Early rejection based on hash difference");
      return hashSimilarity * 0.5; // Return low score but not zero
    }

    logTime("Hash comparison");

    // 2. Global template matching
    // (This is faster than patch matching and can reject unlikely matches)
    const globalScore = matchBinaryImages(
      probe.globalBinary,
      candidate.globalBinary
    );
    console.log(`Global image matching: ${globalScore.toFixed(4)}`);

    // Early rejection for weak global matches
    if (globalScore < 0.2) {
      console.log("Rejection after global matching");
      return (hashSimilarity * 0.3 + globalScore * 0.7) * 0.5;
    }

    logTime("Global matching");

    // 3. Optimized patch matching (only if global match is promising)
    const patchScore = matchPatches(probe.patches, candidate.patches);
    console.log(`Patch matching score: ${patchScore.toFixed(4)}`);

    logTime("Patch matching");

    // 4. Feature descriptor matching with early termination
    const descriptorScore = await fastDescriptorMatching(
      probe.descriptors,
      candidate.descriptors
    );
    console.log(`Descriptor matching score: ${descriptorScore.toFixed(4)}`);

    logTime("Descriptor matching");

    // 5. Weighted combination of all scores
    const finalScore =
      hashSimilarity * 0.15 +
      globalScore * 0.3 +
      patchScore * 0.35 +
      descriptorScore * 0.2;

    console.log(`Final fingerprint match score: ${finalScore.toFixed(4)}`);
    console.log(`Total comparison time: ${Date.now() - startTime}ms`);

    return finalScore;
  } catch (error) {
    console.error("Error comparing fingerprint images:", error);
    return 0;
  }
}

// Fast binary images comparison
function matchBinaryImages(img1, img2) {
  // Use XOR to find differences
  const diff = new cv.Mat();
  cv.bitwise_xor(img1, img2, diff);

  // Count non-matching pixels
  const nonMatches = cv.countNonZero(diff);

  // Calculate similarity as percentage of matching pixels
  const totalPixels = img1.rows * img1.cols;
  const similarity = 1 - nonMatches / totalPixels;

  // Clean up
  diff.delete();

  return similarity;
}

// Optimized patch matching
function matchPatches(patches1, patches2) {
  if (
    !patches1 ||
    !patches2 ||
    patches1.length === 0 ||
    patches2.length === 0
  ) {
    return 0;
  }

  let totalScore = 0;
  let matchCount = 0;

  // For each patch in first set (limited to 5 patches for speed)
  const maxPatches = Math.min(patches1.length, 5);
  const sampledPatches = patches1.slice(0, maxPatches);

  for (const p1 of sampledPatches) {
    let bestScore = 0;

    // Compare with all patches in second set
    for (const p2 of patches2) {
      // Calculate hash distance first (very fast check)
      const hashDist = hammingDistance(p1.hash, p2.hash);
      const hashSim = 1 - hashDist / 64;

      // Only proceed if hash similarity is reasonable
      if (hashSim > 0.5) {
        // Calculate full similarity using binary XOR
        const patchScore = matchBinaryImages(p1.binary, p2.binary);

        if (patchScore > bestScore) {
          bestScore = patchScore;
        }

        // Early termination if we found a very good match
        if (bestScore > 0.8) break;
      }
    }

    // If we found a reasonable match
    if (bestScore > 0.5) {
      totalScore += bestScore;
      matchCount++;
    }

    // Clean up this patch's resources
    p1.binary.delete();
  }

  // Clean up remaining patches
  for (let i = maxPatches; i < patches1.length; i++) {
    patches1[i].binary.delete();
  }

  // Clean up all candidate patches
  for (const p of patches2) {
    p.binary.delete();
  }

  // Calculate average score
  return matchCount > 0 ? totalScore / sampledPatches.length : 0;
}

// Fast descriptor matching with early termination
async function fastDescriptorMatching(desc1, desc2) {
  if (
    !desc1 ||
    !desc2 ||
    !Array.isArray(desc1) ||
    !Array.isArray(desc2) ||
    desc1.length === 0 ||
    desc2.length === 0
  ) {
    return 0;
  }

  try {
    // Convert to OpenCV Mats
    const mat1 = arrayToDescriptorMat(desc1);
    const mat2 = arrayToDescriptorMat(desc2);

    // Create a matcher
    const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);

    // Match descriptors
    const matches = new cv.DMatchVector();
    matcher.match(mat1, mat2, matches);

    // Count matches with good distances
    let goodMatches = 0;
    const distanceThreshold = 60; // Maximum distance for a good match

    // Only check a sample of matches for speed (max 100)
    const maxToCheck = Math.min(matches.size(), 100);

    for (let i = 0; i < maxToCheck; i++) {
      const match = matches.get(i);
      if (match.distance < distanceThreshold) {
        goodMatches++;
      }
    }

    // Scale the count based on the sample
    if (matches.size() > maxToCheck) {
      goodMatches = Math.round(goodMatches * (matches.size() / maxToCheck));
    }

    // Calculate score
    const possibleMatches = Math.min(desc1.length, desc2.length);
    const matchScore = possibleMatches > 0 ? goodMatches / possibleMatches : 0;

    // Clean up
    mat1.delete();
    mat2.delete();
    matches.delete();

    return matchScore;
  } catch (error) {
    console.error("Error comparing descriptors:", error);
    return 0;
  }
}

// Convert descriptor array to Mat
function arrayToDescriptorMat(descriptors) {
  if (!descriptors || descriptors.length === 0) {
    return new cv.Mat();
  }

  const rows = descriptors.length;
  const cols = descriptors[0].length;

  // Create a CV_8UC1 mat for binary descriptors
  const mat = new cv.Mat(rows, cols, cv.CV_8UC1);

  // Copy data
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      mat.ucharPtr(i, j)[0] = descriptors[i][j];
    }
  }

  return mat;
}

module.exports = {
  processFingerprint,
  compareFingerprints,
};
