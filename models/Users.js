// server/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: [true, "Please add a name"],
    trim: true,
  },

  middlename: {
    type: String,
    trim: true,
  },

  lastname: {
    type: String,
    required: [true, "Please add a lastname"],
    trim: true,
  },

  email: {
    type: String,
    required: [true, "Please add an email"],
    unique: [true, "This email already exist!"],
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },

  password: {
    type: String,
    required: [true, "Please add a password"],
    minlength: 6,
    select: false,
  },

  role: {
    type: String,
    enum: ["ADMIN", "STAFF"],
    default: "STAFF",
  },

  department: {
    type: String,
    required: true,
  },

  position: {
    type: String,
    required: true,
  },

  profile: {
    type: String,
  },

  hasFingerPrint: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Users", UserSchema);
