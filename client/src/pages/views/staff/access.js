import DashBoard from "./dashboard";

import { BsGrid1X2, BsCalendarCheck, BsBell, BsFileEarmarkText } from "react-icons/bs";
import LeaveHistoryPage from "./leaveHistory"
import NotificationsPage from "../../Notifications";
import StaffReportsPage from "./reports";

const access = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: BsGrid1X2,
    element: DashBoard,
  },
  
  {
    name: "Leave History",
    path: "/leave-history",
    icon: BsCalendarCheck,
    element: LeaveHistoryPage,
  },
  {
    name: "Notifications",
    path: "/my-notifications",
    icon: BsBell,
    element: NotificationsPage,
  }
  ,
  
  {
    name: "Reports",
    path: "/reports",
    icon: BsFileEarmarkText,
    element: StaffReportsPage,
  }
  // {
  //   name: "My Payroll",
  //   path: "/payroll",
  //   icon: BsCashStack,
  //   element: PayrollView,
  // },
  // {
  //   name: "",
  //   path: "/payslip/:id",
  //   element: PaySlip,
  //   hidden: true,
  // },
];

export default access;
