// client/src/pages/views/staff/dashboard/index.jsx
import React, { useEffect, useState } from "react";
import {
  FaRegMoneyBillAlt,
  FaCalendarAlt,
  FaClock,
  FaExclamationCircle,
} from "react-icons/fa";
import useAuthStore from "../../../../services/stores/authStore";
import useAttendanceStore from "../../../../services/stores/attendance/attendanceStore";
import axiosTools from "../../../../services/utilities/axiosUtils";
import { ENDPOINT } from "../../../../services/utilities";
import Swal from "sweetalert2";
import { format } from "date-fns";

const Dashboard = () => {
  const { token, auth } = useAuthStore();
  const {
    todayAttendance,
    recentAttendance,
    getRecentAttendance,
    submitReason,
    isLoading,
  } = useAttendanceStore();

  const [recentPayroll, setRecentPayroll] = useState(null);
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

  // Update current time
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

    fetchRecentPayroll();
  }, [token, auth]);

  useEffect(() => {
    if (recentAttendance.length > 0) {
      const summary = recentAttendance.reduce(
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
    }
  }, [recentAttendance]);

  // Fetch most recent payroll
  const fetchRecentPayroll = async () => {
    try {
      const response = await axiosTools.getData(
        `${ENDPOINT}/payroll/staff/${auth._id}`,
        "",
        token
      );

      if (response.success && response.data.length > 0) {
        // Get the most recent one
        setRecentPayroll(response.data[0]);
      }
    } catch (error) {
      console.error("Error fetching payroll data:", error);
    }
  };

  // Handle absence/late reason submission
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

  // Download pay slip
  const downloadPaySlip = (payrollId) => {
    if (!payrollId) return;
    window.open(`${ENDPOINT}/payroll/payslip/${payrollId}`, "_blank");
  };

  if (isLoading && !todayAttendance && recentAttendance.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Loading dashboard data...</div>
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
        <h1 className="text-3xl text-white font-semibold mb-6">Dashboard</h1>

        {/* Quick Stats */}
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

          <div className="bg-white rounded-lg shadow p-4 flex items-center">
            <div className="p-3 bg-blue-100 rounded-full text-blue-500 mr-4">
              <FaRegMoneyBillAlt className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Latest Pay</p>
              <p className="text-2xl font-semibold">
                {recentPayroll ? `₱${recentPayroll.netPay.toFixed(2)}` : "N/A"}
              </p>
              <p className="text-xs text-gray-400">
                {recentPayroll
                  ? format(new Date(recentPayroll.periodEnd), "MMM d, yyyy")
                  : "No recent payroll"}
              </p>
            </div>
          </div>
        </div>

        {/* Current Time & Status */}
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
                                        ${
                                          todayAttendance?.status === "present"
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

          {/* Reason Submission (only for absent or late) */}
          <div className="bg-white rounded-lg shadow p-6 md:col-span-2">
            {todayAttendance &&
            (todayAttendance.status === "absent" ||
              todayAttendance.status === "late" ||
              todayAttendance.status === "half-day") &&
            !todayAttendance.reason ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Submit Reason</h2>
                <div className="mb-4">
                  <p className="text-gray-600 mb-2">
                    Please provide a reason for your{" "}
                    {todayAttendance.status === "absent"
                      ? "absence"
                      : todayAttendance.status === "half-day"
                      ? "half-day"
                      : "lateness"}{" "}
                    today:
                  </p>
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
              </>
            ) : todayAttendance?.reason ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Submitted Reason</h2>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p className="text-gray-600 mb-2">Your reason:</p>
                  <p className="font-medium">{todayAttendance.reason}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {todayAttendance.reasonVerified
                      ? "✓ Verified by administrator"
                      : "Pending verification by administrator"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4">Recent Payroll</h2>
                {recentPayroll ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-gray-600 text-sm">Period</p>
                      <p>
                        {format(new Date(recentPayroll.periodStart), "MMM d")} -{" "}
                        {format(
                          new Date(recentPayroll.periodEnd),
                          "MMM d, yyyy"
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Gross Pay</p>
                      <p className="font-semibold">
                        ₱{recentPayroll.grossPay.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Net Pay</p>
                      <p className="font-semibold">
                        ₱{recentPayroll.netPay.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Status</p>
                      <p
                        className={`
                                                ${
                                                  recentPayroll.paymentStatus ===
                                                  "paid"
                                                    ? "text-green-600"
                                                    : recentPayroll.paymentStatus ===
                                                      "pending"
                                                    ? "text-yellow-600"
                                                    : recentPayroll.paymentStatus ===
                                                      "processing"
                                                    ? "text-blue-600"
                                                    : "text-gray-600"
                                                }
                                            `}
                      >
                        {recentPayroll.paymentStatus.charAt(0).toUpperCase() +
                          recentPayroll.paymentStatus.slice(1)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">
                    No recent payroll information available
                  </p>
                )}

                {recentPayroll && (
                  <button
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
                    onClick={() => downloadPaySlip(recentPayroll._id)}
                  >
                    <FaRegMoneyBillAlt />
                    Download Pay Slip
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Recent Attendance */}
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
                {recentAttendance?.length > 0 ? (
                  recentAttendance.map((record) => (
                    <tr key={record._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                    ${
                                                      record.status ===
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
    </div>
  );
};

export default Dashboard;
