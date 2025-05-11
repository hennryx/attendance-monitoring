// controllers/attendanceController.js
const Attendance = require("../models/Attendance");
const Users = require("../models/Users");
const Shift = require("../models/Shift");
const mongoose = require("mongoose");

// Record clock-in for staff
exports.clockIn = async (req, res) => {
  try {
    const { staffId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }
    
    // Find the staff to get their assigned shift
    const staff = await Users.findById(staffId).populate("assignedShift");
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check if an attendance record already exists for today
    let attendance = await Attendance.findOne({
      staffId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    
    // If there's already a timeIn record, return error
    if (attendance && attendance.timeIn) {
      return res.status(400).json({
        success: false,
        message: "Clock-in already recorded for today",
      });
    }
    
    // If no existing record, create a new one
    if (!attendance) {
      attendance = new Attendance({
        staffId,
        date: today,
        timeIn: now,
        status: "present",
      });
    } else {
      // Update existing record
      attendance.timeIn = now;
      attendance.status = "present";
    }
    
    // Check if staff has assigned shift and calculate late minutes
    if (staff.assignedShift) {
      const shift = staff.assignedShift;
      
      // Get current time in HH:MM format
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${hours}:${minutes}`;
      
      // Calculate late minutes
      const lateMinutes = shift.calculateLateMinutes(now);
      attendance.lateMinutes = lateMinutes;
      
      // Update status if late
      if (lateMinutes > 0) {
        attendance.status = "late";
      }
    }
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      message: "Clock-in recorded successfully",
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error recording clock-in",
      error: err.message,
    });
  }
};

// Record clock-out for staff
exports.clockOut = async (req, res) => {
  try {
    const { staffId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Find today's attendance record
    const attendance = await Attendance.findOne({
      staffId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No clock-in record found for today",
      });
    }
    
    if (!attendance.timeIn) {
      return res.status(400).json({
        success: false,
        message: "Cannot clock-out without clocking in first",
      });
    }
    
    if (attendance.timeOut) {
      return res.status(400).json({
        success: false,
        message: "Clock-out already recorded for today",
      });
    }
    
    // Find the staff to get their assigned shift
    const staff = await Users.findById(staffId).populate("assignedShift");
    
    // Update attendance record with clock-out time
    attendance.timeOut = now;
    
    // Calculate overtime if shift is assigned
    if (staff && staff.assignedShift) {
      const shift = staff.assignedShift;
      const overtimeMinutes = shift.calculateOvertimeMinutes(attendance.timeIn, now);
      attendance.overtime = overtimeMinutes;
    }
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      message: "Clock-out recorded successfully",
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error recording clock-out",
      error: err.message,
    });
  }
};

// Record lunch start
exports.startLunch = async (req, res) => {
  try {
    const { staffId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Find today's attendance record
    const attendance = await Attendance.findOne({
      staffId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No clock-in record found for today",
      });
    }
    
    if (!attendance.timeIn) {
      return res.status(400).json({
        success: false,
        message: "Cannot start lunch without clocking in first",
      });
    }
    
    if (attendance.lunchStart) {
      return res.status(400).json({
        success: false,
        message: "Lunch start already recorded for today",
      });
    }
    
    // Update attendance record with lunch start time
    attendance.lunchStart = now;
    await attendance.save();
    
    res.status(200).json({
      success: true,
      message: "Lunch start recorded successfully",
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error recording lunch start",
      error: err.message,
    });
  }
};

// Record lunch end
exports.endLunch = async (req, res) => {
  try {
    const { staffId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Find today's attendance record
    const attendance = await Attendance.findOne({
      staffId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No clock-in record found for today",
      });
    }
    
    if (!attendance.lunchStart) {
      return res.status(400).json({
        success: false,
        message: "Cannot end lunch without starting lunch first",
      });
    }
    
    if (attendance.lunchEnd) {
      return res.status(400).json({
        success: false,
        message: "Lunch end already recorded for today",
      });
    }
    
    // Update attendance record with lunch end time
    attendance.lunchEnd = now;
    await attendance.save();
    
    res.status(200).json({
      success: true,
      message: "Lunch end recorded successfully",
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error recording lunch end",
      error: err.message,
    });
  }
};

// Submit reason for absence or lateness
exports.submitReason = async (req, res) => {
  try {
    const { attendanceId, reason } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance ID",
      });
    }
    
    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Reason is required",
      });
    }
    
    // Find the attendance record
    const attendance = await Attendance.findById(attendanceId);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }
    
    // Check if attendance belongs to the requesting user
    if (req.user.role !== "ADMIN" && 
        attendance.staffId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to modify this attendance record",
      });
    }
    
    // Update the reason
    attendance.reason = reason;
    await attendance.save();
    
    res.status(200).json({
      success: true,
      message: "Reason submitted successfully",
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error submitting reason",
      error: err.message,
    });
  }
};

// Verify a reason (admin only)
exports.verifyReason = async (req, res) => {
  try {
    const { attendanceId, verified, notes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance ID",
      });
    }
    
    // Find the attendance record
    const attendance = await Attendance.findById(attendanceId);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }
    
    // Update the verification status
    attendance.reasonVerified = verified;
    attendance.verifiedBy = req.user._id;
    
    if (notes) {
      attendance.notes = notes;
    }
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      message: "Reason verification updated successfully",
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error updating reason verification",
      error: err.message,
    });
  }
};

// Get staff attendance for a specific date range
exports.getStaffAttendance = async (req, res) => {
  try {
    const { staffId, startDate, endDate } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }
    
    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    
    // Find attendance records
    const attendanceRecords = await Attendance.find({
      staffId,
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 });
    
    res.status(200).json({
      success: true,
      count: attendanceRecords.length,
      data: attendanceRecords,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving attendance records",
      error: err.message,
    });
  }
};

// Get today's attendance for all staff (admin only)
exports.getTodayAttendance = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Find attendance records for today
    const attendanceRecords = await Attendance.find({
      date: { $gte: today, $lt: tomorrow },
    }).populate("staffId", "firstname lastname middlename email department position");
    
    // Count statistics
    const totalStaff = await Users.countDocuments({ role: "STAFF", status: "active" });
    const present = attendanceRecords.filter(record => record.status === "present").length;
    const late = attendanceRecords.filter(record => record.status === "late").length;
    const absent = attendanceRecords.filter(record => record.status === "absent").length;
    const pendingReasons = attendanceRecords.filter(record => 
      (record.status === "absent" || record.status === "late") && 
      (!record.reason || record.reason.trim() === "")
    ).length;
    
    res.status(200).json({
      success: true,
      count: attendanceRecords.length,
      stats: {
        totalStaff,
        present,
        late,
        absent,
        pendingReasons,
        attendanceRate: totalStaff > 0 ? ((present + late) / totalStaff) * 100 : 0,
      },
      data: attendanceRecords,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving today's attendance",
      error: err.message,
    });
  }
};

// Mark absent for staff who haven't clocked in
exports.markAbsentees = async (req, res) => {
  try {
    // Default to yesterday if no date provided
    let markDate = req.body.date ? new Date(req.body.date) : new Date();
    markDate.setHours(0, 0, 0, 0);
    
    // If marking for today, make sure it's after working hours
    const now = new Date();
    if (markDate.toDateString() === now.toDateString()) {
      markDate = new Date(now.setDate(now.getDate() - 1));
      markDate.setHours(0, 0, 0, 0);
    }
    
    // Get all active staff IDs
    const activeStaff = await Users.find({ 
      role: "STAFF", 
      status: "active" 
    }).select("_id");
    
    const staffIds = activeStaff.map(staff => staff._id);
    
    // Mark absent for staff who didn't clock in
    const absentRecords = await Attendance.markAbsentees(markDate, staffIds);
    
    res.status(200).json({
      success: true,
      message: `Marked ${absentRecords.length} staff as absent for ${markDate.toDateString()}`,
      count: absentRecords.length,
      data: absentRecords,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error marking absentees",
      error: err.message,
    });
  }
};

// Get attendance statistics for a specified period
exports.getAttendanceStats = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    
    // Base query
    let query = {
      date: { $gte: start, $lte: end },
    };
    
    // Add department filter if provided
    if (department) {
      const staffInDept = await Users.find({ department }).select("_id");
      const staffIds = staffInDept.map(staff => staff._id);
      query.staffId = { $in: staffIds };
    }
    
    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query);
    
    // Calculate statistics
    const totalRecords = attendanceRecords.length;
    const present = attendanceRecords.filter(record => record.status === "present").length;
    const late = attendanceRecords.filter(record => record.status === "late").length;
    const absent = attendanceRecords.filter(record => record.status === "absent").length;
    const halfDay = attendanceRecords.filter(record => record.status === "half-day").length;
    
    // Calculate average late minutes and overtime
    let totalLateMinutes = 0;
    let totalOvertimeMinutes = 0;
    
    attendanceRecords.forEach(record => {
      totalLateMinutes += record.lateMinutes || 0;
      totalOvertimeMinutes += record.overtime || 0;
    });
    
    const avgLateMinutes = totalRecords > 0 ? totalLateMinutes / totalRecords : 0;
    const avgOvertimeMinutes = totalRecords > 0 ? totalOvertimeMinutes / totalRecords : 0;
    
    // Group by date for trend analysis
    const dateStats = {};
    
    attendanceRecords.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      
      if (!dateStats[dateStr]) {
        dateStats[dateStr] = {
          date: dateStr,
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          halfDay: 0,
        };
      }
      
      dateStats[dateStr].total += 1;
      
      if (record.status === "present") {
        dateStats[dateStr].present += 1;
      } else if (record.status === "late") {
        dateStats[dateStr].late += 1;
      } else if (record.status === "absent") {
        dateStats[dateStr].absent += 1;
      } else if (record.status === "half-day") {
        dateStats[dateStr].halfDay += 1;
      }
    });
    
    // Convert to array and sort by date
    const dailyStats = Object.values(dateStats).sort((a, b) => a.date.localeCompare(b.date));
    
    res.status(200).json({
      success: true,
      stats: {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        summary: {
          totalRecords,
          present,
          late,
          absent,
          halfDay,
          presentPercentage: totalRecords > 0 ? (present / totalRecords) * 100 : 0,
          latePercentage: totalRecords > 0 ? (late / totalRecords) * 100 : 0,
          absentPercentage: totalRecords > 0 ? (absent / totalRecords) * 100 : 0,
          halfDayPercentage: totalRecords > 0 ? (halfDay / totalRecords) * 100 : 0,
          avgLateMinutes,
          avgOvertimeMinutes,
        },
        daily: dailyStats,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving attendance statistics",
      error: err.message,
    });
  }
};