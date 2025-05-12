// routes/payroll.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const {
  generatePayroll,
  generatePayrollBatch,
  updatePayrollStatus,
  getPayrollById,
  getStaffPayroll,
  getPayrollsByPeriod,
  addAllowance,
  addDeduction,
  removeAllowance,
  removeDeduction,
  generatePaySlip,
  getPayrollStats,
} = require("../controllers/payrollController");

router.get("/payslip/:id", generatePaySlip);

// Auth required for all routes
router.use(protect);

// Admin only routes
router.post("/generate", authorize("ADMIN"), generatePayroll);
router.post("/batch", authorize("ADMIN"), generatePayrollBatch);
router.put("/status", authorize("ADMIN"), updatePayrollStatus);
router.post("/allowance", authorize("ADMIN"), addAllowance);
router.post("/deduction", authorize("ADMIN"), addDeduction);
router.delete(
  "/allowance/:payrollId/:allowanceId",
  authorize("ADMIN"),
  removeAllowance
);
router.delete(
  "/deduction/:payrollId/:deductionId",
  authorize("ADMIN"),
  removeDeduction
);
router.get("/period", authorize("ADMIN"), getPayrollsByPeriod);
router.get("/stats", authorize("ADMIN"), getPayrollStats);

// Routes accessible by staff for their own records or admin for any staff
router.get("/:id", getPayrollById);
router.get("/staff/:staffId", getStaffPayroll);

module.exports = router;
