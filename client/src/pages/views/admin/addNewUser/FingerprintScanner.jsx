// Create a new file: FingerprintScanner.js

import { useEffect, useState } from 'react';
import { HiOutlineX } from 'react-icons/hi';
import Swal from 'sweetalert2';

// This function will be your main hook for fingerprint scanning
export const useFingerprintScanner = () => {
    const [fingerprint, setFingerprint] = useState(null);
    const [status, setStatus] = useState("Not started");
    const [sdk, setSdk] = useState(null);
    const [readers, setReaders] = useState([]);
    const [selectedReader, setSelectedReader] = useState("");
    const [acquisitionStarted, setAcquisitionStarted] = useState(false);

    // Initialize the SDK
    useEffect(() => {
        // Check if the SDK is available in the window object
        if (window.Fingerprint) {
            try {
                const fingerprintSdk = new window.Fingerprint.WebApi();
                setSdk(fingerprintSdk);

                // Set up event handlers
                fingerprintSdk.onDeviceConnected = (e) => {
                    setStatus("Device connected. Scan your finger.");
                };

                fingerprintSdk.onDeviceDisconnected = (e) => {
                    setStatus("Device disconnected");
                    setAcquisitionStarted(false);
                };

                fingerprintSdk.onCommunicationFailed = (e) => {
                    setStatus("Communication failed");
                    setAcquisitionStarted(false);
                };

                fingerprintSdk.onSamplesAcquired = (s) => {
                    // Handle samples
                    const samples = JSON.parse(s.samples);
                    // Assuming PngImage format
                    const base64Image = `data:image/png;base64,${window.Fingerprint.b64UrlTo64(samples[0])}`;
                    setFingerprint(base64Image);
                    setStatus("Fingerprint captured");

                    // Auto stop after capture
                    stopCapture();
                };

                fingerprintSdk.onQualityReported = (e) => {
                    // You can expose this if needed
                };

                // Get the list of available readers
                getAvailableReaders();
            } catch (error) {
                setStatus(`Error initializing SDK: ${error.message}`);
            }
        } else {
            setStatus("Fingerprint SDK not available. Make sure you've included the SDK scripts.");
        }

        // Cleanup on unmount
        return () => {
            if (sdk && acquisitionStarted) {
                sdk.stopAcquisition().catch(console.error);
            }
        };
    }, []);

    // Function to get available readers
    const getAvailableReaders = async () => {
        if (!sdk) return;

        try {
            const readersArray = await sdk.enumerateDevices();
            setReaders(readersArray);

            // If there's at least one reader, select it automatically
            if (readersArray.length > 0) {
                setSelectedReader(readersArray[0]);
                setStatus("Reader connected. Ready to scan.");
            } else {
                setStatus("No fingerprint readers found. Please connect a reader.");
            }
        } catch (error) {
            setStatus(`Error getting readers: ${error.message}`);
        }
    };

    // Start capturing
    const startCapture = async () => {
        if (!sdk || !selectedReader) {
            setStatus("SDK not initialized or no reader selected");
            return;
        }

        if (acquisitionStarted) {
            setStatus("Acquisition already started");
            return;
        }

        try {
            // Format is set to PNG image
            const format = window.Fingerprint.SampleFormat.PngImage;
            await sdk.startAcquisition(format, selectedReader);
            setAcquisitionStarted(true);
            setStatus("Scanning started. Place your finger on the reader.");
        } catch (error) {
            setStatus(`Error starting capture: ${error.message}`);
        }
    };

    // Stop capturing
    const stopCapture = async () => {
        if (!sdk || !acquisitionStarted) return;

        try {
            await sdk.stopAcquisition();
            setAcquisitionStarted(false);
        } catch (error) {
            setStatus(`Error stopping capture: ${error.message}`);
        }
    };

    // Scan fingerprint and return result
    const scanFingerprint = async () => {
        return new Promise(async (resolve, reject) => {
            if (!sdk) {
                reject("SDK not initialized");
                return;
            }

            if (readers.length === 0) {
                try {
                    await getAvailableReaders();
                } catch (error) {
                    reject(`Error getting readers: ${error.message}`);
                    return;
                }
            }

            if (readers.length === 0) {
                reject("No fingerprint readers found. Please connect a reader.");
                return;
            }

            // Set up a listener for the fingerprint capture
            const captureListener = () => {
                if (fingerprint) {
                    resolve(fingerprint);
                    setFingerprint(null); // Reset for next capture
                    document.removeEventListener('fingerprintCaptured', captureListener);
                }
            };

            // Create a custom event that will be triggered when fingerprint is captured
            document.addEventListener('fingerprintCaptured', captureListener);

            // Start the capture
            try {
                await startCapture();

                // Set a timeout to reject the promise if no fingerprint is captured
                setTimeout(() => {
                    if (!fingerprint) {
                        document.removeEventListener('fingerprintCaptured', captureListener);
                        stopCapture();
                        reject("Fingerprint capture timed out");
                    }
                }, 30000); // 30 seconds timeout
            } catch (error) {
                document.removeEventListener('fingerprintCaptured', captureListener);
                reject(`Error starting capture: ${error.message}`);
            }
        });
    };

    // Update the fingerprint state and trigger the event
    useEffect(() => {
        if (fingerprint) {
            document.dispatchEvent(new Event('fingerprintCaptured'));
        }
    }, [fingerprint]);

    return {
        fingerprint,
        status,
        readers,
        selectedReader,
        setSelectedReader,
        acquisitionStarted,
        scanFingerprint,
        startCapture,
        stopCapture,
        getAvailableReaders
    };
};

