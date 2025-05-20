// client/src/pages/views/admin/addNewUser/modal.jsx
import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogBackdrop,
    DialogPanel,
    DialogTitle,
} from "@headlessui/react";
import { BsEye, BsEyeSlash, BsCalendar } from "react-icons/bs";
import Swal from "sweetalert2";
import useUsersStore from "../../../../services/stores/users/usersStore";
import useAuthStore from "../../../../services/stores/authStore";
import useShiftStore from "../../../../services/stores/shiftStore";

const initialUserData = {
    firstname: "",
    middlename: "",
    lastname: "",
    email: "",
    password: "",
    department: "",
    position: "",
    role: "STAFF",
    status: "active",
    salaryType: "monthly",
    baseSalary: 0,
    employeeId: "",
    assignedShift: "",
};

const Modal = ({
    isOpen,
    setIsOpen,
    setUserData,
    userData,
    isUpdate,
    setIsUpdate,
    initialData = initialUserData,
}) => {
    const [errorMsg, setErrorMsg] = useState("");
    const [viewPass, setViewPass] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [shifts, setShifts] = useState([]);

    const { signup, update } = useUsersStore();
    const { token } = useAuthStore();
    const { getShifts } = useShiftStore();

    // Fetch shifts when modal opens
    useEffect(() => {
        if (isOpen && token) {
            fetchShifts();
        }
    }, [isOpen, token]);

    const fetchShifts = async () => {
        try {
            const response = await getShifts(token);
            setShifts(response || []);
        } catch (error) {
            console.error("Error fetching shifts:", error);
        }
    };

    const handleUserData = (key, value) => {
        setUserData((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const validateForm = () => {
        const { firstname, lastname, email, department, position } = userData;

        if (!firstname.trim()) {
            setErrorMsg("First name is required");
            return false;
        }

        if (!lastname.trim()) {
            setErrorMsg("Last name is required");
            return false;
        }

        if (!email.trim()) {
            setErrorMsg("Email is required");
            return false;
        }

        if (!department.trim()) {
            setErrorMsg("Department is required");
            return false;
        }

        if (!position.trim()) {
            setErrorMsg("Position is required");
            return false;
        }

        if (!isUpdate && !userData.password) {
            setErrorMsg("Password is required");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        if (isUpdate) {
            Swal.fire({
                title: "Are you sure?",
                text: "This will update the user's information",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, update it!",
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await update(userData, token);
                }
            });
            return;
        }

        Swal.fire({
            title: "Are you sure?",
            text: "You want to add this user?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes",
        }).then(async (result) => {
            if (result.isConfirmed) {
                await signup(userData);
            }
        });
    };

    const handleCancel = () => {
        setIsOpen(false);
        setIsUpdate(false);
        setUserData(() => initialData);
        setShowAdvanced(false);
    };

    useEffect(() => {
        if (errorMsg) {
            setTimeout(() => {
                setErrorMsg("");
            }, 3000);
        }
    }, [errorMsg]);

    return (
        <Dialog open={isOpen} onClose={setIsOpen} className="relative z-10">
            <DialogBackdrop
                transition
                className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
            />

            <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center sm:p-0">
                    <DialogPanel
                        transition
                        className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg data-closed:sm:translate-y-0 data-closed:sm:scale-95"
                    >
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                    <DialogTitle
                                        as="h3"
                                        className="text-2xl font-semibold text-[#4154F1]"
                                    >
                                        {isUpdate ? "Update user" : "Add new user"}
                                    </DialogTitle>
                                    <div className="mt-2">
                                        <form onSubmit={handleSubmit}>
                                            <div className="border-b border-gray-900/10 pb-4">
                                                <h2 className="text-base/7 font-semibold text-gray-900">
                                                    Personal Information
                                                </h2>

                                                <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-6">
                                                    <div className="sm:col-span-2">
                                                        <label
                                                            htmlFor="first-name"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            First name*
                                                        </label>
                                                        <div className="mt-2">
                                                            <input
                                                                required
                                                                id="first-name"
                                                                name="firstname"
                                                                type="text"
                                                                value={userData.firstname}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                autoComplete="given-name"
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-2">
                                                        <label
                                                            htmlFor="middle-name"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Middle name
                                                        </label>
                                                        <div className="mt-2">
                                                            <input
                                                                id="middle-name"
                                                                name="middlename"
                                                                value={userData.middlename || ""}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                type="text"
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-2">
                                                        <label
                                                            htmlFor="last-name"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Last name*
                                                        </label>
                                                        <div className="mt-1">
                                                            <input
                                                                required
                                                                id="last-name"
                                                                name="lastname"
                                                                value={userData.lastname}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                type="text"
                                                                autoComplete="family-name"
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-3">
                                                        <label
                                                            htmlFor="department"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Department*
                                                        </label>
                                                        <div className="mt-1">
                                                            <input
                                                                required
                                                                id="department"
                                                                name="department"
                                                                value={userData.department}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                type="text"
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-3">
                                                        <label
                                                            htmlFor="position"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Position*
                                                        </label>
                                                        <div className="mt-1">
                                                            <input
                                                                required
                                                                id="position"
                                                                name="position"
                                                                value={userData.position}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                type="text"
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-3">
                                                        <label
                                                            htmlFor="email"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Email address*
                                                        </label>
                                                        <div className="mt-1">
                                                            <input
                                                                required
                                                                id="email"
                                                                name="email"
                                                                value={userData.email}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                type="email"
                                                                autoComplete="email"
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-3">
                                                        <label
                                                            htmlFor="role"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Role
                                                        </label>
                                                        <div className="mt-1">
                                                            <select
                                                                id="role"
                                                                name="role"
                                                                value={userData.role || "STAFF"}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            >
                                                                <option value="STAFF">Staff</option>
                                                                <option value="ADMIN">Admin</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {!isUpdate && (
                                                        <div className="sm:col-span-6">
                                                            <label
                                                                htmlFor="password"
                                                                className="block text-sm/6 font-medium text-gray-900"
                                                            >
                                                                Password*
                                                            </label>

                                                            <div className="mt-1 flex flex-row items-center rounded-md border border-gray-300">
                                                                <input
                                                                    required={!isUpdate}
                                                                    id="password"
                                                                    name="password"
                                                                    type={viewPass ? "text" : "password"}
                                                                    value={userData?.password || ""}
                                                                    onChange={(e) =>
                                                                        handleUserData(
                                                                            e.target.name,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    autoComplete="current-password"
                                                                    className="block w-full px-3 py-1.5 text-gray-900 border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                                />
                                                                <div className="px-3 h-full flex items-center">
                                                                    {viewPass ? (
                                                                        <BsEye
                                                                            size={20}
                                                                            className="text-gray-500 cursor-pointer"
                                                                            onClick={() =>
                                                                                setViewPass((prev) => !prev)
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <BsEyeSlash
                                                                            size={20}
                                                                            className="text-gray-500 cursor-pointer"
                                                                            onClick={() =>
                                                                                setViewPass((prev) => !prev)
                                                                            }
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Advanced Settings Button */}
                                            {/* <div className="mt-4 border-t border-gray-200 pt-4">
                                                <button
                                                    type="button"
                                                    className="flex items-center text-blue-600 hover:text-blue-800"
                                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                                >
                                                    <BsCalendar className="mr-2" />
                                                    {showAdvanced
                                                        ? "Hide Advanced Settings"
                                                        : "Show Advanced Settings (Payroll & Schedule)"}
                                                </button>
                                            </div> */}

                                            {/* Advanced Settings */}
                                            {showAdvanced && (
                                                <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-6">
                                                    <div className="sm:col-span-3">
                                                        <label
                                                            htmlFor="employeeId"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Employee ID
                                                        </label>
                                                        <div className="mt-1">
                                                            <input
                                                                id="employeeId"
                                                                name="employeeId"
                                                                value={userData.employeeId || ""}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                type="text"
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-3">
                                                        <label
                                                            htmlFor="status"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Status
                                                        </label>
                                                        <div className="mt-1">
                                                            <select
                                                                id="status"
                                                                name="status"
                                                                value={userData.status || "active"}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            >
                                                                <option value="active">Active</option>
                                                                <option value="inactive">Inactive</option>
                                                                <option value="on-leave">On Leave</option>
                                                                <option value="terminated">Terminated</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-2">
                                                        <label
                                                            htmlFor="salaryType"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Salary Type
                                                        </label>
                                                        <div className="mt-1">
                                                            <select
                                                                id="salaryType"
                                                                name="salaryType"
                                                                value={userData.salaryType || "monthly"}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            >
                                                                <option value="hourly">Hourly</option>
                                                                <option value="daily">Daily</option>
                                                                <option value="monthly">Monthly</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-4">
                                                        <label
                                                            htmlFor="baseSalary"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Base Salary
                                                        </label>
                                                        <div className="mt-1">
                                                            <input
                                                                id="baseSalary"
                                                                name="baseSalary"
                                                                value={userData.baseSalary || 0}
                                                                onChange={(e) =>
                                                                    handleUserData(
                                                                        e.target.name,
                                                                        parseFloat(e.target.value) || 0
                                                                    )
                                                                }
                                                                type="number"
                                                                min="0"
                                                                step={
                                                                    userData.salaryType === "hourly"
                                                                        ? "0.01"
                                                                        : "1"
                                                                }
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-6">
                                                        <label
                                                            htmlFor="assignedShift"
                                                            className="block text-sm/6 font-medium text-gray-900"
                                                        >
                                                            Assigned Shift
                                                        </label>
                                                        <div className="mt-1">
                                                            <select
                                                                id="assignedShift"
                                                                name="assignedShift"
                                                                value={userData.assignedShift || ""}
                                                                onChange={(e) =>
                                                                    handleUserData(e.target.name, e.target.value)
                                                                }
                                                                className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                                            >
                                                                <option value="">No Shift Assigned</option>
                                                                {shifts
                                                                    .filter((shift) => shift.isActive)
                                                                    .map((shift) => (
                                                                        <option key={shift._id} value={shift._id}>
                                                                            {shift.name}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                            <p className="mt-1 text-xs text-gray-500">
                                                                Shifts can be further customized in the Staff
                                                                Schedule Management section.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {errorMsg && (
                                                <div className="mt-4 text-red-800 bg-red-100 p-2 flex justify-center rounded-md">
                                                    {errorMsg}
                                                </div>
                                            )}

                                            <div className="bg-gray-50 mt-6 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-5">
                                                <button
                                                    type="submit"
                                                    className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold ${isUpdate
                                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                                        : "bg-green-600 text-white hover:bg-green-700"
                                                        } sm:ml-3 sm:w-auto shadow-xs`}
                                                >
                                                    {isUpdate ? "Update" : "Save"}
                                                </button>

                                                <button
                                                    type="button"
                                                    data-autofocus
                                                    onClick={() => handleCancel()}
                                                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-gray-300 ring-inset hover:bg-red-100 hover:text-red-800 sm:mt-0 sm:w-auto"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogPanel>
                </div>
            </div>
        </Dialog>
    );
};

export default Modal;
