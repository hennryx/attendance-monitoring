import { create } from "zustand";
import axiosTools from "../../utilities/axiosUtils";

const base = "attendance";
const useAttendanceStore = create((set, get) => ({
  data: [],
  isLoading: false,
  message: "",
  isSuccess: false,

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

  update: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const res = await axiosTools.updateData(`${base}/update`, data, token);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: "User updated successfully!",
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
    }
  },

  delete: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.deleteData(`${base}/delete`, data, token);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: "User deleted successfully!",
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
    }
  },

  clockIn: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.saveData(`${base}/clock-in`, data, "");

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
    }
  },

  clockOut: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.saveData(`${base}/clock-out`, data);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
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

export default useAttendanceStore;
