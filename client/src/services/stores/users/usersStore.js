// client/src/services/stores/users/usersStore.js
import { create } from "zustand";
import axiosTools from "../../utilities/axiosUtils";
import { uploadFile } from "../../utilities/fileUpload";

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
        message: error || "Signup failed",
        isSuccess: false,
      });
    }
  },

  update: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      // Check if data includes a profile image file
      if (data.profileImage instanceof File) {
        // Use FormData for file upload
        const formData = new FormData();

        // Add user data to FormData
        Object.keys(data).forEach((key) => {
          if (key === "profileImage") {
            formData.append("profileImage", data.profileImage);
          } else {
            formData.append(
              key,
              typeof data[key] === "object"
                ? JSON.stringify(data[key])
                : data[key]
            );
          }
        });

        // Use the upload utility
        const res = await uploadFile("users/update-profile", formData, token);

        set({
          isSuccess: res.success,
          isLoading: false,
          message: "Profile updated successfully!",
          user: res.user,
        });
      } else {
        // Regular update without file
        const res = await axiosTools.updateData("users/update", data, token);

        set({
          isSuccess: res.success,
          isLoading: false,
          message: "User updated successfully!",
          user: res.user,
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Update failed",
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
        message: error.message || "Delete failed",
        isSuccess: false,
      });
    }
  },

  enrollFingerPrint: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });

    // Check if data is FormData (for file uploads)
    const isFormData = data instanceof FormData;

    // If not FormData, check for required fingerprints
    if (
      !isFormData &&
      (!data.fingerprints ||
        !Array.isArray(data.fingerprints) ||
        data.fingerprints.length < 2)
    ) {
      set({
        isLoading: false,
        message: "At least 2 fingerprint scans are required",
        isSuccess: false,
      });
      return;
    }

    try {
      // Use the correct function based on data type
      const res = await axiosTools.saveData("users/enroll", data, token);

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

  // Upgraded function to handle both profile update and fingerprint enrollment
  updateUserWithFingerprint: async (userData, fingerprintData, token) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      // First update user profile
      if (userData) {
        await get().update(userData, token);
      }

      // Then enroll fingerprint if available
      if (
        fingerprintData &&
        fingerprintData.fingerprints &&
        Array.isArray(fingerprintData.fingerprints) &&
        fingerprintData.fingerprints.length >= 2
      ) {
        await get().enrollFingerPrint(fingerprintData, token);
      }

      set({
        isSuccess: true,
        isLoading: false,
        message: "User profile and fingerprint updated successfully!",
      });

      return true;
    } catch (error) {
      set({
        isLoading: false,
        message: error.message || "Profile update failed",
        isSuccess: false,
      });

      throw error;
    }
  },

  matchFingerPrint: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false, isMatched: false });

    try {
      const res = await axiosTools.createData("users/match", data);

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

  verifyFingerPrint: async (data) => {
    set({ isLoading: true, message: "", isSuccess: false });

    try {
      const res = await axiosTools.createData("users/verify", data);

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
