// middlewares/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create a factory function for different upload types
const createUploadMiddleware = (type = "general", limits = {}) => {
  // Define the upload directory based on type
  const uploadDirs = {
    profile: "../assets/profiles",
    product: "../assets/products",
    fingerprint: "../assets/fingerprints",
    document: "../assets/documents",
    general: "../assets/uploads",
  };

  const uploadDir = path.join(
    __dirname,
    uploadDirs[type] || uploadDirs.general
  );

  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Configure storage
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      // Generate unique filename with timestamp and original extension
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${type}-${uniqueSuffix}${ext}`);
    },
  });

  // File filter for allowed mime types
  const fileFilter = (req, file, cb) => {
    // Default allowed types for each category
    const allowedTypes = {
      profile: ["image/jpeg", "image/png", "image/gif"],
      product: ["image/jpeg", "image/png", "image/webp"],
      fingerprint: ["image/jpeg", "image/png", "image/bmp"],
      document: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      general: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
    };

    // Get allowed types for current upload type
    const types = allowedTypes[type] || allowedTypes.general;

    if (types.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Invalid file type. Only ${types.join(", ")} are allowed.`),
        false
      );
    }
  };

  // Default upload limits
  const defaultLimits = {
    fileSize: 5 * 1024 * 1024, // 5MB
    ...limits,
  };

  // Create and return the middleware
  return multer({
    storage: storage,
    limits: defaultLimits,
    fileFilter: fileFilter,
  });
};

// Export pre-configured middlewares
module.exports = {
  createUploadMiddleware,
  uploadProfileImage: createUploadMiddleware("profile", {
    fileSize: 2 * 1024 * 1024,
  }).single("profileImage"),
  uploadProductImage: createUploadMiddleware("product").single("image"),
  uploadFingerprintImage: createUploadMiddleware("fingerprint").array(
    "fingerprints",
    10
  ),
  uploadDocument: createUploadMiddleware("document").single("document"),
};
