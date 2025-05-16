const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const FingerPrint = require("../models/FingerPrint");
const Users = require("../models/Users");

const FINGERPRINT_SERVER_URL = process.env.FINGERPRINT_SERVER_URL || "5500";
const FINGERPRINT_DIR = path.join(__dirname, "../assets/fingerprints");
const QUALITY_THRESHOLD = 40;

class FingerprintService {
  constructor() {
    this.initializeStorage();
    this.templateCache = new Map();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(FINGERPRINT_DIR, { recursive: true });
      console.log(
        `Fingerprint storage directory initialized: ${FINGERPRINT_DIR}`
      );
    } catch (error) {
      console.error(
        `Failed to initialize fingerprint storage: ${error.message}`
      );
    }
  }

  async enrollFingerprint(data) {
    if (!data || !data.staffId || !data.fingerPrint) {
      return {
        success: false,
        message: "Missing required enrollment data (staffId or fingerprint)",
      };
    }

    const { staffId, fingerPrint, email } = data;
    const startTime = Date.now();
    console.log(`Starting fingerprint enrollment for staffId: ${staffId}`);

    try {
      const processResponse = await this.processFingerprint(
        fingerPrint,
        staffId,
        email
      );

      if (!processResponse.success) {
        return processResponse;
      }

      const { template, quality_score } = processResponse;

      const enrollmentResult = await this.saveFingerprint(
        staffId,
        template,
        quality_score,
        fingerPrint
      );
      const duration = Date.now() - startTime;

      return {
        ...enrollmentResult,
        duration,
        quality_score,
      };
    } catch (error) {
      console.error(
        `Fingerprint enrollment error for staffId ${staffId}:`,
        error
      );
      return {
        success: false,
        message:
          error.message ||
          "Failed to enroll fingerprint due to an unexpected error",
        error: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  }

  async processFingerprint(fingerPrint, staffId, email) {
    try {
      let cleanFingerprint = fingerPrint;
      if (
        typeof cleanFingerprint === "string" &&
        cleanFingerprint.includes(",")
      ) {
        cleanFingerprint = cleanFingerprint.split(",")[1];
      }

      const response = await axios.post(
        `http://localhost:${FINGERPRINT_SERVER_URL}/api/fingerprint/process-single`,
        { staffId, email, fingerPrint: cleanFingerprint },
        { timeout: 60000 }
      );

      const { data } = response;

      if (!data.success) {
        return {
          success: false,
          message: data.message || "Failed to process fingerprint",
        };
      }

      return {
        success: true,
        template: data.template,
        quality_score: data.quality_score,
        processed_fingerprint: fingerPrint,
      };
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        return {
          success: false,
          message:
            "Fingerprint processing server is not available. Please try again later.",
        };
      }

      if (error.response) {
        return {
          success: false,
          message:
            error.response.data?.message ||
            `Server error: ${error.response.status}`,
        };
      }

      return {
        success: false,
        message: error.message || "Unknown error during fingerprint processing",
      };
    }
  }

  async saveFingerprint(staffId, template, quality_score, fingerprintData) {
    try {
      const filename = `${staffId}_${Date.now()}.png`;
      const filePath = path.join(FINGERPRINT_DIR, filename);

      let base64Data = fingerprintData;
      if (typeof base64Data === "string" && base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      const existingRecord = await FingerPrint.findOne({ staffId });

      if (
        existingRecord &&
        existingRecord.file_paths &&
        existingRecord.file_paths.length > 0
      ) {
        try {
          for (const oldFile of existingRecord.file_paths) {
            const oldPath = path.join(FINGERPRINT_DIR, oldFile);
            await fs.unlink(oldPath).catch(() => {});
          }
          console.log(
            `Deleted existing fingerprint file(s) for staffId: ${staffId}`
          );
        } catch (fileError) {
          console.error(
            `Error deleting old fingerprint files: ${fileError.message}`
          );
        }
      }

      await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));
      console.log(
        `Saved new fingerprint file for staffId: ${staffId} at ${filePath}`
      );

      if (existingRecord) {
        existingRecord.template = template;
        existingRecord.original_template = template;
        existingRecord.quality_score = quality_score;
        existingRecord.file_paths = [filename];
        existingRecord.updated_at = new Date();
        existingRecord.scan_count = existingRecord.scan_count + 1;

        await existingRecord.save();

        this.templateCache.set(staffId.toString(), template);

        await Users.findByIdAndUpdate(staffId, { hasFingerPrint: true });

        return {
          success: true,
          message: "Fingerprint updated successfully!",
        };
      } else {
        const newFingerprint = new FingerPrint({
          staffId,
          template,
          original_template: template,
          quality_score,
          file_paths: [filename],
          scan_count: 1,
          enrolled_at: new Date(),
        });

        await newFingerprint.save();

        this.templateCache.set(staffId.toString(), template);

        await Users.findByIdAndUpdate(staffId, { hasFingerPrint: true });

        return {
          success: true,
          message: "Fingerprint enrolled successfully!",
        };
      }
    } catch (error) {
      console.error(
        `Database/filesystem error during fingerprint save: ${error.message}`
      );
      return {
        success: false,
        message: "Failed to save fingerprint data",
      };
    }
  }

  async matchFingerprint(data) {
    if (!data || !data.fingerPrint) {
      return {
        success: false,
        matched: false,
        message: "Missing fingerprint data",
      };
    }

    console.log("Starting fingerprint matching process");
    const startTime = Date.now();

    try {
      let cleanFingerprint = data.fingerPrint;
      if (
        typeof cleanFingerprint === "string" &&
        cleanFingerprint.includes(",")
      ) {
        cleanFingerprint = cleanFingerprint.split(",")[1];
      }

      const fingerprintRecords = await FingerPrint.find().lean();

      if (fingerprintRecords.length === 0) {
        return {
          success: false,
          matched: false,
          message: "No fingerprints enrolled in the database",
        };
      }

      const templates = fingerprintRecords.map((record) => ({
        staffId: record.staffId.toString(),
        template:
          this.templateCache.get(record.staffId.toString()) || record.template,
      }));

      console.log(`Found ${templates.length} templates for matching`);

      const response = await axios.post(
        `http://localhost:${FINGERPRINT_SERVER_URL}/api/fingerprint/match`,
        { fingerPrint: cleanFingerprint, templates },
        { timeout: 30000 }
      );

      const { data: matchResult } = response;
      const matchTime = Date.now() - startTime;

      if (matchResult.success && matchResult.matched) {
        const userData = await this.getUserData(matchResult.staffId);

        return {
          ...matchResult,
          userData,
          matchTime,
        };
      }

      return {
        ...matchResult,
        matchTime,
      };
    } catch (error) {
      console.error("Fingerprint matching error:", error);

      if (error.code === "ECONNREFUSED") {
        return {
          success: false,
          matched: false,
          message: "Fingerprint processing server is not available",
        };
      }

      if (error.response) {
        return {
          success: false,
          matched: false,
          message:
            error.response.data?.message ||
            `Server error: ${error.response.status}`,
        };
      }

      return {
        success: false,
        matched: false,
        message: error.message || "Failed to match fingerprint",
      };
    }
  }

  async verifyFingerprint(data) {
    if (!data || !data.fingerPrint || !data.staffId) {
      return {
        success: false,
        verified: false,
        message: "Missing fingerprint data or staff ID",
      };
    }

    try {
      const { fingerPrint, staffId } = data;

      let cleanFingerprint = fingerPrint;
      if (
        typeof cleanFingerprint === "string" &&
        cleanFingerprint.includes(",")
      ) {
        cleanFingerprint = cleanFingerprint.split(",")[1];
      }

      let template = this.templateCache.get(staffId.toString());

      if (!template) {
        const record = await FingerPrint.findOne({ staffId }).lean();

        if (!record) {
          return {
            success: false,
            verified: false,
            message: "No fingerprint enrolled for this staff member",
          };
        }

        template = record.template;
        this.templateCache.set(staffId.toString(), template);
      }

      const response = await axios.post(
        `http://localhost:${FINGERPRINT_SERVER_URL}/api/fingerprint/verify`,
        {
          fingerPrint: cleanFingerprint,
          staffId,
          templates: [{ staffId, template }],
        },
        { timeout: 15000 }
      );

      const { data: verifyResult } = response;

      if (verifyResult.success && verifyResult.verified) {
        const userData = await this.getUserData(staffId);

        return {
          ...verifyResult,
          userData,
        };
      }

      return verifyResult;
    } catch (error) {
      console.error("Fingerprint verification error:", error);

      if (error.code === "ECONNREFUSED") {
        return {
          success: false,
          verified: false,
          message: "Fingerprint processing server is not available",
        };
      }

      if (error.response) {
        return {
          success: false,
          verified: false,
          message:
            error.response.data?.message ||
            `Server error: ${error.response.status}`,
        };
      }

      return {
        success: false,
        verified: false,
        message: error.message || "Failed to verify fingerprint",
      };
    }
  }

  async getUserData(staffId) {
    try {
      const user = await Users.findById(staffId);

      return user
        ? {
            name:
              user.firstname +
              (user.middlename ? ` ${user.middlename}` : "") +
              ` ${user.lastname}`,
            email: user.email,
            department: user.department,
            position: user.position,
          }
        : null;
    } catch (error) {
      console.error(`Error fetching user data for staffId ${staffId}:`, error);
      return null;
    }
  }

  clearCache() {
    this.templateCache.clear();
    console.log("Fingerprint template cache cleared");
  }
}

module.exports = new FingerprintService();
