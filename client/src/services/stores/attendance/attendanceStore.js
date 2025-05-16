import { create } from "zustand";
import axiosTools from "../../utilities/axiosUtils";

const base = "attendance";
const useAttendanceStore = create((set, get) => ({
  data: [],
  publicAttendance: [],
  isLoading: false,
  message: "",
  isSuccess: false,
  attendanceType: null, // "in", "lunch-start", "lunch-end", "out"
  staffData: null, // Additional staff data returned by the server
  matchedUser: null, // To store matched user data from fingerprint match
  isMatched: false,

  getAttendance: async (token) => {
    try {
      const res = await axiosTools.getData(`${base}/getAll`, "", token);

      set({
        data: res.data,
        isSuccess: res.success,
      });
    } catch (error) {
      set({
        isSuccess: false,
        message: error?.response?.data?.message || "Something went wrong",
      });
    }
  },

  getPublicAttendance: async () => {
    try {
      const res = await axiosTools.getData(
        `${base}/getPublicAttendance`,
        "",
        ""
      );

      set({
        publicAttendance: res.data,
        isSuccess: res.success,
      });
    } catch (error) {
      set({
        isSuccess: false,
        message: error?.response?.data?.message || "Something went wrong",
      });
    }
  },

  // Match fingerprint without recording attendance
  matchFingerprint: async (fingerprint) => {
    set({
      isLoading: true,
      message: "",
      isSuccess: false,
      matchedUser: null,
    });

    try {
      // Call the fingerprint match endpoint
      const response = await axiosTools.saveData(
        "users/match",
        { fingerPrint: fingerprint },
        ""
      );

      if (response.success && response.matched) {
        set({
          isSuccess: true,
          matchedUser: {
            staffId: response.staffId,
            name: response.userData?.name,
            email: response.userData?.email,
          },
          isMatched: response.matched,
          isLoading: false,
          message: "Fingerprint matched",
        });
        return true;
      } else {
        set({
          isSuccess: false,
          message: response.message || "No matching fingerprint found",
          isMatched: response.matched,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        isLoading: false,
        isSuccess: false,
        message: error.message || "Failed to match fingerprint",
      });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  // Record attendance with staffId after confirmation
  recordAttendance: async (staffId) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      // This uses the auto-detect attendance endpoint with staffId
      const res = await axiosTools.saveData(
        `${base}/clock-in`,
        { staffId },
        ""
      );

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
        attendanceType: res.data?.attendanceType || "in",
        staffData: {
          name: res.data?.staffName,
          department: res.data?.department,
          position: res.data?.position,
        },
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to register attendance",
        isSuccess: false,
      });

      return { success: false, message: error.message };
    }
  },

  // Auto-detect attendance type and register it
  // This supports both fingerprint and staffId-based attendance
  clockIn: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      // This endpoint will auto-detect if it's clock-in, lunch, or clock-out
      const res = await axiosTools.saveData(`${base}/clock-in`, data, "");

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
        attendanceType: res.data?.attendanceType || "in", // Store the detected type
        staffData: {
          name: res.data?.staffName,
          department: res.data?.department,
          position: res.data?.position,
        },
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to register attendance",
        isSuccess: false,
      });

      return { success: false, message: error.message };
    }
  },

  // Method to register attendance with a fingerprint
  fingerprintAttendance: async (fingerprint) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      // This uses the same endpoint but passes fingerprint data
      const res = await axiosTools.saveData(
        `${base}/clock-in`,
        { fingerprint },
        ""
      );

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
        attendanceType: res.data?.attendanceType || "in",
        staffData: {
          name: res.data?.staffName,
          department: res.data?.department,
          position: res.data?.position,
        },
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to register attendance",
        isSuccess: false,
      });

      return { success: false, message: error.message };
    }
  },

  // Legacy methods - kept for compatibility
  clockOut: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.saveData(`${base}/clock-out`, data);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to clock out",
        isSuccess: false,
      });

      return { success: false, message: error.message };
    }
  },

  startLunch: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.saveData(`${base}/lunch-start`, data, "");

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to start lunch",
        isSuccess: false,
      });

      return { success: false, message: error.message };
    }
  },

  endLunch: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.saveData(`${base}/lunch-end`, data, "");

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to end lunch",
        isSuccess: false,
      });

      return { success: false, message: error.message };
    }
  },

  reset: () => {
    set({
      message: "",
      isSuccess: false,
      isLoading: false,
      attendanceType: null,
      staffData: null,
      matchedUser: null,
    });
  },
}));

export default useAttendanceStore;
