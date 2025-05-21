import React, { useEffect, useState, useCallback } from "react";
import { IoIosAdd } from "react-icons/io";
import Swal from "sweetalert2";
import { FingerprintModal } from "./FingerprintModal";
import useUsersStore from "../../../../services/stores/users/usersStore";
import useAuthStore from "../../../../services/stores/authStore";
import Pagination from "../../../../components/pagination";

const Table = ({ data, toggleAdd, handleUpdate }) => {
  const { deleteUser, enrollFingerPrint } = useUsersStore();
  const { token } = useAuthStore();
  const [searchResult, setSearchResult] = useState("");
  const [allData, setAllData] = useState(data || []);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const [currentItems, setCurrentItems] = useState([]);
  const [indexOfFirstItem, setIndexOfFirstItem] = useState(0);

  // Memoize these callback functions to prevent unnecessary re-renders
  const setCurrentItemsCallback = useCallback((items) => {
    setCurrentItems(items);
  }, []);

  const setIndexOfFirstItemCallback = useCallback((index) => {
    setIndexOfFirstItem(index);
  }, []);

  useEffect(() => {
    // Update allData when data prop changes
    if (data) {
      if (searchTerm === "") {
        setAllData(data);
      } else {
        // Re-apply search filter when data updates
        const term = searchTerm.toLowerCase();
        const filtered = data.filter(
          (user) =>
            user.firstname?.toLowerCase().includes(term) ||
            user.middlename?.toLowerCase().includes(term) ||
            user.lastname?.toLowerCase().includes(term) ||
            user.email?.toLowerCase().includes(term)
        );

        if (filtered.length === 0) {
          setSearchResult(`No result found for "${searchTerm}"`);
        } else {
          setSearchResult("");
        }
        setAllData(filtered);
      }
    }
  }, [data, searchTerm]);

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

  const handleFingerprintRegister = (staff) => {
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

  const handleFingerprintCapture = async (formData) => {
    try {
      console.log("Fingerprint Captured - processing");
      await enrollFingerPrint(formData, token);

      Swal.fire({
        title: "Fingerprint Registration Complete",
        text: "The fingerprint has been successfully registered.",
        icon: "success",
      });

      setIsModalOpen(false);

      if (selectedStaff) {
        const updatedData = allData.map((user) =>
          user._id === selectedStaff._id
            ? { ...user, hasFingerPrint: true }
            : user
        );
        setAllData(updatedData);
      }
    } catch (error) {
      console.error("Error registering fingerprint:", error);
      Swal.fire({
        title: "Registration Failed",
        text: error.message || "Failed to register fingerprint",
        icon: "error",
      });
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

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (term === "") {
      setAllData(data);
      setSearchResult("");
      return;
    }

    const termLower = term.toLowerCase();
    const filtered = data.filter(
      (user) =>
        user.firstname?.toLowerCase().includes(termLower) ||
        user.middlename?.toLowerCase().includes(termLower) ||
        user.lastname?.toLowerCase().includes(termLower) ||
        user.email?.toLowerCase().includes(termLower)
    );

    if (filtered.length === 0) {
      setSearchResult(`No result found for "${term}"`);
    } else {
      setSearchResult("");
    }
    setAllData(filtered);
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
                  onChange={handleSearch}
                  placeholder="Search"
                />
              </label>
              <button
                className="flex items-center justify-center px-4 py-3 bg-[#FDBE02] hover:bg-[#E6AB00] text-black rounded-md whitespace-nowrap"
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
          ) : currentItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-500">
                No data available
              </td>
            </tr>
          ) : (
            currentItems.map((_data, i) => (
              <tr key={_data._id || i}>
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
                    className="p-2 rounded-md bg-[#FDBE02] hover:bg-[#E6AB00] text-black"
                    onClick={() => handleFingerprintRegister(_data)}
                  >
                    {!_data?.hasFingerPrint
                      ? "Register Fingerprint"
                      : "Update Fingerprint"}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <Pagination
        allData={allData}
        getCurrentItems={setCurrentItemsCallback}
        getIndexOfFirstItem={setIndexOfFirstItemCallback}
      />

      {isModalOpen && selectedStaff && (
        <FingerprintModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCapture={handleFingerprintCapture}
          staffId={selectedStaff._id}
          staffEmail={selectedStaff.email}
        />
      )}
    </div>
  );
};

export default Table;
