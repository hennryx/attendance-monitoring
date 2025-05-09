const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../../middlewares/auth");
const {
  getAllUsers,
  updateUser,
  deleteUser,
  enrollUSer,
  matchFingerprint,
  verifyFingerprint,
  getDeviceList,
  captureFingerprint,
} = require("../../controllers/users/usersController");

// User management routes
router.get("/getAll", protect, authorize("ADMIN"), getAllUsers);
router.delete("/delete", protect, deleteUser);
router.put("/update", protect, updateUser);

// Fingerprint device routes
router.get("/fingerprint/devices", getDeviceList);
router.post("/fingerprint/capture", captureFingerprint);

// Fingerprint registration and matching routes
router.post("/enroll", protect, enrollUSer);
router.post("/match", matchFingerprint);
router.post("/verify", verifyFingerprint);

module.exports = router;
