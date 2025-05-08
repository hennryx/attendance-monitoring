import React, { useEffect, useState } from "react";
import { IoIosAdd } from "react-icons/io";
import Swal from "sweetalert2";
import useUsersStore from "../../../../services/stores/users/usersStore";
import useAuthStore from "../../../../services/stores/authStore";
import { FingerprintModal } from "./FingerprintModal";

const Table = ({ data, toggleAdd, handleUpdate }) => {
  const { deleteUser, enrollFingerPrint } = useUsersStore();
  const { token } = useAuthStore();
  const [searchResult, setSearchResult] = useState("");
  const [allData, setAllData] = useState(data);
  const [searchTerm, setSearchTerm] = useState("");

  // State for fingerprint modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

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
  const handleFingerprintRegister = (staff) => {
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

    setSelectedStaff(staff);
    setIsModalOpen(true);
  };

  // Handle successful fingerprint capture
  const handleFingerprintCapture = async (data) => {
    console.log("Fingerprint Captured:", data);
    await enrollFingerPrint(data, token);
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
          user.firstName?.toLowerCase().includes(term) ||
          user.middleName?.toLowerCase().includes(term) ||
          user.lastName?.toLowerCase().includes(term) ||
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
  console.log(currentItems);

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
    // Pagination component remains the same
    return (
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        {/* Existing pagination code */}
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
            <th>Action</th>
          </tr>
        </thead>
        <tbody className="text-gray-500">
          {searchResult ? (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-500">
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
                  <button
                    className="p-2 bg-green-200 text-green-800 rounded-md hover:bg-green-300"
                    onClick={() => handleFingerprintRegister(_data)}
                  >
                    {_data?.hasFingerPrint
                      ? "Update Fingerprint"
                      : "Register Fingerprint"}
                  </button>
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
        />
      )}
    </div>
  );
};

export default Table;
