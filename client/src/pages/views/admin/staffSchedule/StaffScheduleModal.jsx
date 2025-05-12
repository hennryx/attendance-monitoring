// client/src/pages/views/admin/staffSchedule/StaffScheduleModal.jsx
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { HiOutlineX } from "react-icons/hi";
import {
  FaCalendarDay,
  FaClock,
  FaEdit,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import useShiftStore from "../../../../services/stores/shiftStore";
import useUsersStore from "../../../../services/stores/users/usersStore";
import Swal from "sweetalert2";

const StaffScheduleModal = ({
  isOpen,
  onClose,
  staff,
  shifts,
  token,
  onSuccess,
}) => {
  const { assignShift } = useShiftStore();
  const { update } = useUsersStore();
  const [selectedShiftId, setSelectedShiftId] = useState(
    staff?.assignedShift || ""
  );
  const [useCustomSchedule, setUseCustomSchedule] = useState(
    staff?.hasCustomSchedule || false
  );
  const [isLoading, setIsLoading] = useState(false);

  // Custom schedule state
  const [customSchedule, setCustomSchedule] = useState({
    monday: {
      isWorkday: true,
      startTime: "09:00",
      endTime: "17:00",
      lunchStartTime: "12:00",
      lunchDuration: 60,
    },
    tuesday: {
      isWorkday: true,
      startTime: "09:00",
      endTime: "17:00",
      lunchStartTime: "12:00",
      lunchDuration: 60,
    },
    wednesday: {
      isWorkday: true,
      startTime: "09:00",
      endTime: "17:00",
      lunchStartTime: "12:00",
      lunchDuration: 60,
    },
    thursday: {
      isWorkday: true,
      startTime: "09:00",
      endTime: "17:00",
      lunchStartTime: "12:00",
      lunchDuration: 60,
    },
    friday: {
      isWorkday: true,
      startTime: "09:00",
      endTime: "17:00",
      lunchStartTime: "12:00",
      lunchDuration: 60,
    },
    saturday: {
      isWorkday: false,
      startTime: "09:00",
      endTime: "17:00",
      lunchStartTime: "12:00",
      lunchDuration: 60,
    },
    sunday: {
      isWorkday: false,
      startTime: "09:00",
      endTime: "17:00",
      lunchStartTime: "12:00",
      lunchDuration: 60,
    },
  });

  // Initialize the form when a staff is selected
  useEffect(() => {
    if (staff) {
      setSelectedShiftId(staff.assignedShift || "");
      setUseCustomSchedule(staff.hasCustomSchedule || false);

      // If staff has a custom schedule, initialize with their current values
      if (staff.customSchedule) {
        setCustomSchedule(staff.customSchedule);
      }
    }
  }, [staff]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let updatedData = {
        _id: staff._id,
      };

      // Update shift assignment
      if (!useCustomSchedule && selectedShiftId) {
        // Assign a predefined shift
        await assignShift(staff._id, selectedShiftId, token);
        updatedData.assignedShift = selectedShiftId;
        updatedData.customSchedule = null; // Remove custom schedule
      } else if (useCustomSchedule) {
        // Use custom schedule
        updatedData.customSchedule = customSchedule;
        updatedData.assignedShift = null; // Remove assigned shift
      }

      // Update the user record
      await update(updatedData, token);

      Swal.fire({
        icon: "success",
        title: "Schedule Updated",
        text: "The staff schedule has been updated successfully",
      });

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error updating schedule:", error);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text:
          error.message || "Failed to update staff schedule. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle custom schedule day changes
  const handleDayChange = (day, field, value) => {
    setCustomSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]:
          field === "isWorkday"
            ? value
            : field === "lunchDuration"
            ? parseInt(value, 10)
            : value,
      },
    }));
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
            className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-2xl data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center">
                <DialogTitle
                  as="h3"
                  className="text-xl font-semibold text-gray-900"
                >
                  Assign Schedule: {staff?.name}
                </DialogTitle>
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-gray-500"
                  onClick={onClose}
                >
                  <HiOutlineX className="h-6 w-6" />
                </button>
              </div>

              <div className="mt-4">
                <form onSubmit={handleSubmit}>
                  {/* Schedule Type Toggle */}
                  <div className="mb-4">
                    <div className="flex space-x-4">
                      <button
                        type="button"
                        className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center gap-2 
                          ${
                            !useCustomSchedule
                              ? "bg-blue-100 text-blue-800 border-2 border-blue-300"
                              : "bg-gray-100 text-gray-600 border border-gray-300"
                          }`}
                        onClick={() => setUseCustomSchedule(false)}
                      >
                        <FaCalendarDay />
                        Use Predefined Shift
                      </button>
                      <button
                        type="button"
                        className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center gap-2 
                          ${
                            useCustomSchedule
                              ? "bg-blue-100 text-blue-800 border-2 border-blue-300"
                              : "bg-gray-100 text-gray-600 border border-gray-300"
                          }`}
                        onClick={() => setUseCustomSchedule(true)}
                      >
                        <FaEdit />
                        Use Custom Schedule
                      </button>
                    </div>
                  </div>

                  {/* Predefined Shift Selection */}
                  {!useCustomSchedule && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Shift
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        value={selectedShiftId}
                        onChange={(e) => setSelectedShiftId(e.target.value)}
                        required={!useCustomSchedule}
                      >
                        <option value="">-- Select a shift --</option>
                        {shifts
                          .filter((shift) => shift.isActive)
                          .map((shift) => (
                            <option key={shift._id} value={shift._id}>
                              {shift.name}
                            </option>
                          ))}
                      </select>

                      {selectedShiftId && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-md">
                          <h4 className="font-medium text-gray-700 mb-2">
                            Shift Details
                          </h4>
                          <div className="text-sm">
                            {shifts.find((s) => s._id === selectedShiftId)
                              ?.description && (
                              <p className="text-gray-600 mb-2">
                                {
                                  shifts.find((s) => s._id === selectedShiftId)
                                    ?.description
                                }
                              </p>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  Working Days
                                </span>
                                <div className="flex space-x-1 mt-1">
                                  {[
                                    "monday",
                                    "tuesday",
                                    "wednesday",
                                    "thursday",
                                    "friday",
                                    "saturday",
                                    "sunday",
                                  ].map((day) => {
                                    const shift = shifts.find(
                                      (s) => s._id === selectedShiftId
                                    );
                                    const isEnabled =
                                      shift && shift[day]?.enabled;
                                    return (
                                      <span
                                        key={day}
                                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs
                                          ${
                                            isEnabled
                                              ? "bg-green-100 text-green-800"
                                              : "bg-gray-100 text-gray-400"
                                          }`}
                                        title={
                                          day.charAt(0).toUpperCase() +
                                          day.slice(1)
                                        }
                                      >
                                        {day.charAt(0).toUpperCase()}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Hours</span>
                                <p className="text-gray-600">
                                  {shifts.find((s) => s._id === selectedShiftId)
                                    ?.monday?.startTime || "09:00"}{" "}
                                  -{" "}
                                  {shifts.find((s) => s._id === selectedShiftId)
                                    ?.monday?.endTime || "17:00"}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">Lunch</span>
                                <p className="text-gray-600">
                                  {shifts.find((s) => s._id === selectedShiftId)
                                    ?.monday?.lunchStartTime || "12:00"}{" "}
                                  (
                                  {shifts.find((s) => s._id === selectedShiftId)
                                    ?.monday?.lunchDuration || 60}{" "}
                                  min)
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Schedule */}
                  {useCustomSchedule && (
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-700 mb-3">
                        Custom Schedule
                      </h4>

                      <div className="space-y-4">
                        {Object.keys(customSchedule).map((day) => (
                          <div key={day} className="border rounded-md p-3">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center">
                                <h5 className="text-sm font-medium text-gray-700 capitalize mr-3">
                                  {day}
                                </h5>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={customSchedule[day].isWorkday}
                                    onChange={(e) =>
                                      handleDayChange(
                                        day,
                                        "isWorkday",
                                        e.target.checked
                                      )
                                    }
                                    className="rounded h-4 w-4 text-blue-600"
                                  />
                                  <span className="ml-2 text-sm text-gray-600">
                                    Work day
                                  </span>
                                </label>
                              </div>
                            </div>

                            {customSchedule[day].isWorkday && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Start Time
                                  </label>
                                  <input
                                    type="time"
                                    className="w-full border border-gray-300 rounded-md px-3 py-1"
                                    value={customSchedule[day].startTime}
                                    onChange={(e) =>
                                      handleDayChange(
                                        day,
                                        "startTime",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    End Time
                                  </label>
                                  <input
                                    type="time"
                                    className="w-full border border-gray-300 rounded-md px-3 py-1"
                                    value={customSchedule[day].endTime}
                                    onChange={(e) =>
                                      handleDayChange(
                                        day,
                                        "endTime",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Lunch Start
                                  </label>
                                  <input
                                    type="time"
                                    className="w-full border border-gray-300 rounded-md px-3 py-1"
                                    value={customSchedule[day].lunchStartTime}
                                    onChange={(e) =>
                                      handleDayChange(
                                        day,
                                        "lunchStartTime",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Lunch Duration (minutes)
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full border border-gray-300 rounded-md px-3 py-1"
                                    value={customSchedule[day].lunchDuration}
                                    onChange={(e) =>
                                      handleDayChange(
                                        day,
                                        "lunchDuration",
                                        e.target.value
                                      )
                                    }
                                    min="0"
                                    max="240"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      disabled={isLoading}
                    >
                      {isLoading ? "Saving..." : "Save Schedule"}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0"
                      onClick={onClose}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};

export default StaffScheduleModal;
