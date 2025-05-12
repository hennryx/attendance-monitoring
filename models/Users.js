// models/Users.js
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
    unique: [true, "This email already exists!"],
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

  // Employment details
  employeeId: {
    type: String,
    unique: true,
    sparse: true, // Allows null values
  },

  dateHired: {
    type: Date,
    default: Date.now,
  },

  status: {
    type: String,
    enum: ["active", "inactive", "on-leave", "terminated"],
    default: "active",
  },

  // Payroll information
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

  // Work schedule information
  assignedShift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shift",
  },

  // Custom schedule (if not using a predefined shift)
  customSchedule: {
    monday: {
      isWorkday: { type: Boolean, default: true },
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "17:00" },
      lunchStartTime: { type: String, default: "12:00" },
      lunchDuration: { type: Number, default: 60 }, // in minutes
    },
    tuesday: {
      isWorkday: { type: Boolean, default: true },
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "17:00" },
      lunchStartTime: { type: String, default: "12:00" },
      lunchDuration: { type: Number, default: 60 },
    },
    wednesday: {
      isWorkday: { type: Boolean, default: true },
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "17:00" },
      lunchStartTime: { type: String, default: "12:00" },
      lunchDuration: { type: Number, default: 60 },
    },
    thursday: {
      isWorkday: { type: Boolean, default: true },
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "17:00" },
      lunchStartTime: { type: String, default: "12:00" },
      lunchDuration: { type: Number, default: 60 },
    },
    friday: {
      isWorkday: { type: Boolean, default: true },
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "17:00" },
      lunchStartTime: { type: String, default: "12:00" },
      lunchDuration: { type: Number, default: 60 },
    },
    saturday: {
      isWorkday: { type: Boolean, default: false },
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "17:00" },
      lunchStartTime: { type: String, default: "12:00" },
      lunchDuration: { type: Number, default: 60 },
    },
    sunday: {
      isWorkday: { type: Boolean, default: false },
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "17:00" },
      lunchStartTime: { type: String, default: "12:00" },
      lunchDuration: { type: Number, default: 60 },
    },
  },

  // Attendance settings
  gracePeriod: {
    type: Number, // in minutes
    default: 15,
  },

  // Contact and personal information
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
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

  profileImage: {
    type: String,
    default: null,
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
UserSchema.virtual("fullName").get(function () {
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

// Get active schedule for a specific day
UserSchema.methods.getScheduleForDay = function (dayIndex) {
  // dayIndex: 0 = Sunday, 1 = Monday, etc.
  const dayMapping = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  const day = dayMapping[dayIndex];

  // If user has a custom schedule for the day
  if (
    this.customSchedule &&
    this.customSchedule[day] &&
    this.customSchedule[day].isWorkday
  ) {
    return {
      isWorkday: true,
      startTime: this.customSchedule[day].startTime,
      endTime: this.customSchedule[day].endTime,
      lunchStartTime: this.customSchedule[day].lunchStartTime,
      lunchDuration: this.customSchedule[day].lunchDuration,
    };
  }

  // Return default (not a workday)
  return {
    isWorkday: false,
    startTime: null,
    endTime: null,
    lunchStartTime: null,
    lunchDuration: null,
  };
};

module.exports = mongoose.model("Users", UserSchema);
