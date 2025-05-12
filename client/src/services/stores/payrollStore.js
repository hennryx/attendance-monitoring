// client/src/services/stores/payrollStore.js
import { create } from "zustand";
import axiosTools from "../utilities/axiosUtils";
import { ENDPOINT } from "../utilities";

const usePayrollStore = create((set, get) => ({
  payrolls: [],
  payroll: null,
  payrollStats: null,
  isLoading: false,
  message: "",
  isSuccess: false,

  // Get all payrolls for a period
  getPayrollsByPeriod: async (params, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.getData(
        `${ENDPOINT}/payroll/period`,
        params,
        token
      );

      if (response.success) {
        set({
          payrolls: response.data,
          isLoading: false,
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch payrolls",
          isSuccess: false,
        });
        return [];
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error fetching payrolls",
        isSuccess: false,
      });
      return [];
    }
  },

  // Get staff payroll
  getStaffPayroll: async (staffId, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.getData(
        `${ENDPOINT}/payroll/staff/${staffId}`,
        "",
        token
      );

      if (response.success) {
        set({
          payrolls: response.data,
          isLoading: false,
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch staff payroll",
          isSuccess: false,
        });
        return [];
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error fetching staff payroll",
        isSuccess: false,
      });
      return [];
    }
  },

  // Get single payroll by ID
  getPayrollById: async (id, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.getData(
        `${ENDPOINT}/payroll/${id}`,
        "",
        token
      );

      if (response.success) {
        set({
          payroll: response.data,
          isLoading: false,
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch payroll",
          isSuccess: false,
        });
        return null;
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error fetching payroll",
        isSuccess: false,
      });
      return null;
    }
  },

  // Generate payroll for a single staff member
  generatePayroll: async (payrollData, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.saveData(
        `${ENDPOINT}/payroll/generate`,
        payrollData,
        token
      );

      if (response.success) {
        set({
          payroll: response.data,
          isLoading: false,
          message: "Payroll generated successfully",
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to generate payroll",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to generate payroll");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error generating payroll",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Generate batch payroll
  generateBatchPayroll: async (batchData, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.saveData(
        `${ENDPOINT}/payroll/batch`,
        batchData,
        token
      );

      if (response.success) {
        set({
          isLoading: false,
          message: `Generated ${response.data.success.length} payrolls successfully`,
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to generate batch payroll",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to generate batch payroll");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error generating batch payroll",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Update payroll status
  updatePayrollStatus: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.updateData(
        `${ENDPOINT}/payroll/status`,
        data,
        token
      );

      if (response.success) {
        set({
          payroll: response.data,
          isLoading: false,
          message: "Payroll status updated successfully",
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to update payroll status",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to update payroll status");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error updating payroll status",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Add allowance to payroll
  addAllowance: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.saveData(
        `${ENDPOINT}/payroll/allowance`,
        data,
        token
      );

      if (response.success) {
        set({
          payroll: response.data,
          isLoading: false,
          message: "Allowance added successfully",
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to add allowance",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to add allowance");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error adding allowance",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Add deduction to payroll
  addDeduction: async (data, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.saveData(
        `${ENDPOINT}/payroll/deduction`,
        data,
        token
      );

      if (response.success) {
        set({
          payroll: response.data,
          isLoading: false,
          message: "Deduction added successfully",
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to add deduction",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to add deduction");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error adding deduction",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Remove allowance from payroll
  removeAllowance: async (payrollId, allowanceId, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.deleteData(
        `${ENDPOINT}/payroll/allowance/${payrollId}/${allowanceId}`,
        {},
        token
      );

      if (response.success) {
        set({
          payroll: response.data,
          isLoading: false,
          message: "Allowance removed successfully",
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to remove allowance",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to remove allowance");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error removing allowance",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Remove deduction from payroll
  removeDeduction: async (payrollId, deductionId, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.deleteData(
        `${ENDPOINT}/payroll/deduction/${payrollId}/${deductionId}`,
        {},
        token
      );

      if (response.success) {
        set({
          payroll: response.data,
          isLoading: false,
          message: "Deduction removed successfully",
          isSuccess: true,
        });
        return response.data;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to remove deduction",
          isSuccess: false,
        });
        throw new Error(response.message || "Failed to remove deduction");
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error removing deduction",
        isSuccess: false,
      });
      throw error;
    }
  },

  // Get payroll statistics
  getPayrollStats: async (params, token) => {
    set({ isLoading: true, message: "", isSuccess: false });
    try {
      const response = await axiosTools.getData(
        `${ENDPOINT}/payroll/stats`,
        params,
        token
      );

      if (response.success) {
        set({
          payrollStats: response.stats,
          isLoading: false,
          isSuccess: true,
        });
        return response.stats;
      } else {
        set({
          isLoading: false,
          message: response.message || "Failed to fetch payroll statistics",
          isSuccess: false,
        });
        return null;
      }
    } catch (error) {
      set({
        isLoading: false,
        message: error?.message || "Error fetching payroll statistics",
        isSuccess: false,
      });
      return null;
    }
  },

  // Download payslip PDF
  downloadPayslip: (payrollId) => {
    if (!payrollId) return false;

    try {
      window.open(`${ENDPOINT}/payroll/payslip/${payrollId}`, "_blank");
      return true;
    } catch (error) {
      console.error("Error downloading payslip:", error);
      return false;
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

export default usePayrollStore;
