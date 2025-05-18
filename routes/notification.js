const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getNotificationStats,
  deleteNotification
} = require("../controllers/notoficationsController");

router.get("/getUserNotifications", protect, getUserNotifications);
router.get("/stats", protect, getNotificationStats);
router.put("/:id/read", protect, markAsRead);
router.put("/read-all", protect, markAllAsRead);
router.delete("/:id", protect, deleteNotification);

module.exports = router;