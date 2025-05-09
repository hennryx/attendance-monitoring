// fingerprint.js - JavaScript wrapper for the fingerprint bridge
const fingerprintBridge = require("./build/Release/fingerprint_bridge");

class FingerprintScanner {
  constructor() {
    this.bridge = new fingerprintBridge.FingerprintBridge();
    this.currentDevice = null;
  }

  /**
   * Get a list of connected fingerprint devices
   * @returns {Array} Array of device objects with name and id properties
   */
  getDeviceList() {
    try {
      return this.bridge.getDeviceList();
    } catch (error) {
      console.error("Error getting device list:", error);
      return [];
    }
  }

  /**
   * Open a fingerprint device for use
   * @param {string} deviceId - The ID of the device to open
   * @returns {boolean} True if the device was opened successfully
   */
  openDevice(deviceId) {
    try {
      const result = this.bridge.openDevice(deviceId);
      if (result) {
        this.currentDevice = deviceId;
      }
      return result;
    } catch (error) {
      console.error("Error opening device:", error);
      return false;
    }
  }

  /**
   * Close the currently open fingerprint device
   * @returns {boolean} True if the device was closed successfully
   */
  closeDevice() {
    try {
      const result = this.bridge.closeDevice();
      if (result) {
        this.currentDevice = null;
      }
      return result;
    } catch (error) {
      console.error("Error closing device:", error);
      return false;
    }
  }

  /**
   * Capture a fingerprint from the currently open device
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Object} Object with success, image, and quality properties
   */
  captureFingerprint(timeout = 10000) {
    try {
      if (!this.currentDevice) {
        throw new Error("No device is open");
      }

      return this.bridge.captureFingerprint(timeout);
    } catch (error) {
      console.error("Error capturing fingerprint:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Extract features from a fingerprint image
   * @param {string} base64Image - Base64-encoded fingerprint image
   * @returns {Object} Object with success and features properties
   */
  extractFeatures(base64Image) {
    try {
      return this.bridge.extractFeatures(base64Image);
    } catch (error) {
      console.error("Error extracting features:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Compare two sets of fingerprint features
   * @param {string} features1 - Base64-encoded features of the first fingerprint
   * @param {string} features2 - Base64-encoded features of the second fingerprint
   * @returns {Object} Object with success, matched, and score properties
   */
  compareFeatures(features1, features2) {
    try {
      return this.bridge.compareFeatures(features1, features2);
    } catch (error) {
      console.error("Error comparing features:", error);
      return {
        success: false,
        matched: false,
        error: error.message,
      };
    }
  }

  /**
   * Find a match for a fingerprint in a list of stored templates
   * @param {string} probe - Features of the probe fingerprint to match
   * @param {Array<Object>} templates - Array of objects with id and features properties
   * @param {number} threshold - Score threshold for a match (0-100, higher is stricter)
   * @returns {Object} Best match information or null if no match found
   */
  findMatch(probe, templates, threshold = 40) {
    let bestMatch = {
      id: null,
      score: 0,
      matched: false,
    };

    for (const template of templates) {
      try {
        const result = this.compareFeatures(probe, template.features);

        if (result.success && result.score > bestMatch.score) {
          bestMatch = {
            id: template.id,
            score: result.score,
            matched: result.matched || result.score >= threshold,
          };
        }
      } catch (error) {
        console.error(`Error comparing with template ${template.id}:`, error);
      }
    }

    return bestMatch.matched ? bestMatch : null;
  }
}

module.exports = FingerprintScanner;
