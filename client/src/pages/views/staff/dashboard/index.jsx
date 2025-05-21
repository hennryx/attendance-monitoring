import React, { useEffect, useState } from "react";
import {
    FaRegMoneyBillAlt,
    FaCalendarAlt,
    FaClock,
    FaExclamationCircle,
    FaPlus,
    FaClipboardList,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../../../services/stores/authStore";
import useAttendanceStore from "../../../../services/stores/attendance/attendanceStore";
import useNotificationStore from "../../../../services/stores/notificationStore";
import Swal from "sweetalert2";
import { format } from "date-fns";
import useLeaveRequestStore from "../../../../services/stores/attendance/leaveRequestStore";
import LeaveRequestForm from "../../../../components/leaveRequest/leaveRequestForm";

const Dashboard = () => {
    const { token, auth } = useAuthStore();
    const { todayAttendance, data, getRecentAttendance, submitReason } =
        useAttendanceStore();
    const { getUnhandledAbsences, getUserLeaveRequests } = useLeaveRequestStore();
    const { clearAll, getUserNotifications } = useNotificationStore();
    const navigate = useNavigate();

    const [absenceReason, setAbsenceReason] = useState("");
    const [reasonSubmitting, setReasonSubmitting] = useState(false);
    const [time, setTime] = useState(new Date());
    const [attendanceSummary, setAttendanceSummary] = useState({
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        total: 0,
    });
    const [showLeaveForm, setShowLeaveForm] = useState(false);
    const [pendingLeaveRequests, setPendingLeaveRequests] = useState([]);
    const [todayActivities, setTodayActivities] = useState([]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        if (!token || !auth?._id) return;

        getRecentAttendance(auth._id, token);

        const checkUnhandledAbsences = async () => {
            try {
                clearAll();
                await getUnhandledAbsences(auth._id, token);
                await getUserNotifications(token);
            } catch (error) {
                console.error("Error fetching unhandled absences:", error);
            }
        };

        const fetchPendingLeaveRequests = async () => {
            try {
                const requests = await getUserLeaveRequests(auth._id, token);
                if (requests) {
                    setPendingLeaveRequests(
                        requests.filter((req) => req.status === "pending")
                    );
                }
            } catch (error) {
                console.error("Error fetching leave requests:", error);
            }
        };

        checkUnhandledAbsences();
        fetchPendingLeaveRequests();
    }, [
        token,
        auth,
        getRecentAttendance,
        getUnhandledAbsences,
        getUserLeaveRequests,
    ]);

    useEffect(() => {
        if (data.length > 0) {
            const summary = data.reduce(
                (acc, record) => {
                    acc.total += 1;

                    if (record.status === "present") {
                        acc.present += 1;
                    } else if (record.status === "late") {
                        acc.late += 1;
                    } else if (record.status === "absent") {
                        acc.absent += 1;
                    } else if (record.status === "half-day") {
                        acc.halfDay += 1;
                    }

                    return acc;
                },
                { present: 0, late: 0, absent: 0, halfDay: 0, total: 0 }
            );

            setAttendanceSummary(summary);

            if (todayAttendance) {
                const activities = [];

                if (todayAttendance.timeIn) {
                    activities.push({
                        type: "Clock In",
                        time: new Date(todayAttendance.timeIn),
                        icon: <FaClock className="text-green-500" />,
                    });
                }

                if (todayAttendance.lunchStart) {
                    activities.push({
                        type: "Lunch Start",
                        time: new Date(todayAttendance.lunchStart),
                        icon: <FaRegMoneyBillAlt className="text-orange-500" />,
                    });
                }

                if (todayAttendance.lunchEnd) {
                    activities.push({
                        type: "Lunch End",
                        time: new Date(todayAttendance.lunchEnd),
                        icon: <FaRegMoneyBillAlt className="text-blue-500" />,
                    });
                }

                if (todayAttendance.timeOut) {
                    activities.push({
                        type: "Clock Out",
                        time: new Date(todayAttendance.timeOut),
                        icon: <FaClock className="text-red-500" />,
                    });
                }

                activities.sort((a, b) => b.time - a.time);
                setTodayActivities(activities);
            }
        }
    }, [data, todayAttendance]);

    const handleSubmitReason = async () => {
        if (!absenceReason.trim()) {
            Swal.fire({
                icon: "warning",
                title: "Empty Reason",
                text: "Please enter a reason for your absence or lateness",
            });
            return;
        }

        if (!todayAttendance?._id) {
            Swal.fire({
                icon: "error",
                title: "No Attendance Record",
                text: "No attendance record found for today",
            });
            return;
        }

        setReasonSubmitting(true);
        try {
            await submitReason(
                {
                    attendanceId: todayAttendance._id,
                    reason: absenceReason,
                },
                token
            );

            Swal.fire({
                icon: "success",
                title: "Reason Submitted",
                text: "Your reason has been submitted successfully",
            });

            setAbsenceReason("");
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Submission Failed",
                text: error.message || "Failed to submit reason. Please try again.",
            });
        } finally {
            setReasonSubmitting(false);
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
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl text-white font-semibold">Dashboard</h1>
                    <button
                        className="bg-[#FDBE02] hover:bg-[#E6AB00] text-black px-4 py-2 rounded-md flex items-center"
                        onClick={() => setShowLeaveForm(true)}
                    >
                        <FaPlus className="mr-2" />
                        Request Leave
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4 flex items-center">
                        <div className="p-3 bg-green-100 rounded-full text-green-500 mr-4">
                            <FaCalendarAlt className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Present Days</p>
                            <p className="text-2xl font-semibold">
                                {attendanceSummary.present}
                            </p>
                            <p className="text-xs text-gray-400">Last 7 days</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-4 flex items-center">
                        <div className="p-3 bg-yellow-100 rounded-full text-yellow-500 mr-4">
                            <FaClock className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Late Days</p>
                            <p className="text-2xl font-semibold">{attendanceSummary.late}</p>
                            <p className="text-xs text-gray-400">Last 7 days</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-4 flex items-center">
                        <div className="p-3 bg-red-100 rounded-full text-red-500 mr-4">
                            <FaExclamationCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Absent Days</p>
                            <p className="text-2xl font-semibold">
                                {attendanceSummary.absent}
                            </p>
                            <p className="text-xs text-gray-400">Last 7 days</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white rounded-lg shadow p-6 md:col-span-1">
                        <div className="text-4xl font-bold text-center mb-2">
                            {format(time, "h:mm:ss a")}
                        </div>
                        <div className="text-lg text-center text-gray-600 mb-4">
                            {format(time, "EEEE, MMMM d, yyyy")}
                        </div>

                        <div className="p-3 rounded-lg bg-gray-100">
                            <h3 className="font-medium mb-2">Today's Status:</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <p className="text-sm text-gray-500">Clock In:</p>
                                    <p className="font-medium">
                                        {todayAttendance?.timeIn
                                            ? format(new Date(todayAttendance.timeIn), "h:mm a")
                                            : "Not recorded"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Clock Out:</p>
                                    <p className="font-medium">
                                        {todayAttendance?.timeOut
                                            ? format(new Date(todayAttendance.timeOut), "h:mm a")
                                            : "Not recorded"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Lunch Start:</p>
                                    <p className="font-medium">
                                        {todayAttendance?.lunchStart
                                            ? format(new Date(todayAttendance.lunchStart), "h:mm a")
                                            : "Not recorded"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Lunch End:</p>
                                    <p className="font-medium">
                                        {todayAttendance?.lunchEnd
                                            ? format(new Date(todayAttendance.lunchEnd), "h:mm a")
                                            : "Not recorded"}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex justify-between">
                                    <p className="text-sm text-gray-500">Status:</p>
                                    <p
                                        className={`font-medium
                                        ${todayAttendance?.status === "present"
                                                ? "text-green-600"
                                                : todayAttendance?.status === "late"
                                                    ? "text-yellow-600"
                                                    : todayAttendance?.status ===
                                                        "half-day"
                                                        ? "text-orange-600"
                                                        : todayAttendance?.status ===
                                                            "absent"
                                                            ? "text-red-600"
                                                            : "text-gray-600"
                                            }
                                    `}
                                    >
                                        {todayAttendance?.status
                                            ? todayAttendance.status
                                                .replace("-", " ")
                                                .replace(/\b\w/g, (l) => l.toUpperCase())
                                            : "Not recorded"}
                                    </p>
                                </div>
                                {todayAttendance?.lateMinutes > 0 && (
                                    <div className="flex justify-between">
                                        <p className="text-sm text-gray-500">Late By:</p>
                                        <p className="font-medium text-yellow-600">
                                            {todayAttendance.lateMinutes} minutes
                                        </p>
                                    </div>
                                )}
                                {todayAttendance?.overtime > 0 && (
                                    <div className="flex justify-between">
                                        <p className="text-sm text-gray-500">Overtime:</p>
                                        <p className="font-medium text-green-600">
                                            {todayAttendance.overtime} minutes
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6 md:col-span-2">
                        <h2 className="text-xl font-semibold mb-4 flex items-center">
                            <FaClipboardList className="mr-2 text-blue-500" />
                            Today's Activities
                        </h2>

                        <div className="relative">
                            <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-200" />

                            <div className="space-y-4">
                                {todayActivities.length > 0 ? (
                                    todayActivities.map((activity, index) => (
                                        <div key={index} className="flex items-start">
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white border-2 border-gray-200 z-10">
                                                    {activity.icon}
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                <div className="font-medium">{activity.type}</div>
                                                <div className="text-sm text-gray-500">
                                                    {format(activity.time, "h:mm a")}
                                                </div>
                                            </div>
                                            <div className="ml-auto text-right">
                                                <div className="text-xs text-gray-400">
                                                    {format(activity.time, "EEEE, MMMM d")}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-center py-6 text-gray-500">
                                        No attendance activities recorded for today
                                    </div>
                                )}

                                <div className="flex items-start">
                                    <div className="flex-shrink-0 mt-1">
                                        <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 border-2 border-blue-400 z-10">
                                            <FaClock className="text-blue-500" />
                                        </div>
                                    </div>
                                    <div className="ml-4">
                                        <div className="font-medium">Current Time</div>
                                        <div className="text-sm text-blue-500">
                                            {format(new Date(), "h:mm a")}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {pendingLeaveRequests.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-gray-200">
                                <h3 className="font-medium text-gray-700 mb-2">
                                    Pending Leave Requests:
                                </h3>
                                <div className="space-y-2">
                                    {pendingLeaveRequests.map((request, index) => (
                                        <div
                                            key={index}
                                            className="p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                                        >
                                            <div className="flex justify-between">
                                                <div className="font-medium">
                                                    {format(new Date(request.startDate), "MMM d")} -{" "}
                                                    {format(new Date(request.endDate), "MMM d, yyyy")}
                                                </div>
                                                <span className="px-2 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center">
                                                    Pending
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600 mt-1">
                                                {request.leaveType.charAt(0).toUpperCase() +
                                                    request.leaveType.slice(1)}{" "}
                                                Leave
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 text-right">
                                    <button
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        onClick={() => navigate("/leave-history")}
                                    >
                                        View all leave requests →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {todayAttendance &&
                    (todayAttendance.status === "absent" ||
                        todayAttendance.status === "late" ||
                        todayAttendance.status === "half-day") &&
                    !todayAttendance.reason && (
                        <div className="bg-white rounded-lg shadow p-6 mb-6">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0">
                                    <FaExclamationCircle className="h-6 w-6 text-red-500" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-semibold mb-2">Submit Reason</h2>
                                    <p className="text-gray-600 mb-4">
                                        Please provide a reason for your{" "}
                                        {todayAttendance.status === "absent"
                                            ? "absence"
                                            : todayAttendance.status === "half-day"
                                                ? "half-day"
                                                : "lateness"}{" "}
                                        today:
                                    </p>
                                    <div className="mb-4">
                                        <textarea
                                            className="w-full border border-gray-300 rounded p-2"
                                            rows="3"
                                            value={absenceReason}
                                            onChange={(e) => setAbsenceReason(e.target.value)}
                                            placeholder="Enter your reason here..."
                                        ></textarea>
                                    </div>
                                    <button
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                                        onClick={handleSubmitReason}
                                        disabled={reasonSubmitting}
                                    >
                                        {reasonSubmitting ? "Submitting..." : "Submit Reason"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Recent Attendance</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Clock In
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Clock Out
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Hours
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Late
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Overtime
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data?.length > 0 ? (
                                    data.map((record) => (
                                        <tr key={record._id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {format(new Date(record.date), "MMM d, yyyy")}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                    ${record.status ===
                                                            "present"
                                                            ? "bg-green-100 text-green-800"
                                                            : record.status ===
                                                                "late"
                                                                ? "bg-yellow-100 text-yellow-800"
                                                                : record.status ===
                                                                    "half-day"
                                                                    ? "bg-orange-100 text-orange-800"
                                                                    : record.status ===
                                                                        "absent"
                                                                        ? "bg-red-100 text-red-800"
                                                                        : "bg-gray-100 text-gray-800"
                                                        }`}
                                                >
                                                    {record.status.charAt(0).toUpperCase() +
                                                        record.status.slice(1).replace("-", " ")}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {record.timeIn
                                                    ? format(new Date(record.timeIn), "h:mm a")
                                                    : "N/A"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {record.timeOut
                                                    ? format(new Date(record.timeOut), "h:mm a")
                                                    : "N/A"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {record.totalHoursWorked
                                                    ? record.totalHoursWorked.toFixed(1)
                                                    : "0"}{" "}
                                                hrs
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {record.lateMinutes > 0
                                                    ? `${record.lateMinutes} min`
                                                    : "No"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {record.overtime > 0 ? `${record.overtime} min` : "No"}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan="7"
                                            className="px-6 py-4 text-center text-gray-500"
                                        >
                                            No recent attendance records found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showLeaveForm && (
                <LeaveRequestForm
                    onClose={() => setShowLeaveForm(false)}
                    isOpen={showLeaveForm}
                />
            )}
        </div>
    );
};

export default Dashboard;
