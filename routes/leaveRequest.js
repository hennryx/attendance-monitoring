const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const {
  createLeaveRequest,
  getAllLeaveRequests,
  getUserLeaveRequests,
  updateLeaveRequestStatus,
  getUnhandledAbsences,
  getLeaveStatistics,
  getStaffSchedule,
} = require("../controllers/leaveRequestController");

router.get("/user-leave-requests/user/:id", protect, getUserLeaveRequests);
router.get("/get-leave-requests", protect, getAllLeaveRequests);
router.get("/attendance/unhandled-absences/:id", protect, getUnhandledAbsences);
router.get("/statistics", protect, getLeaveStatistics); 
router.get("/staff-schedule/:id", protect, getStaffSchedule);

router.post("/leave-requests", protect, createLeaveRequest);

router.put(
  "/update-leave-requests/:id/:status",
  protect,
  authorize("ADMIN"),
  updateLeaveRequestStatus
);

module.exports = router;
