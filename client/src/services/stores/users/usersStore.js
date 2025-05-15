import { create } from "zustand";
import axiosTools from "../../utilities/axiosUtils";

const useUsersStore = create((set, get) => ({
  data: [],
  user: {},
  userFound: {},
  isLoading: false,
  message: "",
  isMatched: false,
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

    // Check that data has the required fingerprints array
    if (
      !data.fingerprints ||
      !Array.isArray(data.fingerprints) ||
      data.fingerprints.length < 2
    ) {
      set({
        isLoading: false,
        message: "At least 2 fingerprint scans are required",
        isSuccess: false,
      });
      return;
    }

    try {
      const res = await axiosTools.creteData("users/enroll", data, token);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message || "Fingerprint enrolled successfully!",
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to enroll fingerprint",
        isSuccess: false,
      });

      throw error;
    }
  },

  // Update to matchFingerPrint function
  matchFingerPrint: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false, isMatched: false });

    try {
      const res = await axiosTools.creteData("users/match", data);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message || "Fingerprint matching complete",
        userFound: res.userData,
        isMatched: res.matched,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to match fingerprint",
        isSuccess: false,
      });

      throw error;
    }
  },

  // Add a new verifyFingerPrint function
  verifyFingerPrint: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.creteData("users/verify", data);

      set({
        isSuccess: res.success,
        isLoading: false,
        message: res.message || "Fingerprint verification complete",
        isVerified: res.verified,
        userData: res.userData,
      });

      return res;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Failed to verify fingerprint",
        isSuccess: false,
      });

      throw error;
    }
  },

  reset: () => {
    set({
      message: "",
      isSuccess: false,
      isLoading: false,
      isMatched: false,
    });
  },
}));

export default useUsersStore;
