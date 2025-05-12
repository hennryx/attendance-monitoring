import React, { useState } from "react";
import { HiX, HiMenu } from "react-icons/hi";
import Logo from "../../assets/Logo.png";
import { Dialog, DialogPanel } from "@headlessui/react";
import { NavLink } from "react-router-dom";

const Header = ({ handleToggle }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigation = [
    { name: "Home", href: "/" },
    { name: "About us", href: "/about-us" },
    { name: "Service", href: "/services" },
  ];

  return (
    <header className="absolute inset-x-0 top-0 z-50 bg-transparent">
      <nav
        aria-label="Global"
        className="flex items-center justify-between p-4 lg:px-8"
      >
        {/* <div className="flex lg:flex-1">
                    <div className="-m-1.5 p-1.5">
                        <span className="sr-only">Your Company</span>
                        <img
                            alt="img"
                            src={Logo}
                            className="h-16 w-auto"
                        />
                    </div>
                </div> */}
        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
          >
            <span className="sr-only">Open main menu</span>
            <HiMenu className="h-6 w-6 text-[#FDBE02]" />
          </button>
        </div>
        <div className="hidden lg:flex lg:gap-x-12 lg:justify-end">
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className="text-base flex justify-center items-center font-semibold leading-6 p-2 rounded-md btn border btn-ghost"
            >
              <span
                className="text-white hover:text-[#FDBE02]"
                style={{ textWrap: "nowrap" }}
              >
                {item.name}
              </span>
            </NavLink>
          ))}

          <button
            className="btn text-white border btn-ghost text-base font-semibold leading-6 p-2 rounded-md hover:text-[#FDBE02]"
            onClick={() => handleToggle("login", true)}
          >
            Login
          </button>
        </div>
      </nav>
      <Dialog
        open={mobileMenuOpen}
        onClose={setMobileMenuOpen}
        className="lg:hidden"
      >
        <div className="fixed inset-0 z-50" />
        <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
          <div className="flex items-center justify-between">
            <div className="-m-1.5 p-1.5">
              <span className="sr-only">Your Company</span>
              <img
                alt=""
                src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
                className="h-8 w-auto"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="-m-2.5 rounded-md p-2.5 text-gray-700"
            >
              <span className="sr-only">Close menu</span>
              <HiX className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-gray-500/10">
              <div className="space-y-2 py-6">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  >
                    {item.name}
                  </a>
                ))}
              </div>

              <div className="py-6 flex flex-col ">
                <button
                  className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50 text-left"
                  onClick={() => {
                    handleToggle("login", true);
                    setMobileMenuOpen(false);
                  }}
                >
                  Login
                </button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </header>
  );
};

export default Header;
