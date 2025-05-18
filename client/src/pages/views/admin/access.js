import AddNewUser from "./addNewUser";
import DashBoard from "./dashboard";
import PayrollManagement from "./payroll";
import LeaveRequestsPage from "./leaveRequests";

import {
  BsGrid1X2,
  BsPersonAdd,
  BsCashStack,
  BsClockHistory,
  BsGear,
  BsCalendarCheck,
  BsFileEarmarkText,
} from "react-icons/bs";
import StaffScheduleManagement from "./staffSchedule";
import ShiftManagement from "./shifts";

const access = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: BsGrid1X2,
    element: DashBoard,
  },

  {
    name: "Add new User",
    path: "/add-new-user",
    icon: BsPersonAdd,
    element: AddNewUser,
  },

  // {
  //   name: "Payroll",
  //   path: "/payroll",
  //   icon: BsCashStack,
  //   element: PayrollManagement,
  // },

  {
    name: "Schedules",
    path: "/schedules",
    icon: BsCashStack,
    element: StaffScheduleManagement,
  },

  {
    name: "Shifts",
    path: "/shifts",
    icon: BsCashStack,
    element: ShiftManagement,
  },

  {
    name: "Leave Requests",
    path: "/leave-requests",
    icon: BsCalendarCheck,
    element: LeaveRequestsPage,
  },
/* 
  {
    name: "Reports",
    path: "/reports",
    icon: BsFileEarmarkText,
    element: ReportsPage,
  }, */
];

export default access;
