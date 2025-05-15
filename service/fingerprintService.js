// service/fingerprintService.js
const axios = require("axios");
const FingerPrint = require("../models/FingerPrint");
const Users = require("../models/Users");

const FINGERPRINT_SERVER_URL = "http://localhost:5500"; // Python server URL

/**
 * Service for interacting with the fingerprint Python server and MongoDB
 */
class FingerprintService {
  /**
   * Process and enroll a new fingerprint with multiple scans
   * @param {Object} data Object containing staffId, email and fingerprints array of base64 data
   * @returns {Promise<Object>} Result of the enrollment
   */
  async enrollFingerprint(data) {
    try {
      const { staffId, fingerprints, email } = data;

      if (
        !staffId ||
        !fingerprints ||
        !Array.isArray(fingerprints) ||
        fingerprints.length === 0
      ) {
        throw new Error("Missing staffId or fingerprint data");
      }

      if (fingerprints.length < 2) {
        throw new Error(
          "At least 2 fingerprint scans are required for registration"
        );
      }

      // Process the fingerprints with the Python server
      const processResponse = await axios.post(
        `${FINGERPRINT_SERVER_URL}/api/fingerprint/process-multiple`,
        {
          staffId,
          email,
          fingerprints,
        }
      );

      if (!processResponse.data.success) {
        throw new Error(
          processResponse.data.message || "Failed to process fingerprints"
        );
      }

      // Extract data from response
      const { template, original_template, quality_score, saved_files } =
        processResponse.data;

      // Check if staff ID already exists in the fingerprint collection
      let existingRecord = await FingerPrint.findOne({ staffId });

      if (existingRecord) {
        // Update existing record
        existingRecord.template = template;
        existingRecord.original_template = original_template;
        existingRecord.quality_score = quality_score;
        existingRecord.file_paths = saved_files;
        existingRecord.updated_at = new Date();

        await existingRecord.save();
        return {
          success: true,
          message: "Fingerprint updated successfully!",
          quality_score: quality_score,
        };
      } else {
        // Create new record
        const newFingerprint = new FingerPrint({
          staffId,
          template,
          original_template,
          quality_score,
          file_paths: saved_files,
          scan_count: fingerprints.length,
          enrolled_at: new Date(),
        });

        await newFingerprint.save();
        return {
          success: true,
          message: "Fingerprint enrolled successfully!",
          quality_score: quality_score,
        };
      }
    } catch (error) {
      console.error("Fingerprint enrollment error:", error);
      return {
        success: false,
        message: error.message || "Failed to enroll fingerprint",
      };
    }
  }

  /**
   * Process and enroll a new fingerprint with multiple uploaded files
   * @param {Object} data Object containing staffId, email and fingerprints array of file paths
   * @returns {Promise<Object>} Result of the enrollment
   */
  async enrollFingerprintFromFiles(data) {
    try {
      const { staffId, fingerprints, email } = data;

      if (
        !staffId ||
        !fingerprints ||
        !Array.isArray(fingerprints) ||
        fingerprints.length === 0
      ) {
        throw new Error("Missing staffId or fingerprint data");
      }

      if (fingerprints.length < 2) {
        throw new Error(
          "At least 2 fingerprint scans are required for registration"
        );
      }

      // Create an array of file paths to send to the Python server
      const filePaths = fingerprints.map((fp) => fp.path);

      // Process the fingerprints with the Python server
      const processResponse = await axios.post(
        `${FINGERPRINT_SERVER_URL}/api/fingerprint/process-multiple`,
        {
          staffId,
          email,
          filePaths,
        }
      );

      if (!processResponse.data.success) {
        throw new Error(
          processResponse.data.message || "Failed to process fingerprints"
        );
      }

      // Extract data from response
      const { template, original_template, quality_score, saved_files } =
        processResponse.data;

      // Check if staff ID already exists in the fingerprint collection
      let existingRecord = await FingerPrint.findOne({ staffId });

      if (existingRecord) {
        // Update existing record
        existingRecord.template = template;
        existingRecord.original_template = original_template;
        existingRecord.quality_score = quality_score;
        existingRecord.file_paths =
          saved_files || fingerprints.map((fp) => fp.path);
        existingRecord.updated_at = new Date();

        await existingRecord.save();
        return {
          success: true,
          message: "Fingerprint updated successfully!",
          quality_score: quality_score,
        };
      } else {
        // Create new record
        const newFingerprint = new FingerPrint({
          staffId,
          template,
          original_template,
          quality_score,
          file_paths: saved_files || fingerprints.map((fp) => fp.path),
          scan_count: fingerprints.length,
          enrolled_at: new Date(),
        });

        await newFingerprint.save();
        return {
          success: true,
          message: "Fingerprint enrolled successfully!",
          quality_score: quality_score,
        };
      }
    } catch (error) {
      console.error("Fingerprint enrollment error:", error);
      return {
        success: false,
        message: error.message || "Failed to enroll fingerprint",
      };
    }
  }

