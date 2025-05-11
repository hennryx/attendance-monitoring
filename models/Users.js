// models/Users.js (Updated)
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
  
  // New fields for payroll system
  employeeId: {
    type: String,
    unique: true,
    sparse: true, // Allows null values
  },
  
  dateHired: {
    type: Date,
  },
  
  status: {
    type: String,
    enum: ["active", "inactive", "on-leave", "terminated"],
    default: "active",
  },
  
  baseSalary: {
    type: Number,
    default: 0,
  },
  
  salaryType: {
    type: String,
    enum: ["hourly", "daily", "monthly"],
    default: "monthly",
  },
  
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String,
  },
  
  taxId: {
    type: String,
  },
  
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
  },
  
  assignedShift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shift",
  },
  
  phoneNumber: {
    type: String,
  },
  
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Virtual for full name
UserSchema.virtual("fullName").get(function() {
  if (this.middlename) {
    return `${this.firstname} ${this.middlename} ${this.lastname}`;
  }
  return `${this.firstname} ${this.lastname}`;
});

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
  this.updatedAt = new Date();
  
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