const axios = require("axios");
const FingerPrint = require("../models/FingerPrint"); // Update path as needed

const FINGERPRINT_SERVER_URL = "http://localhost:5500"; // Update with your Python server URL

/**
 * Service for interacting with the fingerprint Python server and MongoDB
 */
class FingerprintService {
  /**
   * Process and enroll a new fingerprint
   * @param {Object} data Object containing staffId and fingerPrint base64 data
   * @returns {Promise<Object>} Result of the enrollment
   */
  async enrollFingerprint(data) {
    try {
      const { staffId, fingerPrint } = data;

      if (!staffId || !fingerPrint) {
        throw new Error("Missing staffId or fingerprint data");
      }

      // First, process the fingerprint with the Python server to get templates
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

      // Extract templates from the response
      const { template, original_template, quality_score } =
        processResponse.data;

      // Check if staff ID already exists in the fingerprint collection
      let existingRecord = await FingerPrint.findOne({ staffId });

      if (existingRecord) {
        // Update existing record
        existingRecord.original = fingerPrint;
        existingRecord.template = template;
        existingRecord.original_template = original_template;
        existingRecord.quality_score = quality_score;
        existingRecord.enrolled_at = new Date();

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
          original: fingerPrint,
          template,
          original_template,
          quality_score,
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
        original_template: record.original_template,
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
        // You can expand this to include more user data if needed
        const userData = await getUserData(matchResponse.data.staffId);

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
   * Re-process all stored fingerprints to update templates
   * @returns {Promise<Object>} Result of the update process
   */
  async updateAllTemplates() {
    try {
      // Fetch all fingerprint records from the database
      const fingerprintRecords = await FingerPrint.find();

      let updatedCount = 0;
      let errorCount = 0;

      for (const record of fingerprintRecords) {
        try {
          // Skip records without original fingerprint data
          if (!record.original) {
            continue;
          }

          // Process the fingerprint with the Python server
          const processResponse = await axios.post(
            `${FINGERPRINT_SERVER_URL}/api/fingerprint/process`,
            {
              fingerPrint: record.original,
            }
          );

          if (processResponse.data.success) {
            // Update the record with new templates
            record.template = processResponse.data.template;
            record.original_template = processResponse.data.original_template;
            record.quality_score = processResponse.data.quality_score;
            record.updated_at = new Date();

            await record.save();
            updatedCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(
            `Error updating templates for staffId ${record.staffId}:`,
            err
          );
          errorCount++;
        }
      }

      return {
        success: true,
        message: `Updated ${updatedCount} fingerprint templates. ${errorCount} errors.`,
        updatedCount,
        errorCount,
      };
    } catch (error) {
      console.error("Template update error:", error);
      return {
        success: false,
        message: error.message || "Failed to update templates",
      };
    }
  }
}

// Helper function to get user data
async function getUserData(staffId) {
  try {
    // This is a placeholder - implement your own user data retrieval
    // const user = await User.findById(staffId);
    // return user ? { name: user.firstname, email: user.email } : null;

    // For now, return a placeholder
    return {
      name: "User",
      email: "user@example.com",
    };
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
}

module.exports = new FingerprintService();
