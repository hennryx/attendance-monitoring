const { createCanvas, loadImage } = require("canvas");

// Function to extract fingerprint features from base64 image
async function extractFeatures(base64Image) {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.includes(",")
      ? base64Image.split(",")[1]
      : base64Image;

    // Load image from base64
    const image = await loadImage(`data:image/png;base64,${base64Data}`);

    // Create canvas and draw image
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Convert to grayscale and calculate gradient
    const grayPixels = new Uint8Array(canvas.width * canvas.height);
    const features = [];

    // Convert to grayscale
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Standard grayscale conversion
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      grayPixels[i / 4] = gray;
    }

    // Extract feature points based on high contrast areas
    const cellSize = 16; // Divide image into cells for feature extraction

    for (let y = cellSize; y < canvas.height - cellSize; y += cellSize) {
      for (let x = cellSize; x < canvas.width - cellSize; x += cellSize) {
        // Calculate average intensity for cell
        let sum = 0;
        let count = 0;

        for (let cy = -cellSize / 2; cy < cellSize / 2; cy++) {
          for (let cx = -cellSize / 2; cx < cellSize / 2; cx++) {
            const pixelPos = (y + cy) * canvas.width + (x + cx);
            if (pixelPos >= 0 && pixelPos < grayPixels.length) {
              sum += grayPixels[pixelPos];
              count++;
            }
          }
        }

        const avgIntensity = sum / count;

        // Calculate variance (contrast) within cell
        let variance = 0;
        for (let cy = -cellSize / 2; cy < cellSize / 2; cy++) {
          for (let cx = -cellSize / 2; cx < cellSize / 2; cx++) {
            const pixelPos = (y + cy) * canvas.width + (x + cx);
            if (pixelPos >= 0 && pixelPos < grayPixels.length) {
              variance += Math.pow(grayPixels[pixelPos] - avgIntensity, 2);
            }
          }
        }

        variance /= count;

        // If variance is high enough, this might be a ridge or valley
        if (variance > 100) {
          // Threshold for feature detection
          // Look for local maxima and minima
          let isLocalMax = true;
          let isLocalMin = true;

          for (let cy = -3; cy <= 3; cy++) {
            for (let cx = -3; cx <= 3; cx++) {
              if (cx === 0 && cy === 0) continue;

              const pixelPos = (y + cy) * canvas.width + (x + cx);
              if (pixelPos >= 0 && pixelPos < grayPixels.length) {
                if (grayPixels[pixelPos] > grayPixels[y * canvas.width + x]) {
                  isLocalMin = false;
                }
                if (grayPixels[pixelPos] < grayPixels[y * canvas.width + x]) {
                  isLocalMax = false;
                }
              }
            }
          }

          if (isLocalMax || isLocalMin) {
            features.push({
              x,
              y,
              intensity: grayPixels[y * canvas.width + x],
              variance,
              type: isLocalMax ? "max" : "min",
            });
          }
        }
      }
    }

    return features;
  } catch (error) {
    console.error("Error extracting features:", error);
    throw error;
  }
}

// Function to compare fingerprint features
function compareFeatures(probe, candidate) {
  // No features to compare
  if (!probe || !candidate || probe.length === 0 || candidate.length === 0) {
    return 0;
  }

  let matchCount = 0;
  const distanceThreshold = 20; // Maximum distance to consider a match
  const matchedIndices = new Set();

  // For each probe feature, find the closest candidate feature
  for (let i = 0; i < probe.length; i++) {
    let minDistance = Infinity;
    let bestMatchIndex = -1;

    for (let j = 0; j < candidate.length; j++) {
      // Skip if this candidate feature is already matched
      if (matchedIndices.has(j)) continue;

      // Only compare features of the same type
      if (probe[i].type !== candidate[j].type) continue;

      // Calculate Euclidean distance
      const distance = Math.sqrt(
        Math.pow(probe[i].x - candidate[j].x, 2) +
          Math.pow(probe[i].y - candidate[j].y, 2)
      );

      // Check intensity difference too
      const intensityDiff = Math.abs(
        probe[i].intensity - candidate[j].intensity
      );

      // Combined metric
      const combinedDistance = distance + intensityDiff * 0.5;

      if (combinedDistance < minDistance) {
        minDistance = combinedDistance;
        bestMatchIndex = j;
      }
    }

    // If we found a match within the threshold
    if (minDistance < distanceThreshold && bestMatchIndex !== -1) {
      matchCount++;
      matchedIndices.add(bestMatchIndex);
    }
  }

  // Calculate similarity score (0 to 1)
  const maxPossibleMatches = Math.min(probe.length, candidate.length);
  const similarityScore =
    maxPossibleMatches > 0 ? matchCount / maxPossibleMatches : 0;

  return similarityScore;
}

module.exports = {
  extractFeatures,
  compareFeatures,
};
