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

  matchFingerPrint: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.creteData("users/match", data);

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

  verifyFingerPrint: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.creteData("users/verify", data);

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

  enrollFingerPrint: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      // Use axiosTools instead of api
      const res = await axiosTools.creteData("fingerprint/enroll", data, token);

      if (res.success) {
        // Update the user's fingerprint status in the data array
        const updatedData = get().data.map((user) => {
          if (user._id === data.staffId) {
            return {
              ...user,
              hasFingerPrint: true,
              fingerprintEnrollStatus: res.enrollStatus,
              fingerprintTemplateCount: res.enrollCount,
            };
          }
          return user;
        });

        set({
          data: updatedData,
          isSuccess: true,
          isLoading: false,
          message: res.message || "Fingerprint enrolled successfully!",
        });

        return res;
      } else {
        throw new Error(res.message || "Enrollment failed");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Failed to enroll fingerprint",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Get enrollment status for a staff ID
  getEnrollmentStatus: async (staffId, token) => {
    try {
      // Use axiosTools instead of api
      const res = await axiosTools.getData(
        `fingerprint/templates/${staffId}`,
        "",
        token
      );

      if (res.success) {
        return {
          enrollCount: res.templateCount,
          templateCount: res.templateCount,
          enrollmentStatus: res.enrollmentStatus,
          minEnrollments: res.minEnrollments,
          maxEnrollments: res.maxEnrollments,
          remaining: res.remaining,
        };
      } else {
        throw new Error(res.message || "Failed to get enrollment status");
      }
    } catch (error) {
      console.error("Error getting enrollment status:", error);
      throw error;
    }
  },

  // Delete all fingerprint templates for a staff ID
  deleteFingerprints: async (staffId, token) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      // Use axiosTools instead of api
      const res = await axiosTools.deleteData(
        `fingerprint/templates/${staffId}`,
        { staffId },
        token
      );

      if (res.success) {
        // Update the user's fingerprint status in the data array
        const updatedData = get().data.map((user) => {
          if (user._id === staffId) {
            return {
              ...user,
              hasFingerPrint: false,
              fingerprintEnrollStatus: null,
              fingerprintTemplateCount: 0,
            };
          }
          return user;
        });

        set({
          data: updatedData,
          isSuccess: true,
          isLoading: false,
          message: res.message || "Fingerprints deleted successfully!",
        });

        return res;
      } else {
        throw new Error(res.message || "Failed to delete fingerprints");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Failed to delete fingerprints",
        isSuccess: false,
      });
      throw error;
    }
  },
}));

export default useUsersStore;
