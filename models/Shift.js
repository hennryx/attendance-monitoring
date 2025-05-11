// models/Shift.js
const mongoose = require("mongoose");

const ShiftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  
  startTime: {
    type: String, // format: "HH:MM" in 24-hour format
    required: true,
    validate: {
      validator: function(v) {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: props => `${props.value} is not a valid time format! Use HH:MM in 24-hour format.`
    }
  },
  
  endTime: {
    type: String, // format: "HH:MM" in 24-hour format
    required: true,
    validate: {
      validator: function(v) {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: props => `${props.value} is not a valid time format! Use HH:MM in 24-hour format.`
    }
  },
  
  lunchStartTime: {
    type: String, // format: "HH:MM" in 24-hour format
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: props => `${props.value} is not a valid time format! Use HH:MM in 24-hour format.`
    }
  },
  
  lunchDuration: {
    type: Number, // in minutes
    default: 60,
    min: 0,
  },
  
  gracePeriod: {
    type: Number, // in minutes
    default: 15,
    min: 0,
  },
  
  workingDays: {
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    type: [Number],
    default: [1, 2, 3, 4, 5], // Default to Monday-Friday
    validate: {
      validator: function(v) {
        return v.every(day => day >= 0 && day <= 6);
      },
      message: props => `Working days must be between 0 (Sunday) and 6 (Saturday)`
    }
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

// Method to check if a time is within the grace period
ShiftSchema.methods.isWithinGracePeriod = function(time) {
  const [shiftHours, shiftMinutes] = this.startTime.split(":").map(Number);
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
ShiftSchema.methods.calculateLateMinutes = function(timeInStr) {
  const [shiftHours, shiftMinutes] = this.startTime.split(":").map(Number);
  const timeIn = new Date(timeInStr);
  
  // Create date object with shift start time
  const shiftStart = new Date(timeIn);
  shiftStart.setHours(shiftHours, shiftMinutes, 0, 0);
  
  // Calculate minutes late
  const minutesLate = Math.max(0, Math.floor((timeIn - shiftStart) / (1000 * 60)));
  
  // If within grace period, return 0
  if (minutesLate <= this.gracePeriod) {
    return 0;
  }
  
  return minutesLate;
};

// Method to calculate overtime minutes
ShiftSchema.methods.calculateOvertimeMinutes = function(timeInStr, timeOutStr) {
  const [shiftEndHours, shiftEndMinutes] = this.endTime.split(":").map(Number);
  const timeOut = new Date(timeOutStr);
  
  // Create date object with shift end time
  const shiftEnd = new Date(timeOut);
  shiftEnd.setHours(shiftEndHours, shiftEndMinutes, 0, 0);
  
  // Calculate minutes of overtime
  const overtimeMinutes = Math.max(0, Math.floor((timeOut - shiftEnd) / (1000 * 60)));
  
  return overtimeMinutes;
};

// Method to get expected work duration in minutes
ShiftSchema.methods.getWorkDurationMinutes = function() {
  const [startHours, startMinutes] = this.startTime.split(":").map(Number);
  const [endHours, endMinutes] = this.endTime.split(":").map(Number);
  
  // Convert to minutes since midnight
  const startTimeInMinutes = startHours * 60 + startMinutes;
  const endTimeInMinutes = endHours * 60 + endMinutes;
  
  let durationMinutes = endTimeInMinutes - startTimeInMinutes;
  
  // Handle shifts that cross midnight
  if (durationMinutes < 0) {
    durationMinutes += 24 * 60; // Add 24 hours in minutes
  }
  
  // Subtract lunch duration if applicable
  if (this.lunchStartTime && this.lunchDuration) {
    durationMinutes -= this.lunchDuration;
  }
  
  return durationMinutes;
};

module.exports = mongoose.model("Shift", ShiftSchema);