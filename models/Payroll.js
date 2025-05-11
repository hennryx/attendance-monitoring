// models/Payroll.js
const mongoose = require("mongoose");

const PayrollSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  
  periodStart: {
    type: Date,
    required: true,
  },
  
  periodEnd: {
    type: Date,
    required: true,
  },
  
  baseSalary: {
    type: Number,
    required: true,
  },
  
  daysWorked: {
    type: Number,
    default: 0,
  },
  
  totalWorkingDays: {
    type: Number,
    default: 0,
  },
  
  totalHoursWorked: {
    type: Number,
    default: 0,
  },
  
  overtimeHours: {
    type: Number,
    default: 0,
  },
  
  overtimeRate: {
    type: Number,
    default: 1.5, // Default 1.5x regular rate
  },
  
  overtimePay: {
    type: Number,
    default: 0,
  },
  
  lateDeductions: {
    type: Number,
    default: 0,
  },
  
  absenceDeductions: {
    type: Number,
    default: 0,
  },
  
  allowances: [{
    name: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  }],
  
  deductions: [{
    name: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  }],
  
  totalAllowances: {
    type: Number,
    default: 0,
  },
  
  totalDeductions: {
    type: Number,
    default: 0,
  },
  
  grossPay: {
    type: Number,
    default: 0,
  },
  
  netPay: {
    type: Number,
    default: 0,
  },
  
  paymentStatus: {
    type: String,
    enum: ["pending", "processing", "paid", "cancelled"],
    default: "pending",
  },
  
  paymentDate: {
    type: Date,
    default: null,
  },
  
  paymentMethod: {
    type: String,
    default: "bank transfer",
  },
  
  notes: {
    type: String,
    default: "",
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
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
PayrollSchema.index({ staffId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

// Pre-save hook to update the updatedAt field
PayrollSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  
  // Calculate gross pay
  this.grossPay = this.baseSalary + this.overtimePay + this.totalAllowances;
  
  // Calculate total deductions
  this.totalDeductions = this.deductions.reduce((sum, deduction) => sum + deduction.amount, 0) + 
                         this.lateDeductions + 
                         this.absenceDeductions;
  
  // Calculate total allowances
  this.totalAllowances = this.allowances.reduce((sum, allowance) => sum + allowance.amount, 0);
  
  // Calculate net pay
  this.netPay = this.grossPay - this.totalDeductions;
  
  next();
});

// Static method to calculate payroll for a staff member for a period
PayrollSchema.statics.calculatePayroll = async function(staffId, periodStart, periodEnd, baseSalary, settings) {
  const Attendance = mongoose.model("Attendance");
  const Users = mongoose.model("Users");
  
  // Validate staff exists
  const staff = await Users.findById(staffId);
  if (!staff) {
    throw new Error("Staff not found");
  }
  
  // Default settings if not provided
  const payrollSettings = settings || {
    workingHoursPerDay: 8,
    daysPerWeek: 5,
    lateDeductionRate: 0.1, // 10% of daily rate per hour late
    absenceDeductionRate: 1, // 100% of daily rate per absence
    overtimeRate: 1.5
  };
  
  // Calculate total working days in period
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  let totalWorkingDays = 0;
  
  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    // Skip weekends if using a 5-day workweek
    const dayOfWeek = day.getDay();
    if (payrollSettings.daysPerWeek === 5 && (dayOfWeek === 0 || dayOfWeek === 6)) {
      continue;
    }
    totalWorkingDays++;
  }
  
  // Get attendance records for the period
  const attendanceRecords = await Attendance.find({
    staffId,
    date: { $gte: start, $lte: end }
  });
  
  // Calculate metrics
  let daysWorked = 0;
  let totalHoursWorked = 0;
  let overtimeHours = 0;
  let lateMinutes = 0;
  let absenceDays = 0;
  
  attendanceRecords.forEach(record => {
    if (record.status === 'present' || record.status === 'late') {
      daysWorked++;
      
      // Calculate hours worked if both timeIn and timeOut exist
      if (record.timeIn && record.timeOut) {
        const timeIn = new Date(record.timeIn);
        const timeOut = new Date(record.timeOut);
        let lunchDuration = 0;
        
        // Calculate lunch duration if both lunchStart and lunchEnd exist
        if (record.lunchStart && record.lunchEnd) {
          const lunchStart = new Date(record.lunchStart);
          const lunchEnd = new Date(record.lunchEnd);
          lunchDuration = (lunchEnd - lunchStart) / (1000 * 60 * 60); // in hours
        }
        
        // Calculate total hours worked
        const hoursWorked = (timeOut - timeIn) / (1000 * 60 * 60) - lunchDuration;
        totalHoursWorked += hoursWorked;
        
        // Calculate overtime
        if (hoursWorked > payrollSettings.workingHoursPerDay) {
          overtimeHours += hoursWorked - payrollSettings.workingHoursPerDay;
        }
      }
      
      // Add late minutes
      lateMinutes += record.lateMinutes || 0;
    } else if (record.status === 'absent') {
      absenceDays++;
    } else if (record.status === 'half-day') {
      daysWorked += 0.5;
      absenceDays += 0.5;
      totalHoursWorked += payrollSettings.workingHoursPerDay / 2;
    }
  });
  
  // Calculate daily rate
  const dailyRate = baseSalary / totalWorkingDays;
  const hourlyRate = dailyRate / payrollSettings.workingHoursPerDay;
  
  // Calculate overtime pay
  const overtimePay = overtimeHours * hourlyRate * payrollSettings.overtimeRate;
  
  // Calculate deductions
  const lateDeductions = (lateMinutes / 60) * hourlyRate * payrollSettings.lateDeductionRate;
  const absenceDeductions = absenceDays * dailyRate * payrollSettings.absenceDeductionRate;
  
  // Create payroll record
  return {
    staffId,
    periodStart: start,
    periodEnd: end,
    baseSalary,
    daysWorked,
    totalWorkingDays,
    totalHoursWorked,
    overtimeHours,
    overtimeRate: payrollSettings.overtimeRate,
    overtimePay,
    lateDeductions,
    absenceDeductions,
    grossPay: baseSalary + overtimePay,
    totalDeductions: lateDeductions + absenceDeductions,
    netPay: baseSalary + overtimePay - lateDeductions - absenceDeductions,
    paymentStatus: "pending"
  };
};

module.exports = mongoose.model("Payroll", PayrollSchema);