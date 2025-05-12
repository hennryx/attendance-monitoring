// client/src/pages/views/admin/staffSchedule/index.jsx
import React, { useEffect, useState } from "react";
import {
  FaEdit,
  FaCalendarAlt,
  FaExclamationCircle,
  FaCheck,
} from "react-icons/fa";
import useAuthStore from "../../../../services/stores/authStore";
import useUsersStore from "../../../../services/stores/users/usersStore";
import useShiftStore from "../../../../services/stores/shiftStore";
import Swal from "sweetalert2";
import StaffScheduleModal from "./StaffScheduleModal";

const StaffScheduleManagement = () => {
  const { token } = useAuthStore();
  const { getUsers, data: users } = useUsersStore();
  const { getShifts, shifts } = useShiftStore();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [staffSchedules, setStaffSchedules] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [departments, setDepartments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch users and shifts when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([getUsers(token), getShifts(token)]);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to load users and shifts",
        });
        setIsLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token, getUsers, getShifts]);

  // Prepare staff schedules and extract departments when users and shifts are loaded
  useEffect(() => {
    if (users && shifts) {
      // Extract unique departments
      const uniqueDepartments = [
        ...new Set(users.map((user) => user.department)),
      ];
      setDepartments(uniqueDepartments);

      // Prepare staff schedule data
      const scheduleData = users
        .filter((user) => user.role === "STAFF") // Only show staff members
        .map((user) => {
          const assignedShift = shifts.find(
            (s) => s._id === user.assignedShift
          );

          return {
            _id: user._id,
            name: `${user.firstname} ${user.middlename || ""} ${user.lastname}`,
            email: user.email,
            department: user.department,
            position: user.position,
            assignedShift: user.assignedShift,
            shiftName: assignedShift ? assignedShift.name : "No shift assigned",
            hasCustomSchedule: user.customSchedule ? true : false,
            status: user.status,
          };
        });

      setStaffSchedules(scheduleData);
    }
  }, [users, shifts]);

  // Handle opening the schedule assignment modal
  const handleAssignSchedule = (staff) => {
    setSelectedStaff(staff);
    setShowModal(true);
  };

  // Handle filtering by search term and department
  const filteredStaff = staffSchedules
    .filter(
      (staff) =>
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.position.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((staff) =>
      departmentFilter ? staff.department === departmentFilter : true
    );

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredStaff.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const resetFilters = () => {
    setSearchTerm("");
    setDepartmentFilter("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Loading schedule data...</div>
      </div>
    );
  }

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
        <h2 className="text-3xl font-semibold text-white mb-6">
          Staff Schedule Management
        </h2>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Search by name, email, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-1/2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((dept, index) => (
                  <option key={index} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 text-right">
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded"
              onClick={resetFilters}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Staff List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Staff
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Schedule
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
                {currentItems.length > 0 ? (
                  currentItems.map((staff) => (
                    <tr key={staff._id}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {staff.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {staff.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {staff.department}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {staff.position}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaCalendarAlt
                            className={
                              staff.assignedShift
                                ? "text-blue-500 mr-2"
                                : "text-gray-400 mr-2"
                            }
                          />
                          <span
                            className={
                              staff.assignedShift
                                ? "font-medium"
                                : "text-gray-500 italic"
                            }
                          >
                            {staff.shiftName}
                          </span>
                        </div>
                        {staff.hasCustomSchedule && (
                          <div className="text-xs mt-1 text-blue-600 flex items-center">
                            <FaCheck className="mr-1" />
                            <span>Has custom schedule</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${
                            staff.status === "active"
                              ? "bg-green-100 text-green-800"
                              : staff.status === "inactive"
                              ? "bg-gray-100 text-gray-800"
                              : staff.status === "on-leave"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {staff.status.charAt(0).toUpperCase() +
                            staff.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded flex items-center gap-2 ml-auto"
                          onClick={() => handleAssignSchedule(staff)}
                        >
                          <FaEdit />
                          Assign Schedule
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No staff found matching your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredStaff.length > itemsPerPage && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{" "}
                    <span className="font-medium">{indexOfFirstItem + 1}</span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(indexOfLastItem, filteredStaff.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium">{filteredStaff.length}</span>{" "}
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

        {/* Modal for schedule assignment */}
        {selectedStaff && (
          <StaffScheduleModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            staff={selectedStaff}
            shifts={shifts}
            token={token}
            onSuccess={() => {
              getUsers(token);
              setShowModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default StaffScheduleManagement;
