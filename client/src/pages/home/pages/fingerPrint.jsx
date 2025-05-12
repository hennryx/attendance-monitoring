// client/src/pages/home/pages/fingerprintAttendance.jsx
import React, { useState, useEffect } from "react";
import { useFingerprintScanner } from "../../../services/utilities/FingerprintScanner";
import useAttendanceStore from "../../../services/stores/attendance/attendanceStore";
import {
  FaFingerprint,
  FaClock,
  FaUtensils,
  FaCheck,
  FaArrowRight,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { format } from "date-fns";

const FingerprintAttendance = () => {
  const { clockIn, clockOut, startLunch, endLunch } = useAttendanceStore();
  const {
    fingerprint,
    status,
    readers,
    selectedReader,
    scanFingerprint,
    refreshSdk,
  } = useFingerprintScanner();

  const [isScanning, setIsScanning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scanAction, setScanAction] = useState("clock-in");
  const [attendance, setAttendance] = useState(null);
  const [scanResult, setScanResult] = useState(null);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-detect most appropriate action based on time
  useEffect(() => {
    determineAction();
  }, [currentTime, attendance]);

  // Function to determine the most appropriate action
  const determineAction = () => {
    const hour = currentTime.getHours();

    if (!attendance || !attendance.timeIn) {
      setScanAction("clock-in");
    } else if (
      attendance.timeIn &&
      !attendance.lunchStart &&
      hour >= 11 &&
      hour < 14
    ) {
      setScanAction("lunch-start");
    } else if (
      attendance.lunchStart &&
      !attendance.lunchEnd &&
      hour >= 12 &&
      hour < 15
    ) {
      setScanAction("lunch-end");
    } else if (attendance.timeIn && !attendance.timeOut && hour >= 15) {
      setScanAction("clock-out");
    } else if (attendance.timeOut) {
      setScanAction("completed");
    } else {
      setScanAction("clock-in");
    }
  };

  // Handle fingerprint scanning
  const handleScan = async () => {
    if (isScanning || scanAction === "completed") return;

    setIsScanning(true);
    setScanResult(null);

    try {
      // Show processing dialog
      Swal.fire({
        title: "Scanning Fingerprint",
        text: "Please place your finger on the scanner...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Scan fingerprint
      const fingerprintData = await scanFingerprint();
      if (!fingerprintData) {
        throw new Error("Failed to capture fingerprint");
      }

      // Extract base64 data if necessary
      const cleanedFingerprint = fingerprintData.includes("base64")
        ? fingerprintData.split(",")[1]
        : fingerprintData;

      // Update processing message
      Swal.update({
        title: "Processing",
        text: "Identifying and recording attendance...",
      });

      // Choose API endpoint based on action
      let response;
      let actionDescription;

      switch (scanAction) {
        case "clock-in":
          response = await clockIn({ fingerprint: cleanedFingerprint });
          actionDescription = "Clock In";
          break;

        case "lunch-start":
          response = await startLunch({ fingerprint: cleanedFingerprint });
          actionDescription = "Start Lunch Break";
          break;

        case "lunch-end":
          response = await endLunch({ fingerprint: cleanedFingerprint });
          actionDescription = "End Lunch Break";
          break;

        case "clock-out":
          response = await clockOut({ fingerprint: cleanedFingerprint });
          actionDescription = "Clock Out";
          break;

        default:
          throw new Error("Invalid action");
      }

      // Update attendance state with new data
      if (response && response.data) {
        setAttendance(response.data);
      }

      // Show success
      Swal.fire({
        icon: "success",
        title: "Success!",
        text: `${actionDescription} recorded successfully.`,
        timer: 3000,
        timerProgressBar: true,
      });

      // Set scan result for display
      setScanResult({
        success: true,
        action: scanAction,
        time: new Date(),
        message: `${actionDescription} recorded successfully`,
      });
    } catch (error) {
      console.error("Scan error:", error);

      Swal.fire({
        icon: "error",
        title: "Scan Failed",
        text: error.message || "Failed to process fingerprint",
      });

      setScanResult({
        success: false,
        action: scanAction,
        time: new Date(),
        message: error.message || "Failed to process fingerprint",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Render different action buttons based on scanAction
  const renderActionButton = () => {
    let icon,
      text,
      color,
      disabled = false;

    switch (scanAction) {
      case "clock-in":
        icon = <FaClock className="mr-2" />;
        text = "Clock In";
        color = "bg-green-600 hover:bg-green-700";
        break;

      case "lunch-start":
        icon = <FaUtensils className="mr-2" />;
        text = "Start Lunch";
        color = "bg-yellow-600 hover:bg-yellow-700";
        break;

      case "lunch-end":
        icon = <FaArrowRight className="mr-2" />;
        text = "End Lunch";
        color = "bg-yellow-600 hover:bg-yellow-700";
        break;

      case "clock-out":
        icon = <FaArrowRight className="mr-2" />;
        text = "Clock Out";
        color = "bg-blue-600 hover:bg-blue-700";
        break;

      case "completed":
        icon = <FaCheck className="mr-2" />;
        text = "All Done For Today";
        color = "bg-gray-400";
        disabled = true;
        break;

      default:
        icon = <FaClock className="mr-2" />;
        text = "Scan Fingerprint";
        color = "bg-blue-600 hover:bg-blue-700";
    }

    return (
      <button
        className={`${color} text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center w-full ${
          disabled ? "cursor-not-allowed" : ""
        }`}
        onClick={handleScan}
        disabled={isScanning || disabled || readers.length === 0}
      >
        {isScanning ? (
          <span className="flex items-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing...
          </span>
        ) : (
          <>
            {icon}
            {text}
          </>
        )}
      </button>
    );
  };

  // Main render method
  return (
    <div className="relative isolate bg-[#1b1b1b] px-6 pt-14 lg:px-16 min-h-lvh overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ffffff] to-[#eceaff] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

      <div className="min-h-screen flex items-center justify-center p-4 my-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-t-lg p-6 text-white text-center">
            <h1 className="text-2xl font-bold mb-2">Attendance System</h1>
            <p className="text-lg mb-2">{format(currentTime, "h:mm:ss a")}</p>
            <p>{format(currentTime, "EEEE, MMMM d, yyyy")}</p>
          </div>

          <div className="p-6">
            {/* Reader Status */}
            <div
              className={`rounded-lg p-4 mb-6 text-center ${
                readers.length > 0
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {readers.length > 0 ? (
                <>
                  <p className="font-semibold">Fingerprint Reader Connected</p>
                  <p className="text-sm">{selectedReader}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">
                    No Fingerprint Reader Detected
                  </p>
                  <button
                    className="mt-2 bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
                    onClick={refreshSdk}
                  >
                    Refresh Devices
                  </button>
                </>
              )}
            </div>

            {/* Scan Result (if available) */}
            {scanResult && (
              <div
                className={`rounded-lg p-4 mb-6 ${
                  scanResult.success
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                <p className="font-semibold">
                  {scanResult.success ? "Success!" : "Error!"}
                </p>
                <p>{scanResult.message}</p>
                {scanResult.success && (
                  <p className="text-sm mt-1">
                    {format(scanResult.time, "h:mm:ss a")}
                  </p>
                )}
              </div>
            )}

            {/* Fingerprint Display */}
            <div className="border-2 border-gray-300 rounded-lg p-4 mb-6 flex items-center justify-center h-48">
              {fingerprint ? (
                <img
                  src={fingerprint}
                  alt="Fingerprint"
                  className="max-h-full"
                />
              ) : (
                <div className="text-center text-gray-500">
                  <FaFingerprint className="mx-auto text-4xl mb-2" />
                  <p>{status}</p>
                </div>
              )}
            </div>

            {/* Action Button */}
            {renderActionButton()}

            {/* Instructions */}
            <div className="mt-6 text-sm text-gray-600">
              <p className="font-semibold mb-1">Instructions:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  Ensure your fingerprint has been registered in the system
                </li>
                <li>Place your finger on the reader when prompted</li>
                <li>Hold until the scan completes</li>
                <li>System will automatically detect the appropriate action</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FingerprintAttendance;
