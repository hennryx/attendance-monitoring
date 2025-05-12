import { useCallback, useEffect, useState } from "react";

export const useFingerprintScanner = () => {
  const [fingerprint, setFingerprint] = useState(null);
  const [status, setStatus] = useState("Not started");
  const [sdk, setSdk] = useState(null);
  const [readers, setReaders] = useState([]);
  const [selectedReader, setSelectedReader] = useState("");
  const [acquisitionStarted, setAcquisitionStarted] = useState(false);
  const [scanQuality, setScanQuality] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Function to initialize SDK - can be called to re-attempt initialization
  const initializeSdk = useCallback(async () => {
    try {
      // Check if the SDK is available in the window object
      if (window.Fingerprint && window.Fingerprint.WebApi) {
        const fingerprintSdk = new window.Fingerprint.WebApi();
        setSdk(fingerprintSdk);

        // Set up event handlers
        fingerprintSdk.onDeviceConnected = (e) => {
          console.log("Device connected:", e);
          setStatus("Device connected. Scan your finger.");
        };

        fingerprintSdk.onDeviceDisconnected = (e) => {
          console.log("Device disconnected:", e);
          setStatus("Device disconnected");
          setSelectedReader("");
          setAcquisitionStarted(false);
        };

        fingerprintSdk.onCommunicationFailed = (e) => {
          console.log("Communication failed:", e);
          setStatus("Communication failed");
          setAcquisitionStarted(false);
        };

        fingerprintSdk.onSamplesAcquired = (s) => {
          console.log("Sample acquired:", s);
          try {
            const samples = JSON.parse(s.samples);
            console.log("Parsed samples:", samples);
            if (samples && samples.length > 0) {
              const base64Image = `data:image/png;base64,${window.Fingerprint.b64UrlTo64(
                samples[0].Data || samples[0]
              )}`;
              console.log("Successfully processed fingerprint image");
              setFingerprint(base64Image);
              setStatus("Fingerprint captured successfully");

              stopCapture();
            } else {
              console.error("No sample data in response");
              setStatus("No sample data received");
            }
          } catch (error) {
            console.error("Error processing sample:", error, s);
            try {
              if (
                typeof s.samples === "string" &&
                s.samples.startsWith("data:image")
              ) {
                setFingerprint(s.samples);
                setStatus("Fingerprint captured (raw format)");
                stopCapture();
                return;
              }
            } catch (innerError) {
              console.error("Second attempt failed:", innerError);
            }
            setStatus(`Error processing sample: ${error.message}`);
          }
        };

        fingerprintSdk.onQualityReported = (e) => {
          console.log("Quality reported:", e);
          if (window.Fingerprint.QualityCode && e.quality !== undefined) {
            setScanQuality(window.Fingerprint.QualityCode[e.quality]);
          }
        };

        setIsInitialized(true);

        try {
          await getAvailableReaders(fingerprintSdk);
        } catch (error) {
          console.error("Failed to enumerate devices:", error);
          setStatus(`Failed to find readers: ${error.message}`);
        }

        return true;
      } else {
        setStatus(
          "Fingerprint SDK not available. Make sure you've included the SDK scripts."
        );
        return false;
      }
    } catch (error) {
      console.error("Error initializing SDK:", error);
      setStatus(`Error initializing SDK: ${error.message}`);
      return false;
    }
  }, []);

  useEffect(() => {
    initializeSdk();

    return () => {
      if (sdk && acquisitionStarted) {
        sdk.stopAcquisition().catch(console.error);
      }
    };
  }, [initializeSdk]);

  // Function to get available readers
  const getAvailableReaders = async (sdkInstance = null) => {
    const currentSdk = sdkInstance || sdk;
    if (!currentSdk) {
      throw new Error("SDK not initialized");
    }

    try {
      console.log("Enumerating devices...");
      const readersArray = await currentSdk.enumerateDevices();
      console.log("Available readers:", readersArray);

      if (Array.isArray(readersArray)) {
        setReaders(readersArray);

        if (readersArray.length > 0) {
          setSelectedReader(readersArray[0]);
          setStatus("Reader connected. Ready to scan.");
          return readersArray;
        } else {
          setStatus("No fingerprint readers found. Please connect a reader.");
          return [];
        }
      } else {
        console.error("Invalid readers response:", readersArray);
        setStatus("Failed to enumerate devices: Invalid response");
        return [];
      }
    } catch (error) {
      console.error("Error getting readers:", error);
      setStatus(`Error getting readers: ${error.message}`);
      throw error;
    }
  };

  // Start capturing
  const startCapture = async () => {
    if (!sdk) {
      setStatus("SDK not initialized");
      return false;
    }

    if (!selectedReader) {
      setStatus("No reader selected");
      return false;
    }

    if (acquisitionStarted) {
      setStatus("Acquisition already started");
      return false;
    }

    try {
      console.log("Starting acquisition with reader:", selectedReader);
      const format = window.Fingerprint.SampleFormat.PngImage;
      console.log("Using format:", format);

      await sdk.startAcquisition(format, selectedReader);
      console.log("Acquisition started successfully");

      setAcquisitionStarted(true);
      setStatus("Scanning started. Place your finger on the reader.");
      return true;
    } catch (error) {
      console.error("Error starting capture:", error);
      setStatus(`Error starting capture: ${error.message}`);
      return false;
    }
  };

  // Stop capturing
  const stopCapture = async () => {
    if (!sdk || !acquisitionStarted) return false;

    try {
      await sdk.stopAcquisition();
      setAcquisitionStarted(false);
      return true;
    } catch (error) {
      console.error("Error stopping capture:", error);
      setStatus(`Error stopping capture: ${error.message}`);
      return false;
    }
  };

  // Scan fingerprint and return result with timeout
  const scanFingerprint = async (timeoutMs = 30000) => {
    return new Promise(async (resolve, reject) => {
      // Declare timeoutId at the beginning of the function
      let timeoutId = null;

      try {
        setAcquisitionStarted(false);
        setStatus("Ready to scan");

        if (!sdk) {
          const initialized = await initializeSdk();
          if (!initialized || !sdk) {
            reject(new Error("Failed to initialize SDK"));
            return;
          }
        }

        setFingerprint(null);
        setScanQuality("");

        const originalSamplesCallback = sdk.onSamplesAcquired;
        const originalQualityCallback = sdk.onQualityReported;
        const originalErrorCallback = sdk.onCommunicationFailed;

        const cleanup = () => {
          if (sdk) {
            sdk.onSamplesAcquired = originalSamplesCallback;
            sdk.onQualityReported = originalQualityCallback;
            sdk.onCommunicationFailed = originalErrorCallback;
          }
          if (timeoutId) clearTimeout(timeoutId);
        };

        sdk.onSamplesAcquired = (s) => {
          console.log("Sample acquired in scanFingerprint:", s);

          try {
            const samples = JSON.parse(s.samples);
            if (samples && samples.length > 0) {
              const base64Image = `data:image/png;base64,${window.Fingerprint.b64UrlTo64(
                samples[0].Data || samples[0]
              )}`;
              console.log(
                "Successfully processed fingerprint image in scanFingerprint"
              );

              setFingerprint(base64Image);
              setStatus("Fingerprint captured successfully");

              stopCapture().then(() => {
                cleanup();
                resolve(base64Image);
              });
            } else {
              console.error("No sample data in response");
              setStatus("No sample data received");
            }
          } catch (error) {
            console.error(
              "Error processing sample in scanFingerprint:",
              error,
              s
            );
            try {
              if (
                typeof s.samples === "string" &&
                (s.samples.includes("base64") ||
                  s.samples.startsWith("data:image"))
              ) {
                stopCapture().then(() => {
                  setFingerprint(s.samples);
                  cleanup();
                  resolve(s.samples);
                });
                return;
              }
            } catch (innerError) {
              console.error("Alternative format failed:", innerError);
            }

            setStatus(`Error processing sample: ${error.message}`);
          }

          if (originalSamplesCallback) {
            originalSamplesCallback(s);
          }
        };

        // Error handler
        sdk.onCommunicationFailed = (e) => {
          console.error("Communication failed during scan:", e);
          setStatus("Communication failed during scan");

          stopCapture().then(() => {
            cleanup();
            reject(
              new Error("Communication with the fingerprint reader failed.")
            );
          });

          if (originalErrorCallback) {
            originalErrorCallback(e);
          }
        };

        // Start the capture process
        const captureStarted = await startCapture();
        if (!captureStarted) {
          cleanup();
          reject(new Error(`Failed to start capture: ${status}`));
          return;
        }

        // Now assign the timeoutId
        timeoutId = setTimeout(() => {
          stopCapture().then(() => {
            cleanup();
            reject(new Error("Fingerprint scan timed out. Please try again."));
          });
        }, timeoutMs);
      } catch (error) {
        console.error("Unexpected error in scanFingerprint:", error);
        stopCapture();
        reject(new Error(`Scan failed: ${error.message}`));
      }
    });
  };

  // Reload the SDK and readers if needed
  const refreshSdk = async () => {
    try {
      if (sdk && acquisitionStarted) {
        await stopCapture();
      }
      return await initializeSdk();
    } catch (error) {
      console.error("Error refreshing SDK:", error);
      setStatus(`Error refreshing SDK: ${error.message}`);
      return false;
    }
  };

  return {
    fingerprint,
    status,
    readers,
    selectedReader,
    setSelectedReader,
    acquisitionStarted,
    scanFingerprint,
    startCapture,
    stopCapture,
    getAvailableReaders,
    refreshSdk,
    isInitialized,
    scanQuality,
  };
};
