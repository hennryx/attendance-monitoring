import { create } from "zustand";
import axiosTools from "../../utilities/axiosUtils";

const useUsersStore = create((set, get) => ({
  data: [],
  user: {},
  isLoading: false,
  message: "",
  isSuccess: false,

  getUsers: async (token) => {
    try {
      const res = await axiosTools.getData("users/getAll", "", token);

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

  signup: async (item) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const res = await axiosTools.register("auth/signup", { ...item });

      set({
        isSuccess: res.success,
        isLoading: false,
        message: "User created successfully!",
        user: res.user,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error || "eSignup: signup failed",
        isSuccess: false,
      });
    }
  },

  update: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const res = await axiosTools.updateData("users/update", data, token);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: "User updated successfully!",
        user: res.user,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
    }
  },

  deleteUser: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.deleteData("users/delete", data, token);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: "User deleted successfully!",
        user: res.user,
      });
    } catch (error) {
      set({
        isLoading: false,
        message: error,
        isSuccess: false,
      });
    }
  },

  enrollFingerPrint: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.creteData("users/enroll", data, token);

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

export default useUsersStore;
