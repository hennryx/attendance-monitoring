const express = require("express");
const router = express.Router();

const authRoutes = require("./auth");
const userRoutes = require("./users/userRoutes");
const attendanceRoutes = require("./attendance");
const payrollRoutes = require("./payroll");
const shiftRoutes = require("./shift");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/payroll", payrollRoutes);
router.use("/shifts", shiftRoutes);

module.exports = router;