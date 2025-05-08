// file: FingerprintScanner.jsx
import { useEffect, useState } from "react";
import { HiOutlineX } from "react-icons/hi";
import Swal from "sweetalert2";
import { useFingerprintScanner } from "../../../../services/utilities/FingerprintScanner";

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
    stopCapture,
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
      }, 35000);

      setScanTimeout(timeoutId);

      const fingerprintData = await scanFingerprint(30000);
      clearTimeout(timeoutId);

      console.log(
        "Scan completed successfully:",
        fingerprintData ? "Data received" : "No data"
      );

      if (fingerprintData) {
        const cleanedFingerprintData = fingerprintData.includes("base64")
          ? fingerprintData.split(",")[1]
          : fingerprintData;

        onCapture({
          staffId,
          fingerPrint: cleanedFingerprintData,
        });

        Swal.fire({
          title: "Success!",
          text: "Fingerprint captured successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });

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
