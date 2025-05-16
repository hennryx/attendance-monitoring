import React, { useEffect, useState } from "react";
import { FaUserCheck, FaUserClock, FaUserTimes } from "react-icons/fa";
import { FiUsers } from "react-icons/fi";
import useAuthStore from "../../../../services/stores/authStore";
import Swal from "sweetalert2";
import { format } from "date-fns";
import { GrAnnounce } from "react-icons/gr";
import Table from "./table";
import useAttendanceStore from "../../../../services/stores/attendance/attendanceStore";

const Dashboard = () => {
  const { token } = useAuthStore();
  const { getAttendanceToday, data, attendanceToday } = useAttendanceStore();
  const [isLoading, setIsLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [todayStats, setTodayStats] = useState({
    totalStaff: 0,
    present: 0,
    late: 0,
    absent: 0,
    pendingReasons: 0,
    attendanceRate: 0,
  });
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await getAttendanceToday(token);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        Swal.fire({
          icon: "error",
          title: "Failed to load dashboard",
          text: "Could not fetch attendance and payroll data",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  useEffect(() => {
    if (attendanceToday && data) {
      setAttendance(data);
      console.log(data);

      setTodayStats(attendanceToday);
    }
  }, [attendanceToday, data]);

  if (isLoading) {
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
        <h1 className="text-3xl font-semibold mb-6 text-white">
          Admin Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-5">
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
                  : 0}
                % of staff
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
                  <span className="text-red-500">
                    {todayStats.pendingReasons} pending reasons
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center bg-white p-4 rounded-md shadow mb-4">
          <div className="flex gap-2 items-center">
            <div className="bg-[#FDBE02] p-4 rounded-full">
              <GrAnnounce size={40} />
            </div>
            <div className="text-lg text-center text-gray-600 flex flex-col gap-2">
              <div className="flex">
                <h2 className="text-xl font-semibold mr-2">
                  Today, {format(time, "EEEE, MMMM d, yyyy")}
                </h2>
              </div>
              <p className="text-sm font-normal">
                This show Payroll Overview (Current Month)
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <Table allData={attendance} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
