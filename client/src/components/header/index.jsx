import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogPanel,
    PopoverGroup,
} from '@headlessui/react';
import {
    HiOutlineX,
    HiMenu,
} from 'react-icons/hi';
import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Logo from '../../assets/Logo.png';
import ROLES from '../../pages/views/roles';
import useAuthStore from '../../services/stores/authStore';
import Swal from 'sweetalert2';

const Header = ({ role }) => {
    const menuItems = ROLES[role] || [];
    const { logout, isSuccess, message, reset, hardReset, auth } = useAuthStore();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const navigate = useNavigate();
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    // Detect scroll direction
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY > lastScrollY) {
                // Scrolling down, hide the header
                setIsHeaderVisible(false);
            } else {
                // Scrolling up, show the header
                setIsHeaderVisible(true);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [lastScrollY]);

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
        setTimeout(() => {
            setIsPopoverOpen(false)
        }, [500])
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

    const togglePopover = () => setIsPopoverOpen((prev) => !prev);
    return (
        <header
            className={`bg-[#1b1b1b] w-full z-50 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
                }`}
        >
            <nav
                aria-label="Global"
                className="max-w-full flex items-center justify-between p-2 lg:px-8"
                style={{
                    boxShadow:
                        'rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px',
                }}
            >
                <div className="flex">
                    <a href="/dashboard" className="-m-1.5 p-1.5 flex justify-center items-center gap-2">
                        <img alt="" src={Logo} className="h-12 w-auto" />
                        <span className="text-white text-2xl font-semibold">AMS</span>
                    </a>
                </div>
                <div className="flex lg:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(true)}
                        className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
                    >
                        <span className="sr-only">Open main menu</span>
                        <HiMenu aria-hidden="true" className="h-6 w-6" />
                    </button>
                </div>

                <PopoverGroup className="hidden lg:flex lg:gap-x-12">
                    {menuItems.map((item, index) => {
                        if (item?.name) {
                            return (
                                <div key={index} className="hover:text-amber-500 p-2 rounded">
                                    <NavLink
                                        className={({ isActive }) =>
                                            isActive ? "flex items-center space-x-2 text-white border-b-4 border-amber-300" : "flex items-center space-x-2 text-white"
                                        }

                                        to={item.path}
                                    >
                                        <span
                                            className="text-base font-light leading-6 text-white hover:text-amber-300"
                                        >
                                            {item.name}
                                        </span>
                                    </NavLink>
                                </div>
                            )
                        }
                        return null;
                    })}
                </PopoverGroup>

                <div className="hidden lg:flex relative">
                    <button
                        className="hover:text-amber-300 p-2 rounded text-base font-light text-white"
                        onClick={togglePopover}
                    >
                        Account
                    </button>

                    {isPopoverOpen && (
                        <div className="absolute right-0 mt-10 bg-white rounded shadow-md w-52 p-2 z-50">
                            <button
                                onClick={handleNavigateAccount}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 rounded"
                            >
                                Profile
                            </button>
                            <button
                                onClick={handleLogout}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 rounded"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
                <div className="fixed inset-0 z-10" />
                <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
                    <div className="flex items-center justify-between">
                        <a href="#!" className="-m-1.5 p-1.5">
                            <span className="sr-only">Your Company</span>
                            <img alt="" src={Logo} className="h-14 w-auto" />
                        </a>
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(false)}
                            className="-m-2.5 rounded-md p-2.5 text-gray-700"
                        >
                            <span className="sr-only">Close menu</span>
                            <HiOutlineX aria-hidden="true" className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="mt-6 flow-root">
                        <div className="-my-6 divide-y divide-gray-500/10">
                            <div className="space-y-2 py-6">
                                {menuItems.map((item, index) => {
                                    if (item?.name) {
                                        return (
                                            <div key={index}>
                                                <NavLink to={item.path} className="flex items-center space-x-2 text-white">
                                                    <span className="text-sm font-semibold leading-6 text-white">
                                                        {item.name}
                                                    </span>
                                                </NavLink>
                                            </div>
                                        )
                                    }
                                    return null;
                                })}

                                <div className="dropdown dropdown-bottom w-full border-t-2 border-amber-300">
                                    <button
                                        className="w-full text-left text-white font-semibold hover:bg-gray-100 px-0 py-2 rounded"
                                        onClick={togglePopover}
                                    >
                                        Account
                                    </button>

                                    {isPopoverOpen && (
                                        <div className="mt-2 space-y-2 bg-gray-50 rounded p-2 shadow-sm">
                                            <button
                                                onClick={handleNavigateAccount}
                                                className="flex items-center space-x-2 text-white"
                                            >
                                                Profile
                                            </button>
                                            <button
                                                onClick={handleLogout}
                                                className="block w-full text-left text-sm text-gray-800 hover:underline"
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogPanel>
            </Dialog>
        </header>
    );
};

export default Header;