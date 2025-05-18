import React, { useState, useEffect, useRef } from 'react';
import { FaBell } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import useNotificationStore from '../../services/stores/notificationStore';
import useAuthStore from '../../services/stores/authStore';
import { format } from 'date-fns';

const NotificationCenter = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
    const { token, role } = useAuthStore();
    const navigate = useNavigate();
    const notificationRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [notificationRef]);

    const handleNotificationClick = (notification) => {
        markAsRead(notification._id, token);

        if (notification.type === 'leave_request') {
            navigate('/leave-requests');
        } else if (notification.type === 'absence_reason') {
            if (role === 'STAFF') {
                navigate('/dashboard', {
                    state: { showAbsenceDialog: true, absenceData: notification.data }
                });
            } else {
                navigate('/attendance');
            }
        } else if (notification.type === 'leave_status') {
            if (role === 'STAFF') {
                navigate('/leave-history');
            }
        }

        setIsOpen(false);
    };

    const handleMarkAllRead = async () => {
        await markAllAsRead(token);
    };

    return (
        <div className="relative" ref={notificationRef}>
            <button
                className="p-2 rounded-full hover:bg-gray-700 transition-colors relative"
                onClick={() => setIsOpen(!isOpen)}
            >
                <FaBell className="text-white w-5 h-5" />
                {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-50">
                    <div className="p-2 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Notifications</h3>
                        <button
                            className="text-xs text-blue-600 hover:text-blue-800"
                            onClick={handleMarkAllRead}
                        >
                            Mark all as read
                        </button>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No notifications
                            </div>
                        ) : (
                            notifications.map((notification, i) => (
                                <div
                                    key={i}
                                    className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''
                                        }`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex justify-between items-start">
                                        <p className="font-medium text-sm">{notification.title}</p>
                                        <span className="text-xs text-gray-500">
                                            {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-2 border-t border-gray-200 text-center">
                            <button
                                className="text-sm text-blue-600 hover:text-blue-800"
                                onClick={() => {
                                    if (role === 'ADMIN') {
                                        navigate('/notifications');
                                    } else {
                                        navigate('/my-notifications');
                                    }
                                    setIsOpen(false);
                                }}
                            >
                                View all notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;