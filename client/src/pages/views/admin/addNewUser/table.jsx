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

  const indexOfLastItem = currentPage * itemsPerPage;
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
            }`}
          >
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
            }`}
          >
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
                }`}
              >
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
                  }`}
                >
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
                }`}
              >
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
                onClick={() => toggleAdd((prev) => !prev)}
              >
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
            currentItems.map((_data, i) => (
              <tr key={i}>
                <th>{indexOfFirstItem + i + 1}</th>
                <td>
                  {_data.firstname} {_data.middlename} {_data.lastname}
                </td>
                <td>{_data.email}</td>
                <td>{_data.role}</td>
                <td>
                  {_data.hasFingerPrint ? (
                    <div className="flex flex-col">
                      <span className="text-green-600 font-medium">
                        {_data.fingerprintEnrollStatus === "complete"
                          ? "Complete"
                          : "Partial"}
                        ({_data.fingerprintTemplateCount || 1}
                        {_data.fingerprintTemplateCount === 1
                          ? " sample"
                          : " samples"}
                        )
                      </span>
                      {_data.fingerprintEnrollStatus !== "complete" && (
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
                    onClick={() => handleUpdate(_data)}
                  >
                    Update
                  </button>
                  <button
                    className="p-2 bg-red-200 text-red-800 rounded-md hover:bg-red-300"
                    onClick={(e) => handleDelete(e, _data)}
                  >
                    Delete
                  </button>
                  <div className="flex flex-col gap-1">
                    <button
                      className="p-2 bg-green-200 text-green-800 rounded-md hover:bg-green-300"
                      onClick={() => handleFingerprintRegister(_data)}
                    >
                      {!_data?.hasFingerPrint
                        ? "Register Fingerprint"
                        : "Add Samples"}
                    </button>
                    {_data?.hasFingerPrint && (
                      <button
                        className="p-1 text-xs bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                        onClick={(e) => handleDeleteFingerprints(e, _data)}
                      >
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
