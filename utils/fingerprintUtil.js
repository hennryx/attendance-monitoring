// utils/fingerprintUtil.js
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Get the absolute path to the executable - adjust these paths as needed
const executablePath = path.resolve(
  __dirname,
  "../fingerprint-tools/FingerPrintBridge.exe"
);

// Ensure the fingerprint tools directory exists
const toolsDir = path.dirname(executablePath);
if (!fs.existsSync(toolsDir)) {
  fs.mkdirSync(toolsDir, { recursive: true });
}

// Validate executable exists
const validateExecutable = () => {
  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `Fingerprint bridge executable not found at ${executablePath}`
    );
  }
};

// Helper function to run FingerPrintBridge commands
const runFingerPrintCommand = async (args, options = {}) => {
  validateExecutable();

  return new Promise((resolve, reject) => {
    console.log(
      `Running fingerprint command: ${executablePath} ${args.join(" ")}`
    );

    const process = spawn(executablePath, args, {
      ...options,
      windowsVerbatimArguments: true,
      shell: true,
      maxBuffer: 10 * 1024 * 1024,
    });

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(`[FingerPrintBridge Error]: ${data.toString()}`);
    });

    process.on("close", (code) => {
      console.log(`Process exited with code ${code}`);

      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${stderr}`));
      }

      try {
        if (!stdout.trim()) {
          return resolve({ success: false, message: "No output received" });
        }

        const result = JSON.parse(stdout);
        resolve({ ...result, success: true });
      } catch (err) {
        console.error(
          "Failed to parse stdout as JSON:",
          err,
          "Raw output:",
          stdout
        );
        reject(new Error(`Failed to parse output: ${err.message}`));
      }
    });

    process.on("error", (error) => {
      console.error("Error spawning process:", error);
      reject(error);
    });
  });
};

const FingerprintUtil = {
  /**
   * Get list of available fingerprint devices
   * @returns {Promise<Array>} List of devices
   */
  listDevices: async () => {
    try {
      const result = await runFingerPrintCommand(["--list-devices"]);
      return {
        success: true,
        devices: result.devices || [],
      };
    } catch (error) {
      console.error("Error listing devices:", error);
      return {
        success: false,
        message: error.message,
        devices: [],
      };
    }
  },

  /**
   * Capture a fingerprint from the device
   * @param {Object} options Capture options
   * @param {string} [options.deviceId] Optional device ID to use
   * @param {number} [options.timeout] Timeout in milliseconds
   * @returns {Promise<Object>} Capture result with image and features
   */
  captureFingerprint: async (options = {}) => {
    try {
      const args = ["--capture"];

      if (options.deviceId) {
        args.push("--device", options.deviceId);
      }

      if (options.timeout) {
        args.push("--timeout", options.timeout.toString());
      }

      return await runFingerPrintCommand(args);
    } catch (error) {
      console.error("Error capturing fingerprint:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  },

  /**
   * Match a fingerprint against a set of stored templates
   * @param {Object} data Match data
   * @param {string} data.features Probe features to match
   * @param {Array<Object>} data.templates Array of template objects with id and features properties
   * @returns {Promise<Object>} Match result
   */
  matchFingerprint: async (data) => {
    try {
      if (!data.features) {
        throw new Error("Missing features data");
      }

      if (
        !data.templates ||
        !Array.isArray(data.templates) ||
        data.templates.length === 0
      ) {
        return {
          success: true,
          matched: false,
          message: "No templates provided for matching",
        };
      }

      const args = ["--match", "--probe", data.features];

      // Add each template
      data.templates.forEach((template) => {
        if (template.id && template.features) {
          args.push("--candidate", template.id, template.features);
        }
      });

      return await runFingerPrintCommand(args);
    } catch (error) {
      console.error("Error matching fingerprint:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  },
};

module.exports = FingerprintUtil;
