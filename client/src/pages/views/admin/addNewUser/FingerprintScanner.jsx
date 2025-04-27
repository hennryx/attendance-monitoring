// Create a new file: FingerprintScanner.jsx

import { useEffect, useState, useCallback } from "react";
import { HiOutlineX } from "react-icons/hi";
import Swal from "sweetalert2";

// This function will be your main hook for fingerprint scanning
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

<<<<<<< Updated upstream
        fingerprintSdk.onSamplesAcquired = (s) => {
          console.log("Sample acquired:", s);
          // Handle samples
          try {
            const samples = JSON.parse(s.samples);
            console.log("Parsed samples:", samples);
            if (samples && samples.length > 0) {
              // Assuming PngImage format
              const base64Image = `data:image/png;base64,${window.Fingerprint.b64UrlTo64(
                samples[0].Data || samples[0]
              )}`;
              console.log("Successfully processed fingerprint image");
              setFingerprint(base64Image);
              setStatus("Fingerprint captured successfully");

              // Auto stop after capture
              stopCapture();
=======
            // If there's at least one reader, select it automatically
            console.log(readersArray, "<---");
            
            if (readersArray.length > 0) {
                setSelectedReader(readersArray[0]);
                setStatus("Reader connected. Ready to scan.");
>>>>>>> Stashed changes
            } else {
              console.error("No sample data in response");
              setStatus("No sample data received");
            }
          } catch (error) {
            console.error("Error processing sample:", error, s);
            // Try to get raw data if JSON parsing fails
            try {
              if (
                typeof s.samples === "string" &&
                s.samples.startsWith("data:image")
              ) {
                // It might already be a data URL
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

        // Get the list of available readers
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

  // Initialize the SDK
  useEffect(() => {
    initializeSdk();

    // Cleanup on unmount
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

        // If there's at least one reader, select it automatically
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
      // Format is set to PNG image
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
  // Fix scanFingerprint function in FingerprintScanner.jsx

  const scanFingerprint = async (timeoutMs = 30000) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Check SDK initialization first
        if (!sdk) {
          const initialized = await initializeSdk();
          if (!initialized || !sdk) {
            reject(new Error("Failed to initialize SDK"));
            return;
          }
        }

        // Clear any existing fingerprint first
        setFingerprint(null);
        setScanQuality("");

        // Store original callback references to restore later
        const originalSamplesCallback = sdk.onSamplesAcquired;
        const originalQualityCallback = sdk.onQualityReported;
        const originalErrorCallback = sdk.onCommunicationFailed;

        // Create a cleanup function to restore original callbacks and clear timers
        const cleanup = () => {
          if (sdk) {
            sdk.onSamplesAcquired = originalSamplesCallback;
            sdk.onQualityReported = originalQualityCallback;
            sdk.onCommunicationFailed = originalErrorCallback;
          }
          if (timeoutId) clearTimeout(timeoutId);
        };

        // Set up temporary callbacks
        sdk.onSamplesAcquired = (s) => {
          console.log("Sample acquired in scanFingerprint:", s);

          try {
            const samples = JSON.parse(s.samples);
            if (samples && samples.length > 0) {
              // Create the fingerprint image
              const base64Image = `data:image/png;base64,${window.Fingerprint.b64UrlTo64(
                samples[0].Data || samples[0]
              )}`;
              console.log(
                "Successfully processed fingerprint image in scanFingerprint"
              );

              // Update state
              setFingerprint(base64Image);
              setStatus("Fingerprint captured successfully");

              // Stop capture first before resolving
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
            // Try alternative format
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

            // If we get here, both attempts failed but we don't want to reject yet
            setStatus(`Error processing sample: ${error.message}`);
          }

          // Call original callback if it exists
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

          // Still call original callback
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

        // Set timeout
        const timeoutId = setTimeout(() => {
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

  // Simplified event for debugging
  useEffect(() => {
    if (fingerprint) {
      console.log("Fingerprint state updated with image data");
    }
  }, [fingerprint]);

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

// Create a modal component for fingerprint scanning
export const FingerprintModal = ({ isOpen, onClose, onCapture, staffId }) => {
  const {
    fingerprint,
    status,
    readers,
    selectedReader,
    scanFingerprint,
    refreshSdk,
    isInitialized,
    stopCapture, // Make sure to include this
  } = useFingerprintScanner();

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanTimeout, setScanTimeout] = useState(null);

  // Effect to check SDK initialization
  useEffect(() => {
    if (isOpen && !window.Fingerprint) {
      Swal.fire({
        title: "SDK Not Available",
        text: "The Fingerprint SDK is not available or scripts haven't loaded. Please refresh the page and try again.",
        icon: "error",
      });
    }
  }, [isOpen]);

  useEffect(() => {
    let timeoutId;

    if (isOpen && isInitialized) {
      // Only set the timeout if the modal is open and SDK is initialized
      timeoutId = setTimeout(() => {
        // Check readers.length at the time the timeout executes
        if (readers.length === 0) {
          Swal.fire({
            title: "No Reader Found",
            text: "No fingerprint readers detected. Please connect a reader and try again.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Refresh Readers",
            cancelButtonText: "Cancel",
          }).then((result) => {
            if (result.isConfirmed) {
              refreshSdk();
            }
          });
        }
      }, 5000);
    }

    // Clean up the timeout if component unmounts or dependencies change
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen, isInitialized, readers.length, refreshSdk]);

  useEffect(() => {
    return () => {
      // Ensure we clean up if the modal is closed during scanning
      if (isScanning) {
        stopCapture();
        if (scanTimeout) clearTimeout(scanTimeout);
      }
    };
  }, [isScanning, stopCapture]);

  const handleScan = async () => {
    if (isScanning) return;

    if (!selectedReader) {
      Swal.fire({
        title: "No Reader Selected",
        text: "No fingerprint reader selected. Please connect a reader and try again.",
        icon: "error",
      });
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      console.log("Starting fingerprint scan...");

      // Create a timeout to force stop scanning if it takes too long
      const timeoutId = setTimeout(() => {
        if (isScanning) {
          stopCapture();
          setScanError("Scan failed to complete in time. Please try again.");
          setIsScanning(false);
        }
      }, 35000); // Slightly longer than the scanFingerprint timeout

      setScanTimeout(timeoutId);

      const fingerprintData = await scanFingerprint(30000); // 30 second timeout
      clearTimeout(timeoutId);

      console.log(
        "Scan completed successfully:",
        fingerprintData ? "Data received" : "No data"
      );

      if (fingerprintData) {
        // Extract just the base64 part if it's a data URL
        const cleanedFingerprintData = fingerprintData.includes("base64")
          ? fingerprintData.split(",")[1]
          : fingerprintData;

        onCapture({
          staffId,
          fingerprint: cleanedFingerprintData,
        });

        // Show success message
        Swal.fire({
          title: "Success!",
          text: "Fingerprint captured successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });

        // Close modal after success
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error("Scan error:", error);
      setScanError(error.message);

      Swal.fire({
        title: "Scan Failed",
        text: error.message,
        icon: "error",
      });
    } finally {
      clearTimeout(scanTimeout);
      setScanTimeout(null);
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-white text-black">
        <div className="flex flex-row justify-between">
          <h3 className="font-bold text-lg">Register Fingerprint</h3>
          <button
            className="btn btn-ghost bg-white text-black"
            type="button"
            onClick={onClose}
            disabled={isScanning}
          >
            <HiOutlineX />
          </button>
        </div>

        <div className="modal-action">
          <form className="flex flex-col gap-4 w-full">
            <p className="text-gray-600 text-sm">Staff ID: {staffId}</p>

            {readers.length > 0 && (
              <p className="text-green-600 text-sm">
                Using fingerprint reader: {selectedReader}
              </p>
            )}

            {readers.length === 0 && (
              <p className="text-red-600 text-sm">
                No fingerprint reader detected. Please connect a reader.
              </p>
            )}

            <div className="border rounded flex items-center justify-center h-40">
              {fingerprint ? (
                <img
                  src={fingerprint}
                  alt="Fingerprint"
                  className="max-h-full"
                />
              ) : scanError ? (
                <p className="text-center text-red-500">{scanError}</p>
              ) : (
                <p className="text-center text-gray-500">{status}</p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2 w-full">
              <button
                type="button"
                className="btn w-full justify-center rounded-md bg-blue-300 px-3 py-1.5 text-sm font-semibold leading-6 text-blue-800 shadow-sm hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                onClick={handleScan}
                disabled={isScanning || readers.length === 0}
              >
                {isScanning ? "Scanning..." : "Scan Fingerprint"}
              </button>

              <button
                type="button"
                className="btn w-full justify-center rounded-md bg-gray-300 px-3 py-1.5 text-sm font-semibold leading-6 text-gray-800 shadow-sm hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
                onClick={onClose}
                disabled={isScanning}
              >
                Cancel
              </button>

              {readers.length === 0 && (
                <button
                  type="button"
                  className="btn w-full justify-center rounded-md bg-green-300 px-3 py-1.5 text-sm font-semibold leading-6 text-green-800 shadow-sm hover:bg-green-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                  onClick={refreshSdk}
                  disabled={isScanning}
                >
                  Refresh Readers
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
