import { create } from "zustand";
import axiosTools from "../../utilities/axiosUtils";

const base = "leave";
const useLeaveRequestStore = create((set, get) => ({
  leaveRequests: [],
  userLeaveRequests: [],
  pendingCount: 0,
  selectedRequest: null,
  isLoading: false,
  message: "",
  isSuccess: false,

  createLeaveRequest: async (leaveData, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.saveData(
        `${base}/leave-requests`,
        leaveData,
        token
      );

      if (response.success) {
        set({
          isSuccess: true,
          isLoading: false,
          message: "Leave request submitted successfully!",
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to submit leave request",
          isSuccess: false,
        });
        return null;
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to submit leave request",
        isSuccess: false,
      });
      throw error;
    }
  },

  getAllLeaveRequests: async (token) => {
    set({ isLoading: true });
    try {
      const response = await axiosTools.getData(
        `${base}/get-leave-requests`,
        "",
        token
      );

      if (response.success) {
        const pendingCount = response.data.filter(
          (request) => request.status === "pending"
        ).length;

        set({
          leaveRequests: response.data,
          pendingCount,
          isLoading: false,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch leave requests",
        });
        return [];
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Error fetching leave requests",
      });
      return [];
    }
  },

  getUserLeaveRequests: async (userId, token) => {
    set({ isLoading: true });
    try {
      const response = await axiosTools.getData(
        `${base}/user-leave-requests/user/${userId}`,
        "",
        token
      );

      if (response.success) {
        set({
          userLeaveRequests: response.data,
          isLoading: false,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch your leave requests",
        });
        return [];
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Error fetching your leave requests",
      });
      return [];
    }
  },

  updateLeaveRequestStatus: async (requestId, statusUpdate, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.updateData(
        `${base}/update-leave-requests/${requestId}/status`,
        statusUpdate,
        token
      );

      if (response.success) {
        set((state) => ({
          leaveRequests: state.leaveRequests.map((request) =>
            request._id === requestId
              ? { ...request, ...response.data }
              : request
          ),
          isSuccess: true,
          isLoading: false,
          message: `Leave request ${statusUpdate.status} successfully`,
        }));
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to update leave request status",
          isSuccess: false,
        });
        return null;
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Error updating leave request status",
        isSuccess: false,
      });
      throw error;
    }
  },

  getUnhandledAbsences: async (staffId, token) => {
    set({ isLoading: true });
    try {
      const response = await axiosTools.getData(
        `${base}/attendance/unhandled-absences/${staffId}`,
        "",
        token
      );

      if (response.success) {
        set({
          isLoading: false,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch unhandled absences",
        });
        return [];
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Error fetching unhandled absences",
      });
      return [];
    }
  },

  reset: () => {
    set({
      message: "",
      isSuccess: false,
      isLoading: false,
    });
  },
}));

export default useLeaveRequestStore;