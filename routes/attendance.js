// routes/attendance.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const {
  clockIn,
  submitReason,
  verifyReason,
  getStaffAttendance,
  getTodayAttendance,
  markAbsentees,
  getAttendanceStats,
  getPublicAttendance,
  getAllAttendance,
  getRecentAttendance,
} = require("../controllers/attendanceController");

router.post("/clock-in", clockIn);
router.get("/getPublicAttendance", getPublicAttendance);

router.get("/getAll", protect, authorize("ADMIN"), getAllAttendance);
router.get("/getRecent", protect, getRecentAttendance);

router.post("/submit-reason", protect, submitReason);
router.post("/verify-reason", protect, authorize("ADMIN"), verifyReason);
router.post("/mark-absentees", protect, authorize("ADMIN"), markAbsentees);
router.get("/today", protect, authorize("ADMIN"), getTodayAttendance);
router.get("/stats", protect, authorize("ADMIN"), getAttendanceStats);

router.get("/staff", getStaffAttendance);

module.exports = router;
