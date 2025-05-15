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

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const fingerprintStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../assets/fingerprints");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    if (req.body.staffId) {
      const staffDir = path.join(uploadDir, req.body.staffId);
      if (!fs.existsSync(staffDir)) {
        fs.mkdirSync(staffDir, { recursive: true });
      }
      cb(null, staffDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".png";
    cb(null, "fingerprint-" + uniqueSuffix + ext);
  },
});

const uploadFingerprints = multer({
  storage: fingerprintStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Not an image! Please upload only images."), false);
    }
  },
}).array("fingerprintFiles", 5);

router.post(
  "/enroll",
  protect,
  function (req, res, next) {
    uploadFingerprints(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(500).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      }
      next();
    });
  },
  enrollUSer
);

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
