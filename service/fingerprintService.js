// service/fingerprintService.js - Modified version
const axios = require("axios");
const FingerPrint = require("../models/FingerPrint");
const Users = require("../models/Users");

const FINGERPRINT_SERVER_URL = "http://localhost:5500"; // Python server URL

/**
 * Enhanced service for interacting with the fingerprint Python server and MongoDB
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

      console.log(
        `Starting enrollment for staffId ${staffId} with ${fingerprints.length} scans`
      );
      const startTime = Date.now();

      // Process the fingerprints with the Python server
      const processResponse = await axios.post(
        `${FINGERPRINT_SERVER_URL}/api/fingerprint/process-multiple`,
        {
          staffId,
          email,
          fingerprints,
        },
        {
          // Add timeout to prevent long-running requests
          timeout: 60000, // Increased timeout for enhanced processing
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

      // Add quality validation
      if (quality_score < 40) {
        return {
          success: false,
          message: `Low quality fingerprint (score: ${quality_score}). Please scan again with better placement.`,
          quality_score,
        };
      }

      // Check if staff ID already exists in the fingerprint collection
      let existingRecord = await FingerPrint.findOne({ staffId });

      if (existingRecord) {
        // Update existing record
        existingRecord.template = template;
        existingRecord.original_template = original_template;
        existingRecord.quality_score = quality_score;
        existingRecord.file_paths = saved_files;
        existingRecord.updated_at = new Date();
        existingRecord.scan_count = fingerprints.length;

        await existingRecord.save();

        // Update user flag synchronously
        await Users.findByIdAndUpdate(staffId, { hasFingerPrint: true });

        const duration = Date.now() - startTime;
        console.log(`Fingerprint updated in ${duration}ms`);

        return {
          success: true,
          message: "Fingerprint updated successfully!",
          quality_score: quality_score,
          duration,
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

        // Update user flag
        await Users.findByIdAndUpdate(staffId, { hasFingerPrint: true });

        const duration = Date.now() - startTime;
        console.log(`Fingerprint enrolled in ${duration}ms`);

        return {
          success: true,
          message: "Fingerprint enrolled successfully!",
          quality_score: quality_score,
          duration,
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

      console.log("Starting fingerprint matching process");
      const startTime = Date.now();

      // Fetch all fingerprint records from the database
      const fingerprintRecords = await FingerPrint.find().lean();

      if (fingerprintRecords.length === 0) {
        return {
          success: false,
          matched: false,
          message: "No fingerprints enrolled in the database",
        };
      }

      // Organize templates by staffId for better grouping
      const templates = fingerprintRecords.map((record) => ({
        staffId: record.staffId.toString(),
        template: record.template,
      }));

      console.log(`Found ${templates.length} templates for matching`);

      // Send to Python server for matching with enhanced algorithm
      const matchResponse = await axios.post(
        `${FINGERPRINT_SERVER_URL}/api/fingerprint/match`,
        {
          fingerPrint,
          templates,
        },
        {
          timeout: 30000, // Increased timeout for thorough matching
        }
      );

      const matchTime = Date.now() - startTime;
      console.log(`Fingerprint matching completed in ${matchTime}ms`);

      // If a match is found, fetch the user data
      if (matchResponse.data.success && matchResponse.data.matched) {
        // Get user data
        const userData = await this.getUserData(matchResponse.data.staffId);

        return {
          ...matchResponse.data,
          userData,
          matchTime,
        };
      }

      return {
        ...matchResponse.data,
        matchTime,
      };
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

      // Send to Python server for verification with enhanced algorithm
      const verifyResponse = await axios.post(
        `${FINGERPRINT_SERVER_URL}/api/fingerprint/verify`,
        {
          fingerPrint,
          staffId,
          templates: [{ staffId, template: record.template }],
        },
        {
          timeout: 15000,
        }
      );

      // If verification successful, return with user data
      if (verifyResponse.data.success && verifyResponse.data.verified) {
        const userData = await this.getUserData(staffId);

        return {
          ...verifyResponse.data,
          userData,
        };
      }

      return verifyResponse.data;
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
            department: user.department,
            position: user.position,
          }
        : null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }
}

module.exports = new FingerprintService();
