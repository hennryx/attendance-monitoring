const mongoose = require("mongoose");

const FingerPrintSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    fingerPrint: {
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
    features: { type: Array, default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FingerPrint", FingerPrintSchema);
