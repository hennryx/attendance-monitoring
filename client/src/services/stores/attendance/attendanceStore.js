// client/src/services/stores/attendance/attendanceStore.js
import { create } from "zustand";
import axiosTools from "../../utilities/axiosUtils";
import { ENDPOINT } from "../../utilities";

const useAttendanceStore = create((set, get) => ({
  data: [],
  todayAttendance: null,
  recentAttendance: [],
  isLoading: false,
  message: "",
  isSuccess: false,

  // Get staff attendance records
  getStaffAttendance: async (staffId, token, startDate, endDate) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      // Format query parameters
      const queryParams = {
        staffId,
        startDate: startDate || new Date().toISOString().split("T")[0], // Default to today
        endDate: endDate || new Date().toISOString().split("T")[0], // Default to today
      };

      const res = await axiosTools.getData(
        `${ENDPOINT}/attendance/staff`,
        queryParams,
        token
      );

      if (res.success) {
        // If fetching today's attendance, store it separately
        if (
          (!startDate && !endDate) ||
          (startDate === new Date().toISOString().split("T")[0] &&
            endDate === new Date().toISOString().split("T")[0])
        ) {
          set({
            todayAttendance: res.data.length > 0 ? res.data[0] : null,
          });
        }

        set({
          data: res.data,
          isSuccess: true,
          isLoading: false,
        });
      } else {
        set({
          isSuccess: false,
          isLoading: false,
          message: res.message || "Failed to fetch attendance records",
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Something went wrong",
        isSuccess: false,
      });
    }
  },

  // Get recent attendance records (last 7 days)
  getRecentAttendance: async (staffId, token) => {
    set({ isLoading: true });
    try {
      // Calculate date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const queryParams = {
        staffId,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      };

      const res = await axiosTools.getData(
        `${ENDPOINT}/attendance/staff`,
        queryParams,
        token
      );

      if (res.success) {
        set({
          recentAttendance: res.data,
          isLoading: false,
        });
      } else {
        set({
          isLoading: false,
          message: res.message || "Failed to fetch recent attendance",
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Something went wrong",
      });
    }
  },

  // Clock in with fingerprint
  clockIn: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const res = await axiosTools.saveData(
        `${ENDPOINT}/attendance/clock-in`,
        data,
        token
      );

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message || "Clock-in successful",
        todayAttendance: res.data,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Clock-in failed",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Clock out
  clockOut: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const res = await axiosTools.saveData(
        `${ENDPOINT}/attendance/clock-out`,
        data,
        token
      );

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message || "Clock-out successful",
        todayAttendance: res.data,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Clock-out failed",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Start lunch break
  startLunch: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const res = await axiosTools.saveData(
        `${ENDPOINT}/attendance/lunch-start`,
        data,
        token
      );

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message || "Lunch break started",
        todayAttendance: res.data,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Failed to start lunch break",
        isSuccess: false,
      });
      throw error;
    }
  },

  // End lunch break
  endLunch: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const res = await axiosTools.saveData(
        `${ENDPOINT}/attendance/lunch-end`,
        data,
        token
      );

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message || "Lunch break ended",
        todayAttendance: res.data,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Failed to end lunch break",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Submit reason for absence or lateness
  submitReason: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const res = await axiosTools.saveData(
        `${ENDPOINT}/attendance/submit-reason`,
        data,
        token
      );

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message || "Reason submitted successfully",
        todayAttendance: res.data,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Failed to submit reason",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Get attendance statistics (Admin only)
  getAttendanceStats: async (params, token) => {
    set({ isLoading: true });
    try {
      const res = await axiosTools.getData(
        `${ENDPOINT}/attendance/stats`,
        params,
        token
      );

      if (res.success) {
        set({
          attendanceStats: res.stats,
          isLoading: false,
        });
        return res.stats;
      } else {
        set({
          isLoading: false,
          message: res.message || "Failed to fetch attendance statistics",
        });
        return null;
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Something went wrong",
      });
      return null;
    }
  },

  // Reset state
  reset: () => {
    set({
      message: "",
      isSuccess: false,
      isLoading: false,
    });
  },
}));

export default useAttendanceStore;
