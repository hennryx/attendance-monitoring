import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaFingerprint,
  FaCheckCircle,
  FaTimesCircle,
  FaUserCircle,
  FaHistory,
} from "react-icons/fa";
import { MdOutlineFastfood, MdDoneAll } from "react-icons/md";
import Swal from "sweetalert2";
import { useFingerprintScanner } from "../../../services/utilities/FingerprintScanner";
import useAttendanceStore from "../../../services/stores/attendance/attendanceStore";

const FingerprintAttendance = () => {
  const navigate = useNavigate();
  const {
    matchFingerprint,
    recordAttendance,
    getPublicAttendance,
    publicAttendance,
    message,
    reset,
    isSuccess,
    staffData,
    attendanceType,
    isLoading,
    matchedUser,
    isMatched,
  } = useAttendanceStore();

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
    lastError,
  } = useFingerprintScanner();

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanTimeout, setScanTimeout] = useState(null);
  const [attendanceHistoryVisible, setAttendanceHistoryVisible] =
    useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  const mockHistory = [
    { date: new Date(), type: "in", name: "John Doe", department: "IT" },
    {
      date: new Date(Date.now() - 3 * 60000),
      type: "out",
      name: "Jane Smith",
      department: "HR",
    },
    {
      date: new Date(Date.now() - 8 * 60000),
      type: "lunch-end",
      name: "Robert Johnson",
      department: "Finance",
    },
    {
      date: new Date(Date.now() - 15 * 60000),
      type: "lunch-start",
      name: "Mary Williams",
      department: "Marketing",
    },
    {
      date: new Date(Date.now() - 22 * 60000),
      type: "in",
      name: "David Brown",
      department: "Operations",
    },
  ];

  useEffect(() => {
    if (publicAttendance) {
      console.log(publicAttendance);

      setAttendanceHistory(publicAttendance);
    }
  }, [publicAttendance]);

  useEffect(() => {
    getPublicAttendance();
  }, []);

  useEffect(() => {
    if (!window.Fingerprint) {
      Swal.fire({
        title: "SDK Not Available",
        text: "The Fingerprint SDK is not available or scripts haven't loaded. Please refresh the page and try again.",
        icon: "error",
      }).then(() => {
        navigate("/");
      });
    }
  }, [navigate]);

  useEffect(() => {
    let timeoutId;

    if (isInitialized) {
      timeoutId = setTimeout(() => {
        if (readers.length === 0) {
          Swal.fire({
            title: "No Reader Found",
            text: "No fingerprint readers detected. Please connect a reader and try again.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Refresh Readers",
            cancelButtonText: "Go Back",
          }).then((result) => {
            if (result.isConfirmed) {
              refreshSdk();
            } else {
              navigate("/");
            }
          });
        }
      }, 5000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, [isInitialized, readers.length, refreshSdk, navigate]);

  useEffect(() => {
    if (isSuccess && staffData) {
      let actionText, actionIcon;
      switch (attendanceType) {
        case "in":
          actionText = "Clock In";
          actionIcon = <FaCheckCircle className="text-green-500 text-4xl" />;
          break;
        case "lunch-start":
          actionText = "Start Lunch";
          actionIcon = (
            <MdOutlineFastfood className="text-orange-500 text-4xl" />
          );
          break;
        case "lunch-end":
          actionText = "End Lunch";
          actionIcon = <MdDoneAll className="text-blue-500 text-4xl" />;
          break;
        case "out":
          actionText = "Clock Out";
          actionIcon = <FaTimesCircle className="text-red-500 text-4xl" />;
          break;
        default:
          actionText = "Attendance";
          actionIcon = <FaCheckCircle className="text-green-500 text-4xl" />;
      }

      setAttendanceHistory([
        {
          date: new Date(),
          type: attendanceType,
          name: staffData.name || "Unknown Staff",
          department: staffData.department || "",
        },
        ...attendanceHistory.slice(0, 4),
      ]);

      Swal.fire({
        title: "Attendance Recorded",
        html: `
          <div class="flex flex-col items-center mb-4">
            ${actionIcon}
            <p class="text-lg font-bold mt-2">${actionText}</p>
          </div>
          <div class="text-left p-4 bg-gray-50 rounded-lg">
            <p class="font-bold text-lg">${
              staffData.name || "Unknown Staff"
            }</p>
            <p class="text-sm text-gray-600">${staffData.department || ""}</p>
            <p class="text-sm text-gray-600">${staffData.position || ""}</p>
            <p class="mt-3">${message}</p>
            <p class="text-xs text-gray-500 mt-3">Time: ${new Date().toLocaleTimeString()}</p>
          </div>
        `,
        icon: "success",
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false,
      }).then(() => {
        resetScanState();
      });

      reset();
    } else if (!isSuccess && message) {
      Swal.fire({
        title: "Attendance Failed",
        text: message,
        icon: "error",
        confirmButtonText: "Try Again",
      }).then(() => {
        resetScanState();
        reset();
      });
    }
  }, [isSuccess, staffData, message, attendanceType]);

  const resetScanState = () => {
    setIsScanning(false);
    setScanError(null);
    reset();
    resetFingerprint();
    stopCapture();
  };

  const handleScan = async () => {
    if (isScanning || isLoading) return;

    if (!selectedReader) {
      Swal.fire({
        title: "No Reader Selected",
        text: "No fingerprint reader selected. Please connect a reader and try again.",
        icon: "error",
      });
      return;
    }

    await stopCapture();
    setIsScanning(true);
    setScanError(null);

    try {
      console.log("Starting fingerprint scan...");

      Swal.fire({
        title: "Scanning...",
        text: "Place your finger on the reader",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

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
        const cleanedFingerprintData = fingerprintData.includes("base64")
          ? fingerprintData.split(",")[1]
          : fingerprintData;

        Swal.update({
          title: "Processing...",
          text: "Identifying staff...",
        });

        await matchFingerprint(cleanedFingerprintData);
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

  useEffect(() => {
    if (isMatched && matchedUser && message !== "") {
      Swal.fire({
        title: "Confirm Identity",
        html: `
          <div class="text-center">
            <p>Are you <strong>${matchedUser.name}</strong>?</p>
            <p class="text-sm text-gray-600">${matchedUser.email || ""}</p>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, record attendance",
        cancelButtonText: "No, try again",
        allowOutsideClick: false,
      }).then((res) => {
        if (res.isConfirmed) {
          Swal.fire({
            title: "Recording Attendance...",
            text: "Please wait",
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          recordAttendance(matchedUser.staffId);
        } else {
          resetScanState();
        }
      });
    } else if (!isMatched && message !== "") {
      Swal.fire({
        title: "No Match Found",
        text:
          message ||
          "Your fingerprint was not recognized. Please try again or contact an administrator.",
        icon: "error",
        confirmButtonText: "Try Again",
      }).then(() => {
        resetScanState();
      });
    }
  }, [matchedUser, isMatched, message]);

  const getAttendanceIcon = (type) => {
    switch (type) {
      case "in":
        return <FaCheckCircle className="text-green-500" />;
      case "lunch-start":
        return <MdOutlineFastfood className="text-orange-500" />;
      case "lunch-end":
        return <MdDoneAll className="text-blue-500" />;
      case "out":
        return <FaTimesCircle className="text-red-500" />;
      default:
        return <FaUserCircle className="text-gray-500" />;
    }
  };

  return (
    <div className="relative isolate bg-gradient-to-b from-[#1b1b1b] to-[#2d2d2d] px-6 pt-14 lg:px-16 min-h-screen">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#676767] to-[#444444] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

      <div className="container mx-auto max-w-4xl pt-10 pb-8">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Fingerprint Attendance System
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Scan Your Fingerprint
            </h2>

            {readers.length === 0 ? (
              <div className="bg-red-100 text-red-800 p-4 rounded-md mb-4">
                <p className="font-medium">No fingerprint reader detected</p>
                <p className="text-sm mt-1">
                  Please connect a reader and click "Refresh Readers"
                </p>
              </div>
            ) : (
              <div className="bg-green-100 text-green-800 p-4 rounded-md mb-4">
                <p className="font-medium">Fingerprint reader connected</p>
                <p className="text-sm mt-1">Using: {selectedReader}</p>
              </div>
            )}

            <div className="border-2 border-gray-300 rounded-xl flex items-center justify-center h-64 bg-gray-50 mb-6 overflow-hidden">
              {fingerprint ? (
                <img
                  src={fingerprint}
                  alt="Fingerprint"
                  className="max-h-full max-w-full object-contain"
                />
              ) : scanError ? (
                <div className="text-center text-red-500 p-4">
                  <FaTimesCircle className="text-4xl mx-auto mb-2" />
                  <p>{scanError}</p>
                </div>
              ) : isLoading ? (
                <div className="text-center text-blue-500 p-4">
                  <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p>Processing...</p>
                </div>
              ) : (
                <div className="text-center text-gray-500 p-4 flex flex-col items-center">
                  <FaFingerprint size={80} className="text-gray-400 mb-4" />
                  <p className="text-lg">{status || "Ready to scan"}</p>
                  <p className="text-sm mt-2">
                    Place your finger on the reader to record attendance
                  </p>
                </div>
              )}
            </div>

            <div className="mt-auto">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-blue-300 flex items-center justify-center"
                  onClick={handleScan}
                  disabled={isScanning || isLoading || readers.length === 0}
                >
                  <FaFingerprint className="mr-2" />
                  {isScanning || isLoading
                    ? "Processing..."
                    : "Scan Fingerprint"}
                </button>

                <button
                  type="button"
                  className="w-full rounded-md bg-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 disabled:bg-gray-100 flex items-center justify-center"
                  onClick={refreshSdk}
                  disabled={isScanning || isLoading}
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    ></path>
                  </svg>
                  Refresh Readers
                </button>
              </div>

              {lastError && (
                <div className="mt-4 text-xs text-red-500">
                  Last error: {lastError}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Activity</h2>
              <button
                className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                onClick={() =>
                  setAttendanceHistoryVisible(!attendanceHistoryVisible)
                }
              >
                <FaHistory className="mr-1" />
                {attendanceHistoryVisible ? "Hide" : "Show"} History
              </button>
            </div>

            {attendanceHistoryVisible ? (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {attendanceHistory.length > 0 ? (
                  attendanceHistory.map((record, index) => (
                    <div
                      key={index}
                      className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="mr-3 p-2 rounded-full bg-gray-100">
                        {getAttendanceIcon(record.type)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{record.name}</div>
                        <div className="text-sm text-gray-500">
                          {record.department} •{" "}
                          {record.type === "in"
                            ? "Clocked In"
                            : record.type === "out"
                            ? "Clocked Out"
                            : record.type === "lunch-start"
                            ? "Started Lunch"
                            : record.type === "lunch-end"
                            ? "Ended Lunch"
                            : "Attendance"}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(record.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No recent activity
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg">
                <div className="text-6xl text-gray-300 mb-4">
                  <FaHistory />
                </div>
                <p className="text-gray-500">
                  Click "Show History" to view recent attendance activity
                </p>
              </div>
            )}

            <div className="mt-6 bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">
                Attendance Instructions
              </h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start">
                  <FaCheckCircle className="mt-1 mr-2 text-green-500" />
                  <span>
                    Place your finger on the reader to automatically record your
                    attendance.
                  </span>
                </li>
                <li className="flex items-start">
                  <MdOutlineFastfood className="mt-1 mr-2 text-orange-500" />
                  <span>
                    The system will automatically detect if you are clocking in,
                    starting lunch, ending lunch, or clocking out.
                  </span>
                </li>
                <li className="flex items-start">
                  <FaTimesCircle className="mt-1 mr-2 text-red-500" />
                  <span>
                    If your fingerprint is not recognized, please contact HR or
                    your administrator.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FingerprintAttendance;