// Create a modal component for fingerprint scanning
export const FingerprintModal = ({ isOpen, onClose, onCapture, staffId }) => {
    const {
        fingerprint,
        status,
        readers,
        selectedReader,
        scanFingerprint
    } = useFingerprintScanner();

    const [isScanning, setIsScanning] = useState(false);

    // Handle the case when no readers are found
    useEffect(() => {
        if (readers.length === 0 && status !== "Not started") {
            Swal.fire({
                title: "No Reader Found",
                text: "No fingerprint readers detected. Please connect a reader and try again.",
                icon: "error"
            });
        }
    }, [readers, status]);

    const handleScan = async () => {
        if (isScanning) return;

        if (!selectedReader) {
            Swal.fire({
                title: "No Reader Found",
                text: "No fingerprint readers detected. Please connect a reader and try again.",
                icon: "error"
            });
            return;
        }

        setIsScanning(true);
        try {
            const fingerprintData = await scanFingerprint();
            onCapture({
                staffId,
                fingerprint: fingerprintData
            });
            onClose();
        } catch (error) {
            Swal.fire({
                title: "Error",
                text: error.toString(),
                icon: "error"
            });
        } finally {
            setIsScanning(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
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

                            <div className="border rounded flex items-center justify-center h-40">
                                {fingerprint ? (
                                    <img src={fingerprint} alt="Fingerprint" className="max-h-full" />
                                ) : (
                                    <p className="text-center text-gray-500">{status}</p>
                                )}
                            </div>

                            <div className="flex flex-col gap-2 pt-2 w-full">
                                <button
                                    type="button"
                                    className="btn w-full justify-center rounded-md bg-blue-300 px-3 py-1.5 text-sm font-semibold leading-6 text-blue-800 shadow-sm hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                    onClick={handleScan}
                                    disabled={isScanning || !selectedReader}
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
                            </div>

                        </form>
                    </div>
                </div>
            </div>

            {/* <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
                <h2 className="text-xl font-bold mb-4">Register Fingerprint</h2>
                <p className="text-gray-600 mb-4">Staff ID: {staffId}</p>
                
                {readers.length > 0 && (
                    <p className="text-sm text-green-600 mb-4">
                        Using fingerprint reader: {selectedReader}
                    </p>
                )}
                
                <div className="mb-4 h-40 border rounded flex items-center justify-center">
                    {fingerprint ? (
                        <img src={fingerprint} alt="Fingerprint" className="max-h-full" />
                    ) : (
                        <p className="text-center text-gray-500">{status}</p>
                    )}
                </div>
                
                <div className="flex justify-between">
                    <button
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                        onClick={onClose}
                        disabled={isScanning}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={handleScan}
                        disabled={isScanning || !selectedReader}
                    >
                        {isScanning ? "Scanning..." : "Scan Fingerprint"}
                    </button>
                </div>
            </div>
        </div> */}
        </>
    );
};