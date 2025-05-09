// test-fingerprint.js
const FingerprintUtil = require("./utils/fingerprintUtil");

async function testFingerprint() {
  try {
    console.log("Testing device list...");
    const devices = await FingerprintUtil.listDevices();
    console.log("Devices:", devices);

    if (devices.devices && devices.devices.length > 0) {
      console.log("Testing fingerprint capture...");
      const captureResult = await FingerprintUtil.captureFingerprint({
        deviceId: devices.devices[0].id,
        timeout: 30000,
      });
      console.log("Capture successful:", captureResult.success);
      console.log(
        "Features length:",
        captureResult.features ? captureResult.features.length : 0
      );
    } else {
      console.log("No devices found for testing capture");
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testFingerprint();
