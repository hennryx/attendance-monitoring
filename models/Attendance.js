// models/Attendance.js
const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  
  timeIn: {
    type: Date,
    default: null,
  },
  
  timeOut: {
    type: Date,
    default: null,
  },
  
  lunchStart: {
    type: Date,
    default: null,
  },
  
  lunchEnd: {
    type: Date,
    default: null,
  },
  
  status: {
    type: String,
    enum: ["present", "absent", "late", "half-day"],
    default: "absent",
  },
  
  lateMinutes: {
    type: Number,
    default: 0,
  },
  
  overtime: {
    type: Number, // in minutes
    default: 0,
  },
  
  reason: {
    type: String,
    default: "",
  },
  
  reasonVerified: {
    type: Boolean,
    default: false,
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    default: null,
  },
  
  notes: {
    type: String,
    default: "",
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

// Index for efficient queries
AttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

// Pre-save hook to update the updatedAt field
AttendanceSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if a staff member is late
AttendanceSchema.methods.isLate = function(shiftStartTime) {
  if (!this.timeIn) return false;
  
  // Create date objects for comparison
  const timeIn = new Date(this.timeIn);
  const shiftStart = new Date(this.date);
  
  // Set hours and minutes from shiftStartTime (format: "HH:MM")
  const [hours, minutes] = shiftStartTime.split(":").map(Number);
  shiftStart.setHours(hours, minutes, 0, 0);
  
  // Calculate minutes late
  const minutesLate = Math.max(0, Math.floor((timeIn - shiftStart) / (1000 * 60)));
  
  return minutesLate > 0;
};

// Static method to create absent records for staff who didn't check in
AttendanceSchema.statics.markAbsentees = async function(date, staffIds) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Find staff who have attendance records for the given date
  const attendees = await this.find({
    date: { $gte: startOfDay, $lte: endOfDay },
    timeIn: { $ne: null }
  }).select("staffId");
  
  const attendeeIds = attendees.map(a => a.staffId.toString());
  
  // Filter out staff who already have attendance records
  const absenteeIds = staffIds.filter(id => !attendeeIds.includes(id.toString()));
  
  // Create absent records for staff who didn't check in
  const absentRecords = absenteeIds.map(staffId => ({
    staffId,
    date: startOfDay,
    status: "absent",
    timeIn: null,
    timeOut: null
  }));
  
  if (absentRecords.length > 0) {
    return await this.insertMany(absentRecords);
  }
  
  return [];
};

module.exports = mongoose.model("Attendance", AttendanceSchema);