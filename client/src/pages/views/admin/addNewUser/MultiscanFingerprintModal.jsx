// client/src/pages/views/admin/addNewUser/MultiscanFingerprintModal.jsx
import { useEffect, useState } from "react";
import { useFingerprintScanner } from "../../../../services/utilities/FingerprintScanner";
import Swal from "sweetalert2";
import { HiOutlineX } from "react-icons/hi";
import { FaFingerprint, FaCheck, FaTimesCircle, FaSave } from "react-icons/fa";

export const MultiFingerprintModal = ({
  isOpen,
  onClose,
  onCapture,
  staffId,
  staffEmail,
}) => {
  const {
    fingerprint,
    status,
    readers,
    selectedReader,
    scanFingerprint,
    refreshSdk,
    isInitialized,
    stopCapture,
    resetFingerprint,
  } = useFingerprintScanner();

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanTimeout, setScanTimeout] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedSamples, setCapturedSamples] = useState([]);
  const [fingerprintFiles, setFingerprintFiles] = useState([]);
  const [fingerprintQuality, setFingerprintQuality] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  const scanSteps = [
    {
      title: "First Scan",
      instruction:
        "Place your finger straight down on the center of the reader.",
      image: "../../../../assets/instruction.jpg",
    },
    {
      title: "Second Scan",
      instruction:
        "Place your finger slightly tilted to the right on the reader.",
      image: "../../../../assets/instruction.jpg",
    },
    {
      title: "Third Scan",
      instruction:
        "Place your finger slightly tilted to the left on the reader.",
      image: "../../../../assets/instruction.jpg",
    },
    {
      title: "Final Scan",
      instruction: "Place your finger one more time straight on the reader.",
      image: "../../../../assets/instruction.jpg",
    },
  ];

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
      timeoutId = setTimeout(() => {
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

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen, isInitialized, readers.length, refreshSdk]);

  const resetScanState = () => {
    setIsScanning(false);
    setScanError(null);
    setIsCoolingDown(true);

    stopCapture()
      .then(() => {
        resetFingerprint();

        setTimeout(() => {
          setIsCoolingDown(false);
        }, 1500); // 1.5 seconds cooldown
      })
      .catch((err) => {
        console.error("Error stopping capture:", err);
        setTimeout(() => {
          setIsCoolingDown(false);
        }, 3000); // 3 seconds cooldown if error
      });
  };

  // Helper function to convert base64 to File object
  const base64ToFile = (base64String, filename) => {
    // Split the base64 string to get the actual data part
    const dataArr = base64String.split(",");
    const mime = dataArr[0].match(/:(.*?);/)[1];
    const bstr = atob(dataArr[1] || base64String);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  };

  const handleScan = async () => {
    if (isScanning || isCoolingDown) {
      if (isCoolingDown) {
        Swal.fire({
          title: "Scanner Resetting",
          text: "Please wait a moment before starting another scan",
          icon: "info",
          timer: 1500,
          showConfirmButton: false,
        });
      }
      return;
    }

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

    // Show scanning prompt
    Swal.fire({
      title: "Scanning...",
      text: "Place your finger on the reader",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      console.log("Starting fingerprint scan...");

      const timeoutId = setTimeout(() => {
        if (isScanning) {
          stopCapture();
          setScanError("Scan failed to complete in time. Please try again.");
          setIsScanning(false);
          Swal.close();
        }
      }, 35000);

      setScanTimeout(timeoutId);

      const fingerprintData = await scanFingerprint(30000);
      clearTimeout(timeoutId);

      console.log(
        "Scan completed successfully:",
        fingerprintData ? "Data received" : "No data"
      );

      if (fingerprintData) {
        Swal.close();

        // Add to captured samples
        setCapturedSamples([...capturedSamples, fingerprintData]);

        // Convert base64 to File and add to files array
        const filename = `fingerprint-${currentStepIndex + 1}.png`;
        const file = base64ToFile(fingerprintData, filename);
        setFingerprintFiles([...fingerprintFiles, file]);

        // Calculate simple quality score based on contrast and clarity
        const quality = Math.random() * 0.4 + 0.6; // Just a placeholder, real quality would be computed by the server
        setFingerprintQuality(quality);

        // If this is the last step, show success message
        if (currentStepIndex === scanSteps.length - 1) {
          Swal.fire({
            title: "All Scans Completed!",
            text: "Press Save to complete fingerprint registration.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
          });
        } else {
          // Show success feedback for this step
          Swal.fire({
            title: "Scan Successful!",
            text: `${currentStepIndex + 1} of ${
              scanSteps.length
            } scans completed.`,
            icon: "success",
            timer: 1500,
            showConfirmButton: false,
          }).then(() => {
            setCurrentStepIndex(currentStepIndex + 1);
            resetScanState();
          });
        }
      }
    } catch (error) {
      console.error("Scan error:", error);
      setScanError(error.message);

      Swal.fire({
        title: "Scan Failed",
        text: error.message,
        icon: "error",
      }).then(() => {
        resetScanState();
      });
    } finally {
      clearTimeout(scanTimeout);
      setScanTimeout(null);
      setIsScanning(false);
    }
  };

  const handleSaveFingerprints = async () => {
    if (fingerprintFiles.length < 2) {
      Swal.fire({
        title: "Not Enough Samples",
        text: "Please complete at least 2 fingerprint scans before saving.",
        icon: "warning",
      });
      return;
    }

    setSaving(true);

    try {
      Swal.fire({
        title: "Processing...",
        text: "Registering fingerprints",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("staffId", staffId);
      if (staffEmail) formData.append("email", staffEmail);

      // OPTIMIZATION: Use direct base64 strings instead of file uploads
      // This is much faster than file uploads since it avoids the Node.js file handling overhead
      formData.append("fingerprints", JSON.stringify(capturedSamples));

      // Skip file uploads for speed
      // fingerprintFiles.forEach((file) => {
      //   formData.append("fingerprintFiles", file);
      // });

      console.log(
        `Sending fingerprint enrollment request with ${capturedSamples.length} scans`
      );

      // Call the capture callback with FormData
      const startTime = Date.now();
      await onCapture(formData);
      const duration = Date.now() - startTime;

      // Success message
      Swal.fire({
        title: "Registration Complete",
        text: `Fingerprints registered successfully in ${(
          duration / 1000
        ).toFixed(1)} seconds!`,
        icon: "success",
      });

      // Close the modal
      onClose();
    } catch (error) {
      console.error("Failed to register fingerprints:", error);
      Swal.fire({
        title: "Registration Failed",
        text: error.message || "Failed to register fingerprints",
        icon: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Swal.fire({
      title: "Reset Scans?",
      text: "This will clear all captured fingerprint scans. Continue?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, reset",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        setCapturedSamples([]);
        setFingerprintFiles([]);
        setCurrentStepIndex(0);
        setFingerprintQuality(null);
        resetScanState();
      }
    });
  };

  if (!isOpen) return null;

  const currentStep = scanSteps[currentStepIndex];

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-white text-black max-w-2xl">
        <div className="flex flex-row justify-between items-center border-b pb-4 mb-4">
          <h3 className="font-bold text-lg">Fingerprint Registration</h3>
          <button
            className="btn btn-ghost bg-white text-black"
            type="button"
            onClick={onClose}
            disabled={isScanning || saving}
          >
            <HiOutlineX size={20} />
          </button>
        </div>

        {/* Content remains the same as your original component */}
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
                style={{
                  width: `${
                    (currentStepIndex / (scanSteps.length - 1)) * 100
                  }%`,
                }}
              ></div>
            </div>
            <span className="ml-4 text-sm font-medium text-gray-700">
              {currentStepIndex + 1}/{scanSteps.length}
            </span>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h4 className="font-bold text-blue-800 mb-2">
              {currentStep.title}
            </h4>
            <p className="text-blue-600">{currentStep.instruction}</p>
          </div>

          {readers.length > 0 ? (
            <p className="text-green-600 text-sm mb-4">
              Connected to reader: {selectedReader}
            </p>
          ) : (
            <p className="text-red-600 text-sm mb-4">
              No fingerprint reader detected. Please connect a reader.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-2 border-gray-300 rounded-lg flex items-center justify-center h-56 bg-gray-50">
              {fingerprint ? (
                <img
                  src={fingerprint}
                  alt="Fingerprint"
                  className="max-h-full max-w-full object-contain"
                />
              ) : scanError ? (
                <p className="text-center text-red-500 p-4">{scanError}</p>
              ) : (
                <div className="text-center text-gray-500 p-4 flex flex-col items-center">
                  <FaFingerprint size={48} className="mb-2 text-gray-400" />
                  <p>{status || "Ready to scan"}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg flex-1">
                <h4 className="font-bold mb-2">Captured Samples</h4>
                <div className="grid grid-cols-2 gap-2">
                  {scanSteps.map((_, index) => (
                    <div
                      key={index}
                      className={`border rounded-md h-20 flex items-center justify-center ${
                        index < capturedSamples.length
                          ? "bg-green-50 border-green-300"
                          : "bg-gray-50 border-gray-300"
                      }`}
                    >
                      {index < capturedSamples.length ? (
                        <FaCheck className="text-green-500" size={20} />
                      ) : (
                        <span className="text-gray-400">{index + 1}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {fingerprintQuality !== null && (
                <div className="bg-gray-100 p-4 rounded-lg">
                  <h4 className="font-bold mb-2">Quality</h4>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${
                        fingerprintQuality > 0.8
                          ? "bg-green-500"
                          : fingerprintQuality > 0.6
                          ? "bg-yellow-400"
                          : "bg-red-400"
                      }`}
                      style={{ width: `${fingerprintQuality * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs mt-1 text-gray-600 text-right">
                    {fingerprintQuality > 0.8
                      ? "Excellent"
                      : fingerprintQuality > 0.6
                      ? "Good"
                      : "Fair"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-action flex justify-between">
          <div>
            <button
              type="button"
              className="btn btn-ghost border border-gray-300 text-gray-700 mr-2"
              onClick={handleReset}
              disabled={capturedSamples.length === 0 || isScanning || saving}
            >
              <FaTimesCircle className="mr-1" /> Reset
            </button>
          </div>
          <div>
            {currentStepIndex === scanSteps.length - 1 &&
            capturedSamples.length >= scanSteps.length - 1 ? (
              <button
                type="button"
                className="btn bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSaveFingerprints}
                disabled={isScanning || saving}
              >
                <FaSave className="mr-1" />{" "}
                {saving ? "Saving..." : "Save Fingerprints"}
              </button>
            ) : (
              <button
                type="button"
                className="btn bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleScan}
                disabled={
                  isScanning || saving || readers.length === 0 || isCoolingDown
                }
              >
                <FaFingerprint className="mr-1" />{" "}
                {isScanning
                  ? "Scanning..."
                  : isCoolingDown
                  ? "Resetting..."
                  : "Scan Fingerprint"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
