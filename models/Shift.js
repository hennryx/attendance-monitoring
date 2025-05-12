// models/Shift.js
const mongoose = require("mongoose");

const WorkdaySchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },
    startTime: {
      type: String, // format: "HH:MM" in 24-hour format
      default: "09:00",
      validate: {
        validator: function (v) {
          return !this.enabled || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid time format! Use HH:MM in 24-hour format.`,
      },
    },
    endTime: {
      type: String, // format: "HH:MM" in 24-hour format
      default: "17:00",
      validate: {
        validator: function (v) {
          return !this.enabled || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid time format! Use HH:MM in 24-hour format.`,
      },
    },
    lunchStartTime: {
      type: String, // format: "HH:MM" in 24-hour format
      default: "12:00",
      validate: {
        validator: function (v) {
          return !this.enabled || !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid time format! Use HH:MM in 24-hour format.`,
      },
    },
    lunchDuration: {
      type: Number, // in minutes
      default: 60,
      min: 0,
    },
  },
  { _id: false }
);

const ShiftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: {
    type: String,
    trim: true,
  },

  // Work schedule for each day
  monday: {
    type: WorkdaySchema,
    default: () => ({}),
  },
  tuesday: {
    type: WorkdaySchema,
    default: () => ({}),
  },
  wednesday: {
    type: WorkdaySchema,
    default: () => ({}),
  },
  thursday: {
    type: WorkdaySchema,
    default: () => ({}),
  },
  friday: {
    type: WorkdaySchema,
    default: () => ({}),
  },
  saturday: {
    type: WorkdaySchema,
    default: () => ({
      enabled: false,
    }),
  },
  sunday: {
    type: WorkdaySchema,
    default: () => ({
      enabled: false,
    }),
  },

  gracePeriod: {
    type: Number, // in minutes
    default: 15,
    min: 0,
  },

  halfDayThreshold: {
    type: Number, // in hours
    default: 4, // If worked less than this many hours, counted as half-day
    min: 0,
  },

  isActive: {
    type: Boolean,
    default: true,
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

// Pre-save hook to update the updatedAt field
ShiftSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if a specific day is a workday
ShiftSchema.methods.isWorkday = function (dayIndex) {
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
  return this[day]?.enabled || false;
};

// Method to get schedule for a specific day
ShiftSchema.methods.getScheduleForDay = function (dayIndex) {
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

  if (!this[day] || !this[day].enabled) {
    return null; // Not a workday
  }

  return {
    startTime: this[day].startTime,
    endTime: this[day].endTime,
    lunchStartTime: this[day].lunchStartTime,
    lunchDuration: this[day].lunchDuration,
  };
};

// Method to check if a time is within the grace period
ShiftSchema.methods.isWithinGracePeriod = function (time, dayIndex) {
  const schedule = this.getScheduleForDay(dayIndex);
  if (!schedule) return false;

  const [shiftHours, shiftMinutes] = schedule.startTime.split(":").map(Number);
  const [checkHours, checkMinutes] = time.split(":").map(Number);

  // Convert to minutes since midnight
  const shiftTimeInMinutes = shiftHours * 60 + shiftMinutes;
  const checkTimeInMinutes = checkHours * 60 + checkMinutes;

  // Calculate difference in minutes
  const minutesDifference = checkTimeInMinutes - shiftTimeInMinutes;

  // Check if within grace period
  return minutesDifference >= 0 && minutesDifference <= this.gracePeriod;
};

// Method to calculate late minutes
ShiftSchema.methods.calculateLateMinutes = function (timeInStr, dayIndex) {
  const schedule = this.getScheduleForDay(dayIndex);
  if (!schedule) return 0;

  const [shiftHours, shiftMinutes] = schedule.startTime.split(":").map(Number);
  const timeIn = new Date(timeInStr);

  // Create date object with shift start time
  const shiftStart = new Date(timeIn);
  shiftStart.setHours(shiftHours, shiftMinutes, 0, 0);

  // Calculate minutes late
  const minutesLate = Math.max(
    0,
    Math.floor((timeIn - shiftStart) / (1000 * 60))
  );

  // If within grace period, return 0
  if (minutesLate <= this.gracePeriod) {
    return 0;
  }

  return minutesLate;
};

// Method to calculate overtime minutes
ShiftSchema.methods.calculateOvertimeMinutes = function (
  timeInStr,
  timeOutStr,
  dayIndex
) {
  const schedule = this.getScheduleForDay(dayIndex);
  if (!schedule) return 0;

  const [shiftEndHours, shiftEndMinutes] = schedule.endTime
    .split(":")
    .map(Number);
  const timeOut = new Date(timeOutStr);

  // Create date object with shift end time
  const shiftEnd = new Date(timeOut);
  shiftEnd.setHours(shiftEndHours, shiftEndMinutes, 0, 0);

  // Calculate minutes of overtime
  const overtimeMinutes = Math.max(
    0,
    Math.floor((timeOut - shiftEnd) / (1000 * 60))
  );

  return overtimeMinutes;
};

// Method to get expected work duration in minutes for a specific day
ShiftSchema.methods.getWorkDurationMinutes = function (dayIndex) {
  const schedule = this.getScheduleForDay(dayIndex);
  if (!schedule) return 0;

  const [startHours, startMinutes] = schedule.startTime.split(":").map(Number);
  const [endHours, endMinutes] = schedule.endTime.split(":").map(Number);

  // Convert to minutes since midnight
  const startTimeInMinutes = startHours * 60 + startMinutes;
  const endTimeInMinutes = endHours * 60 + endMinutes;

  let durationMinutes = endTimeInMinutes - startTimeInMinutes;

  // Handle shifts that cross midnight
  if (durationMinutes < 0) {
    durationMinutes += 24 * 60; // Add 24 hours in minutes
  }

  // Subtract lunch duration if applicable
  if (schedule.lunchStartTime && schedule.lunchDuration) {
    durationMinutes -= schedule.lunchDuration;
  }

  return durationMinutes;
};

// Method to determine if worked hours qualify as half-day
ShiftSchema.methods.isHalfDay = function (hoursWorked, dayIndex) {
  const schedule = this.getScheduleForDay(dayIndex);
  if (!schedule) return false;

  // Calculate expected hours based on shift
  const expectedHours = this.getWorkDurationMinutes(dayIndex) / 60;

  // Check if hours worked are less than threshold but more than 0
  return hoursWorked > 0 && hoursWorked < this.halfDayThreshold;
};

module.exports = mongoose.model("Shift", ShiftSchema);
