import React, { useState } from 'react';
import { format } from 'date-fns';
import { FaExclamationCircle, FaSpinner } from 'react-icons/fa';
import useAttendanceStore from '../../services/stores/attendance/attendanceStore';
import useAuthStore from '../../services/stores/authStore';
import Swal from 'sweetalert2';

const AbsenceReasonDialog = ({ absenceData, onClose }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { submitReason } = useAttendanceStore();
  const { token } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Empty Reason',
        text: 'Please provide a reason for your absence'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await submitReason(
        {
          attendanceId: absenceData.attendanceId,
          reason: reason.trim()
        },
        token
      );
      
      Swal.fire({
        icon: 'success',
        title: 'Reason Submitted',
        text: 'Your absence reason has been submitted successfully'
      }).then(() => {
        if (onClose) onClose();
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: error.message || 'Failed to submit absence reason. Please try again later.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <FaExclamationCircle className="text-red-500 text-2xl mr-3" />
            <h2 className="text-xl font-semibold">Absence Explanation Required</h2>
          </div>
          
          <p className="mb-4 text-gray-600">
            You were {absenceData.status || 'absent'} on {format(new Date(absenceData.date), 'MMMM d, yyyy')}.
            Please provide a reason for your absence.
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Absence
              </label>
              <textarea
                id="reason"
                rows="4"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Please explain why you were absent..."
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
                  'Submit'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AbsenceReasonDialog;