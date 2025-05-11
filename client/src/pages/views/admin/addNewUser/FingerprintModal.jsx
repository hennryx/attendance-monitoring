import { useEffect, useState } from "react";
import { HiOutlineX } from "react-icons/hi";
import Swal from "sweetalert2";
import { useFingerprintScanner } from "../../../../services/utilities/FingerprintScanner";

export const FingerprintModal = ({ isOpen, onClose, onCapture, staffId }) => {
  const {
    fingerprint,
    status,
    readers,
    selectedReader,
    setSelectedReader,
    scanFingerprint,
    refreshSdk,
    isInitialized,
    stopCapture,
    isScanning,
  } = useFingerprintScanner();

  const [scanError, setScanError] = useState(null);

  // Effect to check for readers when modal opens
  useEffect(() => {
    if (isOpen && isInitialized && readers.length === 0) {
      setTimeout(() => {
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
      }, 1000);
    }
  }, [isOpen, isInitialized, readers.length, refreshSdk]);

  const handleScan = async () => {
    if (isScanning) return;

    if (readers.length === 0) {
      Swal.fire({
        title: "No Reader Available",
        text: "No fingerprint reader selected. Please connect a reader and try again.",
        icon: "error",
      });
      return;
    }

    setScanError(null);

    try {
      console.log("Starting fingerprint scan...");

      // The actual scanning is now handled by the backend
      const fingerprintFeatures = await scanFingerprint(30000);

      console.log("Scan completed successfully");

      if (fingerprintFeatures) {
        onCapture({
          staffId,
          fingerPrint: fingerprint,
          features: fingerprintFeatures,
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
    }
  };

  // Handle reader selection change
  const handleReaderChange = (e) => {
    setSelectedReader(e.target.value);
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
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Select Reader</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={selectedReader}
                  onChange={handleReaderChange}
                  disabled={isScanning}
                >
                  {readers.map((reader, index) => (
                    <option key={index} value={reader.id}>
                      {reader.name}
                    </option>
                  ))}
                </select>
              </div>
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
