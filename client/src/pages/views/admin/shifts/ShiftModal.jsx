// client/src/pages/views/admin/shifts/ShiftModal.jsx
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { HiOutlineX } from "react-icons/hi";
import { FaToggleOn, FaToggleOff } from "react-icons/fa";
import useShiftStore from "../../../../services/stores/shiftStore";
import Swal from "sweetalert2";

const initialShiftState = {
  name: "",
  description: "",
  monday: {
    enabled: true,
    startTime: "08:00",
    endTime: "17:00",
    lunchStartTime: "12:00",
    lunchDuration: 60,
  },
  tuesday: {
    enabled: true,
    startTime: "08:00",
    endTime: "17:00",
    lunchStartTime: "12:00",
    lunchDuration: 60,
  },
  wednesday: {
    enabled: true,
    startTime: "08:00",
    endTime: "17:00",
    lunchStartTime: "12:00",
    lunchDuration: 60,
  },
  thursday: {
    enabled: true,
    startTime: "08:00",
    endTime: "17:00",
    lunchStartTime: "12:00",
    lunchDuration: 60,
  },
  friday: {
    enabled: true,
    startTime: "08:00",
    endTime: "17:00",
    lunchStartTime: "12:00",
    lunchDuration: 60,
  },
  saturday: {
    enabled: false,
    startTime: "08:00",
    endTime: "17:00",
    lunchStartTime: "12:00",
    lunchDuration: 60,
  },
  sunday: {
    enabled: false,
    startTime: "08:00",
    endTime: "17:00",
    lunchStartTime: "12:00",
    lunchDuration: 60,
  },
  gracePeriod: 15,
  halfDayThreshold: 4,
  isActive: true,
};

const ShiftModal = ({ isOpen, onClose, selectedShift, token, onSuccess }) => {
  const { createShift, updateShift, isLoading } = useShiftStore();
  const [shiftData, setShiftData] = useState(initialShiftState);
  const [isEditMode, setIsEditMode] = useState(false);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (selectedShift) {
        setShiftData(selectedShift);
        setIsEditMode(true);
      } else {
        setShiftData(initialShiftState);
        setIsEditMode(false);
      }
    }
  }, [isOpen, selectedShift]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setShiftData({
      ...shiftData,
      [name]: value,
    });
  };

  // Handle day schedule changes
  const handleDayChange = (day, field, value) => {
    setShiftData({
      ...shiftData,
      [day]: {
        ...shiftData[day],
        [field]: field === "lunchDuration" ? parseInt(value, 10) : value,
      },
    });
  };

  // Toggle day enabled/disabled
  const toggleDay = (day) => {
    setShiftData({
      ...shiftData,
      [day]: {
        ...shiftData[day],
        enabled: !shiftData[day].enabled,
      },
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!shiftData.name) {
      Swal.fire("Error", "Shift name is required", "error");
      return;
    }

    try {
      if (isEditMode) {
        await updateShift(shiftData._id, shiftData, token);
        Swal.fire("Success", "Shift updated successfully", "success");
      } else {
        await createShift(shiftData, token);
        Swal.fire("Success", "Shift created successfully", "success");
      }

      if (onSuccess) onSuccess();
    } catch (error) {
      Swal.fire("Error", error.message || "Failed to save shift", "error");
    }
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
                  {isEditMode ? "Edit Shift" : "Create New Shift"}
                </DialogTitle>
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-gray-500"
                  onClick={onClose}
                >
                  <HiOutlineX className="h-6 w-6" />
                </button>
              </div>

              <form className="mt-4" onSubmit={handleSubmit}>
                {/* Basic Information */}
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Shift Name*
                      </label>
                      <input
                        type="text"
                        name="name"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        value={shiftData.name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        name="description"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        value={shiftData.description || ""}
                        onChange={handleInputChange}
                        rows="2"
                      />
                    </div>
                  </div>
                </div>

                {/* Schedule Configuration */}
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">
                    Schedule Configuration
                  </h4>

                  {/* Days of the Week */}
                  <div className="space-y-4">
                    {[
                      "monday",
                      "tuesday",
                      "wednesday",
                      "thursday",
                      "friday",
                      "saturday",
                      "sunday",
                    ].map((day) => (
                      <div key={day} className="border rounded-md p-3">
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="text-sm font-medium text-gray-700 capitalize">
                            {day}
                          </h5>
                          <button
                            type="button"
                            onClick={() => toggleDay(day)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {shiftData[day]?.enabled ? (
                              <div className="flex items-center">
                                <span className="mr-1 text-xs text-green-600">
                                  Enabled
                                </span>
                                <FaToggleOn className="text-green-600" />
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <span className="mr-1 text-xs text-gray-500">
                                  Disabled
                                </span>
                                <FaToggleOff className="text-gray-500" />
                              </div>
                            )}
                          </button>
                        </div>

                        {shiftData[day]?.enabled && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                className="w-full border border-gray-300 rounded-md px-3 py-1"
                                value={shiftData[day]?.startTime || "09:00"}
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
                                value={shiftData[day]?.endTime || "17:00"}
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
                                value={
                                  shiftData[day]?.lunchStartTime || "12:00"
                                }
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
                                value={shiftData[day]?.lunchDuration || 60}
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

                {/* Additional Settings */}
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">
                    Additional Settings
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Grace Period (minutes)
                      </label>
                      <input
                        type="number"
                        name="gracePeriod"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        value={shiftData.gracePeriod}
                        onChange={handleInputChange}
                        min="0"
                        max="120"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Time after shift start before counting as late
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Half-Day Threshold (hours)
                      </label>
                      <input
                        type="number"
                        name="halfDayThreshold"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        value={shiftData.halfDayThreshold}
                        onChange={handleInputChange}
                        min="0"
                        step="0.5"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Hours worked below this threshold counts as half-day
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        name="isActive"
                        className="rounded h-4 w-4 text-blue-600"
                        checked={shiftData.isActive}
                        onChange={(e) =>
                          setShiftData({
                            ...shiftData,
                            isActive: e.target.checked,
                          })
                        }
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Shift is active
                      </span>
                    </label>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                    disabled={isLoading}
                  >
                    {isLoading
                      ? "Saving..."
                      : isEditMode
                      ? "Update Shift"
                      : "Create Shift"}
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};

export default ShiftModal;
