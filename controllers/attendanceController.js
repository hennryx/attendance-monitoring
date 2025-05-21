const Attendance = require("../models/Attendance");
const Users = require("../models/Users");
const Shift = require("../models/Shift");
const fingerprintService = require("../service/fingerprintService");
const mongoose = require("mongoose");

exports.getAllAttendance = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            startDate,
            endDate,
            status,
            staffId,
        } = req.query;

        let query = {};

        if (staffId) {
            query.staffId = staffId;
        }

        if (status) {
            query.status = status;
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.date.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        const attendanceRecords = await Attendance.find(query)
            .populate(
                "staffId",
                "firstname lastname middlename email department position"
            )
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const totalRecords = await Attendance.countDocuments(query);

        res.status(200).json({
            success: true,
            count: attendanceRecords.length,
            total: totalRecords,
            pages: Math.ceil(totalRecords / limit),
            currentPage: parseInt(page),
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

exports.getRecentAttendance = async (req, res) => {
    try {
        const staffId = req.query.staffId;

        if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing staff ID",
            });
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayAttendance = await Attendance.findOne({
            staffId: staffId,
            date: { $gte: today, $lt: tomorrow },
        });

        const recentAttendance = await Attendance.find({
            staffId: staffId,
            date: { $gte: sevenDaysAgo },
        }).sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: recentAttendance.length,
            data: recentAttendance,
            todayAttendance,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Error retrieving recent attendance",
            error: err.message,
        });
    }
};

exports.getPublicAttendance = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const attendanceRecords = await Attendance.find({
            date: { $gte: today, $lt: tomorrow },
        }).populate(
            "staffId",
            "firstname lastname middlename email department position"
        );

        const activityHistory = attendanceRecords
            .map((record) => {
                let actionType = "";
                let actionTime = null;

                if (record.timeOut) {
                    actionType = "out";
                    actionTime = new Date(record.timeOut);
                } else if (record.lunchEnd) {
                    actionType = "lunch-end";
                    actionTime = new Date(record.lunchEnd);
                } else if (record.lunchStart) {
                    actionType = "lunch-start";
                    actionTime = new Date(record.lunchStart);
                } else if (record.timeIn) {
                    actionType = "in";
                    actionTime = new Date(record.timeIn);
                }

                if (!actionTime) return null;

                const staffName = record.staffId
                    ? `${record.staffId.firstname} ${record.staffId.middlename || ""} ${record.staffId.lastname
                        }`.trim()
                    : "Unknown Staff";

                return {
                    date: actionTime,
                    type: actionType,
                    name: staffName,
                    department: record.staffId?.department || "",
                };
            })
            .filter((record) => record !== null)
            .sort((a, b) => b.date - a.date);

        res.status(200).json({
            success: true,
            count: activityHistory.length,
            data: activityHistory,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Error retrieving attendance activity",
            error: err.message,
        });
    }
};

