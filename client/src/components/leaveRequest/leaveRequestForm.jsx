import React, { useState, useEffect } from "react";
import { FaCalendarAlt, FaSpinner } from "react-icons/fa";
import useLeaveRequestStore from "../../services/stores/attendance/leaveRequestStore";
import useAuthStore from "../../services/stores/authStore";
import useNotificationStore from "../../services/stores/notificationStore";
import Swal from "sweetalert2";
import {
    Dialog,
    DialogBackdrop,
    DialogPanel,
    DialogTitle,
} from "@headlessui/react";

const LeaveRequestForm = ({ onClose, isOpen }) => {
    const [leaveData, setLeaveData] = useState({
        startDate: "",
        endDate: "",
        leaveType: "vacation",
        reason: "",
    });
    const { createLeaveRequest, getStaffSchedule, isLoading, isSuccess, message, reset } =
        useLeaveRequestStore();
    const { token, auth } = useAuthStore();
    const { addLeaveRequestNotification } = useNotificationStore();
    const [workdays, setWorkdays] = useState({});
    const [scheduleLoaded, setScheduleLoaded] = useState(false);
    const [dateErrors, setDateErrors] = useState({
        startDate: "",
        endDate: "",
    });

    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        setLeaveData((prev) => ({
            ...prev,
            startDate: tomorrow.toISOString().split("T")[0],
            endDate: tomorrow.toISOString().split("T")[0],
        }));

        // Fetch staff schedule when form is opened
        const fetchSchedule = async () => {
            if (auth?._id && token) {
                const scheduleData = await getStaffSchedule(auth._id, token);
                if (scheduleData?.workdays) {
                    setWorkdays(scheduleData.workdays);
                }
                setScheduleLoaded(true);
            }
        };

        fetchSchedule();
    }, [auth, token, getStaffSchedule]);

    useEffect(() => {
        if (isSuccess && message) {
            Swal.fire({
                icon: "success",
                title: "Leave Request Submitted",
                text: message,
            }).then(() => {
                reset();
                if (onClose) onClose();
            });

            const mockLeaveRequest = {
                ...leaveData,
                staffId: auth._id,
                staffName: `${auth.firstname || ""} ${auth.lastname || ""}`.trim(),
                status: "pending",
                createdAt: new Date().toISOString(),
            };

            addLeaveRequestNotification(mockLeaveRequest);
        } else if (!isSuccess && message) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: message,
            });
            reset();
        }
    }, [
        isSuccess,
        message,
        reset,
        onClose,
        addLeaveRequestNotification,
        auth,
        leaveData,
    ]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLeaveData((prev) => ({
            ...prev,
            [name]: value,
        }));

        // Validate date when it changes
        if (name === 'startDate' || name === 'endDate') {
            validateDate(name, value);
        }
    };

    const validateDate = (fieldName, dateValue) => {
        if (!dateValue) return;

        const date = new Date(dateValue);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayNames = [
            "sunday",
            "monday", 
            "tuesday", 
            "wednesday", 
            "thursday", 
            "friday", 
            "saturday"
        ];
        const dayName = dayNames[dayOfWeek];
        
        if (workdays && !workdays[dayName]) {
            setDateErrors(prev => ({
                ...prev,
                [fieldName]: `You don't have work scheduled on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}. No leave required.`
            }));
            return false;
        } else {
            setDateErrors(prev => ({
                ...prev,
                [fieldName]: ""
            }));
            return true;
        }
    };

    const isDateDisabled = (dateString) => {
        if (!scheduleLoaded || !workdays) return false;
        
        const date = new Date(dateString);
        const dayOfWeek = date.getDay();
        const dayNames = [
            "sunday",
            "monday", 
            "tuesday", 
            "wednesday", 
            "thursday", 
            "friday", 
            "saturday"
        ];
        const dayName = dayNames[dayOfWeek];
        
        return !workdays[dayName];
    };

    const validateDateRange = () => {
        if (!leaveData.startDate || !leaveData.endDate) return false;
        
        const start = new Date(leaveData.startDate);
        const end = new Date(leaveData.endDate);
        const dateArray = [];
        
        // Generate all dates between start and end date
        let currentDate = new Date(start);
        while (currentDate <= end) {
            dateArray.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Check if any selected date is not a workday
        for (const date of dateArray) {
            const dayOfWeek = date.getDay();
            const dayNames = [
                "sunday", "monday", "tuesday", "wednesday", 
                "thursday", "friday", "saturday"
            ];
            const dayName = dayNames[dayOfWeek];
            
            if (!workdays[dayName]) {
                const formattedDate = date.toLocaleDateString();
                Swal.fire({
                    icon: "warning",
                    title: "Non-workday Selected",
                    text: `${formattedDate} (${dayName.charAt(0).toUpperCase() + dayName.slice(1)}) is not a scheduled workday. Please select only workdays.`,
                });
                return false;
            }
        }
        
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate dates against schedule
        if (!validateDateRange()) {
            return;
        }

        const start = new Date(leaveData.startDate);
        const end = new Date(leaveData.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (start < today) {
            Swal.fire({
                icon: "error",
                title: "Invalid Start Date",
                text: "Start date cannot be in the past",
            });
            return;
        }

        if (end < start) {
            Swal.fire({
                icon: "error",
                title: "Invalid End Date",
                text: "End date cannot be before start date",
            });
            return;
        }

        if (!leaveData.reason.trim()) {
            Swal.fire({
                icon: "error",
                title: "Reason Required",
                text: "Please provide a reason for your leave request",
            });
            return;
        }

        await createLeaveRequest(
            {
                ...leaveData,
                staffId: auth._id,
            },
            token
        );
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-10">
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
                                        <FaCalendarAlt className="mr-2 text-blue-500" />
                                        Request Leave
                                    </DialogTitle>

                                    <div className="bg-white rounded-lg">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="required block text-sm font-medium text-gray-700 mb-1">
                                                    Start Date
                                                </label>
                                                <input
                                                    type="date"
                                                    name="startDate"
                                                    value={leaveData.startDate}
                                                    onChange={handleChange}
                                                    className={`w-full border ${dateErrors.startDate ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 text-black input bg-white`}
                                                    required
                                                    min={new Date().toISOString().split('T')[0]}
                                                />
                                                {dateErrors.startDate && (
                                                    <p className="text-red-500 text-xs mt-1">{dateErrors.startDate}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="required block text-sm font-medium text-gray-700 mb-1">
                                                    End Date
                                                </label>
                                                <input
                                                    type="date"
                                                    name="endDate"
                                                    value={leaveData.endDate}
                                                    onChange={handleChange}
                                                    className={`w-full border ${dateErrors.endDate ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 text-black input bg-white`}
                                                    required
                                                    min={leaveData.startDate}
                                                />
                                                {dateErrors.endDate && (
                                                    <p className="text-red-500 text-xs mt-1">{dateErrors.endDate}</p>
                                                )}
                                            </div>
                                        </div>

                                        {scheduleLoaded && (
                                            <div className="mb-4 bg-blue-50 p-3 rounded-md text-sm">
                                                <p className="font-medium text-blue-800">Your Schedule:</p>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {Object.entries(workdays).map(([day, isWorkday]) => (
                                                        <span 
                                                            key={day}
                                                            className={`px-2 py-1 rounded-full text-xs font-medium
                                                            ${isWorkday 
                                                                ? 'bg-green-100 text-green-800' 
                                                                : 'bg-gray-100 text-gray-500 line-through'}`}
                                                        >
                                                            {day.charAt(0).toUpperCase() + day.slice(1)}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="mt-2 text-xs text-blue-700">
                                                    Note: You can only request leave for your scheduled workdays.
                                                </p>
                                            </div>
                                        )}

                                        <div className="mb-4">
                                            <label className="required block text-sm font-medium text-gray-700 mb-1">
                                                Leave Type
                                            </label>
                                            <select
                                                name="leaveType"
                                                value={leaveData.leaveType}
                                                onChange={handleChange}
                                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-black input bg-white"
                                                required
                                            >
                                                <option value="vacation">Vacation</option>
                                                <option value="sick">Sick Leave</option>
                                                <option value="personal">Personal Leave</option>
                                                <option value="bereavement">Bereavement</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>

                                        <div className="mb-4">
                                            <label className="required block text-sm font-medium text-gray-700 mb-1">
                                                Reason
                                            </label>
                                            <textarea
                                                name="reason"
                                                value={leaveData.reason}
                                                onChange={handleChange}
                                                rows="3"
                                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-black input bg-white"
                                                placeholder="Please provide a reason for your leave request"
                                                required
                                            ></textarea>
                                        </div>

                                        <div className="flex justify-end space-x-3">
                                            {onClose && (
                                                <button
                                                    type="button"
                                                    onClick={onClose}
                                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                                >
                                                    Cancel
                                                </button>
                                            )}

                                            <button
                                                disabled={isLoading || dateErrors.startDate || dateErrors.endDate}
                                                onClick={handleSubmit}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2 disabled:bg-blue-300 disabled:cursor-not-allowed"
                                            >
                                                {isLoading ? (
                                                    <>
                                                        <FaSpinner className="animate-spin" />
                                                        <span>Submitting...</span>
                                                    </>
                                                ) : (
                                                    <span>Submit Request</span>
                                                )}
                                            </button>
                                        </div>
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

export default LeaveRequestForm;
