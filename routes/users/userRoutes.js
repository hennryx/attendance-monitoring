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
  getDepartments,
  updateProfile,
  updatePassword,
} = require("../../controllers/users/usersController");
const {
  uploadProfileImage,
} = require("../../middlewares/profileUploadMiddleware");

router.post("/enroll-single", protect, enrollUSer);
// Get all users - admin only
router.get("/getAll", protect, authorize("ADMIN"), getAllUsers);
router.delete("/delete", protect, deleteUser);
router.put("/update", protect, updateUser);
router.post("/match", matchFingerprint);
router.post("/verify", verifyFingerprint);
router.get("/departments", protect, getDepartments);

router.put("/update-profile", protect, uploadProfileImage, updateProfile);
router.put("/update-password", protect, updatePassword);

module.exports = router;
