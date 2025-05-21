import React, { useEffect, useState } from "react";
import { FaCalendarAlt, FaPlus } from "react-icons/fa";
import useAuthStore from "../../../../services/stores/authStore";
import { format } from "date-fns";
import LeaveRequestForm from "../../../../components/leaveRequest/leaveRequestForm";
import useLeaveRequestStore from "../../../../services/stores/attendance/leaveRequestStore";

const LeaveHistoryPage = () => {
    const { token, auth } = useAuthStore();
    const { userLeaveRequests, getUserLeaveRequests, isLoading } = useLeaveRequestStore();
    const [showRequestForm, setShowRequestForm] = useState(false);

    useEffect(() => {
        if (token && auth?._id) {
            getUserLeaveRequests(auth._id, token);
        }
    }, [token, auth, getUserLeaveRequests]);

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

    const calculateDuration = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays + (diffDays === 1 ? " day" : " days");
    };

    const sortedLeaveRequests = [...userLeaveRequests].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;

        return new Date(b.createdAt) - new Date(a.createdAt);
    });

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
                    <h1 className="text-3xl font-semibold text-white">My Leave Requests</h1>
                    <button
                        className="bg-[#FDBE02] hover:bg-[#E6AB00] text-black px-4 py-2 rounded-md flex items-center"
                        onClick={() => setShowRequestForm(true)}
                    >
                        <FaPlus className="mr-2" />
                        New Leave Request
                    </button>
                </div>

                {showRequestForm && (
                    <LeaveRequestForm onClose={() => setShowRequestForm(false)} isOpen={showRequestForm} />
                )}

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {isLoading ? (
                        <div className="p-6 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-500 border-r-transparent"></div>
                            <p className="mt-2 text-gray-600">Loading your leave requests...</p>
                        </div>
                    ) : sortedLeaveRequests.length === 0 ? (
                        <div className="p-6 text-center">
                            <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-semibold text-gray-900">No leave requests</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                You haven't submitted any leave requests yet.
                            </p>
                            <div className="mt-6">
                                <button
                                    type="button"
                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                    onClick={() => setShowRequestForm(true)}
                                >
                                    <FaPlus className="-ml-1 mr-2 h-5 w-5" />
                                    New Leave Request
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto min-h-[80vh] shadow-2xl">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date Range
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Duration
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
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Submitted
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {sortedLeaveRequests.map((request) => (
                                        <tr key={request._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {format(new Date(request.startDate), "MMM d, yyyy")}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    to {format(new Date(request.endDate), "MMM d, yyyy")}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {calculateDuration(request.startDate, request.endDate)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    {formatLeaveType(request.leaveType)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 max-w-xs">
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
                                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {request.createdAt ? format(new Date(request.createdAt), "MMM d, yyyy") : "N/A"}
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

export default LeaveHistoryPage;