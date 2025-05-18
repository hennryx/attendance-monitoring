const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true,
    },

    type: {
        type: String,
        enum: ["absence_reason", "leave_request", "leave_status", "attendance", "payroll", "system"],
        required: true,
    },

    title: {
        type: String,
        required: true,
    },

    message: {
        type: String,
        required: true,
    },

    data: {
        type: Object,
        default: {},
    },

    read: {
        type: Boolean,
        default: false,
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for efficient queries
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ createdAt: -1 });

// Static method to create multiple notifications
NotificationSchema.statics.createMultiple = async function (notifications) {
    return await this.insertMany(notifications);
};

// Static method to mark all notifications as read for a user
NotificationSchema.statics.markAllAsRead = async function (userId) {
    return await this.updateMany(
        { userId, read: false },
        { $set: { read: true } }
    );
};

// Static method to get unread count for a user
NotificationSchema.statics.getUnreadCount = async function (userId) {
    return await this.countDocuments({ userId, read: false });
};

module.exports = mongoose.model("Notification", NotificationSchema);