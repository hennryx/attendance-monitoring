import React, { useState, useEffect } from 'react';
import { FaCalendarAlt, FaSpinner } from 'react-icons/fa';
import useLeaveRequestStore from '../../services/stores/attendance/leaveRequestStore';
import useAuthStore from '../../services/stores/authStore';
import useNotificationStore from '../../services/stores/notificationStore';
import Swal from 'sweetalert2';

const LeaveRequestForm = ({ onClose }) => {
  const [leaveData, setLeaveData] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'vacation',
    reason: '',
  });
  const { createLeaveRequest, isLoading, isSuccess, message, reset } = useLeaveRequestStore();
  const { token, auth } = useAuthStore();
  const { addLeaveRequestNotification } = useNotificationStore();

  useEffect(() => {
    // Initialize with tomorrow's date as default start date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setLeaveData(prev => ({
      ...prev,
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: tomorrow.toISOString().split('T')[0],
    }));
  }, []);

  useEffect(() => {
    if (isSuccess && message) {
      Swal.fire({
        icon: 'success',
        title: 'Leave Request Submitted',
        text: message,
      }).then(() => {
        reset();
        if (onClose) onClose();
      });
      
      // Add a notification for admins (in real app, this would be handled by backend)
      // But for our mockup, we'll add it directly to the store
      const mockLeaveRequest = {
        ...leaveData,
        staffId: auth._id,
        staffName: `${auth.firstname || ''} ${auth.lastname || ''}`.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      addLeaveRequestNotification(mockLeaveRequest);
    } else if (!isSuccess && message) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message,
      });
      reset();
    }
  }, [isSuccess, message, reset, onClose, addLeaveRequestNotification, auth, leaveData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLeaveData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate dates
    const start = new Date(leaveData.startDate);
    const end = new Date(leaveData.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start < today) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Start Date',
        text: 'Start date cannot be in the past'
      });
      return;
    }
    
    if (end < start) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid End Date',
        text: 'End date cannot be before start date'
      });
      return;
    }
    
    if (!leaveData.reason.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Reason Required',
        text: 'Please provide a reason for your leave request'
      });
      return;
    }
    
    await createLeaveRequest({
      ...leaveData,
      staffId: auth._id
    }, token);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <FaCalendarAlt className="mr-2 text-blue-500" />
        Request Leave
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={leaveData.startDate}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              name="endDate"
              value={leaveData.endDate}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
          <select
            name="leaveType"
            value={leaveData.leaveType}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <textarea
            name="reason"
            value={leaveData.reason}
            onChange={handleChange}
            rows="3"
            className="w-full border border-gray-300 rounded-md px-3 py-2"
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
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
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
      </form>
    </div>
  );
};

export default LeaveRequestForm;