exports.clockIn = async (req, res) => {
    try {
        const { fingerprint, staffId } = req.body;

        let identifiedStaffId = staffId;

        if (fingerprint && !staffId) {
            try {
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

        const staff = await Users.findById(identifiedStaffId);

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: "Staff not found",
            });
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = now.getDay();

        let shiftSchedule = null;
        let isWorkday = false;

        if (staff.assignedShift) {
            const shift = await Shift.findById(staff.assignedShift);
            if (shift) {
                isWorkday = shift.isWorkday(dayOfWeek);
                if (isWorkday) {
                    shiftSchedule = shift.getScheduleForDay(dayOfWeek);
                }
            }
        }
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

        if (!isWorkday) {
            return res.status(400).json({
                success: false,
                message: "Today is not a workday according to your schedule",
            });
        }

        let attendance = await Attendance.findOne({
            staffId: identifiedStaffId,
            date: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            },
        });

        let attendanceType = "in";
        let message = "Clock-in recorded successfully";

        if (attendance) {
            if (!attendance.timeIn) {
                attendanceType = "in";
                message = "Clock-in recorded successfully";
            } else if (attendance.timeIn && !attendance.lunchStart) {
                attendanceType = "lunch-start";
                message = "Lunch break started successfully";
            } else if (attendance.lunchStart && !attendance.lunchEnd) {
                attendanceType = "lunch-end";
                message = "Lunch break ended successfully";
            } else if (attendance.timeIn && !attendance.timeOut) {
                attendanceType = "out";
                message = "Clock-out recorded successfully";
            } else {
                return res.status(400).json({
                    success: false,
                    message: "All attendance records already completed for today",
                });
            }
        } else {
            attendance = new Attendance({
                staffId: identifiedStaffId,
                date: today,
                status: "present",
            });
        }

        if (attendanceType === "in") {
            attendance.timeIn = now;

            if (shiftSchedule) {
                const [startHour, startMinute] = shiftSchedule.startTime
                    .split(":")
                    .map(Number);

                const shiftStart = new Date(today);
                shiftStart.setHours(startHour, startMinute, 0, 0.0);

                if (now > shiftStart) {
                    const lateMinutes = Math.floor((now - shiftStart) / (1000 * 60));

                    const gracePeriod = staff.gracePeriod || 15;

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

            if (shiftSchedule) {
                const [endHour, endMinute] = shiftSchedule.endTime
                    .split(":")
                    .map(Number);

                const shiftEnd = new Date(today);
                shiftEnd.setHours(endHour, endMinute, 0, 0);

                if (now > shiftEnd) {
                    const overtimeMinutes = Math.floor((now - shiftEnd) / (1000 * 60));
                    attendance.overtime = overtimeMinutes;
                }

                if (attendance.timeIn) {
                    let totalMinutes = Math.floor(
                        (now - attendance.timeIn) / (1000 * 60)
                    );

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

        const attendance = await Attendance.findById(attendanceId);

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found",
            });
        }

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

exports.verifyReason = async (req, res) => {
    try {
        const { attendanceId, verified, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid attendance ID",
            });
        }

        const attendance = await Attendance.findById(attendanceId);

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found",
            });
        }

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

exports.getStaffAttendance = async (req, res) => {
    try {
        const { staffId, startDate, endDate } = req.query;

        if (!mongoose.Types.ObjectId.isValid(staffId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid staff ID",
            });
        }

        const start = startDate
            ? new Date(startDate)
            : new Date(new Date().setDate(new Date().getDate() - 30));
        start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

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

exports.getTodayAttendance = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const attendanceRecords = await Attendance.find({
            date: { $gte: today, $lt: tomorrow },
        }).populate(
            "staffId",
            "firstname lastname middlename email department position"
        );

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

        const enhancedRecords = attendanceRecords.map((record) => {
            const recordObj = record.toObject ? record.toObject() : record;

            let attendanceType = null;

            if (
                recordObj.timeIn &&
                !recordObj.lunchStart &&
                !recordObj.lunchEnd &&
                !recordObj.timeOut
            ) {
                attendanceType = "in";
            } else if (recordObj.lunchStart && !recordObj.lunchEnd) {
                attendanceType = "lunch-start";
            } else if (recordObj.lunchEnd) {
                attendanceType = "lunch-end";
            } else if (recordObj.timeOut) {
                attendanceType = "out";
            }

            return {
                ...recordObj,
                attendanceType,
            };
        });

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
            data: enhancedRecords,
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

exports.markAbsentees = async (req, res) => {
    try {
        let markDate = req.body.date ? new Date(req.body.date) : new Date();
        markDate.setHours(0, 0, 0, 0);

        const now = new Date();
        if (markDate.toDateString() === now.toDateString() && now.getHours() < 18) {
            if (!req.body.forceMarkToday) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Are you sure you want to mark absences for today before end of workday?",
                    requireConfirmation: true,
                });
            }
        }

        const schedulingService = require("../services/schedulingService");
        const absentRecords = await schedulingService.markAbsenteesForDate(
            markDate
        );

        res.status(200).json({
            success: true,
            message: `Marked ${absentRecords.length
                } staff as absent for ${markDate.toDateString()}`,
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

exports.getAttendanceStats = async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;

        const start = startDate
            ? new Date(startDate)
            : new Date(new Date().setDate(new Date().getDate() - 30));
        start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        let query = {
            date: { $gte: start, $lte: end },
        };

        if (department) {
            const staffInDept = await Users.find({ department }).select("_id");
            const staffIds = staffInDept.map((staff) => staff._id);
            query.staffId = { $in: staffIds };
        }

        const attendanceRecords = await Attendance.find(query);

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
