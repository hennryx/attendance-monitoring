import React, { useEffect, useState } from "react";
import { useFingerprintScanner } from "../../../services/utilities/FingerprintScanner";
import useUsersStore from "../../../services/stores/users/usersStore";
import Swal from "sweetalert2";

const FingerPrint = ({ isOpen, onClose }) => {
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

  const { matchFingerPrint, message, isSuccess, isLoading, reset } =
    useUsersStore();
  const [scanError, setScanError] = useState(null);
  const [attendanceRecorded, setAttendanceRecorded] = useState(false);

  // Effect to show notifications based on fingerprint matching results
  useEffect(() => {
    if (message) {
      if (isSuccess) {
        Swal.fire({
          title: "Success!",
          text: message,
          icon: "success",
          timer: 3000,
          showConfirmButton: false,
        });
        setAttendanceRecorded(true);

        // Auto-close after successful attendance
        setTimeout(() => {
          reset();
          onClose();
        }, 3000);
      } else {
        Swal.fire({
          title: "Notice",
          text: message,
          icon: "info",
        });
        reset();
      }
    }
  }, [message, isSuccess, reset, onClose]);

  // Effect to check SDK availability
  useEffect(() => {
    if (isOpen && readers.length === 0 && isInitialized) {
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
          } else {
            onClose();
          }
        });
      }, 1000);
    }
  }, [isOpen, readers.length, isInitialized, refreshSdk, onClose]);

  const handleScan = async () => {
    if (isScanning || isLoading) return;

    if (readers.length === 0) {
      Swal.fire({
        title: "No Reader Selected",
        text: "No fingerprint reader selected. Please connect a reader and try again.",
        icon: "error",
      });
      return;
    }

    setScanError(null);
    setAttendanceRecorded(false);

    try {
      console.log("Starting fingerprint scan...");

      // The scanning is now handled by the backend
      const fingerprintFeatures = await scanFingerprint(30000);

      console.log("Scan completed successfully");

      if (fingerprintFeatures) {
        matchFingerPrint({
          fingerPrint: fingerprint,
          features: fingerprintFeatures,
        });
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
    <div className="p-6 bg-white rounded-lg shadow-md max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center text-green-800">
        Attendance Scanner
      </h2>

      {readers.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fingerprint Reader
          </label>
          <select
            className="w-full p-2 border border-gray-300 rounded-md"
            value={selectedReader}
            onChange={handleReaderChange}
            disabled={isScanning || isLoading}
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
        <p className="text-red-600 text-sm mb-4">
          No fingerprint reader detected. Please connect a reader.
        </p>
      )}

      <div className="border rounded-lg flex items-center justify-center h-48 mb-4 bg-gray-50">
        {fingerprint ? (
          <img src={fingerprint} alt="Fingerprint" className="max-h-full" />
        ) : scanError ? (
          <p className="text-center text-red-500 p-4">{scanError}</p>
        ) : (
          <div className="text-center text-gray-500 p-4">
            <p className="mb-2">{status}</p>
            {isScanning && (
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <button
          type="button"
          className={`w-full py-2 px-4 rounded-md font-medium text-white ${
            isScanning || isLoading
              ? "bg-blue-300 cursor-not-allowed"
              : attendanceRecorded
              ? "bg-green-500 hover:bg-green-600"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
          onClick={handleScan}
          disabled={isScanning || isLoading || readers.length === 0}
        >
          {isScanning || isLoading
            ? "Processing..."
            : attendanceRecorded
            ? "Attendance Recorded ✓"
            : "Scan Fingerprint"}
        </button>

        <button
          type="button"
          className="w-full py-2 px-4 rounded-md font-medium text-gray-700 bg-gray-200 hover:bg-gray-300"
          onClick={onClose}
          disabled={isScanning || isLoading}
        >
          Cancel
        </button>

        {readers.length === 0 && (
          <button
            type="button"
            className="w-full py-2 px-4 rounded-md font-medium text-white bg-green-500 hover:bg-green-600"
            onClick={refreshSdk}
            disabled={isScanning || isLoading}
          >
            Refresh Readers
          </button>
        )}
      </div>
    </div>
  );
};

export default FingerPrint;
