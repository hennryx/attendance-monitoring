import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { ENDPOINT } from "../index";

export const useFingerprintScanner = () => {
  const [fingerprint, setFingerprint] = useState(null);
  const [status, setStatus] = useState("Not started");
  const [readers, setReaders] = useState([]);
  const [selectedReader, setSelectedReader] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Function to fetch available fingerprint readers
  const fetchReaders = useCallback(() => {
    setStatus("Fetching available readers...");

    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      axios
        .get(`${ENDPOINT}/users/fingerprint/devices`)
        .then((response) => {
          if (response.data.success) {
            const deviceList = response.data.devices || [];
            setReaders(deviceList);

            if (deviceList.length > 0) {
              setSelectedReader(deviceList[0].id);
              setStatus(`Found ${deviceList.length} reader(s). Ready to scan.`);
            } else {
              setStatus(
                "No fingerprint readers found. Please connect a reader."
              );
            }

            setIsInitialized(true);
            resolve(deviceList);
          } else {
            setStatus(
              "Failed to fetch readers: " +
                (response.data.message || "Unknown error")
            );
            setIsInitialized(false);
            resolve([]);
          }
        })
        .catch((error) => {
          console.error("Error fetching readers:", error);
          setStatus(`Error fetching readers: ${error.message}`);
          setIsInitialized(false);
          resolve([]); // Resolving with empty array on error
        });
    });
  }, []);

  // And update refreshSdk to match
  const refreshSdk = useCallback(() => {
    return fetchReaders();
  }, [fetchReaders]);

  // Initialize readers on component mount
  useEffect(() => {
    fetchReaders();
  }, [fetchReaders]);

  // Function to scan fingerprint
  const scanFingerprint = useCallback(
    (timeoutMs = 30000) => {
      return new Promise((resolve, reject) => {
        try {
          if (readers.length === 0) {
            reject(new Error("No fingerprint readers available"));
            return;
          }

          setIsScanning(true);
          setStatus("Scanning... Please place your finger on the reader");
          setFingerprint(null);

          // Call the backend API to capture fingerprint
          axios
            .post(`${ENDPOINT}/users/fingerprint/capture`, {
              deviceId: selectedReader,
              timeout: timeoutMs,
            })
            .then((response) => {
              if (response.data.success) {
                setFingerprint(response.data.image);
                setStatus("Fingerprint captured successfully");
                setIsScanning(false);
                resolve(response.data.features);
              } else {
                setStatus(
                  "Failed to capture fingerprint: " +
                    (response.data.message || "Unknown error")
                );
                setIsScanning(false);
                reject(
                  new Error(
                    response.data.message || "Failed to capture fingerprint"
                  )
                );
              }
            })
            .catch((error) => {
              console.error("Error scanning fingerprint:", error);
              setStatus(`Error scanning fingerprint: ${error.message}`);
              setIsScanning(false);
              reject(error);
            });
        } catch (error) {
          console.error("Unexpected error in scanFingerprint:", error);
          setIsScanning(false);
          reject(error);
        }
      });
    },
    [readers, selectedReader]
  );

  // Function to stop capture
  const stopCapture = useCallback(() => {
    setIsScanning(false);
    setStatus("Scan canceled");
    return true;
  }, []);

  return {
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
  };
};
