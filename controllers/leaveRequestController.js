const LeaveRequest = require("../models/LeaveRequest");
const Users = require("../models/Users");
const Notification = require("../models/Notification");
const Attendance = require("../models/Attendance");

const mongoose = require("mongoose");

exports.createLeaveRequest = async (req, res) => {
  try {
    const { staffId, startDate, endDate, leaveType, reason } = req.body;

    if (!staffId || !startDate || !endDate || !leaveType || !reason) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if dates are valid
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be in the past",
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date",
      });
    }

    // Check if staff exists
    const staff = await Users.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    // Check for overlapping leave requests
    const overlappingRequests = await LeaveRequest.find({
      staffId,
      status: { $ne: "rejected" },
      $or: [
        { 
          startDate: { $lte: end }, 
          endDate: { $gte: start } 
        }
      ],
    });

    if (overlappingRequests.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You already have a leave request for this period",
      });
    }

    // Create leave request
    const leaveRequest = new LeaveRequest({
      staffId,
      startDate,
      endDate,
      leaveType,
      reason,
    });

    await leaveRequest.save();

    // Create notification for admin
    const adminUsers = await Users.find({ role: "ADMIN" }).select("_id");
    const staffName = `${staff.firstname} ${staff.lastname}`;

    // Create notifications for all admins
    const notifications = adminUsers.map(admin => ({
      userId: admin._id,
      type: "leave_request",
      title: "New Leave Request",
      message: `${staffName} has requested leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}.`,
      data: { 
        leaveRequestId: leaveRequest._id,
        staffId,
        staffName,
        startDate,
        endDate,
        leaveType
      },
      read: false
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: leaveRequest,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error creating leave request",
      error: err.message,
    });
  }
};

exports.getAllLeaveRequests = async (req, res) => {
  try {
    const leaveRequests = await LeaveRequest.find()
      .populate("staffId", "firstname lastname email department position")
      .sort({ createdAt: -1 });

    const formattedRequests = leaveRequests.map(request => {
      const staff = request.staffId;
      return {
        _id: request._id,
        staffId: staff._id,
        staffName: `${staff.firstname} ${staff.lastname}`,
        staffEmail: staff.email,
        staffDepartment: staff.department,
        staffPosition: staff.position,
        startDate: request.startDate,
        endDate: request.endDate,
        leaveType: request.leaveType,
        reason: request.reason,
        status: request.status,
        rejectionReason: request.rejectionReason,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      count: formattedRequests.length,
      data: formattedRequests,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving leave requests",
      error: err.message,
    });
  }
};

// Get leave requests for a specific user
exports.getUserLeaveRequests = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const leaveRequests = await LeaveRequest.find({ staffId: id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving user leave requests",
      error: err.message,
    });
  }
};

// Update leave request status (approve/reject)
exports.updateLeaveRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID",
      });
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'approved' or 'rejected'",
      });
    }

    if (status === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    if (leaveRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Leave request has already been ${leaveRequest.status}`,
      });
    }

    // Update the request
    leaveRequest.status = status;
    if (status === "rejected") {
      leaveRequest.rejectionReason = rejectionReason;
    } else {
      leaveRequest.approvedBy = req.user._id;
      leaveRequest.approvedAt = new Date();
    }

    await leaveRequest.save();

    // Create notification for staff
    const staff = await Users.findById(leaveRequest.staffId);
    if (staff) {
      await Notification.create({
        userId: staff._id,
        type: "leave_status",
        title: `Leave Request ${status === "approved" ? "Approved" : "Rejected"}`,
        message: status === "approved" 
          ? `Your leave request from ${new Date(leaveRequest.startDate).toLocaleDateString()} to ${new Date(leaveRequest.endDate).toLocaleDateString()} has been approved.`
          : `Your leave request from ${new Date(leaveRequest.startDate).toLocaleDateString()} to ${new Date(leaveRequest.endDate).toLocaleDateString()} has been rejected. Reason: ${rejectionReason}`,
        data: { 
          leaveRequestId: leaveRequest._id,
          status,
          rejectionReason: status === "rejected" ? rejectionReason : null
        },
        read: false
      });
    }

    res.status(200).json({
      success: true,
      message: `Leave request ${status} successfully`,
      data: leaveRequest,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error updating leave request status",
      error: err.message,
    });
  }
};

exports.getUnhandledAbsences = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const absences = await Attendance.find({
      staffId: id,
      status: { $in: ["absent", "late", "half-day"] },
      reason: { $in: [null, ""] },
      date: { $gte: oneWeekAgo }
    }).sort({ date: -1 });

    const formattedAbsences = absences.map(absence => ({
      attendanceId: absence._id,
      date: absence.date,
      status: absence.status,
      staffId: id
    }));

    console.log(formattedAbsences);
    
    res.status(200).json({
      success: true,
      count: formattedAbsences.length,
      data: formattedAbsences,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving unhandled absences",
      error: err.message,
    });
  }
};

// Get leave requests statistics for reporting
exports.getLeaveStatistics = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    // Build query
    let query = {
      startDate: { $lte: end },
      endDate: { $gte: start }
    };
    
    // Add department filter if provided
    if (department) {
      // Find all staff in the department
      const staffInDept = await Users.find({ department }).select('_id');
      const staffIds = staffInDept.map(staff => staff._id);
      query.staffId = { $in: staffIds };
    }
    
    // Get all leave requests matching the query
    const leaveRequests = await LeaveRequest.find(query)
      .populate('staffId', 'firstname lastname department position')
      .lean();
      
    // Calculate statistics
    
    // 1. Count by status
    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0
    };
    
    // 2. Count by leave type
    const typeCounts = {
      vacation: 0,
      sick: 0,
      personal: 0,
      bereavement: 0,
      other: 0
    };
    
    // 3. Count by department
    const departmentCounts = {};
    
    // Process each request
    leaveRequests.forEach(request => {
      // Update status counts
      statusCounts[request.status]++;
      
      // Update type counts
      typeCounts[request.leaveType]++;
      
      // Update department counts
      const dept = request.staffId?.department || 'Unknown';
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    });
    
    // Calculate average leave duration
    let totalDays = 0;
    leaveRequests.forEach(request => {
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      totalDays += days;
    });
    
    const avgDuration = leaveRequests.length > 0 ? totalDays / leaveRequests.length : 0;
    
    // Prepare monthly distribution
    const monthlyData = {};
    
    leaveRequests.forEach(request => {
      const startMonth = new Date(request.startDate).toLocaleString('default', { month: 'long', year: 'numeric' });
      monthlyData[startMonth] = (monthlyData[startMonth] || 0) + 1;
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalRequests: leaveRequests.length,
        statusCounts,
        typeCounts,
        departmentCounts,
        avgDuration,
        monthlyDistribution: Object.entries(monthlyData).map(([month, count]) => ({ month, count }))
      }
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving leave statistics",
      error: err.message,
    });
  }
};