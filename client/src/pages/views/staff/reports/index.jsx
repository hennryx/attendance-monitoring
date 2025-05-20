import React, { useState, useEffect } from 'react';
import { FaFilePdf, FaFileExcel, FaCalendarAlt } from 'react-icons/fa';
import { format, isValid } from 'date-fns';
import useAuthStore from '../../../../services/stores/authStore';
import useAttendanceStore from '../../../../services/stores/attendance/attendanceStore';
import useLeaveRequestStore from '../../../../services/stores/attendance/leaveRequestStore';
import { generatePDFReport, exportToCSV } from '../../../../services/utilities/pdfUtils';
import Swal from 'sweetalert2';

// Helper function to safely format dates
const safeFormatDate = (dateValue, formatString, fallback = 'N/A') => {
    if (!dateValue) return fallback;
    
    try {
        const date = new Date(dateValue);
        if (!isValid(date)) return fallback;
        return format(date, formatString);
    } catch (error) {
        console.error('Date formatting error:', error);
        return fallback;
    }
};

const StaffReportsPage = () => {
    const { token, auth } = useAuthStore();
    const { getRecentAttendance, data: attendanceData, isLoading: attendanceLoading } = useAttendanceStore();
    const { getUserLeaveRequests, userLeaveRequests, isLoading: leaveLoading } = useLeaveRequestStore();

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportType, setReportType] = useState('attendance');
    const [isGenerating, setIsGenerating] = useState(false);
    const [filteredData, setFilteredData] = useState([]);

    useEffect(() => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        
        setStartDate(format(firstDay, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
    }, []);

    useEffect(() => {
        if (token && auth?._id) {
            getRecentAttendance(auth._id, token);
            getUserLeaveRequests(auth._id, token);
        }
    }, [token, auth, getRecentAttendance, getUserLeaveRequests]);

    useEffect(() => {
        filterData();
    }, [reportType, startDate, endDate, attendanceData, userLeaveRequests]);

    const filterData = () => {
        try {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            
            if (!isValid(start) || !isValid(end)) {
                console.error('Invalid date range');
                setFilteredData([]);
                return;
            }

            if (reportType === 'attendance') {
                let filtered = Array.isArray(attendanceData) ? [...attendanceData] : [];
                
                if (start && end) {
                    filtered = filtered.filter(record => {
                        if (!record.date) return false;
                        
                        try {
                            const recordDate = new Date(record.date);
                            return isValid(recordDate) && recordDate >= start && recordDate <= end;
                        } catch (error) {
                            return false;
                        }
                    });
                }
                
                setFilteredData(filtered);
            } else if (reportType === 'leave') {
                let filtered = Array.isArray(userLeaveRequests) ? [...userLeaveRequests] : [];
                
                if (start && end) {
                    filtered = filtered.filter(record => {
                        if (!record.startDate || !record.endDate) return false;
                        
                        try {
                            const recordStart = new Date(record.startDate);
                            const recordEnd = new Date(record.endDate);
                            
                            if (!isValid(recordStart) || !isValid(recordEnd)) return false;
                            
                            return (recordStart >= start && recordStart <= end) || 
                                (recordEnd >= start && recordEnd <= end) ||
                                (recordStart <= start && recordEnd >= end);
                        } catch (error) {
                            return false;
                        }
                    });
                }
                
                setFilteredData(filtered);
            }
        } catch (error) {
            console.error('Error filtering data:', error);
            setFilteredData([]);
        }
    };

    const generateAttendanceReport = () => {
        if (filteredData.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Data',
                text: 'There is no attendance data available for the selected date range.',
            });
            return;
        }

        setIsGenerating(true);

        try {
            const columns = [
                { header: 'Date', dataKey: 'date' },
                { header: 'Status', dataKey: 'status' },
                { header: 'Clock In', dataKey: 'timeIn' },
                { header: 'Clock Out', dataKey: 'timeOut' },
                { header: 'Lunch Start', dataKey: 'lunchStart' },
                { header: 'Lunch End', dataKey: 'lunchEnd' },
                { header: 'Hours Worked', dataKey: 'hours' },
                { header: 'Late (min)', dataKey: 'late' },
                { header: 'Overtime (min)', dataKey: 'overtime' },
            ];
            
            const tableData = filteredData.map(record => {
                return {
                    date: safeFormatDate(record.date, 'yyyy-MM-dd'),
                    status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A',
                    timeIn: safeFormatDate(record.timeIn, 'HH:mm'),
                    timeOut: safeFormatDate(record.timeOut, 'HH:mm'),
                    lunchStart: safeFormatDate(record.lunchStart, 'HH:mm'),
                    lunchEnd: safeFormatDate(record.lunchEnd, 'HH:mm'),
                    hours: record.totalHoursWorked ? record.totalHoursWorked.toFixed(1) : '0',
                    late: record.lateMinutes || '0',
                    overtime: record.overtime || '0',
                };
            });

            const presentCount = filteredData.filter(record => record.status === 'present').length;
            const lateCount = filteredData.filter(record => record.status === 'late').length;
            const absentCount = filteredData.filter(record => record.status === 'absent').length;
            const halfDayCount = filteredData.filter(record => record.status === 'half-day').length;
            
            const totalHoursWorked = filteredData.reduce((total, record) => 
                total + (record.totalHoursWorked || 0), 0);
            
            const totalLateMinutes = filteredData.reduce((total, record) => 
                total + (record.lateMinutes || 0), 0);
            
            const totalOvertimeMinutes = filteredData.reduce((total, record) => 
                total + (record.overtime || 0), 0);

            const summary = {
                'Total Days': filteredData.length,
                'Present': presentCount,
                'Late': lateCount,
                'Absent': absentCount,
                'Half Day': halfDayCount,
                'Total Hours Worked': totalHoursWorked.toFixed(1),
                'Total Late Minutes': totalLateMinutes,
                'Total Overtime Minutes': totalOvertimeMinutes
            };

            const dateStr = safeFormatDate(new Date(), 'yyyy-MM-dd', 'report');
            
            generatePDFReport({
                title: 'Personal Attendance Report',
                subtitle: `Employee: ${auth?.firstname || ''} ${auth?.lastname || ''} (${auth?.department || 'N/A'})`,
                columns,
                data: tableData,
                dateRange: { 
                    startDate: safeFormatDate(new Date(startDate), 'MMMM d, yyyy', 'Not set'), 
                    endDate: safeFormatDate(new Date(endDate), 'MMMM d, yyyy', 'Not set') 
                },
                filename: `my-attendance-report-${dateStr}.pdf`,
                extraInfo: {
                    summary
                }
            });

            Swal.fire({
                icon: 'success',
                title: 'Report Generated',
                text: 'Your attendance report has been generated successfully!',
                timer: 2000,
                showConfirmButton: false
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
                text: 'There are no leave requests available for the selected date range.',
            });
            return;
        }

        setIsGenerating(true);

        try {
            const columns = [
                { header: 'Start Date', dataKey: 'startDate' },
                { header: 'End Date', dataKey: 'endDate' },
                { header: 'Duration', dataKey: 'duration' },
                { header: 'Type', dataKey: 'type' },
                { header: 'Status', dataKey: 'status' },
                { header: 'Reason', dataKey: 'reason' },
                { header: 'Request Date', dataKey: 'requestDate' },
            ];
            
            const tableData = filteredData.map(record => {
                let diffDays = 1;
                let startDateFormatted = 'N/A';
                let endDateFormatted = 'N/A';
                
                try {
                    if (record.startDate && record.endDate) {
                        const startDate = new Date(record.startDate);
                        const endDate = new Date(record.endDate);
                        
                        if (isValid(startDate) && isValid(endDate)) {
                            const diffTime = Math.abs(endDate - startDate);
                            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                            startDateFormatted = format(startDate, 'yyyy-MM-dd');
                            endDateFormatted = format(endDate, 'yyyy-MM-dd');
                        }
                    }
                } catch (error) {
                    console.error('Error calculating leave duration:', error);
                }

                return {
                    startDate: startDateFormatted,
                    endDate: endDateFormatted,
                    duration: `${diffDays} day${diffDays > 1 ? 's' : ''}`,
                    type: record.leaveType ? record.leaveType.charAt(0).toUpperCase() + record.leaveType.slice(1) : 'N/A',
                    status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A',
                    reason: record.reason || 'N/A',
                    requestDate: safeFormatDate(record.createdAt, 'yyyy-MM-dd'),
                };
            });

            const pendingCount = filteredData.filter(record => record.status === 'pending').length;
            const approvedCount = filteredData.filter(record => record.status === 'approved').length;
            const rejectedCount = filteredData.filter(record => record.status === 'rejected').length;
            
            const totalApprovedDays = filteredData
                .filter(record => record.status === 'approved')
                .reduce((total, record) => {
                    try {
                        if (record.startDate && record.endDate) {
                            const startDate = new Date(record.startDate);
                            const endDate = new Date(record.endDate);
                            
                            if (isValid(startDate) && isValid(endDate)) {
                                const diffTime = Math.abs(endDate - startDate);
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                return total + diffDays;
                            }
                        }
                        return total;
                    } catch (error) {
                        console.error('Error calculating approved days:', error);
                        return total;
                    }
                }, 0);

            const summary = {
                'Total Requests': filteredData.length,
                'Pending': pendingCount,
                'Approved': approvedCount,
                'Rejected': rejectedCount,
                'Total Approved Days': totalApprovedDays
            };

            const dateStr = safeFormatDate(new Date(), 'yyyy-MM-dd', 'report');
            
            generatePDFReport({
                title: 'Personal Leave Requests Report',
                subtitle: `Employee: ${auth?.firstname || ''} ${auth?.lastname || ''} (${auth?.department || 'N/A'})`,
                columns,
                data: tableData,
                dateRange: { 
                    startDate: safeFormatDate(new Date(startDate), 'MMMM d, yyyy', 'Not set'), 
                    endDate: safeFormatDate(new Date(endDate), 'MMMM d, yyyy', 'Not set')
                },
                filename: `my-leave-report-${dateStr}.pdf`,
                extraInfo: {
                    summary
                }
            });

            Swal.fire({
                icon: 'success',
                title: 'Report Generated',
                text: 'Your leave report has been generated successfully!',
                timer: 2000,
                showConfirmButton: false
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
                text: 'There is no data available for the selected date range.',
            });
            return;
        }

        try {
            const dateStr = safeFormatDate(new Date(), 'yyyy-MM-dd', 'report');
            
            if (reportType === 'attendance') {
                const headers = [
                    { key: 'date', label: 'Date' },
                    { key: 'status', label: 'Status' },
                    { key: 'timeIn', label: 'Clock In' },
                    { key: 'timeOut', label: 'Clock Out' },
                    { key: 'lunchStart', label: 'Lunch Start' },
                    { key: 'lunchEnd', label: 'Lunch End' },
                    { key: 'hours', label: 'Hours Worked' },
                    { key: 'late', label: 'Late (min)' },
                    { key: 'overtime', label: 'Overtime (min)' },
                ];
                
                const csvData = filteredData.map(record => {
                    return {
                        date: safeFormatDate(record.date, 'yyyy-MM-dd'),
                        status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A',
                        timeIn: safeFormatDate(record.timeIn, 'HH:mm'),
                        timeOut: safeFormatDate(record.timeOut, 'HH:mm'),
                        lunchStart: safeFormatDate(record.lunchStart, 'HH:mm'),
                        lunchEnd: safeFormatDate(record.lunchEnd, 'HH:mm'),
                        hours: record.totalHoursWorked ? record.totalHoursWorked.toFixed(1) : '0',
                        late: record.lateMinutes || '0',
                        overtime: record.overtime || '0',
                    };
                });
                
                exportToCSV(csvData, headers, `my-attendance-data-${dateStr}.csv`);
            } else if (reportType === 'leave') {
                const headers = [
                    { key: 'startDate', label: 'Start Date' },
                    { key: 'endDate', label: 'End Date' },
                    { key: 'duration', label: 'Duration (days)' },
                    { key: 'type', label: 'Leave Type' },
                    { key: 'status', label: 'Status' },
                    { key: 'reason', label: 'Reason' },
                    { key: 'requestDate', label: 'Request Date' },
                ];
                
                const csvData = filteredData.map(record => {
                    let diffDays = 1;
                    let startDateFormatted = 'N/A';
                    let endDateFormatted = 'N/A';
                    
                    try {
                        if (record.startDate && record.endDate) {
                            const startDate = new Date(record.startDate);
                            const endDate = new Date(record.endDate);
                            
                            if (isValid(startDate) && isValid(endDate)) {
                                const diffTime = Math.abs(endDate - startDate);
                                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                startDateFormatted = format(startDate, 'yyyy-MM-dd');
                                endDateFormatted = format(endDate, 'yyyy-MM-dd');
                            }
                        }
                    } catch (error) {
                        console.error('Error calculating leave duration:', error);
                    }

                    return {
                        startDate: startDateFormatted,
                        endDate: endDateFormatted,
                        duration: diffDays,
                        type: record.leaveType ? record.leaveType.charAt(0).toUpperCase() + record.leaveType.slice(1) : 'N/A',
                        status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A',
                        reason: record.reason || 'N/A',
                        requestDate: safeFormatDate(record.createdAt, 'yyyy-MM-dd'),
                    };
                });
                
                exportToCSV(csvData, headers, `my-leave-data-${dateStr}.csv`);
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

    // Render the attendance data table
    const renderAttendanceTable = () => {
        return (
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.slice(0, 10).map((record, index) => (
                        <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {safeFormatDate(record.date, 'yyyy-MM-dd')}
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
                                {safeFormatDate(record.timeIn, 'HH:mm')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {safeFormatDate(record.timeOut, 'HH:mm')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {record.totalHoursWorked ? record.totalHoursWorked.toFixed(1) : '0'} hrs
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {record.lateMinutes > 0 ? `${record.lateMinutes} min` : 'No'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {record.overtime > 0 ? `${record.overtime} min` : 'No'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    // Render the leave data table
    const renderLeaveTable = () => {
        return (
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.slice(0, 10).map((record, index) => {
                        let diffDays = 1;
                        let startDate, endDate;
                        
                        try {
                            if (record.startDate && record.endDate) {
                                startDate = new Date(record.startDate);
                                endDate = new Date(record.endDate);
                                
                                if (isValid(startDate) && isValid(endDate)) {
                                    const diffTime = Math.abs(endDate - startDate);
                                    diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                }
                            }
                        } catch (error) {
                            console.error('Error calculating leave duration:', error);
                        }

                        return (
                            <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm">
                                        {startDate && isValid(startDate) ? format(startDate, 'MMM d, yyyy') : 'N/A'}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        to {endDate && isValid(endDate) ? format(endDate, 'MMM d, yyyy') : 'N/A'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {diffDays} day{diffDays > 1 ? 's' : ''}
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
                                    {record.rejectionReason && (
                                        <div className="text-xs text-red-600 mt-1">
                                            Rejection: {record.rejectionReason}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {safeFormatDate(record.createdAt, 'MMM d, yyyy')}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
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
                <h1 className="text-3xl font-semibold mb-6 text-white">My Reports</h1>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                className="input bg-white text-black block w-full rounded-md border border-gray-300 px-3 py-2"
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
                                    Try changing your date range to see more results.
                                </p>
                            </div>
                        ) : reportType === 'attendance' ? (
                            renderAttendanceTable()
                        ) : (
                            renderLeaveTable()
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

export default StaffReportsPage;