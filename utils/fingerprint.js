const cv = require("@techstark/opencv-js");
const fs = require("fs");
const path = require("path");

// Wait for OpenCV initialization - important for @techstark/opencv-js
let cvReady = false;
const waitForOpenCV = () => {
  return new Promise((resolve) => {
    if (cv.getBuildInformation) {
      // OpenCV is already loaded
      resolve();
    } else {
      // Wait for OpenCV to initialize
      cv.onRuntimeInitialized = () => {
        resolve();
      };
    }
  });
};

// Function to convert base64 to image and process it
async function base64ToMat(base64Image) {
  // Remove data URL prefix if present
  const base64Data = base64Image.includes(",")
    ? base64Image.split(",")[1]
    : base64Image;

  // Create a buffer from base64 string
  const buffer = Buffer.from(base64Data, "base64");

  // Write to temporary file (OpenCV.js needs a file path)
  const tempFilePath = path.join(__dirname, "temp_fingerprint.png");
  fs.writeFileSync(tempFilePath, buffer);

  // Read the image with OpenCV
  const img = cv.imread(tempFilePath);

  // Cleanup the temporary file
  fs.unlinkSync(tempFilePath);

  return img;
}

// Function to extract fingerprint features from base64 image
async function extractFeatures(base64Image) {
  try {
    // Wait for OpenCV to be ready
    if (!cvReady) {
      await waitForOpenCV();
      cvReady = true;
    }

    // Convert base64 to OpenCV Mat
    const img = await base64ToMat(base64Image);

    // Convert to grayscale
    const gray = new cv.Mat();
    if (img.channels() === 3) {
      cv.cvtColor(img, gray, cv.COLOR_BGR2GRAY);
    } else {
      gray = img.clone();
    }

    // Apply Gaussian blur to reduce noise
    const blurred = new cv.Mat();
    const ksize = new cv.Size(3, 3);
    cv.GaussianBlur(gray, blurred, ksize, 0);

    // Apply threshold to make it binary
    const binary = new cv.Mat();
    cv.threshold(blurred, binary, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

    // Create ORB detector for feature extraction
    const orb = new cv.ORB(100); // nfeatures = 100

    // Detect keypoints and compute descriptors
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();
    orb.detectAndCompute(binary, new cv.Mat(), keypoints, descriptors);

    // Convert keypoints to serializable format
    const keypointsArray = [];
    for (let i = 0; i < keypoints.size(); i++) {
      const kp = keypoints.get(i);
      keypointsArray.push({
        x: kp.pt.x,
        y: kp.pt.y,
        size: kp.size,
        angle: kp.angle,
        response: kp.response,
        octave: kp.octave,
        class_id: kp.class_id,
      });
    }

    // Convert descriptors to serializable format
    let descriptorsArray = null;
    if (descriptors.rows > 0) {
      descriptorsArray = [];
      for (let i = 0; i < descriptors.rows; i++) {
        const row = [];
        for (let j = 0; j < descriptors.cols; j++) {
          row.push(descriptors.ucharAt(i, j));
        }
        descriptorsArray.push(row);
      }
    }

    // Release OpenCV objects to free memory
    img.delete();
    gray.delete();
    blurred.delete();
    binary.delete();
    keypoints.delete();
    descriptors.delete();

    return {
      keypoints: keypointsArray,
      descriptors: descriptorsArray,
    };
  } catch (error) {
    console.error("Error extracting features with OpenCV:", error);
    throw error;
  }
}

// Function to compare fingerprint features
async function compareFeatures(probe, candidate) {
  try {
    // Wait for OpenCV to be ready
    if (!cvReady) {
      await waitForOpenCV();
      cvReady = true;
    }

    // Validate inputs
    if (
      !probe ||
      !candidate ||
      !probe.descriptors ||
      !candidate.descriptors ||
      probe.descriptors.length === 0 ||
      candidate.descriptors.length === 0
    ) {
      return 0;
    }

    // Convert descriptors arrays to cv.Mat
    const mat1 = cv.matFromArray(
      probe.descriptors.length,
      probe.descriptors[0].length,
      cv.CV_8UC1,
      probe.descriptors.flat()
    );

    const mat2 = cv.matFromArray(
      candidate.descriptors.length,
      candidate.descriptors[0].length,
      cv.CV_8UC1,
      candidate.descriptors.flat()
    );

    // Create BFMatcher with Hamming distance (good for binary descriptors like ORB)
    const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);

    // Match descriptors
    const matches = new cv.DMatchVector();
    matcher.match(mat1, mat2, matches);

    // Calculate match score
    let score = 0;
    const matchCount = matches.size();

    if (matchCount > 0) {
      let totalDistance = 0;

      // Get distances of all matches
      for (let i = 0; i < matchCount; i++) {
        totalDistance += matches.get(i).distance;
      }

      // Calculate average distance (lower is better)
      const avgDistance = totalDistance / matchCount;

      // Convert distance to similarity score (0-1 range, higher is better)
      // 100 is a typical max distance for ORB descriptors
      score = Math.max(0, 1 - avgDistance / 100);

      // Adjust score based on number of matches relative to keypoints
      const matchRatio =
        matchCount /
        Math.min(probe.keypoints.length, candidate.keypoints.length);
      score = score * Math.min(1, matchRatio * 2); // Boost score if many keypoints match
    }

    // Release OpenCV objects
    mat1.delete();
    mat2.delete();
    matches.delete();

    return score;
  } catch (error) {
    console.error("Error comparing features with OpenCV:", error);
    return 0;
  }
}

module.exports = {
  extractFeatures,
  compareFeatures,
};
