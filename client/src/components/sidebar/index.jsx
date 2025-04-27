import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import ROLES from "../../pages/views/roles";
import { HiChevronDown, HiChevronUp } from "react-icons/hi";
import { toast } from "react-toastify";
import useAuthStore from "../../services/stores/authStore";
import { BsList } from "react-icons/bs";
import { VscAccount } from "react-icons/vsc";
import { IoMdLogOut } from "react-icons/io";
import Logo from "../../assets/Logo.png";

import Swal from "sweetalert2";

const Sidebar = ({ role, token }) => {
  const menuItems = ROLES[role] || [];
  const { logout, isSuccess, message, reset, hardReset, auth } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAccOpen, setIsAccOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1199) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const path = location.pathname;
    const index = menuItems.findIndex((item) => item.path === path);

    toggleMenu(index);
  }, [location.pathname]);

  const toggleMenu = (index) => {
    setExpandedMenu((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
    setActiveIndex(index);
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    Swal.fire({
      title: "Are you sure?",
      text: "You want to logout?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "logout",
    }).then(async (result) => {
      if (result.isConfirmed) {
        await logout();
      }
    });
  };

  const handleNavigateAccount = () => {
    navigate("/account");
  };

  useEffect(() => {
    if (isSuccess && message === "User logged out") {
      navigate("/");
      window.location.reload();

      setTimeout(() => {
        hardReset();
      }, 100);
    } else if (message === "Logout failed") {
      toast.error(message || "Something went wrong.");
      reset();
    }
  }, [isSuccess, message]);

  return (
    <div
      className={`flex flex-col ${
        isCollapsed ? "w-16" : "w-64"
      } h-auto sidebar-main transition-[width] duration-500 relative gap-6 bg-blue-700`}
    >
      <div
        className={`transition flex ${
          isCollapsed ? "justify-center content-center" : "justify-between"
        } items-center`}
      >
        {!isCollapsed && (
          <span
            className="font-bold transition-opacity duration-300 opacity-100 text-white"
            onClick={() => navigate("/dashboard")}
          >
            <img
              src={Logo}
              alt="logo"
              className="h-18 transition-opacity duration-300 opacity-100"
            />
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2 m-4 text-black focus:outline-none transition font-bold z-[1]`}
        >
          <BsList
            size={25}
            className="transition-transform duration-300 text-white"
          />
        </button>
      </div>

      <nav className="sidebar z-[1] flex-1">
        <ul className="mt-2">
          {menuItems.map((item, index) => (
            <li
              key={index}
              className="flex flex-col items-end transition-all duration-300"
            >
              <div
                onClick={() => toggleMenu(index)}
                className={`w-[90%] flex items-center transition-colors duration-200 ${
                  activeIndex === index ? "border-l-4 border-white" : ""
                }`}
              >
                {!item.children ? (
                  <NavLink
                    to={item.path}
                    className={`${
                      isCollapsed && "py-4"
                    } text-white flex items-center space-x-2 h-full w-full px-4 py-2 transition-all duration-300`}
                  >
                    <item.icon />
                    {!isCollapsed && (
                      <span
                        className="p-2 transition-opacity duration-300 opacity-100 text-white"
                        style={{ textWrap: "nowrap" }}
                      >
                        {item.name}
                      </span>
                    )}
                  </NavLink>
                ) : (
                  <div className="flex items-center space-x-2 text-white cursor-pointer">
                    <i className={`${item.icon} mr-2`}></i>
                    {!isCollapsed && (
                      <span
                        className="text-white transition-opacity duration-300"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {item.name}
                      </span>
                    )}
                  </div>
                )}

                {item.children && !isCollapsed && (
                  <button
                    style={{ marginRight: "1rem" }}
                    className="focus:outline-none transition-transform duration-300"
                  >
                    {expandedMenu[index] ? (
                      <HiChevronUp className="text-black transform rotate-180" />
                    ) : (
                      <HiChevronDown className="text-black" />
                    )}
                  </button>
                )}
              </div>

              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  expandedMenu[index] && !isCollapsed ? "max-h-60" : "max-h-0"
                }`}
              >
                {item.children && (
                  <ul className="pl-6 space-y-1">
                    {item.children.map((child, cIndex) => (
                      <li key={cIndex}>
                        <NavLink
                          to={`${item.path}${child.path}`}
                          className="flex items-center space-x-2 text-black hover:border-l-4 border-red-600 p-2 rounded transition-all duration-300"
                        >
                          <span className="text-black">{child.name}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </nav>

      <div
        className={`text-black flex flex-col items-center flex-nowrap duration-300 ease-in-out bg-blue-900 ${
          isAccOpen && "h-40"
        }`}
      >
        <div
          className={`bg-blue-800 h-full w-full flex items-center transition-[height] duration-500 ease-in-out ${
            isCollapsed ? "justify-center p-4" : "justify-start py-4 pl-10 pr-4"
          } gap-4`}
          onClick={(e) => setIsAccOpen((prev) => !prev)}
        >
          <VscAccount className="text-white" size={22} />
          {!isCollapsed && (
            <span className="text-white transition-opacity duration-500">
              {auth.firstname}
            </span>
          )}
        </div>
        {isAccOpen && (
          <>
            <div
              className="py-2 pl-10 pr-4 cursor-pointer hover:bg-blue-600 w-full flex gap-4 items-center"
              onClick={handleNavigateAccount}
            >
              <VscAccount className="text-white" size={20} />
              {!isCollapsed && (
                <span className="ml-2 transition-opacity duration-300 text-white">
                  Account
                </span>
              )}
            </div>

            <div
              className="py-2 pl-10 pr-4 cursor-pointer  hover:bg-blue-600 w-full flex gap-4 items-center"
              onClick={(e) => handleLogout(e)}
            >
              <IoMdLogOut size={20} className="text-white" />
              {!isCollapsed && (
                <span className="ml-2 transition-opacity duration-300 text-white">
                  Logout
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
