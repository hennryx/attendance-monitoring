// controllers/payrollController.js
const Payroll = require("../models/Payroll");
const Attendance = require("../models/Attendance");
const Users = require("../models/Users");
const Shift = require("../models/Shift");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// Generate payroll for a staff member
exports.generatePayroll = async (req, res) => {
  try {
    const { staffId, periodStart, periodEnd, settings } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }
    
    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Period start and end dates are required",
      });
    }
    
    // Find staff
    const staff = await Users.findById(staffId);
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }
    
    if (!staff.baseSalary || staff.baseSalary <= 0) {
      return res.status(400).json({
        success: false,
        message: "Staff has no base salary set",
      });
    }
    
    // Check if payroll already exists for this period
    const existingPayroll = await Payroll.findOne({
      staffId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
    });
    
    if (existingPayroll) {
      return res.status(400).json({
        success: false,
        message: "Payroll already exists for this period",
      });
    }
    
    // Calculate payroll
    const payrollData = await Payroll.calculatePayroll(
      staffId,
      new Date(periodStart),
      new Date(periodEnd),
      staff.baseSalary,
      settings
    );
    
    // Add creator info
    payrollData.createdBy = req.user._id;
    
    // Create payroll record
    const payroll = await Payroll.create(payrollData);
    
    res.status(201).json({
      success: true,
      message: "Payroll generated successfully",
      data: payroll,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error generating payroll",
      error: err.message,
    });
  }
};

