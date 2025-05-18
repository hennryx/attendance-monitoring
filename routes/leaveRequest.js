const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const { createLeaveRequest, getAllLeaveRequests, getUserLeaveRequests, updateLeaveRequestStatus, getUnhandledAbsences } = require("../controllers/leaveRequestController");

router.get("/user-leave-requests/user/", getUserLeaveRequests);
router.get("/get-leave-requests", getAllLeaveRequests);
router.get("/attendance/unhandled-absences", getUnhandledAbsences);

router.post("/leave-requests", protect, createLeaveRequest);

router.put("/update-leave-requests", protect, authorize("ADMIN"), updateLeaveRequestStatus);


module.exports = router;
