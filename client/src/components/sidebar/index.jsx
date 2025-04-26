import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import ROLES from '../../pages/views/roles';
import { HiChevronDown, HiChevronUp } from 'react-icons/hi';
import { toast } from 'react-toastify';

const Sidebar = ({ role, token }) => {
    const menuItems = ROLES[role] || [];
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedMenu, setExpandedMenu] = useState({});
    const [activeIndex, setActiveIndex] = useState(0);
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
        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        const path = location.pathname;
        const index = menuItems.findIndex(item => item.path === path);
        
        toggleMenu(index)

    }, [location.pathname])

    const toggleMenu = (index) => {
        setExpandedMenu((prev) => ({
            ...prev,
            [index]: !prev[index],
        }));
        setActiveIndex(index);
    };

    const handleLogout = (e) => {
        e.preventDefault();
        console.log("Loging out...");
        
    }

    return (
        <div className={`flex flex-col ${isCollapsed ? 'w-16' : 'w-64'} h-auto bg-white transition-all duration-300 relative`}>
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-2 m-4 text-black focus:outline-none transition flex justify-items-center justify-between items-center font-bold z-[1]"
            >
                <i className="fa-solid fa-bars"></i>
                {!isCollapsed && (
                    <span className='font-bold'>
                        Camille's Store
                    </span>
                )}
            </button>

            <nav className="sidebar z-[1]">
                <ul className="mt-4 space-y-2">
                    {menuItems.map((item, index) => (
                        <li key={index}>
                            <div
                                onClick={() => toggleMenu(index)}
                                className={`flex items-center justify-between space-x-2 p-2 rounded transition ${activeIndex === index ? 'border-l-4 border-red-600 text-black' : 'text-gray-300 hover:pl-1'} hover:border-l-4 border-red-600`}
                            >
                                {!item.children ? (
                                    <NavLink
                                        to={item.path}
                                        className="flex items-center space-x-2 text-black"
                                    >
                                        <i className={`${item.icon} mr-2`}></i>
                                        {!isCollapsed && (
                                            <span className='text-black' style={{ textWrap: "nowrap" }}>{item.name}</span>
                                        )}
                                    </NavLink>
                                ) : (
                                    <div
                                        className="flex items-center space-x-2 text-black cursor-pointer"
                                    >
                                        <i className={`${item.icon} mr-2`}></i>
                                        {!isCollapsed && (
                                            <span className='text-black' style={{ textWrap: "nowrap" }}>{item.name}</span>
                                        )}
                                    </div>
                                )}

                                {item.children && !isCollapsed && (
                                    <button
                                        style={{ marginRight: "1rem" }}
                                        className="focus:outline-none"
                                    >
                                        {expandedMenu[index] ? <HiChevronUp className="text-black" /> : <HiChevronDown className="text-black" />}
                                    </button>
                                )}
                            </div>

                            {item.children && expandedMenu[index] && !isCollapsed && (
                                <ul className="pl-6 space-y-1">
                                    {item.children.map((child, cIndex) => (
                                        <li key={cIndex}>
                                            <NavLink
                                                to={`${item.path}${child.path}`}
                                                className="flex items-center space-x-2 text-black hover:border-l-4 border-red-600 p-2 rounded transition"
                                            >
                                                <span className='text-black'>{child.name}</span>
                                            </NavLink>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                    <li
                        className='text-black flex flex-row items-center flex-nowrap'
                        onClick={(e) => handleLogout(e)}
                    >
                        <div className="p-2 cursor-pointer hover:pl-1 hover:border-l-4 border-red-600 flex-nowrap" style={{ textWrap: "nowrap" }}>
                            <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i>
                            {!isCollapsed && (
                                <span className='text-black ml-2'>
                                    Logout
                                </span>
                            )}
                        </div>
                    </li>
                </ul>
            </nav>

        </div>
    );
};

export default Sidebar;