// Generate payroll for all staff
exports.generatePayrollBatch = async (req, res) => {
  try {
    const { periodStart, periodEnd, settings, departmentFilter } = req.body;
    
    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Period start and end dates are required",
      });
    }
    
    // Build query for staff
    const staffQuery = { 
      role: "STAFF", 
      status: "active",
      baseSalary: { $gt: 0 }
    };
    
    if (departmentFilter) {
      staffQuery.department = departmentFilter;
    }
    
    // Find eligible staff
    const eligibleStaff = await Users.find(staffQuery);
    
    if (eligibleStaff.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No eligible staff found",
      });
    }
    
    // Track results
    const results = {
      success: [],
      failed: [],
    };
    
    // Generate payroll for each staff
    for (const staff of eligibleStaff) {
      try {
        // Check if payroll already exists for this period
        const existingPayroll = await Payroll.findOne({
          staffId: staff._id,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
        });
        
        if (existingPayroll) {
          results.failed.push({
            staffId: staff._id,
            name: `${staff.firstname} ${staff.lastname}`,
            reason: "Payroll already exists for this period",
          });
          continue;
        }
        
        // Calculate payroll
        const payrollData = await Payroll.calculatePayroll(
          staff._id,
          new Date(periodStart),
          new Date(periodEnd),
          staff.baseSalary,
          settings
        );
        
        // Add creator info
        payrollData.createdBy = req.user._id;
        
        // Create payroll record
        const payroll = await Payroll.create(payrollData);
        
        results.success.push({
          staffId: staff._id,
          name: `${staff.firstname} ${staff.lastname}`,
          payrollId: payroll._id,
        });
      } catch (error) {
        results.failed.push({
          staffId: staff._id,
          name: `${staff.firstname} ${staff.lastname}`,
          reason: error.message,
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Generated ${results.success.length} payrolls, failed: ${results.failed.length}`,
      data: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error generating batch payroll",
      error: err.message,
    });
  }
};

// Update payroll status
exports.updatePayrollStatus = async (req, res) => {
  try {
    const { payrollId, status, notes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(payrollId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }
    
    // Find payroll
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }
    
    // Update status
    payroll.paymentStatus = status;
    
    if (status === "paid") {
      payroll.paymentDate = new Date();
    }
    
    if (notes) {
      payroll.notes = notes;
    }
    
    await payroll.save();
    
    res.status(200).json({
      success: true,
      message: "Payroll status updated successfully",
      data: payroll,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error updating payroll status",
      error: err.message,
    });
  }
};

// Get payroll by ID
exports.getPayrollById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }
    
    // Find payroll and populate staff info
    const payroll = await Payroll.findById(id).populate("staffId", "firstname middlename lastname email department position employeeId");
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }
    
    res.status(200).json({
      success: true,
      data: payroll,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving payroll",
      error: err.message,
    });
  }
};

// Get payroll for a staff member
exports.getStaffPayroll = async (req, res) => {
  try {
    const { staffId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }
    
    // Find payrolls for staff
    const payrolls = await Payroll.find({ staffId }).sort({ periodEnd: -1 });
    
    res.status(200).json({
      success: true,
      count: payrolls.length,
      data: payrolls,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving staff payroll",
      error: err.message,
    });
  }
};

// Get all payrolls for a period (admin only)
exports.getPayrollsByPeriod = async (req, res) => {
  try {
    const { periodStart, periodEnd, status, department } = req.query;
    
    // Build query
    const query = {};
    
    if (periodStart && periodEnd) {
      query.periodStart = { $gte: new Date(periodStart) };
      query.periodEnd = { $lte: new Date(periodEnd) };
    } else if (periodStart) {
      query.periodStart = { $gte: new Date(periodStart) };
    } else if (periodEnd) {
      query.periodEnd = { $lte: new Date(periodEnd) };
    }
    
    if (status) {
      query.paymentStatus = status;
    }
    
    // If department filter is provided, first get staff IDs from that department
    if (department) {
      const staffInDept = await Users.find({ department }).select("_id");
      const staffIds = staffInDept.map(staff => staff._id);
      query.staffId = { $in: staffIds };
    }
    
    // Find payrolls and populate staff info
    const payrolls = await Payroll.find(query)
      .populate("staffId", "firstname middlename lastname email department position employeeId")
      .sort({ periodEnd: -1 });
    
    res.status(200).json({
      success: true,
      count: payrolls.length,
      data: payrolls,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving payrolls",
      error: err.message,
    });
  }
};

// Add allowance to payroll
exports.addAllowance = async (req, res) => {
  try {
    const { payrollId, name, amount } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(payrollId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }
    
    if (!name || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid allowance name and amount are required",
      });
    }
    
    // Find payroll
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }
    
    // Add allowance
    payroll.allowances.push({ name, amount: Number(amount) });
    payroll.totalAllowances += Number(amount);
    
    await payroll.save();
    
    res.status(200).json({
      success: true,
      message: "Allowance added successfully",
      data: payroll,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error adding allowance",
      error: err.message,
    });
  }
};

// Add deduction to payroll
exports.addDeduction = async (req, res) => {
  try {
    const { payrollId, name, amount } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(payrollId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }
    
    if (!name || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid deduction name and amount are required",
      });
    }
    
    // Find payroll
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }
    
    // Add deduction
    payroll.deductions.push({ name, amount: Number(amount) });
    payroll.totalDeductions += Number(amount);
    
    await payroll.save();
    
    res.status(200).json({
      success: true,
      message: "Deduction added successfully",
      data: payroll,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error adding deduction",
      error: err.message,
    });
  }
};

// Remove allowance from payroll
exports.removeAllowance = async (req, res) => {
  try {
    const { payrollId, allowanceId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(payrollId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }
    
    // Find payroll
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }
    
    // Find allowance
    const allowance = payroll.allowances.id(allowanceId);
    
    if (!allowance) {
      return res.status(404).json({
        success: false,
        message: "Allowance not found",
      });
    }
    
    // Update total allowances
    payroll.totalAllowances -= allowance.amount;
    
    // Remove allowance
    allowance.remove();
    
    await payroll.save();
    
    res.status(200).json({
      success: true,
      message: "Allowance removed successfully",
      data: payroll,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error removing allowance",
      error: err.message,
    });
  }
};

// Remove deduction from payroll
exports.removeDeduction = async (req, res) => {
  try {
    const { payrollId, deductionId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(payrollId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }
    
    // Find payroll
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }
    
    // Find deduction
    const deduction = payroll.deductions.id(deductionId);
    
    if (!deduction) {
      return res.status(404).json({
        success: false,
        message: "Deduction not found",
      });
    }
    
    // Update total deductions
    payroll.totalDeductions -= deduction.amount;
    
    // Remove deduction
    deduction.remove();
    
    await payroll.save();
    
    res.status(200).json({
      success: true,
      message: "Deduction removed successfully",
      data: payroll,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error removing deduction",
      error: err.message,
    });
  }
};

// Generate pay slip PDF
exports.generatePaySlip = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }
    
    // Find payroll and populate staff info
    const payroll = await Payroll.findById(id).populate("staffId", "firstname middlename lastname email department position employeeId bankDetails");
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }
    
    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });
    
    const fileName = `payslip-${payroll.staffId.employeeId || payroll.staffId._id}-${payroll.periodStart.toISOString().split('T')[0]}-${payroll.periodEnd.toISOString().split('T')[0]}.pdf`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Company header
    doc.fontSize(18).text('Company Name', { align: 'center' });
    doc.fontSize(12).text('Pay Slip', { align: 'center' });
    doc.moveDown();
    
    // Staff information
    doc.fontSize(12).text('Employee Information:', { underline: true });
    doc.fontSize(10).text(`Name: ${payroll.staffId.firstname} ${payroll.staffId.middlename || ''} ${payroll.staffId.lastname}`);
    doc.fontSize(10).text(`Employee ID: ${payroll.staffId.employeeId || 'N/A'}`);
    doc.fontSize(10).text(`Department: ${payroll.staffId.department}`);
    doc.fontSize(10).text(`Position: ${payroll.staffId.position}`);
    doc.moveDown();
    
    // Pay period
    doc.fontSize(12).text('Pay Period:', { underline: true });
    doc.fontSize(10).text(`From: ${payroll.periodStart.toISOString().split('T')[0]}`);
    doc.fontSize(10).text(`To: ${payroll.periodEnd.toISOString().split('T')[0]}`);
    doc.moveDown();
    
    // Earnings
    doc.fontSize(12).text('Earnings:', { underline: true });
    doc.fontSize(10).text(`Base Salary: $${payroll.baseSalary.toFixed(2)}`);
    doc.fontSize(10).text(`Overtime Pay: $${payroll.overtimePay.toFixed(2)}`);
    
    // Allowances
    if (payroll.allowances.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10).text('Allowances:');
      
      payroll.allowances.forEach(allowance => {
        doc.fontSize(10).text(`  ${allowance.name}: $${allowance.amount.toFixed(2)}`);
      });
    }
    
    doc.fontSize(10).text(`Total Allowances: $${payroll.totalAllowances.toFixed(2)}`);
    doc.fontSize(10).text(`Gross Pay: $${payroll.grossPay.toFixed(2)}`);
    doc.moveDown();
    
    // Deductions
    doc.fontSize(12).text('Deductions:', { underline: true });
    
    if (payroll.deductions.length > 0) {
      payroll.deductions.forEach(deduction => {
        doc.fontSize(10).text(`  ${deduction.name}: $${deduction.amount.toFixed(2)}`);
      });
    }
    
    doc.fontSize(10).text(`Late Deductions: $${payroll.lateDeductions.toFixed(2)}`);
    doc.fontSize(10).text(`Absence Deductions: $${payroll.absenceDeductions.toFixed(2)}`);
    doc.fontSize(10).text(`Total Deductions: $${payroll.totalDeductions.toFixed(2)}`);
    doc.moveDown();
    
    // Net pay
    doc.fontSize(14).text(`Net Pay: $${payroll.netPay.toFixed(2)}`, { underline: true });
    doc.moveDown();
    
    // Payment information
    doc.fontSize(12).text('Payment Information:', { underline: true });
    doc.fontSize(10).text(`Payment Status: ${payroll.paymentStatus}`);
    
    if (payroll.paymentDate) {
      doc.fontSize(10).text(`Payment Date: ${payroll.paymentDate.toISOString().split('T')[0]}`);
    }
    
    doc.fontSize(10).text(`Payment Method: ${payroll.paymentMethod}`);
    
    if (payroll.staffId.bankDetails && payroll.staffId.bankDetails.bankName) {
      doc.fontSize(10).text(`Bank: ${payroll.staffId.bankDetails.bankName}`);
      doc.fontSize(10).text(`Account Number: ${payroll.staffId.bankDetails.accountNumber}`);
    }
    
    doc.moveDown();
    
    // Attendance summary
    doc.fontSize(12).text('Attendance Summary:', { underline: true });
    doc.fontSize(10).text(`Days Worked: ${payroll.daysWorked} / ${payroll.totalWorkingDays}`);
    doc.fontSize(10).text(`Total Hours Worked: ${payroll.totalHoursWorked.toFixed(2)}`);
    doc.fontSize(10).text(`Overtime Hours: ${payroll.overtimeHours.toFixed(2)}`);
    doc.moveDown();
    
    // Notes
    if (payroll.notes) {
      doc.fontSize(12).text('Notes:', { underline: true });
      doc.fontSize(10).text(payroll.notes);
      doc.moveDown();
    }
    
    // Footer
    doc.fontSize(8).text('This document is electronically generated and does not require a signature.', { align: 'center' });
    doc.fontSize(8).text(`Generated on: ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
    
    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error generating pay slip",
      error: err.message,
    });
  }
};

