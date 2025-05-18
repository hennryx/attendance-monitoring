import { create } from "zustand";
import axiosTools from "../utilities/axiosUtils";

const baseUrl = "notifications"
const useNotificationStore = create((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    message: "",
    isSuccess: false,

    getUserNotifications: async (token) => {
        set({ isLoading: true });
        try {
            const response = await axiosTools.getData(
                `${baseUrl}/getUserNotifications`,
                "",
                token
            );

            if (response.success) {
                console.log(response.data);
                
                const unreadCount = response.data.filter(
                    (notification) => !notification.read
                ).length;

                set({
                    notifications: response.data,
                    unreadCount,
                    isLoading: false,
                });
                return response.data;
            } else {
                set({
                    isLoading: false,
                    message: response.message || "Failed to fetch notifications",
                });
                return [];
            }
        } catch (error) {
            set({
                isLoading: false,
                message: error.message || "Error fetching notifications",
            });
            return [];
        }
    },

    markAsRead: async (notificationId, token) => {
        try {
            if (typeof notificationId === 'string' && notificationId.length > 0) {
                if (notificationId.startsWith(Date.now().toString().substring(0, 6))) {
                    set((state) => ({
                        notifications: state.notifications.map((notification) =>
                            notification._id === notificationId
                                ? { ...notification, read: true }
                                : notification
                        ),
                        unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
                    }));
                    return true;
                }
            }

            const response = await axiosTools.updateData(
                `${baseUrl}/${notificationId}/read`,
                {},
                token
            );

            if (response && response.success) {
                set((state) => ({
                    notifications: state.notifications.map((notification) =>
                        notification._id === notificationId
                            ? { ...notification, read: true }
                            : notification
                    ),
                    unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
                }));
                return true;
            }

            set((state) => ({
                notifications: state.notifications.map((notification) =>
                    notification._id === notificationId
                        ? { ...notification, read: true }
                        : notification
                ),
                unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
            }));

            return true;
        } catch (error) {
            console.error("Failed to mark notification as read:", error);

            set((state) => ({
                notifications: state.notifications.map((notification) =>
                    notification._id === notificationId
                        ? { ...notification, read: true }
                        : notification
                ),
                unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
            }));

            return false;
        }
    },

    markAllAsRead: async (token) => {
        try {
            const response = await axiosTools.updateData(
                `${baseUrl}/read-all`,
                {},
                token
            );

            if (response.success) {
                set((state) => ({
                    notifications: state.notifications.map((notification) => ({
                        ...notification,
                        read: true,
                    })),
                    unreadCount: 0,
                }));
                return true;
            }
            return false;
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
            return false;
        }
    },

    addAbsenceReasonNotification: (absenceData) => {
        const newNotification = {
            _id: Date.now().toString(),
            type: 'absence_reason',
            title: 'Absence Reason Required',
            message: `You were ${absenceData.status} on ${new Date(absenceData.date).toLocaleDateString()}. Please provide a reason.`,
            data: absenceData,
            read: false,
            createdAt: new Date().toISOString()
        };

        set(state => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1
        }));
    },

    addLeaveRequestNotification: (leaveRequest) => {
        const newNotification = {
            _id: Date.now().toString(),
            type: 'leave_request',
            title: 'New Leave Request',
            message: `${leaveRequest.staffName} has requested leave from ${new Date(leaveRequest.startDate).toLocaleDateString()} to ${new Date(leaveRequest.endDate).toLocaleDateString()}.`,
            data: leaveRequest,
            read: false,
            createdAt: new Date().toISOString()
        };

        set(state => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1
        }));
    },

    addLeaveStatusNotification: (leaveRequest) => {
        const newNotification = {
            _id: Date.now().toString(),
            type: 'leave_status',
            title: 'Leave Request Updated',
            message: `Your leave request from ${new Date(leaveRequest.startDate).toLocaleDateString()} to ${new Date(leaveRequest.endDate).toLocaleDateString()} has been ${leaveRequest.status}.`,
            data: leaveRequest,
            read: false,
            createdAt: new Date().toISOString()
        };

        set(state => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1
        }));
    },

    reset: () => {
        set({
            message: "",
            isSuccess: false,
        });
    },

    clearAll: () => {
        set({
            notifications: [],
            unreadCount: 0
        });
    }
}));

export default useNotificationStore;