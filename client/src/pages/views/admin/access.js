import AddNewUser from "./addNewUser";
import DashBoard from "./dashboard";
import LeaveRequestsPage from "./leaveRequests";

import {
  BsGrid1X2,
  BsPersonAdd,
  BsCashStack,
  BsCalendarCheck,
  BsBell,
  BsFileEarmarkText,
} from "react-icons/bs";
import StaffScheduleManagement from "./staffSchedule";
import ShiftManagement from "./shifts";
import NotificationsPage from "../../Notifications";
import ReportsPage from "./reports";

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
  {
    name: "",
    path: "/notifications",
    icon: BsBell,
    element: NotificationsPage,
  },
  
  {
    name: "Reports",
    path: "/reports",
    icon: BsFileEarmarkText,
    element: ReportsPage,
  },
];

export default access;
