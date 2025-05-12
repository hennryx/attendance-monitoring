import DashBoard from "./dashboard";

import { BsGrid1X2, BsCashStack, BsClockHistory } from "react-icons/bs";
import PaySlip from "./payslip";
import PayrollView from "./payroll";

const access = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: BsGrid1X2,
    element: DashBoard,
  },
  {
    name: "My Payroll",
    path: "/payroll",
    icon: BsCashStack,
    element: PayrollView,
  },
  {
    name: "",
    path: "/payslip/:id",
    element: PaySlip,
    hidden: true,
  },
];

export default access;
