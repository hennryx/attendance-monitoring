import { useEffect, useState } from "react";
import { useFingerprintScanner } from "../../../../services/utilities/FingerprintScanner";
import Swal from "sweetalert2";
import { HiOutlineX } from "react-icons/hi";
import { FaFingerprint, FaTimesCircle, FaSave } from "react-icons/fa";

export const FingerprintModal = ({
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
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [saving, setSaving] = useState(false);

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
      text: "Place your finger flat on the reader",
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

        // Show success feedback
        Swal.fire({
          title: "Scan Successful!",
          text: "Fingerprint captured. Press Save to complete registration.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
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

  const handleSaveFingerprint = async () => {
    if (!fingerprint) {
      Swal.fire({
        title: "No Fingerprint",
        text: "Please scan your fingerprint before saving.",
        icon: "warning",
      });
      return;
    }

    setSaving(true);

    try {
      Swal.fire({
        title: "Processing...",
        text: "Registering fingerprint",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Extract base64 data
      const base64Data = fingerprint.includes("base64")
        ? fingerprint.split(",")[1]
        : fingerprint;

      // Send directly to the backend, skipping FormData
      const fingerprintData = {
        staffId: staffId,
        fingerPrint: base64Data,
        email: staffEmail,
      };

      await onCapture(fingerprintData);

      // Close modal after successful capture
      onClose();
    } catch (error) {
      console.error("Failed to register fingerprint:", error);
      Swal.fire({
        title: "Registration Failed",
        text: error.message || "Failed to register fingerprint",
        icon: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-white text-black max-w-lg">
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

        <div className="mb-6">
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h4 className="font-bold text-blue-800 mb-2">Scan Instructions</h4>
            <p className="text-blue-600">
              Place your finger flat on the center of the reader. Hold still
              until the scan completes.
            </p>
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

          <div className="border-2 border-gray-300 rounded-lg flex items-center justify-center h-56 bg-gray-50">
            {fingerprint ? (
              <img
                src={fingerprint}
                alt="Fingerprint"
                className="max-h-full max-w-full object-contain"
              />
            ) : scanError ? (
              <p className="text-center text-red-500">{scanError}</p>
            ) : (
              <div className="text-center text-gray-500 p-4 flex flex-col items-center">
                <FaFingerprint size={48} className="mb-2 text-gray-400" />
                <p>{status || "Ready to scan"}</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-action flex justify-between">
          <div>
            <button
              type="button"
              className="btn btn-ghost border border-gray-300 text-gray-700 mr-2"
              onClick={resetScanState}
              disabled={!fingerprint || isScanning || saving}
            >
              <FaTimesCircle className="mr-1" /> Reset
            </button>
          </div>
          <div className="flex gap-2">
            {!fingerprint ? (
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
            ) : (
              <button
                type="button"
                className="btn bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSaveFingerprint}
                disabled={isScanning || saving || !fingerprint}
              >
                <FaSave className="mr-1" />{" "}
                {saving ? "Saving..." : "Save Fingerprint"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
