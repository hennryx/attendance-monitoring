import React, { useState } from "react";
import { format } from "date-fns";
import { FaExclamationCircle, FaSpinner } from "react-icons/fa";
import useAttendanceStore from "../../services/stores/attendance/attendanceStore";
import useAuthStore from "../../services/stores/authStore";
import Swal from "sweetalert2";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

const AbsenceReasonDialog = ({ absenceData, onClose, isOpen }) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { submitReason } = useAttendanceStore();
  const { token } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Empty Reason",
        text: "Please provide a reason for your absence",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await submitReason(
        {
          attendanceId: absenceData.attendanceId,
          reason: reason.trim(),
        },
        token
      );

      Swal.fire({
        icon: "success",
        title: "Reason Submitted",
        text: "Your absence reason has been submitted successfully",
      }).then(() => {
        if (onClose) onClose();
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Submission Failed",
        text:
          error.message ||
          "Failed to submit absence reason. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
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
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <DialogTitle
                    as="h3"
                    className="text-2xl font-semibold text-[#4154F1] flex gap-2 items-center mb-4"
                  >
                    <FaExclamationCircle className="text-red-500 text-2xl mr-3" />
                    Absence Explanation Required
                  </DialogTitle>

                  <p className="mb-4 text-gray-600">
                    You were {absenceData.status || "absent"} on{" "}
                    {format(new Date(absenceData.date), "MMMM d, yyyy")}. Please
                    provide a reason for your{" "}
                    {absenceData.status === "late" ? "late" : "absence."}
                  </p>

                  <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                      <label
                        htmlFor="reason"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        {absenceData.status === "late"
                          ? "Reason for Late"
                          : "Reason for Absence"}
                      </label>
                      <textarea
                        id="reason"
                        rows="4"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder={`Please explain why you were ${
                          absenceData.status === "late" ? "late" : "absent"
                        }...`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                      ></textarea>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        onClick={onClose}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <FaSpinner className="animate-spin mr-2" />
                            Submitting...
                          </>
                        ) : (
                          "Submit"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};

export default AbsenceReasonDialog;
