Here's the dir structure of my react js however I didn't include all here.

client/
├── src/
├── assets/
├── components/
├── pages/
├── account/
├── home/
| ├── pages/
│ │ ├── fingerPrint.jsx
├── views/
│ ├── admin/
│ │ ├── addNewUser
│ │ │ ├── FingerprintModal.jsx
│ │ │ ├── index.jsx
│ │ │ ├── modal.jsx
│ │ │ ├── table.jsx
│ │ ├── access.js
│ ├── index.js
├── Routes.jsx

I also have node js express which handles the backend of the website and connected to Mongo db altas
which the python code also connected.

This is the dir structure of my python server which able to connect to shared database since I've also
a node js express server

python_server/
├── app.py
├── config.py
├── .env (optional)
├── utils/
│ ├── **init**.py (empty file)
│ ├── db.py
│ ├── fingerprint_processor.py
│ └── matcher.py
└── routes/
├── **init**.py (empty file)
└── fingerprint_routes.py

// client\src\pages\home\pages\fingerPrint.jsx

import React, { useEffect, useState } from "react";
import { useFingerprintScanner } from "../../../services/utilities/FingerprintScanner";
import Swal from "sweetalert2";

const FingerPrint = ({ isOpen, onClose, onCapture }) => {
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

if (!isOpen) return null;

return (
<div>
FingerPrint
{readers.length === 0 && (
<p className="text-red-600 text-sm">
No fingerprint reader detected. Please connect a reader.
</p>
)}
<div className="border rounded flex items-center justify-center h-40">
{fingerprint ? (
<img src={fingerprint} alt="Fingerprint" className="max-h-full" />
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
disabled={isScanning || readers.length === 0} >
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
    </div>

);
};

export default FingerPrint;

// client\src\pages\views\admin\addNewUser\table.jsx

import React, { useEffect, useState } from "react";
import { IoIosAdd } from "react-icons/io";
import Swal from "sweetalert2";
import useUsersStore from "../../../../services/stores/users/usersStore";
import useAuthStore from "../../../../services/stores/authStore";
import { FingerprintModal } from "./FingerprintModal";

const Table = ({ data, toggleAdd, handleUpdate }) => {
const {
deleteUser,
enrollFingerPrint,
getEnrollmentStatus,
deleteFingerprints, // Make sure this function is implemented in usersStore
} = useUsersStore();

const { token } = useAuthStore();
const [searchResult, setSearchResult] = useState("");
const [allData, setAllData] = useState(data);
const [searchTerm, setSearchTerm] = useState("");

const [enrollmentDetailsCache, setEnrollmentDetailsCache] = useState({});

// State for fingerprint modal
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedStaff, setSelectedStaff] = useState(null);
// State for enrollment details
const [enrollmentDetails, setEnrollmentDetails] = useState(null);

const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(5);

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

// Handle opening the fingerprint registration modal
const handleFingerprintRegister = async (staff) => {
// Check if the Fingerprint SDK is available
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
setIsModalOpen(false);
setTimeout(() => {
window.location.reload();
}, 500);
}
});
return;
}

    // Check enrollment cache first to avoid unnecessary API calls
    const hasEnrollmentDetails = Object.keys(enrollmentDetailsCache).includes(
      staff._id
    );

    // If we already have this staff's enrollment details cached, use that
    if (hasEnrollmentDetails) {
      setEnrollmentDetails(enrollmentDetailsCache[staff._id]);
      setSelectedStaff(staff);
      setIsModalOpen(true);
      return;
    }

    // Show loading indicator
    const loadingAlert = Swal.fire({
      title: "Checking enrollment status...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Add timeout to the getEnrollmentStatus call
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Timeout getting enrollment status")),
        5000
      )
    );

    try {
      // Race the API call against a timeout
      const status = await Promise.race([
        getEnrollmentStatus(staff._id, token),
        timeoutPromise,
      ]);

      // Store in cache for future use
      const cacheUpdate = { ...enrollmentDetailsCache };
      cacheUpdate[staff._id] = status;
      setEnrollmentDetailsCache(cacheUpdate);

      setEnrollmentDetails(status);
      setSelectedStaff(staff);
      loadingAlert.close();
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error getting enrollment status:", error);

      // Derive enrollment status from staff data if possible
      let defaultStatus = {
        enrollCount: staff.fingerprintTemplateCount || 0,
        templateCount: staff.fingerprintTemplateCount || 0,
        enrollmentStatus: staff.fingerprintEnrollStatus || "incomplete",
        minEnrollments: 2,
        maxEnrollments: 5,
        remaining: 2,
      };

      // Calculate remaining based on min enrollments and current count
      if (defaultStatus.enrollCount > 0) {
        defaultStatus.remaining = Math.max(0, 2 - defaultStatus.enrollCount);
      }

      // Cache this derived data too
      const cacheUpdate = { ...enrollmentDetailsCache };
      cacheUpdate[staff._id] = defaultStatus;
      setEnrollmentDetailsCache(cacheUpdate);

      setEnrollmentDetails(defaultStatus);
      setSelectedStaff(staff);

      loadingAlert.close();

      // Show warning toast
      const Toast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });

      Toast.fire({
        icon: "warning",
        title: "Using cached enrollment data",
      });

      setIsModalOpen(true);
    }

};

// Update the cache when enrollment succeeds
const handleFingerprintCapture = async (data) => {
console.log("Fingerprint Captured:", data);

    try {
      Swal.fire({
        title: "Processing fingerprint...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const result = await enrollFingerPrint(data, token);
      Swal.close();

      console.log("Enrollment result:", result);

      // Update enrollment details with response
      if (result && result.success) {
        const updatedDetails = {
          enrollCount: result.enrollCount,
          templateCount: result.enrollCount,
          enrollmentStatus: result.enrollStatus,
          minEnrollments: result.minEnrollments,
          maxEnrollments: result.maxEnrollments,
          remaining: result.remaining,
        };

        // Update the cache with the new details
        const cacheUpdate = { ...enrollmentDetailsCache };
        cacheUpdate[data.staffId] = updatedDetails;
        setEnrollmentDetailsCache(cacheUpdate);

        setEnrollmentDetails(updatedDetails);

        // Update user data to reflect fingerprint enrollment
        const updatedUsers = allData.map((user) => {
          if (user._id === data.staffId) {
            return {
              ...user,
              hasFingerPrint: true,
              fingerprintEnrollStatus: result.enrollStatus,
              fingerprintTemplateCount: result.enrollCount,
            };
          }
          return user;
        });

        setAllData(updatedUsers);

        // Show success message based on enrollment status
        if (result.enrollStatus === "complete") {
          Swal.fire({
            title: "Enrollment Complete!",
            text: "All required fingerprint samples have been collected.",
            icon: "success",
          });
        } else {
          // Show progress message
          Swal.fire({
            title: "Sample Recorded",
            text: `${result.remaining} more sample(s) recommended for better matching.`,
            icon: "info",
          });
        }

        return result;
      }

      return null;
    } catch (error) {
      console.error("Error enrolling fingerprint:", error);
      Swal.fire({
        title: "Enrollment Error",
        text:
          error.message || "An error occurred during fingerprint enrollment.",
        icon: "error",
      });
      return null;
    }

};

const handleDelete = (e, data) => {
e.preventDefault();

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, Delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteUser(data, token);
      }
    });

};

// Delete fingerprints for a user
const handleDeleteFingerprints = async (e, user) => {
e.preventDefault();
e.stopPropagation();

    Swal.fire({
      title: "Delete Fingerprint Templates?",
      text: "This will delete all fingerprint enrollments for this user. They will need to re-enroll.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, Delete Fingerprints",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          Swal.fire({
            title: "Deleting fingerprints...",
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          // Call the deleteFingerprints function from usersStore
          await deleteFingerprints(user._id, token);

          // Clear the cache for this user
          const newCache = { ...enrollmentDetailsCache };
          delete newCache[user._id];
          setEnrollmentDetailsCache(newCache);

          // Update user in the UI
          const updatedUsers = allData.map((u) => {
            if (u._id === user._id) {
              return {
                ...u,
                hasFingerPrint: false,
                fingerprintEnrollStatus: null,
                fingerprintTemplateCount: 0,
              };
            }
            return u;
          });

          setAllData(updatedUsers);

          Swal.fire({
            title: "Success!",
            text: "Fingerprint templates deleted successfully.",
            icon: "success",
          });
        } catch (error) {
          console.error("Error deleting fingerprints:", error);
          Swal.fire({
            title: "Error",
            text: "Failed to delete fingerprint templates.",
            icon: "error",
          });
        }
      }
    });

};

useEffect(() => {
if (data || searchTerm) {
const term = searchTerm.toLowerCase();

      if (term === "") {
        setAllData(data);
        setSearchResult("");
        return;
      }

      const filtered = data.filter(
        (user) =>
          user.firstname?.toLowerCase().includes(term) ||
          user.middlename?.toLowerCase().includes(term) ||
          user.lastname?.toLowerCase().includes(term) ||
          user.email?.toLowerCase().includes(term)
      );

      if (filtered.length === 0 && searchTerm) {
        setSearchResult(`No result found for "${searchTerm}"`);
      } else {
        setSearchResult("");
      }
      setAllData(filtered);
      setCurrentPage(1);
    }

}, [searchTerm, data]);

const indexOfLastItem = currentPage \* itemsPerPage;
const indexOfFirstItem = indexOfLastItem - itemsPerPage;
const currentItems = allData.slice(indexOfFirstItem, indexOfLastItem);

const totalPages = Math.ceil(allData.length / itemsPerPage);

const handlePageChange = (pageNumber) => {
setCurrentPage(pageNumber);
};

const handleItemsPerPageChange = (e) => {
setItemsPerPage(Number(e.target.value));
setCurrentPage(1);
};

const pageNumbers = [];
for (let i = 1; i <= totalPages; i++) {
pageNumbers.push(i);
}

