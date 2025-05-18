import React, { useEffect, useState } from "react";
import {
  FaCheck,
  FaTimes,
  FaCalendarAlt,
  FaFilter,
  FaSearch,
} from "react-icons/fa";
import useAuthStore from "../../../../services/stores/authStore";
import useLeaveRequestStore from "../../../../services/stores/attendance/leaveRequestStore";
import useNotificationStore from "../../../../services/stores/notificationStore";
import { format } from "date-fns";
import Swal from "sweetalert2";

const LeaveRequestsPage = () => {
  const { token } = useAuthStore();
  const {
    leaveRequests,
    getAllLeaveRequests,
    updateLeaveRequestStatus,
    isLoading,
  } = useLeaveRequestStore();
  const { addLeaveStatusNotification } = useNotificationStore();
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (token) {
      getAllLeaveRequests(token);
    }
  }, [token, getAllLeaveRequests]);

  useEffect(() => {
    if (leaveRequests) {
      applyFilters();
    }
  }, [leaveRequests, searchTerm, statusFilter]);

  const applyFilters = () => {
    let filtered = [...leaveRequests];

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((request) => request.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm.trim() !== "") {
      const lowercaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          (request.staffName &&
            request.staffName.toLowerCase().includes(lowercaseSearch)) ||
          (request.reason &&
            request.reason.toLowerCase().includes(lowercaseSearch)) ||
          (request.leaveType &&
            request.leaveType.toLowerCase().includes(lowercaseSearch))
      );
    }

    // Sort by date (newest first) and then by status (pending first)
    filtered.sort((a, b) => {
      // First sort by status (pending first)
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;

      // Then sort by date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    setFilteredRequests(filtered);
  };

  const handleApprove = async (request) => {
    Swal.fire({
      title: "Approve Leave Request",
      text: `Are you sure you want to approve ${request.staffName}'s leave request?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, approve it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await updateLeaveRequestStatus(
            request._id,
            { status: "approved" },
            token
          );

          Swal.fire(
            "Approved!",
            "The leave request has been approved.",
            "success"
          );

          // Notify staff (in a real app this would be done by backend)
          addLeaveStatusNotification({
            ...request,
            status: "approved",
          });
        } catch (error) {
          Swal.fire(
            "Error!",
            "Failed to approve leave request: " + error.message,
            "error"
          );
        }
      }
    });
  };

  const handleReject = async (request) => {
    Swal.fire({
      title: "Reject Leave Request",
      text: "Please provide a reason for rejection",
      input: "textarea",
      inputPlaceholder: "Reason for rejection...",
      inputAttributes: {
        required: true,
      },
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Reject",
      inputValidator: (value) => {
        if (!value.trim()) {
          return "You need to provide a reason for rejection";
        }
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await updateLeaveRequestStatus(
            request._id,
            { status: "rejected", rejectionReason: result.value },
            token
          );

          Swal.fire(
            "Rejected!",
            "The leave request has been rejected.",
            "success"
          );

          // Notify staff (in a real app this would be done by backend)
          addLeaveStatusNotification({
            ...request,
            status: "rejected",
            rejectionReason: result.value,
          });
        } catch (error) {
          Swal.fire(
            "Error!",
            "Failed to reject leave request: " + error.message,
            "error"
          );
        }
      }
    });
  };

  const formatLeaveType = (type) => {
    if (!type) return "Unknown";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
        <h1 className="text-3xl font-semibold mb-6 text-white">
          Leave Requests
        </h1>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="md:w-1/2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FaSearch className="text-gray-400" />
                </div>
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
                  placeholder="Search by staff name, reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FaFilter className="text-gray-400" />
                </div>
                <select
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Leave Requests List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-500 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Loading leave requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6 text-center">
              <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                No leave requests
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== "all"
                  ? "No leave requests match your search criteria."
                  : "There are no leave requests submitted yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Range
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
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
                  {filteredRequests.map((request) => (
                    <tr key={request._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {request.staffName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {request.staffEmail || ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(new Date(request.startDate), "MMM d, yyyy")}
                        </div>
                        <div className="text-sm text-gray-500">
                          to{" "}
                          {format(new Date(request.endDate), "MMM d, yyyy")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {formatLeaveType(request.leaveType)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {request.reason}
                        </div>
                        {request.rejectionReason && (
                          <div className="text-xs text-red-600 mt-1">
                            Rejection Reason: {request.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                            request.status
                          )}`}
                        >
                          {request.status.charAt(0).toUpperCase() +
                            request.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {request.status === "pending" && (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleApprove(request)}
                              className="text-green-600 hover:text-green-900 bg-green-100 hover:bg-green-200 p-2 rounded-full"
                              title="Approve"
                            >
                              <FaCheck />
                            </button>
                            <button
                              onClick={() => handleReject(request)}
                              className="text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 p-2 rounded-full"
                              title="Reject"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestsPage;