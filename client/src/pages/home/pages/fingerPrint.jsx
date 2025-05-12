import React, { useEffect, useState } from "react";
import { useFingerprintScanner } from "../../../services/utilities/FingerprintScanner";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import useAttendanceStore from "../../../services/stores/attendance/attendanceStore";

const Fingerprint = () => {
  const navigate = useNavigate();
  const {
    // fingerprintAttendance,
    matchFingerprint,
    recordAttendance,
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
  } = useFingerprintScanner();

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanTimeout, setScanTimeout] = useState(null);

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

  // Handle attendance results
  useEffect(() => {
    if (isSuccess && staffData) {
      // Define action text based on attendanceType
      let actionText;
      switch (attendanceType) {
        case "in":
          actionText = "Clock In";
          break;
        case "lunch-start":
          actionText = "Start Lunch";
          break;
        case "lunch-end":
          actionText = "End Lunch";
          break;
        case "out":
          actionText = "Clock Out";
          break;
        default:
          actionText = "Attendance";
      }

      Swal.fire({
        title: "Staff Identified",
        html: `
          <div class="text-left">
            <p class="font-bold">${staffData.name || "Unknown Staff"}</p>
            <p class="text-sm text-gray-600">${staffData.department || ""}</p>
            <p class="text-sm text-gray-600">${staffData.position || ""}</p>
            <p class="mt-3">Action: <span class="font-bold">${actionText}</span></p>
            <p class="mt-2">${message}</p>
          </div>
        `,
        icon: "success",
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false,
      }).then(() => {
        // Reset after displaying success message
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

  // Load fingerprint SDK
  useEffect(() => {
    if (!window.fingerprintScriptLoading) {
      window.fingerprintScriptLoading = true;

      if (window.Fingerprint && window.Fingerprint.WebApi) {
        console.log("Fingerprint SDK already loaded");
        window.fingerprintScriptLoading = false;
        return;
      }

      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          const existingScript = document.querySelector(`script[src="${src}"]`);
          if (existingScript) {
            console.log(`Script already loaded: ${src}`);
            resolve();
            return;
          }

          const script = document.createElement("script");
          script.src = src;
          script.async = true;

          script.onload = () => {
            console.log(`Script loaded: ${src}`);
            resolve();
          };

          script.onerror = (error) => {
            console.error(`Error loading script: ${src}`, error);
            reject(new Error(`Failed to load ${src}`));
          };

          document.head.appendChild(script);
        });
      };

      const loadSDK = async () => {
        try {
          console.log("Loading Fingerprint SDK scripts...");
          await loadScript("/scripts/es6-shim.js");
          await loadScript("/scripts/websdk.client.bundle.min.js");
          await loadScript("/scripts/fingerprint.sdk.min.js");

          await new Promise((resolve) => setTimeout(resolve, 500));

          if (window.Fingerprint && window.Fingerprint.WebApi) {
            console.log("Fingerprint SDK loaded successfully");
          } else {
            console.error("SDK objects not found after loading scripts");
            Swal.fire({
              title: "SDK Not Available",
              text: "The Fingerprint SDK could not be initialized. Please check your network connection and try again.",
              icon: "error",
            });
          }
        } catch (error) {
          console.error("Failed to load Fingerprint SDK:", error);
          Swal.fire({
            title: "Failed to Load SDK",
            text: "Could not load the fingerprint SDK scripts. Please check your network connection and try again.",
            icon: "error",
          });
        } finally {
          window.fingerprintScriptLoading = false;
        }
      };

      loadSDK();
    }
  }, []);

  const resetScanState = () => {
    setIsScanning(false);
    setScanError(null);
    reset(); // Reset attendance store
    resetFingerprint(); // Reset fingerprint in the scanner
    stopCapture(); // Stop any ongoing capture
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

        // First, just match the fingerprint to identify the user
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
      // Ask for confirmation before recording attendance
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
        confirmButtonText: "Yes, it's me",
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
          resetScanState();
        } else {
          resetScanState();
        }
      });
    } else if (!isMatched && message !== "") {
      console.log("matchedUser ", matchedUser);

      // No match found
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

  return (
    <div className="relative isolate bg-[#1b1b1b] px-6 pt-14 lg:px-16 h-screen overflow-hidden">
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

      <div className="container max-w-md mx-auto pt-10 pb-8 px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6">
            Fingerprint Attendance
          </h1>

          <div className="mb-4">
            {readers.length === 0 && (
              <div className="bg-red-100 text-red-800 p-3 rounded-md mb-4">
                No fingerprint reader detected. Please connect a reader.
              </div>
            )}

            {readers.length > 0 && (
              <div className="bg-green-100 text-green-800 p-3 rounded-md mb-4">
                Using fingerprint reader: {selectedReader}
              </div>
            )}

            <div className="border-2 border-gray-300 rounded-md flex items-center justify-center h-48 mb-6">
              {fingerprint ? (
                <img
                  src={fingerprint}
                  alt="Fingerprint"
                  className="max-h-full"
                />
              ) : scanError ? (
                <p className="text-center text-red-500">{scanError}</p>
              ) : isLoading ? (
                <p className="text-center text-blue-500">Processing...</p>
              ) : (
                <p className="text-center text-gray-500">{status}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="w-full justify-center rounded-md bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-blue-300"
              onClick={handleScan}
              disabled={isScanning || isLoading || readers.length === 0}
            >
              {isScanning || isLoading ? "Processing..." : "Scan Fingerprint"}
            </button>

            {readers.length === 0 && (
              <button
                type="button"
                className="w-full justify-center rounded-md bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                onClick={refreshSdk}
                disabled={isScanning || isLoading}
              >
                Refresh Readers
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Fingerprint;
