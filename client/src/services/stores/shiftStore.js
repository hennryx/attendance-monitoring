// client/src/services/stores/shiftStore.js
import { create } from "zustand";
import axiosTools from "../utilities/axiosUtils";
import { ENDPOINT } from "../utilities";

const useShiftStore = create((set, get) => ({
  shifts: [],
  shift: null,
  isLoading: false,
  message: "",
  isSuccess: false,

  // Get all shifts
  getShifts: async (token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.getData(
        `${ENDPOINT}/shifts`,
        "",
        token
      );

      if (response.success) {
        set({
          shifts: response.data,
          isLoading: false,
          isSuccess: true,
        });
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch shifts",
          isSuccess: false,
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error fetching shifts",
        isSuccess: false,
      });
    }
  },

  // Get single shift
  getShift: async (id, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.getData(
        `${ENDPOINT}/shifts/${id}`,
        "",
        token
      );

      if (response.success) {
        set({
          shift: response.data,
          isLoading: false,
          isSuccess: true,
        });
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch shift",
          isSuccess: false,
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error fetching shift",
        isSuccess: false,
      });
    }
  },

  // Create shift
  createShift: async (shiftData, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.saveData(
        `${ENDPOINT}/shifts`,
        shiftData,
        token
      );

      if (response.success) {
        set({
          shift: response.data,
          isLoading: false,
          message: "Shift created successfully",
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to create shift",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to create shift");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error creating shift",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Update shift
  updateShift: async (id, shiftData, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.updateData(
        `${ENDPOINT}/shifts/${id}`,
        shiftData,
        token
      );

      if (response.success) {
        set({
          shift: response.data,
          isLoading: false,
          message: "Shift updated successfully",
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to update shift",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to update shift");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error updating shift",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Delete shift
  deleteShift: async (id, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.deleteData(
        `${ENDPOINT}/shifts/${id}`,
        {},
        token
      );

      if (response.success) {
        set({
          isLoading: false,
          message: "Shift deleted successfully",
          isSuccess: true,
        });
        return true;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to delete shift",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to delete shift");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error deleting shift",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Assign shift to staff
  assignShift: async (staffId, shiftId, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.saveData(
        `${ENDPOINT}/shifts/assign`,
        { staffId, shiftId },
        token
      );

      if (response.success) {
        set({
          isLoading: false,
          message: "Shift assigned successfully",
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to assign shift",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to assign shift");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error assigning shift",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Get staff by shift
  getStaffByShift: async (shiftId, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.getData(
        `${ENDPOINT}/shifts/${shiftId}/staff`,
        "",
        token
      );

      if (response.success) {
        set({
          isLoading: false,
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch staff",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to fetch staff");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error fetching staff",
        isSuccess: false,
      });
      throw error;
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

export default useShiftStore;
