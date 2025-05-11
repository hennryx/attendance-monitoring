// controllers/shiftController.js
const Shift = require("../models/Shift");
const Users = require("../models/Users");
const mongoose = require("mongoose");

// Create a new shift
exports.createShift = async (req, res) => {
  try {
    const { name, startTime, endTime, lunchStartTime, lunchDuration, gracePeriod, workingDays } = req.body;
    
    // Validate required fields
    if (!name || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Name, start time, and end time are required",
      });
    }
    
    // Create shift
    const shift = await Shift.create({
      name,
      startTime,
      endTime,
      lunchStartTime,
      lunchDuration,
      gracePeriod,
      workingDays,
    });
    
    res.status(201).json({
      success: true,
      message: "Shift created successfully",
      data: shift,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error creating shift",
      error: err.message,
    });
  }
};

// Get all shifts
exports.getAllShifts = async (req, res) => {
  try {
    const shifts = await Shift.find().sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving shifts",
      error: err.message,
    });
  }
};

// Get shift by ID
exports.getShiftById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shift ID",
      });
    }
    
    const shift = await Shift.findById(id);
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }
    
    res.status(200).json({
      success: true,
      data: shift,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving shift",
      error: err.message,
    });
  }
};

// Update shift
exports.updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shift ID",
      });
    }
    
    // Find and update shift
    const shift = await Shift.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Shift updated successfully",
      data: shift,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error updating shift",
      error: err.message,
    });
  }
};

// Delete shift
exports.deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shift ID",
      });
    }
    
    // Check if shift is assigned to any staff
    const assignedStaff = await Users.find({ assignedShift: id });
    
    if (assignedStaff.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete shift that is assigned to staff",
        assignedStaff: assignedStaff.map(staff => ({
          id: staff._id,
          name: `${staff.firstname} ${staff.lastname}`,
        })),
      });
    }
    
    // Delete shift
    const shift = await Shift.findByIdAndDelete(id);
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Shift deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error deleting shift",
      error: err.message,
    });
  }
};

// Assign shift to staff
exports.assignShift = async (req, res) => {
  try {
    const { staffId, shiftId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(staffId) || !mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID or shift ID",
      });
    }
    
    // Check if staff and shift exist
    const staff = await Users.findById(staffId);
    const shift = await Shift.findById(shiftId);
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }
    
    // Assign shift to staff
    staff.assignedShift = shiftId;
    await staff.save();
    
    res.status(200).json({
      success: true,
      message: "Shift assigned successfully",
      data: {
        staffId: staff._id,
        staffName: `${staff.firstname} ${staff.lastname}`,
        shiftId: shift._id,
        shiftName: shift.name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error assigning shift",
      error: err.message,
    });
  }
};

// Get staff by shift
exports.getStaffByShift = async (req, res) => {
  try {
    const { shiftId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shift ID",
      });
    }
    
    // Find staff assigned to the shift
    const staff = await Users.find({ assignedShift: shiftId })
      .select("_id firstname middlename lastname email department position");
    
    res.status(200).json({
      success: true,
      count: staff.length,
      data: staff,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving staff by shift",
      error: err.message,
    });
  }
};