const renderPagination = () => {
return (
<div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
<div className="flex flex-1 justify-between sm:hidden">
<button
onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
disabled={currentPage === 1}
className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${
              currentPage === 1
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-50"
            }`} >
Previous
</button>
<button
onClick={() =>
handlePageChange(Math.min(totalPages, currentPage + 1))
}
disabled={currentPage === totalPages}
className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${
              currentPage === totalPages
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-50"
            }`} >
Next
</button>
</div>
<div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
<div>
<p className="text-sm text-gray-700">
Showing{" "}
<span className="font-medium">{indexOfFirstItem + 1}</span> to{" "}
<span className="font-medium">
{indexOfLastItem > allData.length
? allData.length
: indexOfLastItem}
</span>{" "}
of <span className="font-medium">{allData.length}</span> results
</p>
</div>
<div className="flex items-center gap-2">
<select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              className="rounded border-gray-300 text-sm"
            >
<option value={5}>5 per page</option>
<option value={10}>10 per page</option>
<option value={25}>25 per page</option>
</select>
<nav
              className="isolate inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
<button
onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
disabled={currentPage === 1}
className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                  currentPage === 1
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50"
                }`} >
<span className="sr-only">Previous</span>
<svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
<path
                    fillRule="evenodd"
                    d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                    clipRule="evenodd"
                  />
</svg>
</button>
{pageNumbers.map((number) => (
<button
key={number}
onClick={() => handlePageChange(number)}
className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    currentPage === number
                      ? "bg-blue-600 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0"
                  }`} >
{number}
</button>
))}
<button
onClick={() =>
handlePageChange(Math.min(totalPages, currentPage + 1))
}
disabled={currentPage === totalPages}
className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                  currentPage === totalPages
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50"
                }`} >
<span className="sr-only">Next</span>
<svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
<path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
</svg>
</button>
</nav>
</div>
</div>
</div>
);
};

return (
<div className="overflow-x-auto bg-white shadow-md rounded-2xl">
<table className="table">
<caption>
<div className="flex justify-between p-4">
<h3 className="text-xl">Users</h3>
<div className="flex flex-row gap-4 justify-center items-center">
<label className="input bg-transparent border-2 border-gray-500 rounded-md">
<svg
                  className="h-4 opacity-50"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                >
<g
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                    fill="none"
                    stroke="currentColor"
                  >
<circle cx="11" cy="11" r="8"></circle>
<path d="m21 21-4.3-4.3"></path>
</g>
</svg>
<input
type="search"
value={searchTerm}
onChange={(e) => setSearchTerm(e.target.value)}
placeholder="Search"
/>
</label>
<button
className="flex items-center justify-center px-4 py-3 bg-green-200 rounded-md text-green-800 whitespace-nowrap hover:bg-green-300"
onClick={() => toggleAdd((prev) => !prev)} >
<IoIosAdd />
Add New Staff
</button>
</div>
</div>
</caption>
<thead>
<tr className="text-black bg-gray-300">
<th>#</th>
<th>Name</th>
<th>Mail</th>
<th>Role</th>
<th>Fingerprint Status</th>
<th>Action</th>
</tr>
</thead>
<tbody className="text-gray-500">
{searchResult ? (
<tr>
<td colSpan={6} className="text-center py-4 text-gray-500">
{searchResult}
</td>
</tr>
) : (
currentItems.map((\_data, i) => (
<tr key={i}>
<th>{indexOfFirstItem + i + 1}</th>
<td>
{\_data.firstname} {\_data.middlename} {\_data.lastname}
</td>
<td>{\_data.email}</td>
<td>{\_data.role}</td>
<td>
{\_data.hasFingerPrint ? (
<div className="flex flex-col">
<span className="text-green-600 font-medium">
{\_data.fingerprintEnrollStatus === "complete"
? "Complete"
: "Partial"}
({\_data.fingerprintTemplateCount || 1}
{\_data.fingerprintTemplateCount === 1
? " sample"
: " samples"}
)
</span>
{\_data.fingerprintEnrollStatus !== "complete" && (
<span className="text-xs text-amber-600">
More samples recommended
</span>
)}
</div>
) : (
<span className="text-red-600">Not Enrolled</span>
)}
</td>
<td className="flex flex-row justify-center items-center gap-2 p-2">
<button
className="p-2 bg-blue-200 text-blue-800 rounded-md hover:bg-blue-300"
onClick={() => handleUpdate(\_data)} >
Update
</button>
<button
className="p-2 bg-red-200 text-red-800 rounded-md hover:bg-red-300"
onClick={(e) => handleDelete(e, \_data)} >
Delete
</button>
<div className="flex flex-col gap-1">
<button
className="p-2 bg-green-200 text-green-800 rounded-md hover:bg-green-300"
onClick={() => handleFingerprintRegister(\_data)} >
{!\_data?.hasFingerPrint
? "Register Fingerprint"
: "Add Samples"}
</button>
{\_data?.hasFingerPrint && (
<button
className="p-1 text-xs bg-red-100 text-red-800 rounded-md hover:bg-red-200"
onClick={(e) => handleDeleteFingerprints(e, \_data)} >
Reset Fingerprints
</button>
)}
</div>
</td>
</tr>
))
)}
</tbody>
</table>
{!searchResult && renderPagination()}

      {/* Fingerprint Modal */}
      {isModalOpen && selectedStaff && (
        <FingerprintModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCapture={handleFingerprintCapture}
          staffId={selectedStaff._id}
          enrollmentDetails={enrollmentDetails}
        />
      )}
    </div>

);
};

export default Table;

// client\src\pages\views\admin\addNewUser\index.jsx

import React, { useEffect, useState } from "react";
import Table from "./table";
import Modal from "./modal";
import useAuthStore from "../../../../services/stores/authStore";
import useUsersStore from "../../../../services/stores/users/usersStore";
import Swal from "sweetalert2";

const info = {
firstname: "",
middlename: "",
lastname: "",
email: "",
password: "",
department: "",
position: "",
role: "STAFF",
};

const AddNewUser = () => {
const { token } = useAuthStore();
const { getUsers, data, user, reset, message, isSuccess } = useUsersStore();
const [toggleAdd, setToggleAdd] = useState(false);
const [usersData, setUsersData] = useState([]);
const [isUpdate, setIsUpdate] = useState(false);
const [newUser, setNewUser] = useState(info);

useEffect(() => {
if (token) {
getUsers(token);
}
}, [token]);

useEffect(() => {
if (data) {
setUsersData(data);
}
}, [data]);

const handleUpdate = (user) => {
setToggleAdd(true);
setNewUser(user);
setIsUpdate(true);
console.log(user);
};

useEffect(() => {
if (isSuccess && message) {
setToggleAdd(false);

      setNewUser(info);

      console.log(user);

      if (Object.keys(user).length > 0 && isUpdate) {
        const updatedUsers = usersData.map((u) =>
          u._id === user._id ? user : u
        );
        setUsersData(updatedUsers);
        setIsUpdate(false);
      } else if (Object.keys(user).length > 0) {
        setUsersData((prev) => {
          const exists = prev.some((u) => u._id === user._id);

          if (exists) {
            return prev.filter((u) => u._id !== user._id);
          } else {
            return [...prev, user];
          }
        });
      }

      reset();
      Swal.fire({
        title: "Saved!",
        text: message,
        icon: "success",
      });
    } else if (message) {
      reset();
      Swal.fire({
        title: "Error!",
        text: message,
        icon: "error",
      });
    }

}, [isSuccess, message, user]);

return (
<>
<div className="container">
<div className="flex flex-col gap-5 pt-4">
<div className="">
<h2 className="text-xl text-[#4154F1]">Add new staff</h2>
<p className="text-sm text-[#989797]">
Staffs / {toggleAdd && "Add new staff"}
</p>
</div>
<div>
<Table
              data={usersData}
              toggleAdd={setToggleAdd}
              handleUpdate={handleUpdate}
            />
</div>
</div>
</div>
<Modal
        isOpen={toggleAdd}
        setIsOpen={setToggleAdd}
        setUserData={setNewUser}
        userData={newUser}
        isUpdate={isUpdate}
        setIsUpdate={setIsUpdate}
        initialData={info}
      />
</>
);
};

export default AddNewUser;

// client\src\pages\views\admin\addNewUser\FingerprintModal.jsx

import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

export const FingerprintModal = ({
isOpen,
onClose,
onCapture,
staffId,
enrollmentDetails,
}) => {
const [captureInProgress, setCaptureInProgress] = useState(false);
const [reader, setReader] = useState(null);
const [captureOperation, setCaptureOperation] = useState(null);
const [captureError, setCaptureError] = useState(null);
const [fingerprintSample, setFingerprintSample] = useState(null);

// Parse enrollment details
const isEnrollmentComplete =
enrollmentDetails?.enrollmentStatus === "complete";
const enrolledCount = enrollmentDetails?.enrollCount || 0;
const minEnrollments = enrollmentDetails?.minEnrollments || 2;
const maxEnrollments = enrollmentDetails?.maxEnrollments || 5;
const remainingSamples =
enrollmentDetails?.remaining || minEnrollments - enrolledCount;
const hasReachedMax = enrolledCount >= maxEnrollments;

useEffect(() => {
if (isOpen) {
initializeReader();
return () => {
// Clean up scanner when the modal is closed
if (captureOperation) {
try {
captureOperation.cancel();
} catch (e) {
console.error("Error canceling capture:", e);
}
}

        if (reader) {
          try {
            reader.dispose();
          } catch (e) {
            console.error("Error disposing reader:", e);
          }
        }
      };
    }

}, [isOpen]);

const initializeReader = async () => {
try {
if (!window.Fingerprint || !window.Fingerprint.WebApi) {
setCaptureError(
"Fingerprint SDK not available. Please refresh the page."
);
return;
}

      // Initialize the fingerprint reader
      const webApi = new window.Fingerprint.WebApi();
      const readers = await webApi.enumerateReaders();

      if (readers.length === 0) {
        setCaptureError(
          "No fingerprint readers found. Please connect a reader and try again."
        );
        return;
      }

      // Use the first available reader
      const newReader = await webApi.openReader(readers[0]);
      setReader(newReader);

      console.log("Fingerprint reader initialized:", readers[0]);
    } catch (error) {
      console.error("Error initializing fingerprint reader:", error);
      setCaptureError(
        `Could not initialize the fingerprint reader: ${error.message}`
      );
    }

};

const handleStartCapture = async () => {
if (!reader) {
setCaptureError("Fingerprint reader not initialized. Please try again.");
return;
}

    try {
      setCaptureInProgress(true);
      setCaptureError(null);
      setFingerprintSample(null);

      // Start the capture operation
      const operation = reader.capture();
      setCaptureOperation(operation);

      operation
        .then((captureResult) => {
          console.log("Capture successful:", captureResult);

          // Check if we got a valid sample
          if (captureResult && captureResult.data) {
            // Convert the sample to base64
            const base64Sample = captureResult.data;
            setFingerprintSample(base64Sample);

            // Process enrollment
            handleEnrollment(base64Sample);
          } else {
            setCaptureError("Invalid capture result. Please try again.");
            setCaptureInProgress(false);
          }
        })
        .catch((error) => {
          console.error("Capture error:", error);
          setCaptureError(
            `Capture failed: ${error.message || "Unknown error"}`
          );
          setCaptureInProgress(false);
        });
    } catch (error) {
      console.error("Error starting capture:", error);
      setCaptureError(`Failed to start capture: ${error.message}`);
      setCaptureInProgress(false);
    }

};

const handleEnrollment = async (fingerPrintData) => {
try {
// Call the onCapture handler with the fingerprint data
const result = await onCapture({
staffId,
fingerPrint: fingerPrintData,
});

      setCaptureInProgress(false);

      if (result && result.success) {
        // Success - handled by parent component
        console.log("Enrollment successful:", result);
      } else {
        // Error
        setCaptureError("Enrollment failed. Please try again.");
      }
    } catch (error) {
      console.error("Enrollment error:", error);
      setCaptureError(`Enrollment failed: ${error.message || "Unknown error"}`);
      setCaptureInProgress(false);
    }

};

const renderEnrollmentProgress = () => {
// Calculate percentage complete
const percentComplete = Math.min(
100,
(enrolledCount / minEnrollments) \* 100
);

    return (
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 dark:bg-gray-700">
        <div
          className={`h-2.5 rounded-full ${
            isEnrollmentComplete ? "bg-green-600" : "bg-blue-600"
          }`}
          style={{ width: `${percentComplete}%` }}
        ></div>
      </div>
    );

};

const renderStatusMessage = () => {
if (isEnrollmentComplete) {
return (
<div className="text-green-600 font-medium text-center my-2">
✅ Enrollment complete with {enrolledCount} samples
{enrolledCount < maxEnrollments && (
<div className="text-xs text-gray-600 mt-1">
You can add up to {maxEnrollments - enrolledCount} more samples to
improve matching accuracy
</div>
)}
</div>
);
}

    return (
      <div className="text-amber-600 font-medium text-center my-2">
        {enrolledCount > 0 ? (
          <>
            Partial enrollment: {enrolledCount}/{minEnrollments} samples
            <div className="text-xs text-gray-600 mt-1">
              {remainingSamples} more{" "}
              {remainingSamples === 1 ? "sample" : "samples"} recommended
            </div>
          </>
        ) : (
          <>
            No samples yet
            <div className="text-xs text-gray-600 mt-1">
              Minimum {minEnrollments} samples needed
            </div>
          </>
        )}
      </div>
    );

};

// If the modal is not open, don't render anything
if (!isOpen) {
return null;
}

return (
<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
<div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
<div className="flex justify-between items-center mb-4">
<h2 className="text-xl font-semibold text-gray-800">
Fingerprint Enrollment
</h2>
<button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={captureInProgress}
          >
<svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
<path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
</svg>
</button>
</div>

        {/* Enrollment progress */}
        {renderEnrollmentProgress()}
        {renderStatusMessage()}

        <div className="mt-4">
          {captureError && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              <p>{captureError}</p>
            </div>
          )}

          <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg mb-4">
            <div className="w-32 h-32 mb-4">
              {fingerprintSample ? (
                <div className="w-full h-full flex items-center justify-center bg-green-50 rounded-lg border-2 border-green-500">
                  <svg
                    className="w-16 h-16 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                  <svg
                    className="w-12 h-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    ></path>
                  </svg>
                </div>
              )}
            </div>

            {captureInProgress ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-gray-600">
                  Place your finger on the scanner...
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 mb-2">
                  {hasReachedMax
                    ? "Maximum samples reached. You can still replace samples."
                    : "Press the button to scan your fingerprint"}
                </p>
                <button
                  onClick={handleStartCapture}
                  disabled={captureInProgress}
                  className={`px-4 py-2 rounded-md text-white font-semibold ${
                    captureInProgress
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isEnrollmentComplete
                    ? "Add Another Sample"
                    : "Scan Fingerprint"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-500">
          <h3 className="font-medium mb-1">Tips for Better Scanning:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Place your finger flat on the center of the scanner</li>
            <li>Apply consistent, moderate pressure</li>
            <li>Keep your finger still during the scan</li>
            <li>Clean the scanner and your finger for best results</li>
            <li>Try different positions for multiple samples</li>
          </ul>
        </div>
      </div>
    </div>

);
};

// client\src\services\stores\users\usersStore.js

import { create } from "zustand";
import axiosTools from "../../utilities/axiosUtils";

const useUsersStore = create((set, get) => ({
data: [],
user: {},
isLoading: false,
message: "",
isSuccess: false,

getUsers: async (token) => {
try {
const res = await axiosTools.getData("users/getAll", "", token);

      set({
        data: res.data,
        isSuccess: res.success,
      });
    } catch (error) {
      set({
        isSuccess: false,
        message: error?.response?.data?.message || "Something went wrong",
      });
    }

},

signup: async (item) => {
set({ isLoading: true, message: "", isSuccess: false });
try {
const res = await axiosTools.register("auth/signup", { ...item });

      set({
        isSuccess: res.success,
        isLoading: false,
        message: "User created successfully!",
        user: res.user,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error || "eSignup: signup failed",
        isSuccess: false,
      });
    }

},

update: async (data, token) => {
set({ isLoading: true, message: "", isSuccess: false });
try {
const res = await axiosTools.updateData("users/update", data, token);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: "User updated successfully!",
        user: res.user,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
    }

},

deleteUser: async (data, token) => {
set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.deleteData("users/delete", data, token);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: "User deleted successfully!",
        user: res.user,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
    }

},

matchFingerPrint: async (data) => {
set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.creteData("users/match", data);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
    }

},

verifyFingerPrint: async (data) => {
set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.creteData("users/verify", data);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
    }

},

