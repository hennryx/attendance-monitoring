import React, { useEffect, useState } from "react";
import FingerPrint from "./fingerPrint";
import useUsersStore from "../../../services/stores/users/usersStore";

const Home = () => {
  const { matchFingerPrint } = useUsersStore();
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const handleToggle = () => {
    if (!window.Fingerprint || !window.Fingerprint.WebApi) {
      Swal.fire({
        title: "SDK Not Available",
        text: "The Fingerprint SDK is not available. Please refresh the page and try again.",
        icon: "error",
        showCancelButton: true,
        confirmButtonText: "Reload Scripts",
        cancelButtonText: "Cancel",
      }).then((result) => {
        if (result.isConfirmed) {
          window.Fingerprint = null;
          setIsAttendanceModalOpen(false);
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      });
      return;
    }

    setIsAttendanceModalOpen((prev) => !prev);
  };

  const handleFingerprintCapture = async (data) => {
    console.log("Fingerprint Captured:", data);
    matchFingerPrint(data);
  };

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

  return (
    <div className="relative bg-[#f3f6fd] px-6 pt-14 lg:px-16 h-screen overflow-hidden">
      {!isAttendanceModalOpen ? (
        <div className="max-w-4xl pt-28 sm:pt-36 lg:pt-40 relative z-10">
          <h1 className="text-4xl sm:text-6xl font-bold text-green-800 leading-tight text-shadow-base-300">
            ATTENDANCE <br /> MONITORING SYSTEM
          </h1>
          <p className="mt-6 w-full sm:w-2/3 text-base sm:text-lg text-black font-medium leading-relaxed">
            Lorem Ipsum is simply dummy text of the printing and typesetting
            industry. Lorem Ipsum has been the industry's standard dummy text
            ever since the 1500s, when an unknown printer took a galley of type
            and scrambled it to make a type specimen book.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={() => handleToggle()}
              className="px-5 py-3 border-2 border-green-400 text-green-400 rounded-md shadow hover:bg-indigo-700 transition"
            >
              Get attendance
            </button>
          </div>
        </div>
      ) : (
        <div>
          <FingerPrint
            isOpen={isAttendanceModalOpen}
            onClose={() => setIsAttendanceModalOpen(false)}
            onCapture={handleFingerprintCapture}
          />
        </div>
      )}
    </div>
  );
};

export default Home;
