// routes/shift.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const {
  createShift,
  getAllShifts,
  getShiftById,
  updateShift,
  deleteShift,
  assignShift,
  getStaffByShift,
} = require("../controllers/shiftController");

// Auth required for all routes
router.use(protect);

// Admin only routes
router.post("/", authorize("ADMIN"), createShift);
router.put("/:id", authorize("ADMIN"), updateShift);
router.delete("/:id", authorize("ADMIN"), deleteShift);
router.post("/assign", authorize("ADMIN"), assignShift);

// Routes accessible by all authenticated users
router.get("/", getAllShifts);
router.get("/:id", getShiftById);
router.get("/:shiftId/staff", getStaffByShift);

module.exports = router;