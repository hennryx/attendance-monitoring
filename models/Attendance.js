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
    enum: ["present", "absent", "late", "half-day", "on-leave"],
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

  totalHoursWorked: {
    type: Number, // in hours (decimal)
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

  leaveType: {
    type: String,
    enum: ["sick", "vacation", "personal", "bereavement", "other", null],
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

// Pre-save hook to update the updatedAt field and calculate hours worked
AttendanceSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Calculate total hours worked if both timeIn and timeOut exist
  if (this.timeIn && this.timeOut) {
    let timeInMs = this.timeIn.getTime();
    let timeOutMs = this.timeOut.getTime();

    // Account for lunch break if both lunchStart and lunchEnd exist
    let lunchTimeMs = 0;
    if (this.lunchStart && this.lunchEnd) {
      lunchTimeMs = this.lunchEnd.getTime() - this.lunchStart.getTime();
    }

    // Calculate total working time in hours
    const totalWorkingTimeMs = timeOutMs - timeInMs - lunchTimeMs;
    this.totalHoursWorked = Math.max(0, totalWorkingTimeMs / (1000 * 60 * 60));

    // Update status to half-day if hours worked are below threshold (configure in Shift model)
    // This logic should be handled by the controller using the associated shift's halfDayThreshold
  }

  next();
});

// Static method to create absent records for staff who didn't check in
AttendanceSchema.statics.markAbsentees = async function (date, staffIds) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Find staff who have attendance records for the given date
  const attendees = await this.find({
    date: { $gte: startOfDay, $lte: endOfDay },
    timeIn: { $ne: null },
  }).select("staffId");

  const attendeeIds = attendees.map((a) => a.staffId.toString());

  // Filter out staff who already have attendance records
  const absenteeIds = staffIds.filter(
    (id) => !attendeeIds.includes(id.toString())
  );

  // Create absent records for staff who didn't check in
  const absentRecords = absenteeIds.map((staffId) => ({
    staffId,
    date: startOfDay,
    status: "absent",
    timeIn: null,
    timeOut: null,
  }));

  if (absentRecords.length > 0) {
    return await this.insertMany(absentRecords);
  }

  return [];
};

// Static method to get attendance record for a specific date and staff
AttendanceSchema.statics.getRecordForDate = async function (staffId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return await this.findOne({
    staffId,
    date: { $gte: startOfDay, $lte: endOfDay },
  });
};

module.exports = mongoose.model("Attendance", AttendanceSchema);
