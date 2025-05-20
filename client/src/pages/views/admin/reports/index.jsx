import React, { useState, useEffect } from 'react';
import { FaFilePdf, FaFileExcel, FaCalendarAlt } from 'react-icons/fa';
import { format } from 'date-fns';
import useAuthStore from '../../../../services/stores/authStore';
import useAttendanceStore from '../../../../services/stores/attendance/attendanceStore';
import useUsersStore from '../../../../services/stores/users/usersStore';
import useLeaveRequestStore from '../../../../services/stores/attendance/leaveRequestStore';
import { generatePDFReport, exportToCSV } from '../../../../services/utilities/pdfUtils';
import Swal from 'sweetalert2';

const ReportsPage = () => {
    const { token } = useAuthStore();
    const { getAttendance, data: attendanceData, isLoading: attendanceLoading } = useAttendanceStore();
    const { getUsers, data: usersData, isLoading: usersLoading } = useUsersStore();
    const { getAllLeaveRequests, leaveRequests, isLoading: leaveLoading } = useLeaveRequestStore();
    
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportType, setReportType] = useState('attendance');
    const [department, setDepartment] = useState('');
    const [departments, setDepartments] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [filteredData, setFilteredData] = useState([]);

    useEffect(() => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        
        setStartDate(format(firstDay, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
    }, []);

    useEffect(() => {
        if (token) {
            getUsers(token);
            getAttendance(token);
            getAllLeaveRequests(token);
        }
    }, [token, getUsers, getAttendance, getAllLeaveRequests]);

    useEffect(() => {
        if (usersData.length > 0) {
            const depts = [...new Set(usersData.map(user => user.department))];
            setDepartments(depts);
        }
    }, [usersData]);

    useEffect(() => {
        filterData();
    }, [reportType, department, startDate, endDate, attendanceData, leaveRequests]);

    const filterData = () => {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (reportType === 'attendance') {
            let filtered = [...attendanceData];
            
            if (start && end) {
                filtered = filtered.filter(record => {
                    const recordDate = new Date(record.date);
                    return recordDate >= start && recordDate <= end;
                });
            }
            
            if (department) {
                filtered = filtered.filter(record => {
                    const user = usersData.find(u => u._id === record.staffId?._id);
                    return user && user.department === department;
                });
            }
            
            setFilteredData(filtered);
        } else if (reportType === 'leave') {
            let filtered = [...leaveRequests];
            
            if (start && end) {
                filtered = filtered.filter(record => {
                    const recordStart = new Date(record.startDate);
                    const recordEnd = new Date(record.endDate);
                    return (recordStart >= start && recordStart <= end) || 
                           (recordEnd >= start && recordEnd <= end) ||
                           (recordStart <= start && recordEnd >= end);
                });
            }
            
            if (department) {
                filtered = filtered.filter(record => 
                    record.staffDepartment === department
                );
            }
            
            setFilteredData(filtered);
        }
    };

    const generateAttendanceReport = () => {
        if (filteredData.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Data',
                text: 'There is no data available for the selected filters.',
            });
            return;
        }

        setIsGenerating(true);

        try {
            const columns = [
                { header: 'Date', dataKey: 'date' },
                { header: 'Staff', dataKey: 'staff' },
                { header: 'Department', dataKey: 'department' },
                { header: 'Status', dataKey: 'status' },
                { header: 'Clock In', dataKey: 'timeIn' },
                { header: 'Clock Out', dataKey: 'timeOut' },
                { header: 'Hours', dataKey: 'hours' },
                { header: 'Late (min)', dataKey: 'late' },
            ];
            
            const tableData = filteredData.map(record => {
                const user = usersData.find(u => u._id === record.staffId?._id) || {};
                
                return {
                    date: record.date ? format(new Date(record.date), 'yyyy-MM-dd') : 'N/A',
                    staff: user ? `${user.firstname || ''} ${user.lastname || ''}` : 'Unknown',
                    department: user?.department || 'N/A',
                    status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A',
                    timeIn: record.timeIn ? format(new Date(record.timeIn), 'HH:mm') : 'N/A',
                    timeOut: record.timeOut ? format(new Date(record.timeOut), 'HH:mm') : 'N/A',
                    hours: record.totalHoursWorked ? record.totalHoursWorked.toFixed(1) : '0',
                    late: record.lateMinutes || '0',
                };
            });

            const presentCount = filteredData.filter(record => record.status === 'present').length;
            const lateCount = filteredData.filter(record => record.status === 'late').length;
            const absentCount = filteredData.filter(record => record.status === 'absent').length;
            const halfDayCount = filteredData.filter(record => record.status === 'half-day').length;

            const summary = {
                'Total Records': filteredData.length,
                'Present': presentCount,
                'Late': lateCount,
                'Absent': absentCount,
                'Half-Day': halfDayCount,
                'Attendance Rate': `${((presentCount + lateCount) / filteredData.length * 100).toFixed(1)}%`
            };

            const dateStr = format(new Date(), 'yyyy-MM-dd');
            
            generatePDFReport({
                title: 'Attendance Monitoring System - Attendance Report',
                subtitle: department ? `Department: ${department}` : 'All Departments',
                columns,
                data: tableData,
                dateRange: { startDate, endDate },
                filename: `attendance-report-${dateStr}.pdf`,
                extraInfo: {
                    summary
                }
            });

            Swal.fire({
                icon: 'success',
                title: 'Report Generated',
                text: 'The attendance report has been generated successfully!',
            });
        } catch (error) {
            console.error('Error generating PDF:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to generate the report. Please try again.',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const generateLeaveReport = () => {
        if (filteredData.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Data',
                text: 'There is no leave requests available for the selected filters.',
            });
            return;
        }

        setIsGenerating(true);

        try {
            const columns = [
                { header: 'Staff', dataKey: 'staff' },
                { header: 'Department', dataKey: 'department' },
                { header: 'Start Date', dataKey: 'startDate' },
                { header: 'End Date', dataKey: 'endDate' },
                { header: 'Type', dataKey: 'type' },
                { header: 'Status', dataKey: 'status' },
                { header: 'Reason', dataKey: 'reason' },
            ];
            
            const tableData = filteredData.map(record => {
                return {
                    staff: record.staffName || 'Unknown',
                    department: record.staffDepartment || 'N/A',
                    startDate: record.startDate ? format(new Date(record.startDate), 'yyyy-MM-dd') : 'N/A',
                    endDate: record.endDate ? format(new Date(record.endDate), 'yyyy-MM-dd') : 'N/A',
                    type: record.leaveType ? record.leaveType.charAt(0).toUpperCase() + record.leaveType.slice(1) : 'N/A',
                    status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A',
                    reason: record.reason || 'N/A',
                };
            });

            const pendingCount = filteredData.filter(record => record.status === 'pending').length;
            const approvedCount = filteredData.filter(record => record.status === 'approved').length;
            const rejectedCount = filteredData.filter(record => record.status === 'rejected').length;

            const summary = {
                'Total Requests': filteredData.length,
                'Pending': pendingCount,
                'Approved': approvedCount,
                'Rejected': rejectedCount,
                'Approval Rate': `${(approvedCount / (approvedCount + rejectedCount) * 100 || 0).toFixed(1)}%`
            };

            const dateStr = format(new Date(), 'yyyy-MM-dd');
            
            generatePDFReport({
                title: 'Attendance Monitoring System - Leave Requests Report',
                subtitle: department ? `Department: ${department}` : 'All Departments',
                columns,
                data: tableData,
                dateRange: { startDate, endDate },
                filename: `leave-report-${dateStr}.pdf`,
                extraInfo: {
                    summary
                }
            });

            Swal.fire({
                icon: 'success',
                title: 'Report Generated',
                text: 'The leave requests report has been generated successfully!',
            });
        } catch (error) {
            console.error('Error generating PDF:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to generate the report. Please try again.',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateReport = () => {
        if (reportType === 'attendance') {
            generateAttendanceReport();
        } else if (reportType === 'leave') {
            generateLeaveReport();
        }
    };

    const handleExportCSV = () => {
        if (filteredData.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Data',
                text: 'There is no data available for the selected filters.',
            });
            return;
        }

        try {
            const dateStr = format(new Date(), 'yyyy-MM-dd');
            
            if (reportType === 'attendance') {
                const headers = [
                    { key: 'date', label: 'Date' },
                    { key: 'staff', label: 'Staff' },
                    { key: 'department', label: 'Department' },
                    { key: 'status', label: 'Status' },
                    { key: 'timeIn', label: 'Clock In' },
                    { key: 'timeOut', label: 'Clock Out' },
                    { key: 'hours', label: 'Hours Worked' },
                    { key: 'late', label: 'Late (min)' },
                ];
                
                const csvData = filteredData.map(record => {
                    const user = usersData.find(u => u._id === record.staffId?._id) || {};
                    
                    return {
                        date: record.date ? format(new Date(record.date), 'yyyy-MM-dd') : 'N/A',
                        staff: user ? `${user.firstname || ''} ${user.lastname || ''}` : 'Unknown',
                        department: user?.department || 'N/A',
                        status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A',
                        timeIn: record.timeIn ? format(new Date(record.timeIn), 'HH:mm') : 'N/A',
                        timeOut: record.timeOut ? format(new Date(record.timeOut), 'HH:mm') : 'N/A',
                        hours: record.totalHoursWorked ? record.totalHoursWorked.toFixed(1) : '0',
                        late: record.lateMinutes || '0',
                    };
                });
                
                exportToCSV(csvData, headers, `attendance-report-${dateStr}.csv`);
            } else if (reportType === 'leave') {
                const headers = [
                    { key: 'staff', label: 'Staff' },
                    { key: 'department', label: 'Department' },
                    { key: 'startDate', label: 'Start Date' },
                    { key: 'endDate', label: 'End Date' },
                    { key: 'type', label: 'Type' },
                    { key: 'status', label: 'Status' },
                    { key: 'reason', label: 'Reason' },
                ];
                
                const csvData = filteredData.map(record => {
                    return {
                        staff: record.staffName || 'Unknown',
                        department: record.staffDepartment || 'N/A',
                        startDate: record.startDate ? format(new Date(record.startDate), 'yyyy-MM-dd') : 'N/A',
                        endDate: record.endDate ? format(new Date(record.endDate), 'yyyy-MM-dd') : 'N/A',
                        type: record.leaveType ? record.leaveType.charAt(0).toUpperCase() + record.leaveType.slice(1) : 'N/A',
                        status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A',
                        reason: record.reason || 'N/A',
                    };
                });
                
                exportToCSV(csvData, headers, `leave-report-${dateStr}.csv`);
            }

            Swal.fire({
                icon: 'success',
                title: 'CSV Exported',
                text: 'The data has been exported to CSV successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error exporting CSV:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to export the data. Please try again.',
            });
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
                <h1 className="text-3xl font-semibold mb-6 text-white">Reports</h1>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                            <select
                                className="block w-full rounded-md border border-gray-300 px-3 py-2"
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                            >
                                <option value="attendance">Attendance Report</option>
                                <option value="leave">Leave Requests Report</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input
                                type="date"
                                className="block w-full rounded-md border border-gray-300 px-3 py-2"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input
                                type="date"
                                className="block w-full rounded-md border border-gray-300 px-3 py-2"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                            <select
                                className="block w-full rounded-md border border-gray-300 px-3 py-2"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
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

                    <div className="mt-4 flex justify-end space-x-3">
                        <button
                            className="inline-flex items-center rounded-md bg-[#FDBE02] px-4 py-2 text-black hover:bg-[#E6AB00] focus:outline-none"
                            onClick={handleGenerateReport}
                            disabled={isGenerating || attendanceLoading || leaveLoading}
                        >
                            <FaFilePdf className="mr-2" />
                            {isGenerating ? 'Generating...' : 'Generate PDF Report'}
                        </button>
                        
                        <button
                            className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 focus:outline-none"
                            onClick={handleExportCSV}
                            disabled={isGenerating || attendanceLoading || leaveLoading}
                        >
                            <FaFileExcel className="mr-2" />
                            Export to CSV
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold">Report Preview</h2>
                        <p className="text-sm text-gray-500">
                            {filteredData.length} {reportType === 'attendance' ? 'attendance records' : 'leave requests'} found
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        {attendanceLoading || leaveLoading ? (
                            <div className="p-8 text-center">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-500 border-r-transparent"></div>
                                <p className="mt-2 text-gray-600">Loading data...</p>
                            </div>
                        ) : filteredData.length === 0 ? (
                            <div className="p-8 text-center">
                                <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-300" />
                                <h3 className="mt-2 text-sm font-semibold text-gray-900">No data found</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Try changing your filters to see more results.
                                </p>
                            </div>
                        ) : reportType === 'attendance' ? (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late (min)</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredData.slice(0, 10).map((record, index) => {
                                        const user = usersData.find(u => u._id === record.staffId?._id) || {};
                                        
                                        return (
                                            <tr key={index}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {record.date ? format(new Date(record.date), 'yyyy-MM-dd') : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {user ? `${user.firstname || ''} ${user.lastname || ''}` : 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {user?.department || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                        ${record.status === 'present'
                                                            ? 'bg-green-100 text-green-800'
                                                            : record.status === 'late'
                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                : record.status === 'half-day'
                                                                    ? 'bg-orange-100 text-orange-800'
                                                                    : record.status === 'absent'
                                                                        ? 'bg-red-100 text-red-800'
                                                                        : 'bg-gray-100 text-gray-800'
                                                        }`}
                                                    >
                                                        {record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {record.timeIn ? format(new Date(record.timeIn), 'HH:mm') : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {record.timeOut ? format(new Date(record.timeOut), 'HH:mm') : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {record.totalHoursWorked ? record.totalHoursWorked.toFixed(1) : '0'} hrs
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {record.lateMinutes || '0'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredData.slice(0, 10).map((record, index) => (
                                        <tr key={index}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {record.staffName || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {record.staffDepartment || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm">
                                                    {record.startDate ? format(new Date(record.startDate), 'MMM d, yyyy') : 'N/A'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    to {record.endDate ? format(new Date(record.endDate), 'MMM d, yyyy') : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    {record.leaveType ? record.leaveType.charAt(0).toUpperCase() + record.leaveType.slice(1) : 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                    ${record.status === 'approved'
                                                        ? 'bg-green-100 text-green-800'
                                                        : record.status === 'rejected'
                                                            ? 'bg-red-100 text-red-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                    }`}
                                                >
                                                    {record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 max-w-xs truncate">
                                                    {record.reason || 'N/A'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {filteredData.length > 10 && (
                        <div className="px-4 py-3 bg-gray-50 text-gray-500 text-sm text-center">
                            Showing 10 of {filteredData.length} records. Generate a report to see all data.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;