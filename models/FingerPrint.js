const mongoose = require("mongoose");

const FingerPrintSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Original base64 fingerprint data (renamed from fingerPrint to original for consistency)
    original: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          // Basic check for Base64 string format
          return /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            v
          );
        },
        message: (props) => `${props.value} is not a valid Base64 string!`,
      },
    },

    // Enhanced template using new algorithm
    template: {
      type: Object,
      required: true,
    },

    // Original template for compatibility
    original_template: {
      type: Object,
      required: true,
    },

    // Specific enrollment timestamp
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
