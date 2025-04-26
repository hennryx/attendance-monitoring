import AddNewUser from "./addNewUser";
import DashBoard from "./dashboard";

import { BsGrid1X2, BsPersonAdd } from "react-icons/bs";

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
]

export default access;