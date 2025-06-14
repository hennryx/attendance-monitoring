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
            if (data.profileImage instanceof File) {
                const formData = new FormData();

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

                const res = await uploadFile("users/update-profile", formData, token);

                set({
                    isSuccess: res.success,
                    isLoading: false,
                    message: "Profile updated successfully!",
                    user: res.user,
                });
            } else {
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

        try {
            if (!data.staffId || !data.fingerPrint) {
                set({
                    isLoading: false,
                    message: "Missing staff ID or fingerprint data",
                    isSuccess: false,
                });
                throw new Error("Missing staff ID or fingerprint data");
            }

            const requestData = {
                staffId: data.staffId,
                fingerPrint: data.fingerPrint,
                email: data.email || "",
            };

            console.log("Enrolling fingerprint with data:", {
                staffId: requestData.staffId,
                email: requestData.email,
                fingerPrintProvided: !!requestData.fingerPrint,
            });

            const res = await axiosTools.saveData("users/enroll", requestData, token);

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
