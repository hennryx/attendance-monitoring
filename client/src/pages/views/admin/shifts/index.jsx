// client/src/pages/views/admin/shifts/index.jsx
import React, { useEffect, useState } from "react";
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from "react-icons/fa";
import useAuthStore from "../../../../services/stores/authStore";
import useShiftStore from "../../../../services/stores/shiftStore";
import Swal from "sweetalert2";
import ShiftModal from "./ShiftModal";

const ShiftManagement = () => {
  const { token } = useAuthStore();
  const { shifts, isLoading, getShifts, deleteShift } = useShiftStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch shifts on component mount
  useEffect(() => {
    if (token) {
      getShifts(token);
    }
  }, [token, getShifts]);

  // Handle new shift creation
  const handleOpenModal = () => {
    setSelectedShift(null);
    setShowModal(true);
  };

  // Handle shift editing
  const handleEditShift = (shift) => {
    setSelectedShift(shift);
    setShowModal(true);
  };

  // Handle shift deletion
  const handleDeleteShift = (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You will not be able to recover this shift!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        deleteShift(id, token)
          .then(() => {
            Swal.fire("Deleted!", "The shift has been deleted.", "success");
            getShifts(token);
          })
          .catch((error) => {
            Swal.fire(
              "Error!",
              error.message || "Failed to delete shift.",
              "error"
            );
          });
      }
    });
  };

  // Format time
  const formatTime = (timeString) => {
    if (!timeString) return "N/A";

    const [hours, minutes] = timeString.split(":");
    let hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";

    hour = hour % 12;
    hour = hour ? hour : 12; // convert 0 to 12

    return `${hour}:${minutes} ${ampm}`;
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = shifts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(shifts.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="relative isolate min-h-lvh overflow-hidden bg-[linear-gradient(to_bottom,#1b1b1b_25%,#FAFAFA_25%)]">
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

      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-semibold text-white">
            Shift Management
          </h2>
          <button
            className="bg-[#FDBE02] hover:bg-[#E6AB00] text-black px-4 py-2 rounded flex items-center gap-2"
            onClick={handleOpenModal}
          >
            <FaPlus />
            Add New Shift
          </button>
        </div>

        {/* Shift List */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shift Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Loading shift data...
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No shifts found. Create a new shift to get started.
                    </td>
                  </tr>
                ) : (
                  currentItems.map((shift) => (
                    <tr key={shift._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {shift.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {shift.description}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div>
                            Hours: {formatTime(shift.monday.startTime)} -{" "}
                            {formatTime(shift.monday.endTime)}
                          </div>
                          <div>
                            Lunch: {formatTime(shift.monday.lunchStartTime)} (
                            {shift.monday.lunchDuration} min)
                          </div>
                          <div className="text-xs text-gray-500">
                            Grace Period: {shift.gracePeriod} min
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1">
                          {[
                            "monday",
                            "tuesday",
                            "wednesday",
                            "thursday",
                            "friday",
                            "saturday",
                            "sunday",
                          ].map((day) => (
                            <span
                              key={day}
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs
                                ${
                                  shift[day]?.enabled
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-400"
                                }`}
                              title={day.charAt(0).toUpperCase() + day.slice(1)}
                            >
                              {day.charAt(0).toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${
                            shift.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {shift.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => handleEditShift(shift)}
                            title="Edit Shift"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-900"
                            onClick={() => handleDeleteShift(shift._id)}
                            title="Delete Shift"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {shifts.length > itemsPerPage && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{" "}
                    <span className="font-medium">{indexOfFirstItem + 1}</span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(indexOfLastItem, shifts.length)}
                    </span>{" "}
                    of <span className="font-medium">{shifts.length}</span>{" "}
                    results
                  </p>
                </div>
                <div>
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50
                      ${
                        currentPage === 1
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer"
                      }`}
                    >
                      Previous
                    </button>

                    {/* Page numbers */}
                    {[...Array(totalPages).keys()].map((number) => (
                      <button
                        key={number + 1}
                        onClick={() => paginate(number + 1)}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium
                        ${
                          currentPage === number + 1
                            ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                            : "text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {number + 1}
                      </button>
                    ))}

                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50
                      ${
                        currentPage === totalPages
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer"
                      }`}
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Shift Creation/Edit Modal */}
        <ShiftModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          selectedShift={selectedShift}
          token={token}
          onSuccess={() => {
            setShowModal(false);
            getShifts(token);
          }}
        />
      </div>
    </div>
  );
};

export default ShiftManagement;
