const mongoose = require("mongoose");

const FingerPrintSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  template: {
    type: Object,
    required: true,
  },
  original_template: {
    type: Object,
    required: true,
  },
  file_paths: {
    type: [String],
    default: [],
  },
  scan_count: {
    type: Number,
    default: 1,
    min: 1,
  },
  enrolled_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
  },
  quality_score: {
    type: Number,
    min: 0,
  },
  meta: {
    type: Object,
    default: {},
  },
});

FingerPrintSchema.index({ staffId: 1 });

module.exports = mongoose.model("FingerPrint", FingerPrintSchema);
