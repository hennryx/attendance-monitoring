// controllers/notificationController.js
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

// Get notifications for the current user
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100); // Limit to recent notifications
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: err.message
    });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID"
      });
    }
    
    const notification = await Notification.findOne({ 
      _id: id, 
      userId 
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or does not belong to this user"
      });
    }
    
    notification.read = true;
    await notification.save();
    
    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: err.message
    });
  }
};

// Mark all notifications as read for a user
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const result = await Notification.markAllAsRead(userId);
    
    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      count: result.modifiedCount || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error marking all notifications as read",
      error: err.message
    });
  }
};

// Get notification stats (unread count)
exports.getNotificationStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const unreadCount = await Notification.getUnreadCount(userId);
    
    res.status(200).json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving notification statistics",
      error: err.message
    });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID"
      });
    }
    
    const notification = await Notification.findOneAndDelete({ 
      _id: id, 
      userId 
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or does not belong to this user"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Notification deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: err.message
    });
  }
};