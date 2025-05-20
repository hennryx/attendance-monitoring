import React, { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import {
  FaCalendarAlt, FaUsers, FaChartBar, FaDownload,
  FaUserCheck, FaUserClock, FaUserTimes, FaRegClock
} from "react-icons/fa";
import useAuthStore from "../../../../services/stores/authStore";
import useAttendanceStore from "../../../../services/stores/attendance/attendanceStore";
import useUsersStore from "../../../../services/stores/users/usersStore";
import useLeaveRequestStore from "../../../../services/stores/attendance/leaveRequestStore";
import Swal from "sweetalert2";

const ReportsPage = () => {
  const { token } = useAuthStore();
  const { getAttendanceStats, data: attendanceData, attendanceToday } = useAttendanceStore();
  const { getUsers, data: userData } = useUsersStore();
  const { getLeaveStats, getLeaveStatistics } = useLeaveRequestStore();
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState("attendance");
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [departments, setDepartments] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [leaveStats, setLeaveStats] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        await getUsers(token);

        await fetchReportData();
      } catch (error) {
        console.error("Error fetching initial data:", error);
        Swal.fire({
          icon: "error",
          title: "Failed to load report data",
          text: "Could not fetch the necessary data for reports",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchInitialData();
    }
  }, [token]);

  useEffect(() => {
    if (userData && userData.length > 0) {
      const depts = [...new Set(userData.map((user) => user.department))];
      setDepartments(depts);
    }
  }, [userData]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      if (reportType === "attendance" || reportType === "all") {
        const attendanceResponse = await getAttendanceStats({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          department: departmentFilter || undefined
        }, token);

        setAttendanceStats(attendanceResponse || null);
      }

      if (reportType === "leave" || reportType === "all") {
        const leaveResponse = await getLeaveStatistics({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          department: departmentFilter || undefined
        }, token);

        setLeaveStats(leaveResponse || null);
      }

    } catch (error) {
      console.error("Error fetching report data:", error);
      Swal.fire({
        icon: "error",
        title: "Failed to load report data",
        text: error.message || "An error occurred while loading the report data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = () => {
    fetchReportData();
  };

  // Export report as PDF
  const handleExportReport = () => {
    Swal.fire({
      title: "Export Report",
      text: "This will export the current report as a PDF. Would you like to continue?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Export",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        exportToPDF();
      }
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text("Attendance Management System Report", pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Report Period: ${dateRange.startDate} to ${dateRange.endDate}`, pageWidth / 2, 22, { align: 'center' });
    
    if (departmentFilter) {
      doc.text(`Department: ${departmentFilter}`, pageWidth / 2, 28, { align: 'center' });
    }
    
    if ((reportType === "attendance" || reportType === "all") && attendanceStats && attendanceStats.summary) {
      doc.setFontSize(14);
      doc.text("Attendance Summary", 14, 38);
      
      const summaryData = [
        ["Present", attendanceStats.summary.present, `${attendanceStats.summary.presentPercentage?.toFixed(1) || 0}%`],
        ["Late", attendanceStats.summary.late, `${attendanceStats.summary.latePercentage?.toFixed(1) || 0}%`],
        ["Absent", attendanceStats.summary.absent, `${attendanceStats.summary.absentPercentage?.toFixed(1) || 0}%`],
        ["Half Day", attendanceStats.summary.halfDay, `${attendanceStats.summary.halfDayPercentage?.toFixed(1) || 0}%`],
        ["Total Records", attendanceStats.summary.totalRecords, "100%"],
        ["Avg Hours Worked", attendanceStats.summary.avgHoursWorked?.toFixed(1) || 0, ""],
        ["Avg Late (minutes)", attendanceStats.summary.avgLateMinutes?.toFixed(1) || 0, ""],
      ];
      
      doc.autoTable({
        startY: 42,
        head: [["Status", "Count", "Percentage"]],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] }
      });
      
      if (attendanceStats.daily && attendanceStats.daily.length > 0) {
        const dailyData = attendanceStats.daily.map(day => [
          format(new Date(day.date), "MMM dd, yyyy"),
          day.present,
          day.late,
          day.absent,
          day.halfDay,
          day.total
        ]);
        
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 10,
          head: [["Date", "Present", "Late", "Absent", "Half Day", "Total"]],
          body: dailyData,
          theme: 'grid',
          headStyles: { fillColor: [66, 139, 202] }
        });
      }
    }
    
    if (reportType === "all") {
      doc.addPage();
    }
    
    if ((reportType === "leave" || reportType === "all") && leaveStats) {
      const startY = reportType === "all" ? 20 : doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 42;
      
      doc.setFontSize(14);
      doc.text("Leave Requests Summary", 14, startY - 5);
      
      const leaveSummaryData = [
        ["Pending", leaveStats.statusCounts?.pending || 0],
        ["Approved", leaveStats.statusCounts?.approved || 0],
        ["Rejected", leaveStats.statusCounts?.rejected || 0],
        ["Total Requests", leaveStats.totalRequests || 0],
        ["Average Duration (days)", leaveStats.avgDuration?.toFixed(1) || 0]
      ];
      
      doc.autoTable({
        startY: startY,
        head: [["Status", "Count"]],
        body: leaveSummaryData,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] }
      });
      
      if (leaveStats.typeCounts) {
        const leaveTypesData = [
          ["Vacation", leaveStats.typeCounts.vacation || 0],
          ["Sick", leaveStats.typeCounts.sick || 0],
          ["Personal", leaveStats.typeCounts.personal || 0],
          ["Bereavement", leaveStats.typeCounts.bereavement || 0],
          ["Other", leaveStats.typeCounts.other || 0]
        ];
        
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 10,
          head: [["Leave Type", "Count"]],
          body: leaveTypesData,
          theme: 'grid',
          headStyles: { fillColor: [66, 139, 202] }
        });
      }
      
      if (leaveStats.departmentCounts && Object.keys(leaveStats.departmentCounts).length > 0) {
        const departmentData = Object.entries(leaveStats.departmentCounts).map(([dept, count]) => [
          dept,
          count,
          ((count / leaveStats.totalRequests) * 100).toFixed(1) + "%"
        ]);
        
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 10,
          head: [["Department", "Count", "Percentage"]],
          body: departmentData,
          theme: 'grid',
          headStyles: { fillColor: [66, 139, 202] }
        });
      }
    }
    
    doc.setFontSize(10);
    doc.text(`Report generated on ${format(new Date(), "MMMM d, yyyy, h:mm a")}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    
    doc.save(`attendance_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    
    Swal.fire("Exported!", "Your report has been exported successfully.", "success");
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
          <h1 className="text-3xl font-semibold text-white">Reports</h1>
          <button
            onClick={handleExportReport}
            className="bg-[#FDBE02] hover:bg-[#E6AB00] text-black px-4 py-2 rounded-md flex items-center"
          >
            <FaDownload className="mr-2" />
            Export Report
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaCalendarAlt className="text-gray-400" />
                </div>
                <input
                  type="date"
                  className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, startDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaCalendarAlt className="text-gray-400" />
                </div>
                <input
                  type="date"
                  className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Type
              </label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="all">All Reports</option>
                <option value="attendance">Attendance Report</option>
                <option value="leave">Leave Report</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleGenerateReport}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <FaChartBar className="mr-2" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-12 flex justify-center items-center">
            <div className="text-center">
              <svg className="animate-spin mx-auto h-12 w-12 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-4 text-lg text-gray-600">Loading report data...</p>
            </div>
          </div>
        ) : (
          <>
            {(reportType === "attendance" || reportType === "all") && (
              <>
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-6 flex items-center">
                    <FaUsers className="mr-2 text-blue-500" />
                    Attendance Summary
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                      <div className="p-3 rounded-full bg-green-100 text-green-500 mr-4">
                        <FaUserCheck className="text-xl" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Present</p>
                        <p className="text-2xl font-semibold">
                          {attendanceStats?.summary?.present || 0}
                        </p>
                        <p className="text-xs text-gray-400">
                          {attendanceStats?.summary?.presentPercentage?.toFixed(1) || 0}% of total
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                      <div className="p-3 rounded-full bg-yellow-100 text-yellow-500 mr-4">
                        <FaUserClock className="text-xl" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Late</p>
                        <p className="text-2xl font-semibold">
                          {attendanceStats?.summary?.late || 0}
                        </p>
                        <p className="text-xs text-gray-400">
                          {attendanceStats?.summary?.latePercentage?.toFixed(1) || 0}% of total
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                      <div className="p-3 rounded-full bg-red-100 text-red-500 mr-4">
                        <FaUserTimes className="text-xl" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Absent</p>
                        <p className="text-2xl font-semibold">
                          {attendanceStats?.summary?.absent || 0}
                        </p>
                        <p className="text-xs text-gray-400">
                          {attendanceStats?.summary?.absentPercentage?.toFixed(1) || 0}% of total
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                      <div className="p-3 rounded-full bg-blue-100 text-blue-500 mr-4">
                        <FaRegClock className="text-xl" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Average Hours</p>
                        <p className="text-2xl font-semibold">
                          {attendanceStats?.summary?.avgHoursWorked?.toFixed(1) || 0}
                        </p>
                        <p className="text-xs text-gray-400">
                          per attendance record
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-md font-medium text-gray-700 mb-4">Attendance Distribution</h3>
                      <div className="h-64">
                        <Pie data={getAttendancePieData()} options={{ maintainAspectRatio: false }} />
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-md font-medium text-gray-700 mb-4">Attendance Trend</h3>
                      <div className="h-64">
                        <Line 
                          data={getAttendanceTrendData()} 
                          options={{ 
                            maintainAspectRatio: false,
                            scales: {
                              y: {
                                beginAtZero: true
                              }
                            }
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {(reportType === "leave" || reportType === "all") && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center">
                  <FaCalendarAlt className="mr-2 text-blue-500" />
                  Leave Requests Summary
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-700">Status Distribution</h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Pending</span>
                          <span className="text-sm font-medium text-yellow-600">
                            {leaveStats?.statusCounts?.pending || 0}
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-yellow-400 h-2.5 rounded-full"
                            style={{
                              width: `${
                                leaveStats?.totalRequests
                                  ? (leaveStats.statusCounts.pending / leaveStats.totalRequests) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Approved</span>
                          <span className="text-sm font-medium text-green-600">
                            {leaveStats?.statusCounts?.approved || 0}
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-green-500 h-2.5 rounded-full"
                            style={{
                              width: `${
                                leaveStats?.totalRequests
                                  ? (leaveStats.statusCounts.approved / leaveStats.totalRequests) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Rejected</span>
                          <span className="text-sm font-medium text-red-600">
                            {leaveStats?.statusCounts?.rejected || 0}
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-red-500 h-2.5 rounded-full"
                            style={{
                              width: `${
                                leaveStats?.totalRequests
                                  ? (leaveStats.statusCounts.rejected / leaveStats.totalRequests) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Total Requests</span>
                        <span className="text-sm font-medium text-blue-600">
                          {leaveStats?.totalRequests || 0}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Average Duration</span>
                        <span className="text-sm font-medium text-blue-600">
                          {leaveStats?.avgDuration?.toFixed(1) || 0} days
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                    <h3 className="text-lg font-medium text-gray-700 mb-4">Leave Types</h3>
                    <div className="h-64">
                      <Bar 
                        data={getLeaveTypesData()} 
                        options={{ 
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              beginAtZero: true
                            }
                          }
                        }} 
                      />
                    </div>
                  </div>
                </div>

                {leaveStats?.departmentCounts && Object.keys(leaveStats.departmentCounts).length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-700 mb-4">Department Breakdown</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Department
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Leave Requests
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Percentage
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(leaveStats.departmentCounts).map(([dept, count], index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {dept}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {count}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {((count / leaveStats.totalRequests) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;