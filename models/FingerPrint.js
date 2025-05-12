const mongoose = require("mongoose");

const FingerPrintSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Original image data - now optional
    fingerPrint: {
      type: String,
      required: false, // Changed from required: true
      validate: {
        validator: function (v) {
          // Skip validation if value is not present
          if (!v) return true;

          // Basic check for Base64 string format
          return /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            v
          );
        },
        message: (props) => `${props.value} is not a valid Base64 string!`,
      },
    },

    // Template data (extracted features)
    template: {
      type: Object,
      required: true, // Now required since this is the essential data
    },

    // New fields for multi-enrollment support
    enrollmentIndex: {
      type: Number,
      default: 0, // Starts at 0 for the first enrollment
    },

    // Optional metadata for enrollment
    enrollmentMeta: {
      quality: Number, // Quality score of this template (0-1)
      minutiaeCount: Number, // Number of minutiae points
      keypointCount: Number, // Number of keypoints
      device: String, // Optional device information
    },
  },
  { timestamps: true }
);

// Create a compound index for efficient lookups
FingerPrintSchema.index({ staffId: 1, enrollmentIndex: 1 });

module.exports = mongoose.model("FingerPrint", FingerPrintSchema);