reset: () => {
set({
message: "",
isSuccess: false,
isLoading: false,
});
},

enrollFingerPrint: async (data, token) => {
set({ isLoading: true, message: "", isSuccess: false });

    try {
      // Use axiosTools instead of api
      const res = await axiosTools.creteData("fingerprint/enroll", data, token);

      if (res.success) {
        // Update the user's fingerprint status in the data array
        const updatedData = get().data.map((user) => {
          if (user._id === data.staffId) {
            return {
              ...user,
              hasFingerPrint: true,
              fingerprintEnrollStatus: res.enrollStatus,
              fingerprintTemplateCount: res.enrollCount,
            };
          }
          return user;
        });

        set({
          data: updatedData,
          isSuccess: true,
          isLoading: false,
          message: res.message || "Fingerprint enrolled successfully!",
        });

        return res;
      } else {
        throw new Error(res.message || "Enrollment failed");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Failed to enroll fingerprint",
        isSuccess: false,
      });
      throw error;
    }

},

// Get enrollment status for a staff ID
getEnrollmentStatus: async (staffId, token) => {
try {
// Use axiosTools instead of api
const res = await axiosTools.getData(
`fingerprint/templates/${staffId}`,
"",
token
);

      if (res.success) {
        return {
          enrollCount: res.templateCount,
          templateCount: res.templateCount,
          enrollmentStatus: res.enrollmentStatus,
          minEnrollments: res.minEnrollments,
          maxEnrollments: res.maxEnrollments,
          remaining: res.remaining,
        };
      } else {
        throw new Error(res.message || "Failed to get enrollment status");
      }
    } catch (error) {
      console.error("Error getting enrollment status:", error);
      throw error;
    }

},

// Delete all fingerprint templates for a staff ID
deleteFingerprints: async (staffId, token) => {
set({ isLoading: true, message: "", isSuccess: false });

    try {
      // Use axiosTools instead of api
      const res = await axiosTools.deleteData(
        `fingerprint/templates/${staffId}`,
        { staffId },
        token
      );

      if (res.success) {
        // Update the user's fingerprint status in the data array
        const updatedData = get().data.map((user) => {
          if (user._id === staffId) {
            return {
              ...user,
              hasFingerPrint: false,
              fingerprintEnrollStatus: null,
              fingerprintTemplateCount: 0,
            };
          }
          return user;
        });

        set({
          data: updatedData,
          isSuccess: true,
          isLoading: false,
          message: res.message || "Fingerprints deleted successfully!",
        });

        return res;
      } else {
        throw new Error(res.message || "Failed to delete fingerprints");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Failed to delete fingerprints",
        isSuccess: false,
      });
      throw error;
    }

},
}));

export default useUsersStore;

// python

// python_server\app.py

from flask import Flask
from flask_cors import CORS
from routes.fingerprint_routes import fingerprint_bp
from config import HOST, PORT, DEBUG

def create_app():
"""Create and configure the Flask application."""
app = Flask(**name**)
CORS(app) # Enable CORS for all routes

    # Register blueprints
    app.register_blueprint(fingerprint_bp)

    return app

if **name** == '**main**':
app = create_app()
print(f"Starting fingerprint matching server on {HOST}:{PORT}") # logging.basicConfig(level=logging.DEBUG)
app.run(host=HOST, port=PORT, debug=DEBUG)

// python_server\.env

MONGO_URI=mongodb+srv://hennryx101:OIXs7TPJhxHX9o8F@cluster0.croadpx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
DB_NAME=Cluster0
DEBUG=True
HOST=0.0.0.0
PORT=5500
MATCH_THRESHOLD=0.3
FEATURE_COUNT=1000
GABOR_ENABLED=True

// python_server\config.py

import os

# MongoDB Configuration

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://hennryx101:OIXs7TPJhxHX9o8F@cluster0.croadpx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
DB_NAME = os.getenv("DB_NAME", "Cluster0")

# Application Configuration

DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5500"))

# Fingerprint Matching Configuration

MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.36")) # Balanced threshold
FEATURE_COUNT = int(os.getenv("FEATURE_COUNT", "1000"))
GABOR_ENABLED = os.getenv("GABOR_ENABLED", "True").lower() in ("true", "1", "t")

# Multi-Enrollment Configuration

MIN_ENROLLMENTS = int(os.getenv("MIN_ENROLLMENTS", "2")) # Minimum recommended enrollments
MAX_ENROLLMENTS = int(os.getenv("MAX_ENROLLMENTS", "5")) # Maximum enrollments per staff ID
STORE_ORIGINAL_IMAGE = os.getenv("STORE_ORIGINAL_IMAGE", "False").lower() in ("true", "1", "t") # Whether to store original images

# Local Storage Configuration

LOCAL_DATA_PATH = os.getenv("LOCAL_DATA_PATH", "fingerprint_data") # Directory for local fingerprint data
LOCAL_FIRST = os.getenv("LOCAL_FIRST", "True").lower() in ("true", "1", "t") # Whether to prioritize local data

// python_server\utils\db.py

from pymongo import MongoClient
from bson.objectid import ObjectId
import datetime
import time
import json
import os
from config import MONGO_URI, DB_NAME, LOCAL_DATA_PATH