// Get payroll statistics
exports.getPayrollStats = async (req, res) => {
  try {
    const { year, month, department } = req.query;
    
    // Build query
    const query = {};
    
    if (year && month) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
      
      query.periodEnd = { 
        $gte: startDate,
        $lte: endDate
      };
    } else if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31);
      
      query.periodEnd = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    // If department filter is provided, first get staff IDs from that department
    if (department) {
      const staffInDept = await Users.find({ department }).select("_id");
      const staffIds = staffInDept.map(staff => staff._id);
      query.staffId = { $in: staffIds };
    }
    
    // Find payrolls
    const payrolls = await Payroll.find(query);
    
    // Calculate statistics
    const totalPayrolls = payrolls.length;
    let totalGrossPay = 0;
    let totalNetPay = 0;
    let totalOvertimePay = 0;
    let totalDeductions = 0;
    let totalAllowances = 0;
    
    payrolls.forEach(payroll => {
      totalGrossPay += payroll.grossPay;
      totalNetPay += payroll.netPay;
      totalOvertimePay += payroll.overtimePay;
      totalDeductions += payroll.totalDeductions;
      totalAllowances += payroll.totalAllowances;
    });
    
    // Status breakdown
    const statusBreakdown = {
      pending: payrolls.filter(p => p.paymentStatus === "pending").length,
      processing: payrolls.filter(p => p.paymentStatus === "processing").length,
      paid: payrolls.filter(p => p.paymentStatus === "paid").length,
      cancelled: payrolls.filter(p => p.paymentStatus === "cancelled").length,
    };
    
    // Monthly breakdown (only if year is provided)
    let monthlyBreakdown = null;
    
    if (year && !month) {
      monthlyBreakdown = Array(12).fill(0).map((_, index) => {
        const monthStart = new Date(parseInt(year), index, 1);
        const monthEnd = new Date(parseInt(year), index + 1, 0);
        
        const monthPayrolls = payrolls.filter(p => 
          p.periodEnd >= monthStart && p.periodEnd <= monthEnd
        );
        
        return {
          month: index + 1,
          count: monthPayrolls.length,
          grossPay: monthPayrolls.reduce((sum, p) => sum + p.grossPay, 0),
          netPay: monthPayrolls.reduce((sum, p) => sum + p.netPay, 0),
        };
      });
    }
    
    res.status(200).json({
      success: true,
      stats: {
        totalPayrolls,
        totalGrossPay,
        totalNetPay,
        totalOvertimePay,
        totalDeductions,
        totalAllowances,
        averageGrossPay: totalPayrolls > 0 ? totalGrossPay / totalPayrolls : 0,
        averageNetPay: totalPayrolls > 0 ? totalNetPay / totalPayrolls : 0,
        statusBreakdown,
        monthlyBreakdown,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error retrieving payroll statistics",
      error: err.message,
    });
  }
};