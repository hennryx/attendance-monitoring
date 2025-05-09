// utils/fingerprintUtil.js
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Path to the fingerprint executable
const executablePath = path.join(
  __dirname,
  "../fingerprint-tools/FingerPrintBridge.exe"
);
console.log("Executable path:", executablePath);
console.log("Executable exists:", fs.existsSync(executablePath));

// List the directory contents to see all files in the directory
const dirPath = path.join(__dirname, "../../fingerprint-tools");
console.log("Directory contents:", fs.readdirSync(dirPath));

const FingerprintUtil = {
  /**
   * Get list of available fingerprint devices
   * @returns {Promise<Array>} List of devices
   */
  listDevices: () => {
    return new Promise((resolve, reject) => {
      console.log("Attempting to spawn process:", executablePath);

      try {
        const process = spawn(executablePath, ["--list-devices"], {
          stdio: ["pipe", "pipe", "pipe"],
          windowsVerbatimArguments: true,
          shell: true, // Try using shell to execute
        });

        let stdout = "";
        let stderr = "";

        process.stdout.on("data", (data) => {
          const chunk = data.toString();
          console.log("Received stdout chunk:", chunk);
          stdout += chunk;
        });

        process.stderr.on("data", (data) => {
          const chunk = data.toString();
          console.log("Received stderr chunk:", chunk);
          stderr += chunk;
        });

        process.on("close", (code) => {
          console.log(`Process exited with code ${code}`);
          if (stderr) console.log("stderr output:", stderr);

          if (code !== 0) {
            reject(new Error(`Process exited with code ${code}: ${stderr}`));
            return;
          }

          try {
            console.log("Full stdout:", stdout);
            const devices = JSON.parse(stdout);
            resolve({ success: true, devices });
          } catch (err) {
            console.error("Failed to parse stdout as JSON:", err);
            reject(
              new Error(
                `Failed to parse device list: ${err.message}\nRaw output: ${stdout}`
              )
            );
          }
        });

        process.on("error", (error) => {
          console.error("Error spawning process:", error);
          reject(error);
        });
      } catch (error) {
        console.error("Exception during spawn attempt:", error);
        reject(error);
      }
    });
  },

  /**
   * Capture a fingerprint from the device
   * @param {Object} options Capture options
   * @param {string} [options.deviceId] Optional device ID to use
   * @param {number} [options.timeout] Timeout in milliseconds
   * @returns {Promise<Object>} Capture result with image and features
   */
  captureFingerprint: (options = {}) => {
    return new Promise((resolve, reject) => {
      const args = ["--capture"];

      if (options.deviceId) {
        args.push("--device", options.deviceId);
      }

      if (options.timeout) {
        args.push("--timeout", options.timeout.toString());
      }

      try {
        const process = spawn(executablePath, args, {
          stdio: ["pipe", "pipe", "pipe"],
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
        });

        process.on("close", (code) => {
          console.log(`Capture process exited with code ${code}`);

          if (code !== 0) {
            console.error(`Capture error: Process exited with code ${code}`);
            if (stderr) console.error("Stderr:", stderr);
            reject(
              new Error(
                `Failed to capture fingerprint: Process exited with code ${code}`
              )
            );
            return;
          }

          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (err) {
            console.error("Failed to parse capture result:", err);
            reject(new Error(`Failed to parse capture result: ${err.message}`));
          }
        });

        process.on("error", (error) => {
          console.error("Error spawning capture process:", error);
          reject(error);
        });
      } catch (error) {
        console.error("Exception during spawn attempt for capture:", error);
        reject(error);
      }
    });
  },

  /**
   * Match a fingerprint against a set of stored templates
   * @param {Object} data Match data
   * @param {string} data.features Probe features to match
   * @param {Array<Object>} data.templates Array of template objects with id and features properties
   * @returns {Promise<Object>} Match result
   */
  matchFingerprint: (data) => {
    return new Promise((resolve, reject) => {
      if (!data.features) {
        reject(new Error("Missing features data"));
        return;
      }

      if (
        !data.templates ||
        !Array.isArray(data.templates) ||
        data.templates.length === 0
      ) {
        resolve({
          success: true,
          matched: false,
          message: "No templates provided for matching",
        });
        return;
      }

      const args = ["--match", "--probe", data.features];

      // Add each template
      data.templates.forEach((template) => {
        if (template.id && template.features) {
          args.push("--candidate", template.id, template.features);
        }
      });

      try {
        const process = spawn(executablePath, args, {
          stdio: ["pipe", "pipe", "pipe"],
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
        });

        process.on("close", (code) => {
          console.log(`Match process exited with code ${code}`);

          if (code !== 0) {
            console.error(`Match error: Process exited with code ${code}`);
            if (stderr) console.error("Stderr:", stderr);
            reject(
              new Error(
                `Failed to match fingerprint: Process exited with code ${code}`
              )
            );
            return;
          }

          try {
            const result = JSON.parse(stdout);
            resolve({
              success: true,
              matched: result.matched,
              staffId: result.staffId,
              score: result.score,
            });
          } catch (err) {
            console.error("Failed to parse match result:", err);
            reject(new Error(`Failed to parse match result: ${err.message}`));
          }
        });

        process.on("error", (error) => {
          console.error("Error spawning match process:", error);
          reject(error);
        });
      } catch (error) {
        console.error("Exception during spawn attempt for match:", error);
        reject(error);
      }
    });
  },
};

module.exports = FingerprintUtil;
