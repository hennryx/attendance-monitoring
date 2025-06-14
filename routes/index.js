const express = require("express");
const router = express.Router();

const authRoutes = require("./auth");
const userRoutes = require("./users/userRoutes");
const attendanceRoutes = require("./attendance");
const leaveRequestRoutes = require("./leaveRequest")
const shiftRoutes = require("./shift");
const notificationRoutes = require("./notification");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/leave", leaveRequestRoutes);
router.use("/shifts", shiftRoutes);
router.use("/notifications", notificationRoutes); 

module.exports = router;