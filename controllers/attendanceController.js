// controllers/attendanceController.js
const Attendance = require("../models/Attendance");
const Users = require("../models/Users");
const Shift = require("../models/Shift");
const FingerPrint = require("../models/FingerPrint");
const fingerprintService = require("../service/fingerprintService");
const mongoose = require("mongoose");

exports.clockIn = async (req, res) => {
  try {
    const { fingerprint, staffId } = req.body;

    // If fingerprint is provided, identify staff
    let identifiedStaffId = staffId;

    if (fingerprint && !staffId) {
      try {
        // Match fingerprint to identify staff using the improved matching algorithm
        const matchResult = await fingerprintService.matchFingerprint({
          fingerPrint: fingerprint,
        });

        if (!matchResult.matched) {
          return res.status(401).json({
            success: false,
            message:
              "No matching fingerprint found. Please register your fingerprint first.",
          });
        }

        identifiedStaffId = matchResult.staffId;
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error processing fingerprint",
          error: error.message,
        });
      }
    }

    if (!identifiedStaffId) {
      return res.status(400).json({
        success: false,
        message: "Staff identification failed",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(identifiedStaffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    // Find the staff to get their assigned shift
    const staff = await Users.findById(identifiedStaffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Get the staff's shift (either assigned or custom)
    let shiftSchedule = null;
    let isWorkday = false;

    // Check if staff has an assigned shift
    if (staff.assignedShift) {
      const shift = await Shift.findById(staff.assignedShift);
      if (shift) {
        isWorkday = shift.isWorkday(dayOfWeek);
        if (isWorkday) {
          shiftSchedule = shift.getScheduleForDay(dayOfWeek);
        }
      }
    }
    // If no assigned shift or not a workday, check custom schedule
    if (!shiftSchedule && staff.customSchedule) {
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayName = dayNames[dayOfWeek];

      if (
        staff.customSchedule[dayName] &&
        staff.customSchedule[dayName].isWorkday
      ) {
        isWorkday = true;
        shiftSchedule = {
          startTime: staff.customSchedule[dayName].startTime,
          endTime: staff.customSchedule[dayName].endTime,
          lunchStartTime: staff.customSchedule[dayName].lunchStartTime,
          lunchDuration: staff.customSchedule[dayName].lunchDuration,
        };
      }
    }

    // If not a workday, inform user
    if (!isWorkday) {
      return res.status(400).json({
        success: false,
        message: "Today is not a workday according to your schedule",
      });
    }

    // Check if an attendance record already exists for today
    let attendance = await Attendance.findOne({
      staffId: identifiedStaffId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    // AUTO DETECTION LOGIC
    let attendanceType = "in"; // Default is clock-in
    let message = "Clock-in recorded successfully";

    if (attendance) {
      // Record exists - auto-detect what type of action this is
      if (!attendance.timeIn) {
        // If no timeIn recorded, this is a clock-in
        attendanceType = "in";
        message = "Clock-in recorded successfully";
      } else if (attendance.timeIn && !attendance.lunchStart) {
        // If timeIn exists but no lunchStart, this is starting lunch
        attendanceType = "lunch-start";
        message = "Lunch break started successfully";
      } else if (attendance.lunchStart && !attendance.lunchEnd) {
        // If lunchStart exists but no lunchEnd, this is ending lunch
        attendanceType = "lunch-end";
        message = "Lunch break ended successfully";
      } else if (attendance.timeIn && !attendance.timeOut) {
        // If timeIn exists but no timeOut, this is a clock-out
        attendanceType = "out";
        message = "Clock-out recorded successfully";
      } else {
        // All records exist for today - return error
        return res.status(400).json({
          success: false,
          message: "All attendance records already completed for today",
        });
      }
    } else {
      // No attendance record exists - create new one for clock-in
      attendance = new Attendance({
        staffId: identifiedStaffId,
        date: today,
        status: "present",
      });
    }

    // Update attendance record based on detected type
    if (attendanceType === "in") {
      attendance.timeIn = now;

      // Calculate late minutes and update status if necessary
      if (shiftSchedule) {
        // Parse shift start time
        const [startHour, startMinute] = shiftSchedule.startTime
          .split(":")
          .map(Number);

        // Create shift start time for today
        const shiftStart = new Date(today);
        shiftStart.setHours(startHour, startMinute, 0, 0.0);

        // Calculate late minutes
        if (now > shiftStart) {
          const lateMinutes = Math.floor((now - shiftStart) / (1000 * 60));

          // Check if within grace period
          const gracePeriod = staff.gracePeriod || 15; // Default 15 minutes

          if (lateMinutes > gracePeriod) {
            attendance.status = "late";
            attendance.lateMinutes = lateMinutes;
          }
        }
      }
    } else if (attendanceType === "lunch-start") {
      attendance.lunchStart = now;
    } else if (attendanceType === "lunch-end") {
      attendance.lunchEnd = now;
    } else if (attendanceType === "out") {
      attendance.timeOut = now;

      // Calculate overtime if shift is assigned
      if (shiftSchedule) {
        // Parse shift end time
        const [endHour, endMinute] = shiftSchedule.endTime
          .split(":")
          .map(Number);

        // Create shift end time for today
        const shiftEnd = new Date(today);
        shiftEnd.setHours(endHour, endMinute, 0, 0);

        // Calculate overtime (if clock-out time is after shift end time)
        if (now > shiftEnd) {
          const overtimeMinutes = Math.floor((now - shiftEnd) / (1000 * 60));
          attendance.overtime = overtimeMinutes;
        }

        // Calculate total hours worked including lunch break adjustment
        if (attendance.timeIn) {
          let totalMinutes = Math.floor(
            (now - attendance.timeIn) / (1000 * 60)
          );

          // Subtract lunch break if taken
          if (attendance.lunchStart && attendance.lunchEnd) {
            const lunchMinutes = Math.floor(
              (attendance.lunchEnd - attendance.lunchStart) / (1000 * 60)
            );
            totalMinutes -= lunchMinutes;
          }

          attendance.totalHoursWorked = Math.max(0, totalMinutes / 60);
        }
      }
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: message,
      data: {
        attendance,
        attendanceType,
        staffName: `${staff.firstname} ${staff.lastname}`,
        department: staff.department,
        position: staff.position,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error recording attendance",
      error: err.message,
    });
  }
};

exports.clockOut = async (req, res) => {
  try {
    const { fingerprint, staffId } = req.body;

    // If fingerprint is provided, identify staff
    let identifiedStaffId = staffId;

    if (fingerprint && !staffId) {
      try {
        // Match fingerprint to identify staff
        const matchResult = await fingerprintService.matchFingerprint({
          fingerPrint: fingerprint,
        });

        if (!matchResult.matched) {
          return res.status(401).json({
            success: false,
            message:
              "No matching fingerprint found. Please register your fingerprint first.",
          });
        }

        identifiedStaffId = matchResult.staffId;
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error processing fingerprint",
          error: error.message,
        });
      }
    }

    if (!identifiedStaffId) {
      return res.status(400).json({
        success: false,
        message: "Staff identification failed",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(identifiedStaffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      staffId: identifiedStaffId,
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
    const staff = await Users.findById(identifiedStaffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    // Update attendance record with clock-out time
    attendance.timeOut = now;

    // Get the staff's shift (either assigned or custom)
    let shiftSchedule = null;
    let shift = null;

    // Check if staff has an assigned shift
    if (staff.assignedShift) {
      shift = await Shift.findById(staff.assignedShift);
      if (shift) {
        if (shift.isWorkday(dayOfWeek)) {
          shiftSchedule = shift.getScheduleForDay(dayOfWeek);
        }
      }
    }

    // Calculate overtime if shift is assigned
    if (shiftSchedule) {
      // Parse shift end time
      const [endHour, endMinute] = shiftSchedule.endTime.split(":").map(Number);

      // Create shift end time for today
      const shiftEnd = new Date(today);
      shiftEnd.setHours(endHour, endMinute, 0, 0);

      // Calculate overtime minutes
      if (now > shiftEnd) {
        const overtimeMinutes = Math.floor((now - shiftEnd) / (1000 * 60));
        attendance.overtime = overtimeMinutes;
      }

      // Calculate total hours worked and determine if half-day
      const timeIn = new Date(attendance.timeIn);
      const timeOut = now;

      // Account for lunch break
      let lunchBreakDuration = 0;
      if (attendance.lunchStart && attendance.lunchEnd) {
        lunchBreakDuration =
          (new Date(attendance.lunchEnd) - new Date(attendance.lunchStart)) /
          (1000 * 60 * 60);
      } else if (shiftSchedule.lunchDuration) {
        // If lunch break not recorded but exists in schedule, use default
        lunchBreakDuration = shiftSchedule.lunchDuration / 60;
      }

      // Calculate total hours worked
      const totalHours =
        (timeOut - timeIn) / (1000 * 60 * 60) - lunchBreakDuration;
      attendance.totalHoursWorked = Math.max(0, totalHours);

      // Check if this qualifies as a half-day
      if (shift && totalHours > 0 && totalHours < shift.halfDayThreshold) {
        attendance.status = "half-day";
      }
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
    const { fingerprint, staffId } = req.body;

    // If fingerprint is provided, identify staff
    let identifiedStaffId = staffId;

    if (fingerprint && !staffId) {
      try {
        // Match fingerprint to identify staff
        const matchResult = await fingerprintService.matchFingerprint({
          fingerPrint: fingerprint,
        });

        if (!matchResult.matched) {
          return res.status(401).json({
            success: false,
            message:
              "No matching fingerprint found. Please register your fingerprint first.",
          });
        }

        identifiedStaffId = matchResult.staffId;
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error processing fingerprint",
          error: error.message,
        });
      }
    }

    if (!identifiedStaffId) {
      return res.status(400).json({
        success: false,
        message: "Staff identification failed",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(identifiedStaffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      staffId: identifiedStaffId,
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
    const { fingerprint, staffId } = req.body;

    // If fingerprint is provided, identify staff
    let identifiedStaffId = staffId;

    if (fingerprint && !staffId) {
      try {
        // Match fingerprint to identify staff
        const matchResult = await fingerprintService.matchFingerprint({
          fingerPrint: fingerprint,
        });

        if (!matchResult.matched) {
          return res.status(401).json({
            success: false,
            message:
              "No matching fingerprint found. Please register your fingerprint first.",
          });
        }

        identifiedStaffId = matchResult.staffId;
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error processing fingerprint",
          error: error.message,
        });
      }
    }

    if (!identifiedStaffId) {
      return res.status(400).json({
        success: false,
        message: "Staff identification failed",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(identifiedStaffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      staffId: identifiedStaffId,
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
    if (
      req.user &&
      req.user.role !== "ADMIN" &&
      attendance.staffId.toString() !== req.user._id.toString()
    ) {
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
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
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
    }).populate(
      "staffId",
      "firstname lastname middlename email department position"
    );

    // Count statistics
    const totalStaff = await Users.countDocuments({
      role: "STAFF",
      status: "active",
    });
    const present = attendanceRecords.filter(
      (record) => record.status === "present"
    ).length;
    const late = attendanceRecords.filter(
      (record) => record.status === "late"
    ).length;
    const absent = attendanceRecords.filter(
      (record) => record.status === "absent"
    ).length;
    const halfDay = attendanceRecords.filter(
      (record) => record.status === "half-day"
    ).length;
    const pendingReasons = attendanceRecords.filter(
      (record) =>
        (record.status === "absent" ||
          record.status === "late" ||
          record.status === "half-day") &&
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
        halfDay,
        pendingReasons,
        attendanceRate:
          totalStaff > 0 ? ((present + late + halfDay) / totalStaff) * 100 : 0,
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

    // If marking for today, ensure it's after working hours (after 6 PM)
    const now = new Date();
    if (markDate.toDateString() === now.toDateString() && now.getHours() < 18) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot mark absences for today until after working hours (6 PM)",
      });
    }

    // Process date to mark
    const processDate =
      markDate.toDateString() === now.toDateString()
        ? markDate // Today, after 6 PM
        : new Date(markDate); // Past date

    const dayOfWeek = processDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[dayOfWeek];

    // Get all active staff
    const activeStaff = await Users.find({
      role: "STAFF",
      status: "active",
    })
      .populate("assignedShift")
      .select("_id assignedShift customSchedule");

    // Filter staff who should be working on this day
    const workingStaff = activeStaff.filter((staff) => {
      // Check assigned shift first
      if (staff.assignedShift) {
        return staff.assignedShift.isWorkday(dayOfWeek);
      }

      // If no assigned shift, check custom schedule
      if (staff.customSchedule && staff.customSchedule[dayName]) {
        return staff.customSchedule[dayName].isWorkday;
      }

      // Default to Mon-Fri if no schedule defined
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    });

    const staffIds = workingStaff.map((staff) => staff._id);

    // Mark absent for staff who didn't clock in
    const absentRecords = await Attendance.markAbsentees(processDate, staffIds);

    res.status(200).json({
      success: true,
      message: `Marked ${
        absentRecords.length
      } staff as absent for ${processDate.toDateString()}`,
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

// Schedule task to automatically mark absences at end of day
exports.scheduleAbsenteeMarking = () => {
  console.log("Setting up scheduled task for automatic absence marking");

  // Schedule to run at 8 PM every day
  const scheduledTime = "0 20 * * *"; // Cron format: minute hour day month day-of-week

  // Use a scheduling library like node-cron to handle this
  // This is pseudo-code and needs to be implemented with a proper scheduler
  /*
  cron.schedule(scheduledTime, async () => {
    try {
      const today = new Date();
      const response = await axios.post(`${process.env.SERVER_URL}/api/attendance/mark-absentees`, { 
        date: today.toISOString().split('T')[0]
      });
      
      console.log(`Auto-marked absences: ${response.data.count} staff`);
    } catch (error) {
      console.error('Error in scheduled absence marking:', error);
    }
  });
  */
};

// Get attendance statistics for a specified period
exports.getAttendanceStats = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    // Parse dates
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Base query
    let query = {
      date: { $gte: start, $lte: end },
    };

    // Add department filter if provided
    if (department) {
      const staffInDept = await Users.find({ department }).select("_id");
      const staffIds = staffInDept.map((staff) => staff._id);
      query.staffId = { $in: staffIds };
    }

    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query);

    // Calculate statistics
    const totalRecords = attendanceRecords.length;
    const present = attendanceRecords.filter(
      (record) => record.status === "present"
    ).length;
    const late = attendanceRecords.filter(
      (record) => record.status === "late"
    ).length;
    const absent = attendanceRecords.filter(
      (record) => record.status === "absent"
    ).length;
    const halfDay = attendanceRecords.filter(
      (record) => record.status === "half-day"
    ).length;

    // Calculate average late minutes and overtime
    let totalLateMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalHoursWorked = 0;

    attendanceRecords.forEach((record) => {
      totalLateMinutes += record.lateMinutes || 0;
      totalOvertimeMinutes += record.overtime || 0;
      totalHoursWorked += record.totalHoursWorked || 0;
    });

    const avgLateMinutes =
      totalRecords > 0 ? totalLateMinutes / totalRecords : 0;
    const avgOvertimeMinutes =
      totalRecords > 0 ? totalOvertimeMinutes / totalRecords : 0;
    const avgHoursWorked =
      totalRecords > 0 ? totalHoursWorked / totalRecords : 0;

    // Group by date for trend analysis
    const dateStats = {};

    attendanceRecords.forEach((record) => {
      const dateStr = record.date.toISOString().split("T")[0];

      if (!dateStats[dateStr]) {
        dateStats[dateStr] = {
          date: dateStr,
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          halfDay: 0,
          hoursWorked: 0,
          lateMinutes: 0,
          overtimeMinutes: 0,
        };
      }

      dateStats[dateStr].total += 1;
      dateStats[dateStr].hoursWorked += record.totalHoursWorked || 0;
      dateStats[dateStr].lateMinutes += record.lateMinutes || 0;
      dateStats[dateStr].overtimeMinutes += record.overtime || 0;

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
    const dailyStats = Object.values(dateStats).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

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
          presentPercentage:
            totalRecords > 0 ? (present / totalRecords) * 100 : 0,
          latePercentage: totalRecords > 0 ? (late / totalRecords) * 100 : 0,
          absentPercentage:
            totalRecords > 0 ? (absent / totalRecords) * 100 : 0,
          halfDayPercentage:
            totalRecords > 0 ? (halfDay / totalRecords) * 100 : 0,
          avgLateMinutes,
          avgOvertimeMinutes,
          avgHoursWorked,
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
