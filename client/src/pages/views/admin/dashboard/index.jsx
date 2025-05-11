    import React, { useEffect, useState } from 'react';
    import { FaUserCheck, FaUserClock, FaUserTimes } from 'react-icons/fa';
    import { FiUsers } from 'react-icons/fi';
    import { Line } from 'react-chartjs-2';
    import useAuthStore from '../../../../services/stores/authStore';
    import axiosTools from '../../../../services/utilities/axiosUtils';
    import { ENDPOINT } from '../../../../services/utilities';
    import Swal from 'sweetalert2';
    import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

    ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

    const Dashboard = () => {
    const { token } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);
    const [todayStats, setTodayStats] = useState({
        totalStaff: 0,
        present: 0,
        late: 0,
        absent: 0,
        pendingReasons: 0,
        attendanceRate: 0,
    });
    const [monthlyStats, setMonthlyStats] = useState([]);
    const [payrollStats, setPayrollStats] = useState({
        totalPayrolls: 0,
        totalGrossPay: 0,
        totalNetPay: 0,
        pendingPayrolls: 0,
    });

    useEffect(() => {
        const fetchData = async () => {
        setIsLoading(true);
        try {
            const attendanceResponse = await axiosTools.getData(`${ENDPOINT}/attendance/today`, '', token);

            if (attendanceResponse.success) {
                setTodayStats(attendanceResponse.stats);
            }

            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);

            const statsResponse = await axiosTools.getData(
            `${ENDPOINT}/attendance/stats`,
            {
                startDate: thirtyDaysAgo.toISOString(),
                endDate: today.toISOString(),
            },
            token
            );

            if (statsResponse.success && statsResponse.stats.daily) {
            setMonthlyStats(statsResponse.stats.daily);
            }

            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth() + 1;
            
            const payrollResponse = await axiosTools.getData(
            `${ENDPOINT}/payroll/stats`,
            {
                year: currentYear,
                month: currentMonth,
            },
            token
            );

            if (payrollResponse.success) {
            setPayrollStats({
                totalPayrolls: payrollResponse.stats.totalPayrolls,
                totalGrossPay: payrollResponse.stats.totalGrossPay,
                totalNetPay: payrollResponse.stats.totalNetPay,
                pendingPayrolls: payrollResponse.stats.statusBreakdown.pending,
            });
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            Swal.fire({
            icon: 'error',
            title: 'Failed to load dashboard',
            text: 'Could not fetch attendance and payroll data',
            });
        } finally {
            setIsLoading(false);
        }
        };

        if (token) {
        fetchData();
        }
    }, [token]);

    const chartData = {
        labels: monthlyStats.map(stat => stat.date),
        datasets: [
        {
            label: 'Present',
            data: monthlyStats.map(stat => stat.present),
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1,
        },
        {
            label: 'Late',
            data: monthlyStats.map(stat => stat.late),
            borderColor: 'rgba(255, 159, 64, 1)',
            backgroundColor: 'rgba(255, 159, 64, 0.2)',
            tension: 0.1,
        },
        {
            label: 'Absent',
            data: monthlyStats.map(stat => stat.absent),
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.1,
        },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
        legend: {
            position: 'top',
        },
        title: {
            display: true,
            text: 'Daily Attendance (Last 30 Days)',
        },
        },
        scales: {
        y: {
            beginAtZero: true,
            title: {
            display: true,
            text: 'Number of Staff',
            },
        },
        },
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
            <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6 flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-500 mr-4">
                    <FiUsers className="text-xl" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">Total Staff</p>
                    <p className="text-2xl font-semibold">{todayStats.totalStaff}</p>
                </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-500 mr-4">
                    <FaUserCheck className="text-xl" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">Present Today</p>
                    <p className="text-2xl font-semibold">{todayStats.present}</p>
                    <p className="text-xs text-gray-400">
                    {todayStats.attendanceRate.toFixed(1)}% attendance rate
                    </p>
                </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 flex items-center">
                <div className="p-3 rounded-full bg-yellow-100 text-yellow-500 mr-4">
                    <FaUserClock className="text-xl" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">Late Today</p>
                    <p className="text-2xl font-semibold">{todayStats.late}</p>
                    <p className="text-xs text-gray-400">
                    {todayStats.totalStaff > 0
                        ? ((todayStats.late / todayStats.totalStaff) * 100).toFixed(1)
                        : 0}% of staff
                    </p>
                </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 flex items-center">
                <div className="p-3 rounded-full bg-red-100 text-red-500 mr-4">
                    <FaUserTimes className="text-xl" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">Absent Today</p>
                    <p className="text-2xl font-semibold">{todayStats.absent}</p>
                    <p className="text-xs text-gray-400">
                    {todayStats.pendingReasons > 0 && (
                        <span className="text-red-500">{todayStats.pendingReasons} pending reasons</span>
                    )}
                    </p>
                </div>
                </div>
            </div>

            <h2 className="text-xl font-semibold mb-4">Payroll Overview (Current Month)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-500">Total Payrolls</p>
                <p className="text-2xl font-semibold">{payrollStats.totalPayrolls}</p>
                <p className="text-xs text-gray-400">
                    {payrollStats.pendingPayrolls > 0 && (
                    <span className="text-blue-500">{payrollStats.pendingPayrolls} pending</span>
                    )}
                </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-500">Total Gross Pay</p>
                <p className="text-2xl font-semibold">
                    ₱{payrollStats.totalGrossPay.toFixed(2)}
                </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-500">Total Net Pay</p>
                <p className="text-2xl font-semibold">
                    ₱{payrollStats.totalNetPay.toFixed(2)}
                </p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-8">
                <Line data={chartData} options={chartOptions} />
            </div>
        </div>
    );
};

export default Dashboard;