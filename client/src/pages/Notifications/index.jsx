import React, { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  FaBell,
  FaCheckCircle,
  FaEye,
  FaRegClock,
  FaCalendarAlt,
  FaExclamationCircle,
} from "react-icons/fa";
import useNotificationStore from "../../services/stores/notificationStore";
import useAuthStore from "../../services/stores/authStore";
import AbsenceReasonDialog from "../../components/absenceReason/absenceReasonDialog";
import Swal from "sweetalert2";

const NotificationsPage = () => {
  const { token } = useAuthStore();
  const {
    notifications,
    unreadCount,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    isLoading,
  } = useNotificationStore();

  const [showAbsenceDialog, setShowAbsenceDialog] = useState(false);
  const [absenceData, setAbsenceData] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (token) {
      getUserNotifications(token);
    }
  }, [token, getUserNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead(token);
      Swal.fire({
        icon: "success",
        title: "Success",
        text: "All notifications marked as read",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
      });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to mark notifications as read",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
      });
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification._id, token);
    }

    if (
      notification.type === "absence_reason" ||
      notification.type === "late_reason"
    ) {
      setAbsenceData(notification.data);
      setShowAbsenceDialog(true);
    } else if (notification.type === "leave_request") {
      // Handle leave request notification
    } else if (notification.type === "leave_status") {
      // Handle leave status notification
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "absence_reason":
        return <FaExclamationCircle className="text-red-500" />;
      case "leave_request":
        return <FaCalendarAlt className="text-blue-500" />;
      case "leave_status":
        return <FaCheckCircle className="text-green-500" />;
      case "attendance":
        return <FaRegClock className="text-purple-500" />;
      default:
        return <FaBell className="text-gray-500" />;
    }
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case "absence_reason":
        return "Absence";
      case "leave_request":
        return "Leave Request";
      case "leave_status":
        return "Leave Status";
      case "attendance":
        return "Attendance";
      case "payroll":
        return "Payroll";
      case "system":
        return "System";
      default:
        return "Notification";
    }
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "unread") return !notification.read;
    if (filter === "read") return notification.read;
    return true;
  });

  return (
    <div className="relative isolate min-h-lvh overflow-hidden bg-[linear-gradient(to_bottom,#1b1b1b_25%,#FAFAFA_25%)]">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ffffff] to-[#eceaff] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-semibold mb-6 text-white">
          Notifications
        </h1>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex space-x-4">
              <button
                className={`px-3 py-1 rounded-full text-sm ${
                  filter === "all"
                    ? "bg-blue-100 text-blue-800"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setFilter("all")}
              >
                All ({notifications.length})
              </button>
              <button
                className={`px-3 py-1 rounded-full text-sm ${
                  filter === "unread"
                    ? "bg-blue-100 text-blue-800"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setFilter("unread")}
              >
                Unread ({unreadCount})
              </button>
              <button
                className={`px-3 py-1 rounded-full text-sm ${
                  filter === "read"
                    ? "bg-blue-100 text-blue-800"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setFilter("read")}
              >
                Read ({notifications.length - unreadCount})
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                className="text-sm text-blue-600 hover:text-blue-800"
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-500 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <FaBell className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">
                No notifications
              </h3>
              <p className="mt-1 text-gray-500">
                {filter === "all"
                  ? "You don't have any notifications"
                  : filter === "unread"
                  ? "You don't have any unread notifications"
                  : "You don't have any read notifications"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredNotifications.map((notification, i) => (
                <div
                  key={i}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    !notification.read ? "bg-blue-50" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <div className="flex-shrink-0 flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {getNotificationTypeLabel(notification.type)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {notification.message}
                      </p>
                      <div className="mt-2 flex justify-between items-center">
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(
                            new Date(notification.createdAt),
                            { addSuffix: true }
                          )}
                        </p>
                        {!notification.read && (
                          <span className="inline-flex items-center text-xs text-blue-600">
                            <FaEye className="mr-1" /> Mark as read
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAbsenceDialog && absenceData && (
        <AbsenceReasonDialog
          absenceData={absenceData}
          onClose={() => setShowAbsenceDialog(false)}
          isOpen={showAbsenceDialog}
        />
      )}
    </div>
  );
};

export default NotificationsPage;
