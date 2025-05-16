import { create } from "zustand";
import axiosTools from "../../utilities/axiosUtils";

const base = "attendance";
const useAttendanceStore = create((set, get) => ({
  data: [],
  attendanceToday: {},
  publicAttendance: [],
  isLoading: false,
  message: "",
  isSuccess: false,
  attendanceType: null,
  staffData: null,
  matchedUser: null,
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

  getAttendanceToday: async (token) => {
    try {
      const res = await axiosTools.getData(`${base}/today`, "", token);

      set({
        attendanceToday: res.stats,
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

  matchFingerprint: async (fingerprint) => {
    set({
      isLoading: true,
      message: "",
      isSuccess: false,
      matchedUser: null,
    });

    try {
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

  recordAttendance: async (staffId) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
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

  fingerprintAttendance: async (fingerprint) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
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