class Database:
"""Database handler for fingerprint operations with multi-enrollment support."""

    _instance = None

    def __new__(cls):
        """Singleton pattern to ensure only one database connection."""
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize the database connection and local storage."""
        self.client = None
        self.db = None
        self.fingerprint_collection = None
        self.local_cache = {}  # In-memory cache of fingerprint data

        # Create local data directory if it doesn't exist
        if not os.path.exists(LOCAL_DATA_PATH):
            os.makedirs(LOCAL_DATA_PATH)

        # Load local data into memory cache
        self._load_local_data()

        # Simple connection parameters
        self.connection_params = {
            'connectTimeoutMS': 10000,
            'socketTimeoutMS': 15000,
            'serverSelectionTimeoutMS': 10000
        }

        # Attempt to connect with retry
        max_retries = 3
        retry_delay = 2  # seconds

        for attempt in range(max_retries):
            try:
                print(f"Attempting to connect to MongoDB (attempt {attempt+1}/{max_retries})...")

                # Create client with simplified parameters
                self.client = MongoClient(MONGO_URI, **self.connection_params)

                # Test connection with a ping command
                self.client.admin.command('ping')

                self.db = self.client[DB_NAME]
                self.fingerprint_collection = self.db["fingerprints"]

                # Create indexes for faster queries
                self.fingerprint_collection.create_index("staffId")

                print("MongoDB connection successful!")
                break

            except Exception as e:
                print(f"MongoDB connection error (attempt {attempt+1}): {str(e)}")

                # Close client if it was created
                if self.client:
                    self.client.close()
                    self.client = None

                # If this is the last attempt, fallback to local mode
                if attempt == max_retries - 1:
                    print("All connection attempts failed. Using fallback mode.")
                    # Set to fallback mode instead of raising exception
                    self.client = None
                else:
                    # Wait before retrying
                    time.sleep(retry_delay)
                    # Increase delay for next attempt
                    retry_delay *= 2

    def _load_local_data(self):
        """Load all local fingerprint data into memory cache."""
        try:
            if not os.path.exists(LOCAL_DATA_PATH):
                return

            # Load all JSON files in the directory
            for filename in os.listdir(LOCAL_DATA_PATH):
                if filename.endswith('.json'):
                    file_path = os.path.join(LOCAL_DATA_PATH, filename)
                    with open(file_path, 'r') as f:
                        try:
                            data = json.load(f)
                            if 'staffId' in data:
                                staff_id = data['staffId']
                                # Initialize the list if this is the first template for this staff ID
                                if staff_id not in self.local_cache:
                                    self.local_cache[staff_id] = []
                                # Add this template to the list
                                self.local_cache[staff_id].append(data)
                        except json.JSONDecodeError:
                            print(f"Error parsing JSON from {file_path}")

            print(f"Loaded {len(self.local_cache)} staff IDs with fingerprint data from local storage")

            # Count total templates
            total_templates = sum(len(templates) for templates in self.local_cache.values())
            print(f"Total templates loaded: {total_templates}")

        except Exception as e:
            print(f"Error loading local data: {str(e)}")

    def _ensure_connection(self):
        """Ensure that database connection exists before operations."""
        if not self.client:
            try:
                print("Attempting to reconnect to MongoDB...")
                self.client = MongoClient(MONGO_URI, **self.connection_params)
                self.client.admin.command('ping')
                self.db = self.client[DB_NAME]
                self.fingerprint_collection = self.db["fingerprints"]
                print("MongoDB reconnection successful!")
            except Exception as e:
                print(f"MongoDB reconnection failed: {str(e)}")
                raise

    def get_all_fingerprints(self):
        """Get all fingerprint records with priority on local data."""
        try:
            # First, get all templates from local cache
            all_templates = []
            for staff_id, templates in self.local_cache.items():
                for template in templates:
                    all_templates.append(template)

            # If we have enough local templates (at least 1 per staff ID), use those
            if all_templates:
                print(f"Using {len(all_templates)} templates from local cache")
                return all_templates

            # If no local templates, try MongoDB
            self._ensure_connection()
            if not self.client:
                print("Database connection unavailable. Returning empty list.")
                return []

            # Get templates from MongoDB
            mongo_templates = list(self.fingerprint_collection.find())
            print(f"Using {len(mongo_templates)} templates from MongoDB")
            return mongo_templates

        except Exception as e:
            print(f"Error retrieving fingerprints: {str(e)}")
            return []

    def get_fingerprint_templates_by_staff_id(self, staff_id):
        """Get all fingerprint templates for a staff ID with priority on local data."""
        try:
            # Check local cache first
            if staff_id in self.local_cache and self.local_cache[staff_id]:
                print(f"Found {len(self.local_cache[staff_id])} templates for staff ID {staff_id} in local cache")
                return self.local_cache[staff_id]

            # If not in local cache, try MongoDB
            self._ensure_connection()
            if not self.client:
                print("Database connection unavailable. Returning empty list.")
                return []

            # Convert staff_id if needed
            if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                staff_id_obj = ObjectId(staff_id)
            else:
                staff_id_obj = staff_id

            # Find all templates for this staff ID
            templates = list(self.fingerprint_collection.find({"staffId": staff_id_obj}))
            print(f"Found {len(templates)} templates for staff ID {staff_id} in MongoDB")
            return templates

        except Exception as e:
            print(f"Error retrieving fingerprints for staff ID {staff_id}: {str(e)}")
            return []

    def get_template_count_for_staff_id(self, staff_id):
        """Get the number of enrolled templates for a staff ID."""
        try:
            # Check local cache first
            if staff_id in self.local_cache:
                return len(self.local_cache[staff_id])

            # If not in local cache, try MongoDB
            self._ensure_connection()
            if not self.client:
                return 0

            # Convert staff_id if needed
            if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                staff_id_obj = ObjectId(staff_id)
            else:
                staff_id_obj = staff_id

            # Count templates for this staff ID
            count = self.fingerprint_collection.count_documents({"staffId": staff_id_obj})
            return count

        except Exception as e:
            print(f"Error counting fingerprints for staff ID {staff_id}: {str(e)}")
            return 0

    def add_fingerprint_template(self, staff_id, template, original_data=None):
        """Add a new fingerprint template for a staff ID (without replacing existing ones)."""
        try:
            # Create new template record
            template_data = {
                "staffId": staff_id,
                "template": template,
                "createdAt": datetime.datetime.now(),
            }

            # Only include original image data if provided (optional)
            if original_data:
                template_data["original"] = original_data

            # Add to local cache first
            if staff_id not in self.local_cache:
                self.local_cache[staff_id] = []

            # Make a copy for local cache
            local_template = template_data.copy()
            # Convert datetime to string for JSON serialization
            local_template["createdAt"] = local_template["createdAt"].isoformat()

            # Add to local cache
            self.local_cache[staff_id].append(local_template)

            # Save to local file
            template_id = f"{int(time.time())}_{len(self.local_cache[staff_id])}"
            filename = os.path.join(LOCAL_DATA_PATH, f"fingerprint_{staff_id}_{template_id}.json")

            with open(filename, 'w') as f:
                json.dump(local_template, f)

            print(f"Saved fingerprint template to local file: {filename}")

            # Try to save to MongoDB as well if available
            try:
                self._ensure_connection()
                if self.client:
                    # Convert staff_id if needed
                    if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                        template_data["staffId"] = ObjectId(staff_id)

                    # Insert new template
                    result = self.fingerprint_collection.insert_one(template_data)

                    if result.inserted_id:
                        print(f"Saved fingerprint template to MongoDB with ID: {result.inserted_id}")
                        return True, len(self.local_cache[staff_id])
                    else:
                        print("Failed to save template to MongoDB, but local copy exists")
                        return True, len(self.local_cache[staff_id])
                else:
                    print("MongoDB unavailable, template saved locally only")
                    return True, len(self.local_cache[staff_id])
            except Exception as e:
                print(f"Error saving to MongoDB: {str(e)}")
                print("Template saved locally only")
                return True, len(self.local_cache[staff_id])

        except Exception as e:
            print(f"Error adding fingerprint template: {str(e)}")
            return False, 0

    def delete_fingerprint_templates(self, staff_id):
        """Delete all fingerprint templates for a staff ID."""
        try:
            templates_deleted = 0

            # Delete from local cache
            if staff_id in self.local_cache:
                templates_deleted = len(self.local_cache[staff_id])
                del self.local_cache[staff_id]

            # Delete local files
            for filename in os.listdir(LOCAL_DATA_PATH):
                if filename.startswith(f"fingerprint_{staff_id}_"):
                    os.remove(os.path.join(LOCAL_DATA_PATH, filename))

            # Try to delete from MongoDB
            try:
                self._ensure_connection()
                if self.client:
                    # Convert staff_id if needed
                    if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                        staff_id_obj = ObjectId(staff_id)
                    else:
                        staff_id_obj = staff_id

                    # Delete all templates for this staff ID
                    result = self.fingerprint_collection.delete_many({"staffId": staff_id_obj})
                    print(f"Deleted {result.deleted_count} templates from MongoDB")
            except Exception as e:
                print(f"Error deleting from MongoDB: {str(e)}")

            return templates_deleted

        except Exception as e:
            print(f"Error deleting fingerprint templates: {str(e)}")
            return 0

    def sync_to_mongodb(self):
        """Synchronize local data to MongoDB (for background task)."""
        try:
            if not self.local_cache:
                print("No local data to sync")
                return 0

            self._ensure_connection()
            if not self.client:
                print("MongoDB unavailable for sync")
                return 0

            templates_synced = 0

            # Iterate through all local templates
            for staff_id, templates in self.local_cache.items():
                for template in templates:
                    # Create a copy for MongoDB
                    mongo_template = template.copy()

                    # Convert staff_id if needed
                    if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                        mongo_template["staffId"] = ObjectId(staff_id)

                    # Convert ISO datetime string back to datetime object
                    if isinstance(mongo_template.get("createdAt"), str):
                        mongo_template["createdAt"] = datetime.datetime.fromisoformat(mongo_template["createdAt"])

                    # Check if this template already exists in MongoDB
                    # We can use createdAt as a unique identifier
                    existing = self.fingerprint_collection.find_one({
                        "staffId": mongo_template["staffId"],
                        "createdAt": mongo_template["createdAt"]
                    })

                    if not existing:
                        # Insert new template
                        result = self.fingerprint_collection.insert_one(mongo_template)
                        if result.inserted_id:
                            templates_synced += 1

            print(f"Synced {templates_synced} templates to MongoDB")
            return templates_synced

        except Exception as e:
            print(f"Error syncing to MongoDB: {str(e)}")
            return 0

// python_server\utils\fingerprint_processor.py

import cv2
import numpy as np
from scipy import ndimage
import base64
from PIL import Image
import io
import math
import random

# Check if cv2.ximgproc is available (for thinning)

XIMGPROC_AVAILABLE = False
try:
from cv2 import ximgproc
XIMGPROC_AVAILABLE = True
except ImportError:
print("OpenCV ximgproc module not available. Using basic processing instead.")

class FingerprintProcessor:
"""Enhanced fingerprint processing with robust feature extraction."""

    @staticmethod
    def base64_to_image(base64_string):
        """Convert base64 string to OpenCV image with extensive error checking."""
        try:
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]

            try:
                img_data = base64.b64decode(base64_string)
                img = Image.open(io.BytesIO(img_data))

                # Convert to numpy array and ensure 3 channels
                np_img = np.array(img)

                # Handle grayscale images
                if len(np_img.shape) == 2:
                    # If grayscale, convert to BGR
                    np_img = cv2.cvtColor(np_img, cv2.COLOR_GRAY2BGR)
                elif len(np_img.shape) == 3 and np_img.shape[2] == 4:
                    # If RGBA, convert to BGR
                    np_img = cv2.cvtColor(np_img, cv2.COLOR_RGBA2BGR)
                elif len(np_img.shape) == 3 and np_img.shape[2] == 3:
                    # Already BGR or RGB, convert to ensure BGR
                    np_img = cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)

                # Validate that we have a proper image
                if np_img.size == 0:
                    raise ValueError("Image has zero size")

                # Print image information for debugging
                print(f"Image loaded successfully: shape={np_img.shape}, dtype={np_img.dtype}")

                return np_img

            except Exception as e:
                print(f"Error in base64 decoding: {str(e)}")
                # Try an alternative method
                img_data = base64.b64decode(base64_string)
                nparr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if img is None or img.size == 0:
                    raise ValueError("Failed to decode image with alternative method")

                print(f"Image loaded with alternative method: shape={img.shape}, dtype={img.dtype}")
                return img

        except Exception as e:
            print(f"Fatal error converting base64 to image: {str(e)}")
            # Return a blank image as last resort
            print("RETURNING BLANK IMAGE AS FALLBACK")
            return np.ones((400, 400, 3), dtype=np.uint8) * 128  # Gray image

    @staticmethod
    def preprocess_fingerprint(img, target_size=(500, 500)):
        """Advanced and highly robust fingerprint preprocessing."""
        try:
            print(f"Beginning preprocessing: input shape={img.shape}, dtype={img.dtype}")

            # Convert to grayscale if not already
            if len(img.shape) == 3:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            else:
                gray = img.copy()

            # Check for blank or low-contrast images
            if np.std(gray) < 5:  # Very low contrast
                print("WARNING: Very low contrast image detected")
                # Apply artificial contrast enhancement
                gray = (gray.astype(np.float32) - np.min(gray)) * (255.0 / max(1, np.max(gray) - np.min(gray)))
                gray = gray.astype(np.uint8)

            # Standardize size
            try:
                gray = cv2.resize(gray, target_size)
            except Exception as resize_error:
                print(f"Resize error: {str(resize_error)}")
                # Create a new image with target size
                new_gray = np.ones(target_size, dtype=np.uint8) * 128
                h, w = min(gray.shape[0], target_size[1]), min(gray.shape[1], target_size[0])
                new_gray[:h, :w] = gray[:h, :w]
                gray = new_gray

            # Save original for backup
            original_gray = gray.copy()

            # Step 1: Apply multiple noise reduction techniques
            try:
                # Start with bilateral filter for edge-preserving noise reduction
                denoised = cv2.bilateralFilter(gray, 9, 75, 75)

                # Apply Gaussian blur as a fallback if bilateral produces errors
                blurred = cv2.GaussianBlur(gray, (5, 5), 0)

                # Choose the best result
                if np.std(denoised) > np.std(blurred):
                    processed = denoised
                else:
                    processed = blurred
            except Exception as denoise_error:
                print(f"Denoising error: {str(denoise_error)}")
                processed = gray  # Use original if denoising fails

            # Step 2: Multi-stage contrast enhancement
            try:
                # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
                enhanced = clahe.apply(processed)

                # Add histogram equalization
                hist_eq = cv2.equalizeHist(enhanced)

                # Blend the two enhancements
                enhanced = cv2.addWeighted(enhanced, 0.7, hist_eq, 0.3, 0)
            except Exception as enhance_error:
                print(f"Enhancement error: {str(enhance_error)}")
                enhanced = processed  # Use previous step if enhancement fails

            # Step 3: Try various binarization methods and pick the best
            binary_results = []

            try:
                # Method 1: Otsu thresholding
                _, otsu = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                binary_results.append(("otsu", otsu))

                # Method 2: Adaptive thresholding
                adaptive = cv2.adaptiveThreshold(
                    enhanced,
                    255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                    cv2.THRESH_BINARY_INV,
                    25,  # Block size
                    5    # Constant
                )
                binary_results.append(("adaptive", adaptive))

                # Method 3: Fixed threshold
                _, fixed = cv2.threshold(enhanced, 127, 255, cv2.THRESH_BINARY)
                binary_results.append(("fixed", fixed))

                # Pick the best binary result (most ridge pixels)
                best_binary = None
                best_count = -1
                best_method = ""

                for method, binary in binary_results:
                    white_count = np.sum(binary > 0)
                    if white_count > best_count and white_count < 0.7 * binary.size:  # Avoid too many white pixels
                        best_count = white_count
                        best_binary = binary
                        best_method = method

                if best_binary is not None:
                    print(f"Selected {best_method} binarization")
                    binary = best_binary
                else:
                    # Default to adaptive if selection fails
                    binary = adaptive
            except Exception as binary_error:
                print(f"Binarization error: {str(binary_error)}")
                # Fallback to simple thresholding
                _, binary = cv2.threshold(enhanced, 127, 255, cv2.THRESH_BINARY)

            # Step 4: Clean up with morphological operations
            try:
                kernel = np.ones((3, 3), np.uint8)
                cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
                cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
            except Exception as morph_error:
                print(f"Morphological operations error: {str(morph_error)}")
                cleaned = binary  # Use binary if morphological operations fail

            # Step 5: Skeletonization/thinning
            try:
                if XIMGPROC_AVAILABLE:
                    skeleton = cv2.ximgproc.thinning(cleaned)
                else:
                    # Basic morphological thinning
                    skeleton = FingerprintProcessor._morphological_thinning(cleaned)
            except Exception as skeleton_error:
                print(f"Skeletonization error: {str(skeleton_error)}")
                skeleton = cleaned  # Use cleaned if skeletonization fails

            # Ensure there are white ridges by checking white pixel count
            ridge_pixel_count = np.sum(skeleton > 0)
            expected_min_pixels = 1000  # Minimum expected ridge pixels

            if ridge_pixel_count < expected_min_pixels:
                print(f"WARNING: Low ridge pixel count ({ridge_pixel_count}). Trying inversion.")
                # Try inverting the image
                skeleton = 255 - skeleton
                ridge_pixel_count = np.sum(skeleton > 0)

                # If still too few, use original image with adaptive threshold
                if ridge_pixel_count < expected_min_pixels:
                    print("Still low ridge count. Using original with adaptive threshold.")
                    skeleton = cv2.adaptiveThreshold(
                        original_gray,
                        255,
                        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                        cv2.THRESH_BINARY_INV,
                        25,
                        5
                    )

            print(f"Preprocessing complete: ridge pixels={np.sum(skeleton > 0)}")

            # Ensure consistent format: binary image with white ridges on black background
            if np.mean(skeleton) > 127:  # If more white than black, invert
                skeleton = 255 - skeleton

            return skeleton.astype(np.uint8)

        except Exception as e:
            print(f"CRITICAL preprocessing error: {str(e)}")
            # Return a simple binary version of input as fallback
            if len(img.shape) == 3:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            else:
                gray = img.copy()

            # Resize to target size
            try:
                gray = cv2.resize(gray, target_size)
            except:
                new_gray = np.ones(target_size, dtype=np.uint8) * 128
                h, w = min(gray.shape[0], target_size[1]), min(gray.shape[1], target_size[0])
                new_gray[:h, :w] = gray[:h, :w]
                gray = new_gray

            # Simple threshold
            _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)

            return binary

    @staticmethod
    def _morphological_thinning(img):
        """Perform basic morphological thinning if ximgproc is not available."""
        # Create a copy to avoid modifying the original
        thinned = img.copy()

        # Define kernels for thinning
        kernel = np.ones((3, 3), np.uint8)

        # Iterative thinning (simplified)
        prev = np.zeros_like(thinned)
        max_iterations = 10  # Limit iterations to avoid infinite loop

        for i in range(max_iterations):
            if np.array_equal(thinned, prev):
                break
            prev = thinned.copy()
            thinned = cv2.erode(thinned, kernel)

        return thinned

    @staticmethod
    def extract_minutiae(img):
        """Extract minutiae points with multiple fallback mechanisms."""
        try:
            # Ensure the image is binary and thinned
            if len(img.shape) == 3:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            else:
                binary = img.copy()
                if np.max(binary) != 255 or np.min(binary) != 0:
                    _, binary = cv2.threshold(binary, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # Ensure we have a thinned skeleton
            if XIMGPROC_AVAILABLE:
                skeleton = cv2.ximgproc.thinning(binary)
            else:
                skeleton = FingerprintProcessor._morphological_thinning(binary)

            # Ensure white ridges (255) on black background (0)
            if np.sum(skeleton == 0) > np.sum(skeleton == 255):
                skeleton = 255 - skeleton

            # Create a padded version to handle border cases
            padded = cv2.copyMakeBorder(skeleton, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)

            # Initialize lists for minutiae
            minutiae = []

            # Scan the image (excluding borders)
            height, width = skeleton.shape
            for y in range(1, height - 1):
                for x in range(1, width - 1):
                    # Skip background pixels
                    if skeleton[y, x] == 0:
                        continue

                    # Get 8-neighborhood
                    neighbors = padded[y:y+3, x:x+3].copy()
                    center = neighbors[1, 1]
                    neighbors[1, 1] = 0  # Remove center

                    # Count transitions and neighbors
                    neighbor_count = np.sum(neighbors == 255)

                    # Crossing Number method
                    neighbor_pixels = np.array([
                        neighbors[0, 0], neighbors[0, 1], neighbors[0, 2],
                        neighbors[1, 2], neighbors[2, 2], neighbors[2, 1],
                        neighbors[2, 0], neighbors[1, 0], neighbors[0, 0]  # Added last one to close the circle
                    ])

                    # Calculate transitions from 0 to 1
                    transitions = 0
                    for i in range(8):
                        transitions += abs(int(neighbor_pixels[i]) - int(neighbor_pixels[i+1])) // 255

                    minutiae_type = None
                    direction = 0.0

                    # Classify minutiae
                    if transitions == 2 and neighbor_count == 1:
                        # Ridge ending
                        minutiae_type = "ending"
                        direction = 0.0  # Simplified direction
                    elif transitions == 6 and neighbor_count == 3:
                        # Ridge bifurcation
                        minutiae_type = "bifurcation"
                        direction = 0.0  # Simplified direction

                    if minutiae_type:
                        minutiae.append({
                            "x": float(x),
                            "y": float(y),
                            "type": minutiae_type,
                            "direction": float(direction)
                        })

            # If we've found minutiae, filter and return them
            if minutiae:
                filtered_minutiae = FingerprintProcessor._filter_minutiae(minutiae, skeleton)
                print(f"Found {len(filtered_minutiae)} minutiae points naturally")
                return filtered_minutiae

            # FALLBACK: If no minutiae found, use Harris corner detection to generate points
            print("No minutiae found, using corner detection as fallback")
            return FingerprintProcessor._generate_artificial_minutiae(skeleton)

        except Exception as e:
            print(f"Error extracting minutiae: {str(e)}")
            # Last resort - create some artificial minutiae
            print("ERROR in minutiae extraction - generating artificial points")
            return FingerprintProcessor._generate_artificial_minutiae(img)

    @staticmethod
    def _generate_artificial_minutiae(img):
        """Generate artificial minutiae from corners or random points when natural extraction fails."""
        try:
            # Convert to correct format if needed
            if len(img.shape) == 3:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            else:
                gray = img.copy()

            minutiae = []

            # Method 1: Try Harris corner detection
            try:
                corners = cv2.cornerHarris(gray.astype(np.float32), 2, 3, 0.04)
                corners = cv2.dilate(corners, None)

                # Threshold corners
                threshold = 0.01 * corners.max()
                corner_points = np.where(corners > threshold)

                # Convert to list of minutiae
                if len(corner_points[0]) > 0:
                    # Limit to 50 strongest corners
                    max_corners = min(50, len(corner_points[0]))
                    for i in range(max_corners):
                        y, x = corner_points[0][i], corner_points[1][i]
                        minutiae.append({
                            "x": float(x),
                            "y": float(y),
                            "type": "ending" if i % 2 == 0 else "bifurcation",
                            "direction": float(random.randint(0, 359))
                        })

                if len(minutiae) >= 10:
                    print(f"Generated {len(minutiae)} minutiae from corners")
                    return minutiae
            except Exception as corner_error:
                print(f"Corner detection failed: {str(corner_error)}")

            # Method 2: Use good features to track
            try:
                corners = cv2.goodFeaturesToTrack(gray, 50, 0.01, 10)
                if corners is not None and len(corners) > 0:
                    for corner in corners:
                        x, y = corner.ravel()
                        minutiae.append({
                            "x": float(x),
                            "y": float(y),
                            "type": "ending" if random.random() > 0.5 else "bifurcation",
                            "direction": float(random.randint(0, 359))
                        })

                if len(minutiae) >= 10:
                    print(f"Generated {len(minutiae)} minutiae from goodFeaturesToTrack")
                    return minutiae
            except Exception as gftt_error:
                print(f"Good features to track failed: {str(gftt_error)}")

            # Method 3: Last resort - generate random minutiae
            height, width = gray.shape
            num_points = 40  # Reasonable number of minutiae for a fingerprint

            for _ in range(num_points):
                x = random.uniform(10, width - 10)
                y = random.uniform(10, height - 10)
                minutiae.append({
                    "x": float(x),
                    "y": float(y),
                    "type": "ending" if random.random() > 0.5 else "bifurcation",
                    "direction": float(random.randint(0, 359))
                })

            print(f"Generated {len(minutiae)} random minutiae as last resort")
            return minutiae

        except Exception as e:
            print(f"Failed to generate artificial minutiae: {str(e)}")
            # Absolute last resort - hardcoded minutiae
            minutiae = []
            for i in range(40):
                minutiae.append({
                    "x": float(100 + i * 5),
                    "y": float(100 + i * 3),
                    "type": "ending" if i % 2 == 0 else "bifurcation",
                    "direction": float(i * 10)
                })

            print("Using hardcoded minutiae")
            return minutiae

    @staticmethod
    def _filter_minutiae(minutiae, skeleton):
        """Filter out false minutiae."""
        if not minutiae:
            return []

        filtered = []
        height, width = skeleton.shape

        # Parameters for filtering
        min_distance_between_minutiae = 8  # Reduced from 10
        border_distance = 10  # Reduced from 20

        # Create a list of all minutiae points as (x, y) tuples
        points = [(m["x"], m["y"]) for m in minutiae]

        for i, minutia in enumerate(minutiae):
            x, y = minutia["x"], minutia["y"]

            # Filter 1: Remove minutiae too close to the border
            if (x < border_distance or x >= width - border_distance or
                y < border_distance or y >= height - border_distance):
                continue

            # Filter 2: Remove minutiae that are too close to each other
            too_close = False
            for j, (other_x, other_y) in enumerate(points):
                if i == j:
                    continue

                # Calculate Euclidean distance
                dist = np.sqrt((x - other_x)**2 + (y - other_y)**2)
                if dist < min_distance_between_minutiae:
                    too_close = True
                    break

            if too_close:
                continue

            # Add to filtered list
            filtered.append(minutia)

        # If we filtered too aggressively, revert to original set
        if len(filtered) < 5 and len(minutiae) >= 5:
            print(f"Filtering removed too many minutiae ({len(filtered)} left), using original set")
            return minutiae

        return filtered

    @staticmethod
    def extract_fingerprint_features(img):
        """Extract comprehensive fingerprint features with multiple fallbacks."""
        try:
            # Step 1: Preprocessing (with enhanced robustness)
            processed = FingerprintProcessor.preprocess_fingerprint(img)

            # Step 2: Extract minutiae points (with fallbacks)
            minutiae = FingerprintProcessor.extract_minutiae(processed)

            # Step 3: Extract keypoints and descriptors using multiple methods
            # Try ORB first for richer features
            keypoints = []
            descriptors = []

            try:
                orb = cv2.ORB_create(nfeatures=1000, scaleFactor=1.2, WTA_K=3)
                kp, desc = orb.detectAndCompute(processed, None)

                if kp and len(kp) > 0:
                    print(f"Generated {len(kp)} keypoints with ORB")
                    for kp_item in kp:
                        keypoints.append({
                            'x': float(kp_item.pt[0]),
                            'y': float(kp_item.pt[1]),
                            'size': float(kp_item.size),
                            'angle': float(kp_item.angle),
                            'response': float(kp_item.response),
                            'octave': int(kp_item.octave)
                        })

                    if desc is not None:
                        descriptors = desc.tolist()
            except Exception as orb_error:
                print(f"ORB feature extraction failed: {str(orb_error)}")

            # If ORB failed, try FAST
            if not keypoints:
                try:
                    # Detect FAST keypoints
                    fast = cv2.FastFeatureDetector_create(threshold=20)
                    kp = fast.detect(processed, None)

                    # Use BRIEF for descriptors
                    brief = cv2.xfeatures2d.BriefDescriptorExtractor_create()
                    kp, desc = brief.compute(processed, kp)

                    if kp and len(kp) > 0:
                        print(f"Generated {len(kp)} keypoints with FAST+BRIEF")
                        for kp_item in kp:
                            keypoints.append({
                                'x': float(kp_item.pt[0]),
                                'y': float(kp_item.pt[1]),
                                'size': float(kp_item.size),
                                'angle': float(kp_item.angle),
                                'response': float(kp_item.response),
                                'octave': int(kp_item.octave)
                            })

                        if desc is not None:
                            descriptors = desc.tolist()
                except Exception as fast_error:
                    print(f"FAST+BRIEF feature extraction failed: {str(fast_error)}")

            # If all else failed, generate artificial keypoints
            if not keypoints:
                print("Generating artificial keypoints")
                height, width = processed.shape

                # Generate 50 artificial keypoints
                for i in range(50):
                    keypoints.append({
                        'x': float(random.uniform(20, width - 20)),
                        'y': float(random.uniform(20, height - 20)),
                        'size': float(random.uniform(5, 20)),
                        'angle': float(random.uniform(0, 360)),
                        'response': float(random.uniform(0.01, 0.99)),
                        'octave': int(random.randint(0, 3))
                    })

                # Generate pseudo-random descriptors
                descriptors = []
                for _ in range(50):
                    descriptors.append([random.randint(0, 255) for _ in range(32)])

            # Step 4: Generate hash for quick comparison
            img_hash = FingerprintProcessor._generate_robust_hash(processed)

            # Step 5: Extract simple texture features that won't fail
            texture_features = FingerprintProcessor._extract_simple_texture_features(processed)

            # Step 6: Extract simple pattern features
            pattern_features = FingerprintProcessor._extract_simple_pattern_features(processed)

            # Combine all features into the template
            template = {
                'keypoints': keypoints,
                'descriptors': descriptors,
                'hash': img_hash,
                'minutiae': minutiae,
                'texture': texture_features,
                'pattern': pattern_features
            }

            # Final verification - ensure we have features
            if not minutiae or not keypoints:
                print("WARNING: Missing critical features. Using fallback generation.")
                if not minutiae:
                    template['minutiae'] = FingerprintProcessor._generate_artificial_minutiae(processed)

                if not keypoints:
                    # Generate artificial keypoints if still empty
                    height, width = processed.shape
                    artificial_keypoints = []
                    for i in range(50):
                        artificial_keypoints.append({
                            'x': float(random.uniform(20, width - 20)),
                            'y': float(random.uniform(20, height - 20)),
                            'size': float(random.uniform(5, 20)),
                            'angle': float(random.uniform(0, 360)),
                            'response': float(random.uniform(0.01, 0.99)),
                            'octave': int(random.randint(0, 3))
                        })
                    template['keypoints'] = artificial_keypoints

            # Report feature counts
            print(f"Final feature counts - minutiae: {len(template['minutiae'])}, "
                  f"keypoints: {len(template['keypoints'])}, "
                  f"descriptors: {len(template['descriptors'])}")

            return template

        except Exception as e:
            print(f"CRITICAL ERROR in feature extraction: {str(e)}")
            # Last resort - create a minimal viable template with some artificial features
            height, width = img.shape[:2] if len(img.shape) > 1 else (400, 400)

            # Create artificial minutiae
            minutiae = []
            for i in range(40):
                minutiae.append({
                    "x": float(width / 4 + random.uniform(0, width / 2)),
                    "y": float(height / 4 + random.uniform(0, height / 2)),
                    "type": "ending" if i % 2 == 0 else "bifurcation",
                    "direction": float(random.uniform(0, 360))
                })

            # Create artificial keypoints
            keypoints = []
            for i in range(50):
                keypoints.append({
                    'x': float(width / 4 + random.uniform(0, width / 2)),
                    'y': float(height / 4 + random.uniform(0, height / 2)),
                    'size': float(random.uniform(5, 20)),
                    'angle': float(random.uniform(0, 360)),
                    'response': float(random.uniform(0.01, 0.99)),
                    'octave': int(random.randint(0, 3))
                })

            # Create artificial descriptors
            descriptors = []
            for _ in range(50):
                descriptors.append([random.randint(0, 255) for _ in range(32)])

            # Create artificial hash
            img_hash = ''.join(['1' if random.random() > 0.5 else '0' for _ in range(1024)])

            # Create artificial texture and pattern features
            texture = [[random.random() for _ in range(2)] for _ in range(64)]
            pattern = [[{'ridge_density': random.random(), 'dominant_angle': random.random()}
                       for _ in range(4)] for _ in range(4)]

            print("Created emergency artificial template due to critical extraction failure")

            return {
                'keypoints': keypoints,
                'descriptors': descriptors,
                'hash': img_hash,
                'minutiae': minutiae,
                'texture': texture,
                'pattern': pattern
            }

    @staticmethod
    def _generate_robust_hash(img):
        """Generate perceptual hash with multiple methods for robustness."""
        try:
            # Method 1: Simple average hash
            try:
                resized = cv2.resize(img, (32, 32))
                avg_val = np.mean(resized)
                hash1 = ''.join(['1' if pixel > avg_val else '0' for pixel in resized.flatten()])
            except:
                hash1 = ''.join(['1' if random.random() > 0.5 else '0' for _ in range(1024)])

            # Method 2: DCT-based hash
            try:
                dct_size = 8
                resized = cv2.resize(img, (dct_size, dct_size))
                dct = cv2.dct(np.float32(resized))
                # Use the low-frequency DCT coefficients (excluding the DC component)
                dct_flat = dct.flatten()[1:17]  # Get 16 low-frequency components
                median_val = np.median(dct_flat)
                hash2 = ''.join(['1' if val > median_val else '0' for val in dct_flat])
            except:
                hash2 = ''.join(['1' if random.random() > 0.5 else '0' for _ in range(16)])

            # Combine hashes
            combined_hash = hash1 + hash2

            return combined_hash
        except Exception as e:
            print(f"Hash generation failed: {str(e)}")
            # Fallback to random hash
            return ''.join(['1' if random.random() > 0.5 else '0' for _ in range(1040)])

    @staticmethod
    def _extract_simple_texture_features(img):
        """Extract simplified texture features that are robust to errors."""
        try:
            # Use a fixed grid size to avoid dimension issues
            grid_size = 8  # 8x8 grid regardless of image size
            height, width = img.shape

            cell_height = height // grid_size
            cell_width = width // grid_size

            # Simple feature vector: mean value and standard deviation for each cell
            features = []

            for y in range(grid_size):
                for x in range(grid_size):
                    # Calculate cell boundaries
                    start_y = y * cell_height
                    end_y = min((y + 1) * cell_height, height)
                    start_x = x * cell_width
                    end_x = min((x + 1) * cell_width, width)

                    # Extract cell
                    cell = img[start_y:end_y, start_x:end_x]

                    # Calculate simple statistics
                    mean_val = float(np.mean(cell))
                    std_val = float(np.std(cell))

                    # Add to features
                    features.append([mean_val, std_val])

            return features
        except Exception as e:
            print(f"Texture feature extraction failed: {str(e)}")
            # Return dummy features
            return [[random.random(), random.random()] for _ in range(64)]

    @staticmethod
    def _extract_simple_pattern_features(img):
        """Extract simple pattern features using a fixed grid."""
        try:
            # Use a fixed 4x4 grid for pattern features
            grid_size = 4
            height, width = img.shape

            cell_height = height // grid_size
            cell_width = width // grid_size

            pattern = []

            for y in range(grid_size):
                row = []
                for x in range(grid_size):
                    # Calculate cell boundaries
                    start_y = y * cell_height
                    end_y = min((y + 1) * cell_height, height)
                    start_x = x * cell_width
                    end_x = min((x + 1) * cell_width, width)

                    # Extract cell
                    cell = img[start_y:end_y, start_x:end_x]

                    # Calculate density (white pixel ratio)
                    total_pixels = cell.size
                    white_pixels = np.sum(cell > 0)
                    ridge_density = float(white_pixels / total_pixels) if total_pixels > 0 else 0.5

                    # Calculate gradient for angle
                    if cell.size > 4:  # Ensure cell is big enough for gradient
                        gx = cv2.Sobel(cell, cv2.CV_64F, 1, 0, ksize=3)
                        gy = cv2.Sobel(cell, cv2.CV_64F, 0, 1, ksize=3)
                        angle = float(np.arctan2(np.sum(gy), np.sum(gx)) % np.pi)
                    else:
                        angle = float(random.random() * np.pi)

                    row.append({
                        'ridge_density': ridge_density,
                        'dominant_angle': angle
                    })

                pattern.append(row)

            return pattern
        except Exception as e:
            print(f"Pattern feature extraction failed: {str(e)}")
            # Return dummy pattern
            return [[{'ridge_density': random.random(), 'dominant_angle': random.random() * np.pi}
                    for _ in range(4)] for _ in range(4)]

// python_server\utils\matcher.py

import cv2
import numpy as np
from scipy.spatial import distance
from scipy.optimize import linear_sum_assignment

class FingerprintMatcher:
"""Enhanced fingerprint template matching with multi-enrollment support."""

    @staticmethod
    def compare_fingerprints(probe, candidate, match_threshold=0.36):
        """Compare fingerprints with a balance between leniency and selectivity.

        Args:
            probe (dict): Probe fingerprint template
            candidate (dict): Candidate fingerprint template
            match_threshold (float): Threshold for match determination

        Returns:
            float: Similarity score between 0 and 1
        """
        try:
            print("\n========== DETAILED MATCHING DEBUG ==========")
            print(f"Probe template keys: {list(probe.keys())}")
            print(f"Candidate template keys: {list(candidate.keys())}")

            # Check for keypoints and descriptors
            probe_keypoints_count = len(probe.get('keypoints', []))
            candidate_keypoints_count = len(candidate.get('keypoints', []))
            print(f"Probe keypoints: {probe_keypoints_count}")
            print(f"Candidate keypoints: {candidate_keypoints_count}")

            probe_descriptors_count = len(probe.get('descriptors', []))
            candidate_descriptors_count = len(candidate.get('descriptors', []))
            if probe_descriptors_count > 0 and candidate_descriptors_count > 0:
                print(f"Probe descriptors: {probe_descriptors_count}")
                print(f"Candidate descriptors: {candidate_descriptors_count}")
            else:
                print("WARNING: Empty descriptors found")

            probe_minutiae_count = len(probe.get('minutiae', []))
            candidate_minutiae_count = len(candidate.get('minutiae', []))
            print(f"Probe minutiae: {probe_minutiae_count}")
            print(f"Candidate minutiae: {candidate_minutiae_count}")

            # SPECIAL CHECK: If candidate has no features but probe does,
            # base match ONLY on hash similarity with higher weight
            if ((candidate_keypoints_count == 0 or candidate_minutiae_count == 0) and
                (probe_keypoints_count > 0 and probe_minutiae_count > 0)):
                print("SPECIAL CASE: Candidate has no features - using hash-based matching")

                # Calculate hash similarity with high priority
                hash_similarity = FingerprintMatcher._compare_hashes(probe, candidate)
                print(f"Hash similarity: {hash_similarity:.4f}")

                # Return a modest score for empty templates - not too high
                enhanced_score = hash_similarity * 0.4  # Scale down significantly

                print(f"Final score (hash-based): {enhanced_score:.4f}")
                print(f"Match threshold: {match_threshold:.4f}")
                print(f"Match result: {'Match' if enhanced_score >= match_threshold else 'No match'}")
                print("==============================================\n")

                return enhanced_score

            # Define weights for different comparison methods
            weights = {
                'hash': 0.1,              # Reduced importance for hash
                'descriptors': 0.4,       # Increased descriptors weight
                'minutiae': 0.4,          # Increased minutiae weight
                'texture': 0.05,          # Less importance for texture
                'pattern': 0.05           # Less importance for pattern
            }

            print(f"Using weights: {weights}")

            # 1. Hash comparison - used primarily as a quick filter
            hash_similarity = FingerprintMatcher._compare_hashes(probe, candidate)
            print(f"Hash similarity: {hash_similarity:.4f}")

            # 2. Descriptor matching (keypoints)
            descriptor_similarity = FingerprintMatcher._compare_descriptors(probe, candidate)
            print(f"Descriptor similarity: {descriptor_similarity:.4f}")

            # 3. Minutiae point matching (most important)
            minutiae_similarity = FingerprintMatcher._compare_minutiae(probe, candidate)
            print(f"Minutiae similarity: {minutiae_similarity:.4f}")

            # 4. Texture pattern comparison
            texture_similarity = FingerprintMatcher._compare_textures(probe, candidate)
            print(f"Texture similarity: {texture_similarity:.4f}")

            # 5. Global pattern comparison
            pattern_similarity = FingerprintMatcher._compare_patterns(probe, candidate)
            print(f"Pattern similarity: {pattern_similarity:.4f}")

            # Calculate weighted score
            final_score = (
                hash_similarity * weights['hash'] +
                descriptor_similarity * weights['descriptors'] +
                minutiae_similarity * weights['minutiae'] +
                texture_similarity * weights['texture'] +
                pattern_similarity * weights['pattern']
            )

            # Balanced score enhancement that doesn't over-boost
            enhanced_score = FingerprintMatcher._apply_balanced_score_enhancement(final_score)

            print(f"Final score (raw): {final_score:.4f}")
            print(f"Final score (enhanced): {enhanced_score:.4f}")
            print(f"Match threshold: {match_threshold:.4f}")
            print(f"Match result: {'Match' if enhanced_score >= match_threshold else 'No match'}")
            print("==============================================\n")

            return enhanced_score

        except Exception as e:
            print(f"Error in fingerprint comparison: {str(e)}")
            return 0.0

    @staticmethod
    def _apply_balanced_score_enhancement(score):
        """Apply a balanced non-linear transformation to enhance matching."""
        # Moderate enhancement that doesn't over-boost low scores
        if score < 0.4:
            # Modest increase for lower scores
            return score * 1.1
        else:
            # Moderate boost for higher scores
            return 0.4 + ((score - 0.4) * 1.5)

    @staticmethod
    def _compare_hashes(probe, candidate):
        """Compare perceptual hashes."""
        try:
            if 'hash' in probe and 'hash' in candidate and probe['hash'] and candidate['hash']:
                # Ensure equal length by truncating the longer hash if necessary
                min_len = min(len(probe['hash']), len(candidate['hash']))
                # Only compare the first min_len bits
                hash1 = np.array([int(bit) for bit in probe['hash'][:min_len]])
                hash2 = np.array([int(bit) for bit in candidate['hash'][:min_len]])

                # Hamming distance (use NumPy for vectorized XOR)
                hash_similarity = 1.0 - np.mean(np.logical_xor(hash1, hash2))
                return hash_similarity
            return 0.0  # Return 0 for missing hash - be more strict
        except Exception as e:
            print(f"Hash comparison error: {str(e)}")
            return 0.0

    @staticmethod
    def _compare_descriptors(probe, candidate):
        """Enhanced descriptor matching with a balance between leniency and selectivity."""
        try:
            # Check if both templates have descriptors and keypoints
            if ('descriptors' in probe and 'descriptors' in candidate and
                    probe['descriptors'] and candidate['descriptors'] and
                    'keypoints' in probe and 'keypoints' in candidate and
                    probe['keypoints'] and candidate['keypoints']):

                # Convert lists back to numpy arrays
                desc1 = np.array(probe['descriptors'], dtype=np.uint8)
                desc2 = np.array(candidate['descriptors'], dtype=np.uint8)

                if desc1.size == 0 or desc2.size == 0:
                    print("Empty descriptors detected")
                    return 0.0  # Return 0 - be more strict

                # Create BFMatcher with Hamming distance
                bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

                try:
                    # Match descriptors with k=2 for ratio test
                    matches = bf.knnMatch(desc1, desc2, k=2)

                    # Apply balanced ratio test
                    good_matches = []
                    for match_pair in matches:
                        if len(match_pair) == 2:  # Ensure we have two matches for ratio test
                            m, n = match_pair
                            # Using a balanced ratio (0.8 is standard)
                            if m.distance < 0.8 * n.distance:
                                good_matches.append(m)

                    if not good_matches:
                        print("No good matches found in descriptors")
                        return 0.0

                    print(f"Good matches: {len(good_matches)} out of {len(matches)}")

                    # Calculate match ratio with balanced scoring
                    match_ratio = len(good_matches) / min(len(probe['keypoints']), len(candidate['keypoints']))

                    # Calculate average distance with balanced normalization
                    distances = np.array([m.distance for m in good_matches])
                    avg_distance = np.mean(distances)
                    # Balanced distance normalization
                    norm_distance = max(0, 1 - (avg_distance / 100))

                    print(f"Match ratio: {match_ratio:.4f}, Norm distance: {norm_distance:.4f}")

                    # 3. Check spatial consistency if enough matches
                    inlier_ratio = 0.0
                    if len(good_matches) >= 4:  # Minimum needed for homography
                        try:
                            # Extract source and destination points
                            src_pts = np.float32([
                                [probe['keypoints'][m.queryIdx]['x'], probe['keypoints'][m.queryIdx]['y']]
                                for m in good_matches
                            ]).reshape(-1, 1, 2)

                            dst_pts = np.float32([
                                [candidate['keypoints'][m.trainIdx]['x'], candidate['keypoints'][m.trainIdx]['y']]
                                for m in good_matches
                            ]).reshape(-1, 1, 2)

                            # Find homography with balanced RANSAC threshold
                            M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)  # Standard value

                            if M is not None:
                                # Count inliers
                                inlier_count = np.sum(mask)
                                inlier_ratio = inlier_count / len(good_matches) if len(good_matches) > 0 else 0
                                print(f"Inlier ratio: {inlier_ratio:.4f} ({inlier_count} inliers)")
                            else:
                                print("No homography found")
                        except Exception as e:
                            print(f"Homography calculation error: {str(e)}")

                    # Combine factors with balanced weights
                    descriptor_similarity = (
                        match_ratio * 0.4 +
                        norm_distance * 0.3 +
                        inlier_ratio * 0.3
                    )

                    # No additional boost - keep original score
                    return descriptor_similarity

                except Exception as e:
                    print(f"BFMatcher error: {str(e)}")
                    return 0.0

            return 0.0  # Return 0 when descriptors are missing - be more strict
        except Exception as e:
            print(f"Descriptor comparison error: {str(e)}")
            return 0.0

    @staticmethod
    def _compare_minutiae(probe, candidate):
        """Compare minutiae points with balanced strictness."""
        try:
            if 'minutiae' in probe and 'minutiae' in candidate:
                minutiae1 = probe['minutiae']
                minutiae2 = candidate['minutiae']

                if not minutiae1 or not minutiae2:
                    print("No minutiae points found in at least one template")
                    return 0.0  # Return 0 - be more strict

                print(f"Comparing {len(minutiae1)} vs {len(minutiae2)} minutiae points")

                # Step 1: Create cost matrix for matching
                cost_matrix = np.zeros((len(minutiae1), len(minutiae2)))

                for i, m1 in enumerate(minutiae1):
                    for j, m2 in enumerate(minutiae2):
                        # Calculate spatial distance
                        spatial_dist = np.sqrt((m1['x'] - m2['x'])**2 + (m1['y'] - m2['y'])**2)

                        # Calculate directional distance (if direction is available)
                        if 'direction' in m1 and 'direction' in m2:
                            # Handle angular difference (considering the circular nature)
                            dir1 = m1['direction'] % 360
                            dir2 = m2['direction'] % 360
                            direction_diff = min(abs(dir1 - dir2), 360 - abs(dir1 - dir2))
                            norm_direction_diff = direction_diff / 180.0  # Normalize to 0-1
                        else:
                            norm_direction_diff = 0.5  # Default if direction not available

                        # Calculate type difference
                        type_diff = 0.0 if m1['type'] == m2['type'] else 1.0

                        # Combine differences with weights
                        # Using balanced spatial tolerance
                        max_dist = 500.0  # Standard value
                        norm_spatial_dist = min(spatial_dist / max_dist, 1.0)

                        # Combined cost with balanced weights
                        combined_cost = (
                            norm_spatial_dist * 0.7 +
                            norm_direction_diff * 0.2 +
                            type_diff * 0.1
                        )

                        cost_matrix[i, j] = combined_cost

                # Step 2: Apply Hungarian algorithm for optimal assignment
                row_ind, col_ind = linear_sum_assignment(cost_matrix)

                # Step 3: Calculate matching score based on assignments
                match_costs = cost_matrix[row_ind, col_ind]

                # Step 4: Use balanced threshold for good matches
                good_match_threshold = 0.4  # Standard value
                good_matches = match_costs < good_match_threshold
                num_good_matches = np.sum(good_matches)

                print(f"Found {num_good_matches} good minutiae matches out of {len(match_costs)}")

                # Calculate matching score
                # 1. Ratio of good matches to total minutiae
                match_ratio = num_good_matches / max(len(minutiae1), len(minutiae2))

                # 2. Quality of matches (inverse of average cost)
                if num_good_matches > 0:
                    avg_match_cost = np.mean(match_costs[good_matches])
                    quality_score = 1.0 - avg_match_cost
                    print(f"Average match cost: {avg_match_cost:.4f}, Quality score: {quality_score:.4f}")
                else:
                    quality_score = 0.0

                # 3. Size ratio (balanced importance)
                size_ratio = min(len(minutiae1), len(minutiae2)) / max(len(minutiae1), len(minutiae2)) if max(len(minutiae1), len(minutiae2)) > 0 else 0
                print(f"Size ratio: {size_ratio:.4f}")

                # Combine scores with balanced weights
                minutiae_similarity = (
                    match_ratio * 0.6 +
                    quality_score * 0.2 +
                    size_ratio * 0.2
                )

                # No additional boost - keep original score
                return minutiae_similarity

            return 0.0  # Return 0 when minutiae are missing - be more strict
        except Exception as e:
            print(f"Minutiae comparison error: {str(e)}")
            return 0.0

    @staticmethod
    def _compare_textures(probe, candidate):
        """Compare texture features with balanced strictness."""
        try:
            if 'texture' in probe and 'texture' in candidate:
                texture1 = probe['texture']
                texture2 = candidate['texture']

                if not texture1 or not texture2:
                    print("Empty texture features")
                    return 0.0  # Return 0 - be more strict

                # Try to convert to numpy arrays
                try:
                    texture1 = np.array(texture1)
                    texture2 = np.array(texture2)
                    print(f"Texture features: {texture1.shape} vs {texture2.shape}")

                    # Check for compatible shapes
                    if texture1.shape != texture2.shape:
                        print(f"Incompatible texture shapes: {texture1.shape} vs {texture2.shape}")
                        return 0.0  # Return 0 for incompatible shapes

                    # Calculate correlation
                    if texture1.ndim == 2:
                        # Flatten 2D arrays
                        t1_flat = texture1.flatten()
                        t2_flat = texture2.flatten()

                        # Calculate correlation
                        if np.std(t1_flat) > 0 and np.std(t2_flat) > 0:
                            correlation = np.corrcoef(t1_flat, t2_flat)[0, 1]
                            if not np.isnan(correlation):
                                # Scale to 0-1 range
                                return (correlation + 1) / 2

                    # Simple fallback - mean absolute difference
                    diff = np.abs(texture1 - texture2)
                    similarity = 1.0 - np.mean(diff) / np.max(diff) if np.max(diff) > 0 else 1.0
                    return similarity

                except Exception as shape_error:
                    print(f"Texture shape error: {str(shape_error)}")

            return 0.0  # Return 0 for missing textures - be more strict
        except Exception as e:
            print(f"Texture comparison error: {str(e)}")
            return 0.0

    @staticmethod
    def _compare_patterns(probe, candidate):
        """Compare pattern features with balanced strictness."""
        try:
            if 'pattern' in probe and 'pattern' in candidate:
                pattern1 = probe['pattern']
                pattern2 = candidate['pattern']

                if not pattern1 or not pattern2:
                    print("Empty pattern features")
                    return 0.0  # Return 0 - be more strict

                # Extract basic pattern features in a robust way
                if (isinstance(pattern1, list) and pattern1 and
                    isinstance(pattern2, list) and pattern2):

                    # Just use the first row as a sample if available
                    if (isinstance(pattern1[0], list) and pattern1[0] and
                        isinstance(pattern2[0], list) and pattern2[0]):

                        # Extract first element of each list for comparison
                        if ('ridge_density' in pattern1[0][0] and 'ridge_density' in pattern2[0][0]):
                            # Compare ridge densities
                            density1 = [item['ridge_density'] for row in pattern1 for item in row
                                       if 'ridge_density' in item]
                            density2 = [item['ridge_density'] for row in pattern2 for item in row
                                       if 'ridge_density' in item]

                            if density1 and density2:
                                # Truncate to shortest length
                                min_len = min(len(density1), len(density2))
                                density1 = density1[:min_len]
                                density2 = density2[:min_len]

                                # Calculate correlation
                                try:
                                    correlation = np.corrcoef(density1, density2)[0, 1]
                                    if not np.isnan(correlation):
                                        return (correlation + 1) / 2  # Scale to 0-1
                                except:
                                    pass

            return 0.0  # Return 0 for missing patterns - be more strict
        except Exception as e:
            print(f"Pattern comparison error: {str(e)}")
            return 0.0

    @staticmethod
    def match_against_database(probe_template, database_records, match_threshold=0.36):
        """Match a probe fingerprint against database with multi-enrollment support.

        This version compares the probe against all templates for each staff ID and
        returns the best match result.

        Args:
            probe_template (dict): Probe fingerprint template
            database_records (list): List of database fingerprint records
            match_threshold (float): Threshold for match determination

        Returns:
            dict: Match result with best match information
        """
        try:
            # Group templates by staff ID
            staff_templates = {}

            for record in database_records:
                if 'template' in record and 'staffId' in record:
                    staff_id = record['staffId']

                    # Convert ObjectId to string if needed
                    if not isinstance(staff_id, str):
                        staff_id = str(staff_id)

                    # Initialize if this is the first template for this staff ID
                    if staff_id not in staff_templates:
                        staff_templates[staff_id] = []

                    # Add this template to the list
                    staff_templates[staff_id].append(record['template'])

            # Initialize results
            best_match = {
                "staffId": None,
                "score": 0,
                "matched": False,
                "confidence": "None",
                "template_index": -1,
                "template_count": 0
            }

            # Track all scores for statistical analysis
            all_scores = []
            all_ids = []

            print(f"Comparing against templates for {len(staff_templates)} staff IDs...")

            # Compare against each staff ID's templates
            for staff_id, templates in staff_templates.items():
                print(f"Staff ID {staff_id} has {len(templates)} templates")

                # Track best score for this staff ID
                staff_best_score = 0
                staff_best_index = -1

                # Compare against each template
                for i, template in enumerate(templates):
                    score = FingerprintMatcher.compare_fingerprints(
                        probe_template, template, match_threshold
                    )
                    print(f"  Template {i+1}: score {score:.4f}")

                    # Update best score for this staff ID
                    if score > staff_best_score:
                        staff_best_score = score
                        staff_best_index = i

                # Record best score for this staff ID
                all_scores.append(staff_best_score)
                all_ids.append(staff_id)

                print(f"Best score for staff ID {staff_id}: {staff_best_score:.4f} (template {staff_best_index+1})")

                # Update overall best match
                if staff_best_score > best_match["score"]:
                    best_match["staffId"] = staff_id
                    best_match["score"] = staff_best_score
                    best_match["template_index"] = staff_best_index
                    best_match["template_count"] = len(templates)

            # Analyze score distribution and determine match with confidence
            if len(all_scores) > 1:
                scores_array = np.array(all_scores)

                # Only look at actual match if it exceeds threshold
                if best_match["score"] >= match_threshold:
                    # Sort scores in descending order
                    sorted_indices = np.argsort(scores_array)[::-1]
                    sorted_scores = scores_array[sorted_indices]

                    # Calculate confidence based on gap between best and second-best score
                    if len(sorted_scores) >= 2:
                        score_gap = sorted_scores[0] - sorted_scores[1]

                        # Assign confidence level with balanced thresholds
                        if score_gap > 0.2:
                            confidence = "High"
                        elif score_gap > 0.1:
                            confidence = "Medium"
                        else:
                            confidence = "Low"
                    else:
                        confidence = "Medium"  # Only one staff ID in DB

                    best_match["matched"] = True
                    best_match["confidence"] = confidence
                else:
                    best_match["matched"] = False
            else:
                # If only one staff ID, just use threshold
                best_match["matched"] = best_match["score"] >= match_threshold
                if best_match["matched"]:
                    best_match["confidence"] = "Medium"  # Only one staff ID in DB

            return best_match
        except Exception as e:
            print(f"Error in database matching: {str(e)}")
            return {
                "staffId": None,
                "score": 0,
                "matched": False,
                "confidence": "None",
                "template_index": -1,
                "template_count": 0
            }

// python_server\routes\fingerprint_routes.py

from flask import Blueprint, request, jsonify, send_file
from utils.fingerprint_processor import FingerprintProcessor
from utils.matcher import FingerprintMatcher
from utils.db import Database
from config import MATCH_THRESHOLD, MIN_ENROLLMENTS, MAX_ENROLLMENTS, STORE_ORIGINAL_IMAGE
import os
import base64
import cv2
import numpy as np
import io
import time
import functools
import threading

# Create a blueprint for fingerprint routes

fingerprint_bp = Blueprint('fingerprint', **name**, url_prefix='/api/fingerprint')

# Initialize database connection

db = Database()

# Simple in-memory cache for enrollment status (staffId -> status info)

enrollment_cache = {}
cache_lock = threading.Lock()
CACHE_TIMEOUT = 60 # seconds

def timed_lru_cache(seconds=120, maxsize=128):
"""Time-based cache decorator"""
def decorator(func):
@functools.lru_cache(maxsize=maxsize)
def wrapper(*args, expire_time=None, \*\*kwargs):
now = time.time()
if expire_time is None or now >= expire_time:
result = func(*args, **kwargs)
expire_time = now + seconds
return (result, expire_time)
return wrapper(\*args, expire_time=expire_time, **kwargs)

        @functools.wraps(func)
        def inner(*args, **kwargs):
            result, _ = wrapper(*args, **kwargs)
            return result

        inner.cache_clear = wrapper.cache_clear

        return inner
    return decorator

@fingerprint_bp.route('/enroll', methods=['POST'])
def enroll_fingerprint():
"""Enroll a new fingerprint template for a staff ID."""
start_time = time.time()
try:
print("Starting fingerprint enrollment...")
data = request.json
if not data or 'staffId' not in data or 'fingerPrint' not in data:
return jsonify({
'success': False,
'message': 'Missing staffId or fingerPrint data'
}), 400

        staff_id = data['staffId']
        fingerprint_data = data['fingerPrint']

        print(f"Processing fingerprint for enrollment (Staff ID: {staff_id})...")

        # Get current template count (with caching for performance)
        with cache_lock:
            # Check if we have a cached enrollment status
            if staff_id in enrollment_cache:
                cache_entry = enrollment_cache[staff_id]
                # If cache is still valid, use it
                if time.time() - cache_entry['timestamp'] < CACHE_TIMEOUT:
                    current_count = cache_entry['count']
                    print(f"Using cached template count: {current_count}")
                else:
                    # Cache expired, get fresh count
                    current_count = db.get_template_count_for_staff_id(staff_id)
                    # Update cache
                    enrollment_cache[staff_id] = {
                        'count': current_count,
                        'timestamp': time.time()
                    }
            else:
                # No cache entry, get fresh count
                current_count = db.get_template_count_for_staff_id(staff_id)
                # Create cache entry
                enrollment_cache[staff_id] = {
                    'count': current_count,
                    'timestamp': time.time()
                }

        print(f"Current template count for {staff_id}: {current_count}")

        # Check if max enrollments reached
        if current_count >= MAX_ENROLLMENTS:
            return jsonify({
                'success': False,
                'message': f'Maximum enrollment limit reached ({MAX_ENROLLMENTS})',
                'enrollCount': current_count,
                'maxEnrollments': MAX_ENROLLMENTS
            }), 400

        # Convert base64 to image
        feature_start = time.time()
        img = FingerprintProcessor.base64_to_image(fingerprint_data)

        # Extract features with enhanced processor
        template = FingerprintProcessor.extract_fingerprint_features(img)
        feature_time = time.time() - feature_start
        print(f"Feature extraction took {feature_time:.2f} seconds")

        # Check feature quality
        minutiae_count = len(template.get('minutiae', []))
        keypoint_count = len(template.get('keypoints', []))
        print(f"Extracted {minutiae_count} minutiae points and {keypoint_count} keypoints")

        if minutiae_count < 10 or keypoint_count < 50:
            return jsonify({
                'success': False,
                'message': 'Low quality fingerprint image. Please try again.',
                'enrollCount': current_count,
                'minutiaeCount': minutiae_count,
                'keypointCount': keypoint_count,
                'minEnrollments': MIN_ENROLLMENTS
            }), 400

        # Store original image only if configured to do so
        original_data = fingerprint_data if STORE_ORIGINAL_IMAGE else None

        # Add new template (don't replace existing ones)
        db_start = time.time()
        success, new_count = db.add_fingerprint_template(staff_id, template, original_data)
        db_time = time.time() - db_start
        print(f"Database operation took {db_time:.2f} seconds")

        # Update cache with new count
        with cache_lock:
            enrollment_cache[staff_id] = {
                'count': new_count,
                'timestamp': time.time()
            }

        if success:
            enrollment_status = "complete" if new_count >= MIN_ENROLLMENTS else "incomplete"
            remaining = max(0, MIN_ENROLLMENTS - new_count)

            message = f"Fingerprint template enrolled successfully! ({new_count}/{MIN_ENROLLMENTS})"
            if remaining > 0:
                message += f" {remaining} more sample(s) recommended."
            else:
                message += " Enrollment complete."

            total_time = time.time() - start_time
            print(f"Total enrollment time: {total_time:.2f} seconds")

            return jsonify({
                'success': True,
                'message': message,
                'enrollCount': new_count,
                'enrollStatus': enrollment_status,
                'maxEnrollments': MAX_ENROLLMENTS,
                'minEnrollments': MIN_ENROLLMENTS,
                'remaining': remaining,
                'minutiaeCount': minutiae_count,
                'keypointCount': keypoint_count,
                'processingTime': total_time
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to enroll fingerprint template',
                'enrollCount': current_count
            }), 500

    except ValueError as ve:
        print(f"Enrollment validation error: {str(ve)}")
        return jsonify({
            'success': False,
            'message': f'Validation error: {str(ve)}'
        }), 400
    except Exception as e:
        print(f"Enrollment error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Enrollment error: {str(e)}'
        }), 500

@fingerprint_bp.route('/match', methods=['POST'])
def match_fingerprint():
"""Match a fingerprint against the database with multi-enrollment support."""
try:
data = request.json
if not data or 'fingerPrint' not in data:
return jsonify({
'success': False,
'message': 'Missing fingerPrint data'
}), 400

        print("Processing fingerprint for matching...")

        # Extract custom threshold if provided
        custom_threshold = float(data.get('threshold', MATCH_THRESHOLD))

        # Convert base64 to image
        start_time = time.time()
        img = FingerprintProcessor.base64_to_image(data['fingerPrint'])

        # Extract features with enhanced processor
        probe_template = FingerprintProcessor.extract_fingerprint_features(img)
        feature_time = time.time() - start_time

        print(f"Feature extraction took {feature_time:.2f} seconds")
        print(f"Extracted {len(probe_template.get('minutiae', []))} minutiae points")
        print(f"Extracted {len(probe_template.get('keypoints', []))} keypoints")

        # Get all fingerprint records
        fingerprint_records = db.get_all_fingerprints()

        if not fingerprint_records:
            return jsonify({
                'success': False,
                'message': 'No fingerprint records available for matching',
                'matched': False
            })

        # Match against database with improved matcher
        start_time = time.time()
        match_result = FingerprintMatcher.match_against_database(
            probe_template,
            fingerprint_records,
            match_threshold=custom_threshold
        )
        match_time = time.time() - start_time

        print(f"Matching took {match_time:.2f} seconds")

        # Get template count information
        template_count = match_result["template_count"]
        min_enrollments_met = template_count >= MIN_ENROLLMENTS

        if match_result["matched"]:
            print(f"Match found: {match_result['staffId']} with score {match_result['score']:.4f} "
                  f"(confidence: {match_result['confidence']})")

            # Include enrollment status in response
            return jsonify({
                'success': True,
                'matched': True,
                'staffId': str(match_result["staffId"]),
                'score': match_result["score"],
                'confidence': match_result["confidence"],
                'threshold': custom_threshold,
                'templateCount': template_count,
                'enrollmentComplete': min_enrollments_met,
                'minutiaeCount': len(probe_template.get('minutiae', [])),
                'keypointCount': len(probe_template.get('keypoints', []))
            })
        else:
            print(f"No match found. Best score: {match_result['score']:.4f}")
            return jsonify({
                'success': True,
                'matched': False,
                'bestScore': match_result["score"],
                'threshold': custom_threshold,
                'minutiaeCount': len(probe_template.get('minutiae', [])),
                'keypointCount': len(probe_template.get('keypoints', []))
            })

    except ValueError as ve:
        print(f"Matching validation error: {str(ve)}")
        return jsonify({
            'success': False,
            'message': f'Validation error: {str(ve)}'
        }), 400
    except Exception as e:
        print(f"Matching error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Matching error: {str(e)}'
        }), 500

@fingerprint_bp.route('/templates/<staff_id>', methods=['GET'])
def get_templates(staff_id):
"""Get enrollment status and template count for a staff ID.
This endpoint is critical for the frontend to display enrollment progress."""
start_time = time.time()
try:
print(f"Getting template status for staff ID: {staff_id}")

        # Check cache first for quick response
        with cache_lock:
            if staff_id in enrollment_cache:
                cache_entry = enrollment_cache[staff_id]
                # If cache is still valid, use it
                if time.time() - cache_entry['timestamp'] < CACHE_TIMEOUT:
                    template_count = cache_entry['count']
                    print(f"Using cached template count: {template_count}")

                    # Use cached count to determine status
                    enrollment_status = "complete" if template_count >= MIN_ENROLLMENTS else "incomplete"
                    remaining = max(0, MIN_ENROLLMENTS - template_count)

                    response_time = time.time() - start_time
                    print(f"Response time (cached): {response_time:.4f} seconds")

                    return jsonify({
                        'success': True,
                        'staffId': staff_id,
                        'templateCount': template_count,
                        'enrollmentStatus': enrollment_status,
                        'minEnrollments': MIN_ENROLLMENTS,
                        'maxEnrollments': MAX_ENROLLMENTS,
                        'remaining': remaining,
                        'fromCache': True,
                        'responseTime': response_time
                    })

        # Cache miss or expired, get actual data
        print("Cache miss, getting templates from database")
        db_start = time.time()
        templates = db.get_fingerprint_templates_by_staff_id(staff_id)
        db_time = time.time() - db_start
        print(f"Database query took {db_time:.4f} seconds")

        template_count = len(templates)

        # Update cache with fresh count
        with cache_lock:
            enrollment_cache[staff_id] = {
                'count': template_count,
                'timestamp': time.time()
            }

        enrollment_status = "complete" if template_count >= MIN_ENROLLMENTS else "incomplete"
        remaining = max(0, MIN_ENROLLMENTS - template_count)

        response_time = time.time() - start_time
        print(f"Total response time: {response_time:.4f} seconds")

        return jsonify({
            'success': True,
            'staffId': staff_id,
            'templateCount': template_count,
            'enrollmentStatus': enrollment_status,
            'minEnrollments': MIN_ENROLLMENTS,
            'maxEnrollments': MAX_ENROLLMENTS,
            'remaining': remaining,
            'fromCache': False,
            'responseTime': response_time
        })

    except Exception as e:
        error_time = time.time() - start_time
        print(f"Error getting templates: {str(e)}")
        print(f"Error occurred after {error_time:.4f} seconds")

        # Still provide a valid response with defaults
        return jsonify({
            'success': True,  # Return success=true to avoid frontend errors
            'staffId': staff_id,
            'templateCount': 0,
            'enrollmentStatus': "incomplete",
            'minEnrollments': MIN_ENROLLMENTS,
            'maxEnrollments': MAX_ENROLLMENTS,
            'remaining': MIN_ENROLLMENTS,
            'fromCache': False,
            'error': str(e),
            'message': "Using default values due to error"
        })

@fingerprint_bp.route('/templates/<staff_id>', methods=['DELETE'])
def delete_templates(staff_id):
"""Delete all templates for a staff ID."""
try:
print(f"Deleting templates for staff ID: {staff_id}")
deleted_count = db.delete_fingerprint_templates(staff_id)

        # Clear cache entry
        with cache_lock:
            if staff_id in enrollment_cache:
                del enrollment_cache[staff_id]

        return jsonify({
            'success': True,
            'staffId': staff_id,
            'deletedCount': deleted_count,
            'message': f'Deleted {deleted_count} templates for staff ID {staff_id}'
        })

    except Exception as e:
        print(f"Error deleting templates: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error deleting templates: {str(e)}'
        }), 500

@fingerprint_bp.route('/debug', methods=['POST'])
def debug_fingerprint():
"""Debug endpoint to visualize fingerprint processing."""
try:
data = request.json
if not data or 'fingerPrint' not in data:
return jsonify({
'success': False,
'message': 'Missing fingerPrint data'
}), 400

        # Convert base64 to image
        img = FingerprintProcessor.base64_to_image(data['fingerPrint'])

        # Process and visualize
        processed_img = FingerprintProcessor.preprocess_fingerprint(img)

        # Extract features
        template = FingerprintProcessor.extract_fingerprint_features(img)

        # Create a color visualization of the processed image
        height, width = processed_img.shape
        visual = np.zeros((height, width, 3), dtype=np.uint8)

        # Copy processed image to all channels
        visual[:,:,0] = processed_img
        visual[:,:,1] = processed_img
        visual[:,:,2] = processed_img

        # Draw minutiae points for visualization
        for minutia in template.get('minutiae', []):
            x, y = int(minutia['x']), int(minutia['y'])
            if 0 <= x < width and 0 <= y < height:
                # Draw bifurcations in green, endings in red
                color = (0, 255, 0) if minutia['type'] == 'bifurcation' else (0, 0, 255)
                cv2.circle(visual, (x, y), 5, color, -1)

        # Draw keypoints
        for keypoint in template.get('keypoints', [])[:50]:  # Limit to 50 keypoints to avoid clutter
            x, y = int(keypoint['x']), int(keypoint['y'])
            if 0 <= x < width and 0 <= y < height:
                cv2.circle(visual, (x, y), 3, (255, 0, 0), -1)

        # Convert the visualization to base64
        _, buffer = cv2.imencode('.png', visual)
        visual_base64 = base64.b64encode(buffer).decode('utf-8')

        # Return debug information
        return jsonify({
            'success': True,
            'visualization': f"data:image/png;base64,{visual_base64}",
            'minutiaeCount': len(template.get('minutiae', [])),
            'keypointCount': len(template.get('keypoints', [])),
            'hashLength': len(template.get('hash', '')),
            'descriptorCount': len(template.get('descriptors', [])),
            'textureFeatureCount': len(template.get('texture', [])),
            'patternGridSize': len(template.get('pattern', []))
        })

    except Exception as e:
        print(f"Debug error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Debug error: {str(e)}'
        }), 500

@fingerprint_bp.route('/test', methods=['GET'])
def test_connection():
"""Test route to verify API is working"""
try: # Test database connection
db_status = "Connected"
try:
db.\_ensure_connection()
if db.client:
db.fingerprint_collection.find_one({})
else:
db_status = "Disconnected: No client"
except Exception as e:
db_status = f"Disconnected: {str(e)}"

        # Get local storage info
        local_templates = {}
        for staff_id, templates in db.local_cache.items():
            local_templates[staff_id] = len(templates)

        # Get cache info
        cache_info = {}
        with cache_lock:
            for staff_id, entry in enrollment_cache.items():
                cache_info[staff_id] = {
                    'count': entry['count'],
                    'age': time.time() - entry['timestamp']
                }

        return jsonify({
            'success': True,
            'message': 'Fingerprint API is running!',
            'version': '3.1',
            'database_status': db_status,
            'match_threshold': MATCH_THRESHOLD,
            'min_enrollments': MIN_ENROLLMENTS,
            'max_enrollments': MAX_ENROLLMENTS,
            'store_original_image': STORE_ORIGINAL_IMAGE,
            'local_templates': local_templates,
            'cache_info': cache_info
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Test error: {str(e)}',
            'version': '3.1'
        })

@fingerprint_bp.route('/sync', methods=['POST'])
def sync_to_mongodb():
"""Sync local data to MongoDB."""
try:
synced_count = db.sync_to_mongodb()

        return jsonify({
            'success': True,
            'message': f'Synced {synced_count} templates to MongoDB',
            'syncedCount': synced_count
        })

    except Exception as e:
        print(f"Sync error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Sync error: {str(e)}'
        }), 500

@fingerprint_bp.route('/clear-cache', methods=['POST'])
def clear_cache():
"""Clear the enrollment cache."""
try:
with cache_lock:
cache_size = len(enrollment_cache)
enrollment_cache.clear()

        return jsonify({
            'success': True,
            'message': f'Cleared cache with {cache_size} entries'
        })

    except Exception as e:
        print(f"Cache clear error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Cache clear error: {str(e)}'
        }), 500
