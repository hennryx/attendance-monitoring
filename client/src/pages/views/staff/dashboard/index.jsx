import React, { useEffect, useState } from 'react';
import { FaRegMoneyBillAlt } from 'react-icons/fa';
import useAuthStore from '../../../../services/stores/authStore';
import axiosTools from '../../../../services/utilities/axiosUtils';
import { ENDPOINT } from '../../../../services/utilities';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

const Dashboard = () => {
  const { token, auth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [recentPayroll, setRecentPayroll] = useState(null);
  const [absenceReason, setAbsenceReason] = useState('');
  const [reasonSubmitting, setReasonSubmitting] = useState(false);
  const [time, setTime] = useState(new Date());

  // Timer for clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!token || !auth?._id) return;

      setIsLoading(true);
      try {
        // Get today's attendance
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        
        const attendanceResponse = await axiosTools.getData(
          `${ENDPOINT}/attendance/staff`,
          { 
            staffId: auth._id,
            startDate: todayStr,
            endDate: todayStr
          },
          token
        );

        if (attendanceResponse.success && attendanceResponse.data.length > 0) {
          setTodayAttendance(attendanceResponse.data[0]);
        } else {
          setTodayAttendance(null);
        }

        // Get recent attendance (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentResponse = await axiosTools.getData(
          `${ENDPOINT}/attendance/staff`,
          { 
            staffId: auth._id,
            startDate: sevenDaysAgo.toISOString(),
            endDate: today.toISOString()
          },
          token
        );

        if (recentResponse.success) {
          setRecentAttendance(recentResponse.data);
        }

        // Get most recent payroll
        const payrollResponse = await axiosTools.getData(
          `${ENDPOINT}/payroll/staff/${auth._id}`,
          '',
          token
        );

        if (payrollResponse.success && payrollResponse.data.length > 0) {
          // Get the most recent one
          setRecentPayroll(payrollResponse.data[0]);
        }

      } catch (error) {
        console.error('Error fetching staff dashboard data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Failed to load dashboard',
          text: 'Could not fetch attendance and payroll data',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token, auth]);

  const handleSubmitReason = async () => {
    if (!absenceReason.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Empty Reason',
        text: 'Please enter a reason for your absence or lateness',
      });
      return;
    }

    if (!todayAttendance?._id) {
      Swal.fire({
        icon: 'error',
        title: 'No Attendance Record',
        text: 'No attendance record found for today',
      });
      return;
    }

    setReasonSubmitting(true);
    try {
      const response = await axiosTools.saveData(
        `${ENDPOINT}/attendance/submit-reason`,
        { 
          attendanceId: todayAttendance._id,
          reason: absenceReason 
        },
        token
      );

      if (response.success) {
        Swal.fire({
          icon: 'success',
          title: 'Reason Submitted',
          text: 'Your reason has been submitted successfully',
        });
        
        // Update today's attendance
        setTodayAttendance(response.data);
        setAbsenceReason('');
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: error.message || 'Failed to submit reason. Please try again.',
      });
    } finally {
      setReasonSubmitting(false);
    }
  };

  const downloadPaySlip = (payrollId) => {
    if (!payrollId) return;
    window.open(`${ENDPOINT}/payroll/payslip/${payrollId}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Loading dashboard data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-6">Staff Dashboard</h1>
      
      {/* Current Time & Date */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-4xl font-bold text-center mb-2">
          {format(time, 'h:mm:ss a')}
        </div>
        <div className="text-lg text-center text-gray-600">
          {format(time, 'EEEE, MMMM d, yyyy')}
        </div>
      </div>
      
      {/* Reason Submission (only for absent or late) */}
      {todayAttendance && (todayAttendance.status === 'absent' || todayAttendance.status === 'late') && !todayAttendance.reason && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Submit Reason</h2>
          <div className="mb-4">
            <p className="text-gray-600 mb-2">
              Please provide a reason for your {todayAttendance.status === 'absent' ? 'absence' : 'lateness'} today:
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
            {reasonSubmitting ? 'Submitting...' : 'Submit Reason'}
          </button>
        </div>
      )}
      
      {/* Recent Attendance */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Recent Attendance</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentAttendance.length > 0 ? (
                recentAttendance.map((record) => (
                  <tr key={record._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {format(new Date(record.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${record.status === 'present' ? 'bg-green-100 text-green-800' : 
                          record.status === 'late' ? 'bg-yellow-100 text-yellow-800' : 
                          record.status === 'absent' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.timeIn ? format(new Date(record.timeIn), 'h:mm a') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.timeOut ? format(new Date(record.timeOut), 'h:mm a') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.lateMinutes > 0 ? `${record.lateMinutes} min` : 'No'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.overtime > 0 ? `${record.overtime} min` : 'No'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No recent attendance records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Most Recent Payroll */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Latest Payroll</h2>
        {recentPayroll ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-gray-600 text-sm">Period</p>
                <p>{format(new Date(recentPayroll.periodStart), 'MMM d')} - {format(new Date(recentPayroll.periodEnd), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Gross Pay</p>
                <p className="font-semibold">${recentPayroll.grossPay.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Net Pay</p>
                <p className="font-semibold">${recentPayroll.netPay.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <p className={`
                  ${recentPayroll.paymentStatus === 'paid' ? 'text-green-600' : 
                    recentPayroll.paymentStatus === 'pending' ? 'text-yellow-600' : 
                    recentPayroll.paymentStatus === 'processing' ? 'text-blue-600' : 'text-gray-600'}
                `}>
                  {recentPayroll.paymentStatus.charAt(0).toUpperCase() + recentPayroll.paymentStatus.slice(1)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Days Worked</p>
                <p>{recentPayroll.daysWorked} / {recentPayroll.totalWorkingDays}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Hours Worked</p>
                <p>{recentPayroll.totalHoursWorked.toFixed(1)} hrs</p>
              </div>
            </div>
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
              onClick={() => downloadPaySlip(recentPayroll._id)}
            >
              <FaRegMoneyBillAlt />
              Download Pay Slip
            </button>
          </div>
        ) : (
          <p className="text-gray-500">No recent payroll information available</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;