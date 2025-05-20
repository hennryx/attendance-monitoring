// services/schedulingService.js
const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Users = require("../models/Users");
const Shift = require("../models/Shift");
const Notification = require("../models/Notification");

class SchedulingService {
  constructor() {
    this.tasks = [];
  }

  init() {
    this.scheduleAbsenteeMarking();
    console.log("✅ Scheduling service initialized");
  }

  scheduleAbsenteeMarking() {
    const task = cron.schedule("59 23 * * *", async () => {
      console.log("🔄 Running automatic absent marking...");
      try {
        const today = new Date();
        await this.markAbsenteesForDate(today);
        console.log("✅ Automatic absent marking completed");
      } catch (error) {
        console.error("❌ Error in automatic absent marking:", error);
      }
    });

    this.tasks.push(task);
  }

  async markAbsenteesForDate(date) {
    const processDate = new Date(date);
    processDate.setHours(0, 0, 0, 0);

    const dayOfWeek = processDate.getDay();
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

    const activeStaff = await Users.find({
      role: "STAFF",
      status: "active",
    })
      .populate("assignedShift")
      .select("_id firstname lastname email assignedShift customSchedule");

    const workingStaff = activeStaff.filter((staff) => {
      if (staff.assignedShift) {
        return staff.assignedShift.isWorkday(dayOfWeek);
      }

      if (staff.customSchedule && staff.customSchedule[dayName]) {
        return staff.customSchedule[dayName].isWorkday;
      }

      return dayOfWeek >= 1 && dayOfWeek <= 5;
    });

    const staffIds = workingStaff.map((staff) => staff._id);

    const absentRecords = await Attendance.markAbsentees(processDate, staffIds);

    if (absentRecords && absentRecords.length > 0) {
      const notifications = [];

      for (const record of absentRecords) {
        const staffMember = workingStaff.find(
          (s) => s._id.toString() === record.staffId.toString()
        );
        if (staffMember) {
          notifications.push({
            userId: staffMember._id,
            type: "absence_reason",
            title: "Absence Reason Required",
            message: `You were marked absent on ${processDate.toLocaleDateString()}. Please provide a reason.`,
            data: {
              attendanceId: record._id,
              date: record.date,
              status: record.status,
              staffId: staffMember._id,
            },
            read: false,
          });
        }
      }

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    return absentRecords;
  }

  stop() {
    this.tasks.forEach((task) => task.stop());
    this.tasks = [];
    console.log("🛑 Scheduling service stopped");
  }
}

module.exports = new SchedulingService();
