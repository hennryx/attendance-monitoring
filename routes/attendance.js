// routes/attendance.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const {
  clockIn,
  clockOut,
  startLunch,
  endLunch,
  submitReason,
  verifyReason,
  getStaffAttendance,
  getTodayAttendance,
  markAbsentees,
  getAttendanceStats,
} = require("../controllers/attendanceController");

// Auth required for all routes
// router.use(protect);

// Clock in/out routes
router.post("/clock-in", clockIn);
router.post("/clock-out", clockOut);
router.post("/lunch-start", startLunch);
router.post("/lunch-end", endLunch);

// Reason submission
router.post("/submit-reason", protect, submitReason);

// Admin only routes
router.post("/verify-reason", protect, authorize("ADMIN"), verifyReason);
router.post("/mark-absentees", protect, authorize("ADMIN"), markAbsentees);
router.get("/today", protect, authorize("ADMIN"), getTodayAttendance);
router.get("/stats", protect, authorize("ADMIN"), getAttendanceStats);

// Get staff attendance (can be accessed by staff for own records or admin for any staff)
router.get("/staff", getStaffAttendance);

module.exports = router;
