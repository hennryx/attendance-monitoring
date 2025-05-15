const mongoose = require("mongoose");

const FingerPrintSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },

    // Enhanced template with multiple features
    template: {
      type: Object,
      required: true,
    },

    // Original template for compatibility
    original_template: {
      type: Object,
      required: true,
    },

    // Paths to fingerprint image files
    file_paths: {
      type: [String],
      default: [],
    },

    // Number of scans used to create the template
    scan_count: {
      type: Number,
      default: 1,
      min: 1,
    },

    // For enrollment tracking
    enrolled_at: {
      type: Date,
      default: Date.now,
    },

    // For re-enrollment tracking
    updated_at: {
      type: Date,
    },

    // Quality score of the enrolled fingerprint
    quality_score: {
      type: Number,
      min: 0,
      max: 1,
    },

    // Metadata for debugging or logging
    meta: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true, // Keep the standard createdAt and updatedAt fields
  }
);

// Add an index for faster lookups
FingerPrintSchema.index({ staffId: 1 });

module.exports = mongoose.model("FingerPrint", FingerPrintSchema);
