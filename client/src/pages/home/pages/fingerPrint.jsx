import React, { useEffect, useState } from "react";
import { useFingerprintScanner } from "../../../services/utilities/FingerprintScanner";
import useUsersStore from "../../../services/stores/users/usersStore";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const Fingerprint = () => {
  const navigate = useNavigate();
  const { matchFingerPrint, message, isSuccess } = useUsersStore();
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

  useEffect(() => {
    if (!window.Fingerprint) {
      Swal.fire({
        title: "SDK Not Available",
        text: "The Fingerprint SDK is not available or scripts haven't loaded. Please refresh the page and try again.",
        icon: "error",
      }).then(() => {
        navigate('/');
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
              navigate('/');
            }
          });
        }
      }, 5000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isInitialized, readers.length, refreshSdk, navigate]);

  useEffect(() => {
    if (isSuccess && message) {
      Swal.fire({
        title: "Success!",
        text: message,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    }
  }, [isSuccess, message]);

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

        await matchFingerPrint({
          fingerPrint: cleanedFingerprintData,
        });

        Swal.fire({
          title: "Success!",
          text: "Fingerprint captured successfully.",
          icon: "success",
          timer: 1000,
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
      });
    } finally {
      clearTimeout(scanTimeout);
      setScanTimeout(null);
      setIsScanning(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto pt-10 pb-8 px-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Fingerprint Attendance</h1>
        
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
              <img src={fingerprint} alt="Fingerprint" className="max-h-full" />
            ) : scanError ? (
              <p className="text-center text-red-500">{scanError}</p>
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
            disabled={isScanning || readers.length === 0}
          >
            {isScanning ? "Scanning..." : "Scan Fingerprint"}
          </button>

          {readers.length === 0 && (
            <button
              type="button"
              className="w-full justify-center rounded-md bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
              onClick={refreshSdk}
              disabled={isScanning}
            >
              Refresh Readers
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Fingerprint;