import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { HiOutlineX } from "react-icons/hi";
import Swal from "sweetalert2";
import axiosTools from "../../../../services/utilities/axiosUtils";
import { ENDPOINT } from "../../../../services/utilities";

const PayrollModal = ({ isOpen, onClose, onPayrollGenerated, token }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [settings, setSettings] = useState({
    workingHoursPerDay: 8,
    daysPerWeek: 5,
    lateDeductionRate: 0.1,
    absenceDeductionRate: 1,
    overtimeRate: 1.5,
  });

  // Fetch staff and departments when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchStaffAndDepartments();

      // Set default period (current month)
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      setPeriodStart(start.toISOString().split("T")[0]);
      setPeriodEnd(end.toISOString().split("T")[0]);
    }
  }, [isOpen, token]);

  const fetchStaffAndDepartments = async () => {
    setIsLoading(true);
    try {
      // Fetch active staff
      const staffResponse = await axiosTools.getData(
        `${ENDPOINT}/users/getAll`,
        "",
        token
      );

      console.log(staffResponse);

      if (staffResponse.success) {
        const staffsList = staffResponse.data;
        const activeStaff = staffsList.filter((s) => {
          return (
            s.status !== "inactive" &&
            s.status !== "terminated" &&
            s.baseSalary > 0
          );
        });

        console.log(activeStaff);

        setStaff(activeStaff);
      }

      // Fetch departments
      const deptResponse = await axiosTools.getData(
        `${ENDPOINT}/users/departments`,
        "",
        token
      );

      if (deptResponse.success) {
        setDepartments(deptResponse.data);
      }
    } catch (error) {
      console.error("Error fetching staff and departments:", error);
      Swal.fire({
        icon: "error",
        title: "Failed to load data",
        text: "Could not fetch staff and departments",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePayroll = async () => {
    // Validate inputs
    if (!periodStart || !periodEnd) {
      Swal.fire({
        icon: "warning",
        title: "Missing Information",
        text: "Please specify the period start and end dates",
      });
      return;
    }

    if (new Date(periodStart) > new Date(periodEnd)) {
      Swal.fire({
        icon: "warning",
        title: "Invalid Date Range",
        text: "Period start date cannot be after end date",
      });
      return;
    }

    if (!batchMode && !selectedStaffId) {
      Swal.fire({
        icon: "warning",
        title: "No Staff Selected",
        text: "Please select a staff member",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (batchMode) {
        // Generate payroll for multiple staff
        const response = await axiosTools.saveData(
          `${ENDPOINT}/payroll/batch`,
          {
            periodStart,
            periodEnd,
            settings,
            departmentFilter: selectedDepartment,
          },
          token
        );

        if (response.success) {
          Swal.fire({
            icon: "success",
            title: "Batch Payroll Generated",
            text: `Successfully generated ${response.data.success.length} payrolls`,
          });

          // If some payrolls failed
          if (response.data.failed.length > 0) {
            let failureMessages = response.data.failed
              .map((f) => `- ${f.name}: ${f.reason}`)
              .join("\n");

            Swal.fire({
              icon: "warning",
              title: "Some Payrolls Failed",
              text: `${response.data.failed.length} payrolls could not be generated`,
              footer: `<details><summary>Show Details</summary><pre>${failureMessages}</pre></details>`,
            });
          }

          onClose();
        }
      } else {
        // Generate payroll for single staff
        const response = await axiosTools.saveData(
          `${ENDPOINT}/payroll/generate`,
          {
            staffId: selectedStaffId,
            periodStart,
            periodEnd,
            settings,
          },
          token
        );

        if (response.success) {
          Swal.fire({
            icon: "success",
            title: "Payroll Generated",
            text: "The payroll has been generated successfully",
          });

          // Notify parent component about the new payroll
          if (onPayrollGenerated) {
            onPayrollGenerated(response.data);
          }

          onClose();
        }
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Generation Failed",
        text: error.message || "Failed to generate payroll",
      });
    } finally {
      setIsLoading(false);
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
            className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center">
                <DialogTitle
                  as="h3"
                  className="text-xl font-semibold text-gray-900"
                >
                  Generate Payroll
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
                {/* Mode Selection */}
                <div className="mb-4">
                  <div className="flex items-center mb-2">
                    <input
                      id="single-mode"
                      type="radio"
                      name="payroll-mode"
                      className="h-4 w-4 text-blue-600 border-gray-300"
                      checked={!batchMode}
                      onChange={() => setBatchMode(false)}
                    />
                    <label
                      htmlFor="single-mode"
                      className="ml-2 block text-sm font-medium text-gray-700"
                    >
                      Single Staff
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="batch-mode"
                      type="radio"
                      name="payroll-mode"
                      className="h-4 w-4 text-blue-600 border-gray-300"
                      checked={batchMode}
                      onChange={() => setBatchMode(true)}
                    />
                    <label
                      htmlFor="batch-mode"
                      className="ml-2 block text-sm font-medium text-gray-700"
                    >
                      Batch Processing
                    </label>
                  </div>
                </div>

                {/* Staff Selection (for single mode) */}
                {!batchMode && (
                  <div className="mb-4">
                    <label
                      htmlFor="staff"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Select Staff
                    </label>
                    <select
                      id="staff"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      disabled={isLoading}
                    >
                      <option value="">Select a staff member</option>
                      {staff.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.firstname} {s.lastname} - {s.department} - ₱
                          {s.baseSalary}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Department Filter (for batch mode) */}
                {batchMode && (
                  <div className="mb-4">
                    <label
                      htmlFor="department"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Department (Optional)
                    </label>
                    <select
                      id="department"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      disabled={isLoading}
                    >
                      <option value="">All Departments</option>
                      {departments.map((dept, index) => (
                        <option key={index} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Pay Period */}
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="period-start"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Period Start
                    </label>
                    <input
                      type="date"
                      id="period-start"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="period-end"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Period End
                    </label>
                    <input
                      type="date"
                      id="period-end"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Payroll Settings */}
                <div className="mb-4">
                  <details>
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                      Advanced Settings
                    </summary>
                    <div className="mt-2 pl-2 border-l-2 border-gray-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="working-hours"
                            className="block text-xs font-medium text-gray-700 mb-1"
                          >
                            Working Hours/Day
                          </label>
                          <input
                            type="number"
                            id="working-hours"
                            min="1"
                            max="24"
                            step="0.5"
                            className="mt-1 block w-full pl-3 pr-10 py-1 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            value={settings.workingHoursPerDay}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                workingHoursPerDay: parseFloat(e.target.value),
                              })
                            }
                            disabled={isLoading}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="days-per-week"
                            className="block text-xs font-medium text-gray-700 mb-1"
                          >
                            Working Days/Week
                          </label>
                          <input
                            type="number"
                            id="days-per-week"
                            min="1"
                            max="7"
                            className="mt-1 block w-full pl-3 pr-10 py-1 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            value={settings.daysPerWeek}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                daysPerWeek: parseInt(e.target.value),
                              })
                            }
                            disabled={isLoading}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="late-deduction"
                            className="block text-xs font-medium text-gray-700 mb-1"
                          >
                            Late Deduction Rate
                          </label>
                          <input
                            type="number"
                            id="late-deduction"
                            min="0"
                            max="1"
                            step="0.01"
                            className="mt-1 block w-full pl-3 pr-10 py-1 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            value={settings.lateDeductionRate}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                lateDeductionRate: parseFloat(e.target.value),
                              })
                            }
                            disabled={isLoading}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="absence-deduction"
                            className="block text-xs font-medium text-gray-700 mb-1"
                          >
                            Absence Deduction Rate
                          </label>
                          <input
                            type="number"
                            id="absence-deduction"
                            min="0"
                            max="2"
                            step="0.1"
                            className="mt-1 block w-full pl-3 pr-10 py-1 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            value={settings.absenceDeductionRate}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                absenceDeductionRate: parseFloat(
                                  e.target.value
                                ),
                              })
                            }
                            disabled={isLoading}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="overtime-rate"
                            className="block text-xs font-medium text-gray-700 mb-1"
                          >
                            Overtime Rate
                          </label>
                          <input
                            type="number"
                            id="overtime-rate"
                            min="1"
                            max="3"
                            step="0.1"
                            className="mt-1 block w-full pl-3 pr-10 py-1 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            value={settings.overtimeRate}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                overtimeRate: parseFloat(e.target.value),
                              })
                            }
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                onClick={handleGeneratePayroll}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </span>
                ) : batchMode ? (
                  "Generate Batch Payrolls"
                ) : (
                  "Generate Payroll"
                )}
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
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};

export default PayrollModal;