  /**
   * Process a single fingerprint for initial analysis without saving
   * @param {Object} data Object containing fingerPrint base64 data
   * @returns {Promise<Object>} Result of the processing
   */
  async processFingerprint(data) {
    try {
      const { fingerPrint } = data;

      if (!fingerPrint) {
        throw new Error("Missing fingerprint data");
      }

      // Process the fingerprint with the Python server
      const processResponse = await axios.post(
        `${FINGERPRINT_SERVER_URL}/api/fingerprint/process`,
        {
          fingerPrint,
        }
      );

      if (!processResponse.data.success) {
        throw new Error(
          processResponse.data.message || "Failed to process fingerprint"
        );
      }

      return processResponse.data;
    } catch (error) {
      console.error("Fingerprint processing error:", error);
      throw error;
    }
  }

  /**
   * Match a fingerprint against enrolled templates in the database
   * @param {Object} data Object containing fingerPrint base64 data
   * @returns {Promise<Object>} Result of the matching process
   */
  async matchFingerprint(data) {
    try {
      const { fingerPrint } = data;

      if (!fingerPrint) {
        throw new Error("Missing fingerprint data");
      }

      // Fetch all fingerprint records from the database
      const fingerprintRecords = await FingerPrint.find().lean();

      if (fingerprintRecords.length === 0) {
        return {
          success: false,
          matched: false,
          message: "No fingerprints enrolled in the database",
        };
      }

      // Format the templates for the matching API
      const templates = fingerprintRecords.map((record) => ({
        staffId: record.staffId,
        template: record.template,
      }));

      // Send to Python server for matching
      const matchResponse = await axios.post(
        `${FINGERPRINT_SERVER_URL}/api/fingerprint/match`,
        {
          fingerPrint,
          templates,
        }
      );

      // If a match is found, fetch the user data
      if (matchResponse.data.success && matchResponse.data.matched) {
        // Get user data
        const userData = await this.getUserData(matchResponse.data.staffId);

        return {
          ...matchResponse.data,
          userData,
        };
      }

      return matchResponse.data;
    } catch (error) {
      console.error("Fingerprint matching error:", error);
      return {
        success: false,
        matched: false,
        message: error.message || "Failed to match fingerprint",
      };
    }
  }

  /**
   * Verify a fingerprint against a specific staff ID
   * @param {Object} data Object containing fingerPrint and staffId
   * @returns {Promise<Object>} Result of the verification
   */
  async verifyFingerprint(data) {
    try {
      const { fingerPrint, staffId } = data;

      if (!fingerPrint || !staffId) {
        throw new Error("Missing fingerprint data or staff ID");
      }

      // Get the specific staff member's template
      const record = await FingerPrint.findOne({ staffId }).lean();

      if (!record) {
        return {
          success: false,
          verified: false,
          message: "No fingerprint enrolled for this staff member",
        };
      }

      // Send to Python server for matching
      const verifyResponse = await axios.post(
        `${FINGERPRINT_SERVER_URL}/api/fingerprint/match`,
        {
          fingerPrint,
          templates: [{ staffId: record.staffId, template: record.template }],
        }
      );

      if (verifyResponse.data.success && verifyResponse.data.matched) {
        // Make sure the matched ID is the same as the requested ID
        if (verifyResponse.data.staffId == staffId) {
          return {
            success: true,
            verified: true,
            staffId: staffId,
            score: verifyResponse.data.score,
            confidence: verifyResponse.data.confidence,
          };
        }
      }

      return {
        success: false,
        verified: false,
        message: "Fingerprint verification failed",
      };
    } catch (error) {
      console.error("Fingerprint verification error:", error);
      return {
        success: false,
        verified: false,
        message: error.message || "Failed to verify fingerprint",
      };
    }
  }

  /**
   * Re-process all stored fingerprints to update templates
   * @returns {Promise<Object>} Result of the update process
   */
  async updateAllTemplates() {
    try {
      // Call the server to update all templates
      const response = await axios.post(
        `${FINGERPRINT_SERVER_URL}/api/fingerprint/update-templates`
      );

      return response.data;
    } catch (error) {
      console.error("Template update error:", error);
      return {
        success: false,
        message: error.message || "Failed to update templates",
      };
    }
  }

  /**
   * Get user data by staff ID
   * @param {string} staffId Staff ID
   * @returns {Promise<Object|null>} User data or null
   */
  async getUserData(staffId) {
    try {
      const user = await Users.findById(staffId);
      return user
        ? {
            name: user.firstname,
            email: user.email,
          }
        : null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }
}

module.exports = new FingerprintService();
