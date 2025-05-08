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
} = require("../../controllers/users/usersController");

// Get all users - admin only
router.get("/getAll", protect, authorize("ADMIN"), getAllUsers);
router.delete("/delete", protect, deleteUser);
router.put("/update", protect, updateUser);
router.post("/enroll", protect, enrollUSer);
router.post("/match", matchFingerprint);
router.post("/verify", verifyFingerprint);

module.exports = router;
