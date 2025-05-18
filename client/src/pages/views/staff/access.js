import DashBoard from "./dashboard";

import { BsGrid1X2, BsCashStack, BsClockHistory, BsCalendarCheck, BsFileEarmarkText } from "react-icons/bs";
import PaySlip from "./payslip";
import PayrollView from "./payroll";
import LeaveHistoryPage from "./leaveHistory"

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
  }
  /* ,
  
  {
    name: "Reports",
    path: "/reports",
    icon: BsFileEarmarkText,
    element: ReportsPage,
  } */
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
