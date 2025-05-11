import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaDownload, FaArrowLeft } from 'react-icons/fa';
import useAuthStore from '../../../../services/stores/authStore';
import axiosTools from '../../../../services/utilities/axiosUtils';
import { ENDPOINT } from '../../../../services/utilities';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

const PaySlip = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, auth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [payroll, setPayroll] = useState(null);
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    const fetchPayroll = async () => {
      if (!token || !id) return;

      setIsLoading(true);
      try {
        const response = await axiosTools.getData(
          `${ENDPOINT}/payroll/${id}`,
          '',
          token
        );

        if (response.success) {
          setPayroll(response.data);
          setStaff(response.data.staffId);
          
          // Verify the user is authorized to view this payslip
          if (auth.role !== 'ADMIN' && auth._id !== response.data.staffId._id) {
            Swal.fire({
              icon: 'error',
              title: 'Unauthorized',
              text: 'You are not authorized to view this pay slip',
            });
            navigate('/dashboard');
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Not Found',
            text: 'The requested pay slip could not be found',
          });
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching payroll data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Failed to load pay slip',
          text: error.message || 'An error occurred while loading the pay slip',
        });
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayroll();
  }, [token, id, auth, navigate]);

  const handleDownload = () => {
    if (!id) return;
    
    // Open payslip in new tab for downloading
    window.open(`${ENDPOINT}/payroll/payslip/${id}`, '_blank');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Loading pay slip...</div>
      </div>
    );
  }

  if (!payroll || !staff) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-xl text-center text-gray-600">Pay slip not found</div>
        <div className="flex justify-center mt-4">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
            onClick={() => navigate('/dashboard')}
          >
            <FaArrowLeft /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <button
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded flex items-center gap-2"
          onClick={() => navigate(-1)}
        >
          <FaArrowLeft /> Back
        </button>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
          onClick={handleDownload}
        >
          <FaDownload /> Download PDF
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Company Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-center">Company Name</h1>
          <p className="text-gray-500 text-center">Pay Slip</p>
        </div>

        {/* Pay Slip Content */}
        <div className="p-6">
          {/* Employee Information */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold border-b pb-2 mb-3">Employee Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Name:</p>
                <p className="font-medium">{staff.firstname} {staff.middlename} {staff.lastname}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Employee ID:</p>
                <p className="font-medium">{staff.employeeId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Department:</p>
                <p className="font-medium">{staff.department}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Position:</p>
                <p className="font-medium">{staff.position}</p>
              </div>
            </div>
          </div>

          {/* Pay Period */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold border-b pb-2 mb-3">Pay Period</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">From:</p>
                <p className="font-medium">{format(new Date(payroll.periodStart), 'MMMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">To:</p>
                <p className="font-medium">{format(new Date(payroll.periodEnd), 'MMMM d, yyyy')}</p>
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold border-b pb-2 mb-3">Earnings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Base Salary:</p>
                <p className="font-medium">{formatCurrency(payroll.baseSalary)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Overtime Pay:</p>
                <p className="font-medium">{formatCurrency(payroll.overtimePay)}</p>
              </div>
            </div>

            {/* Allowances */}
            {payroll.allowances && payroll.allowances.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-600 text-sm mb-2">Allowances:</p>
                <div className="pl-4">
                  {payroll.allowances.map((allowance, index) => (
                    <div key={index} className="flex justify-between mb-1">
                      <span>{allowance.name}</span>
                      <span>{formatCurrency(allowance.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t">
                  <span className="font-medium">Total Allowances:</span>
                  <span className="font-medium">{formatCurrency(payroll.totalAllowances)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-4 pt-2 border-t font-semibold">
              <span>Gross Pay:</span>
              <span>{formatCurrency(payroll.grossPay)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold border-b pb-2 mb-3">Deductions</h2>
            
            {/* Standard Deductions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Late Deductions:</p>
                <p className="font-medium">{formatCurrency(payroll.lateDeductions)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Absence Deductions:</p>
                <p className="font-medium">{formatCurrency(payroll.absenceDeductions)}</p>
              </div>
            </div>

            {/* Additional Deductions */}
            {payroll.deductions && payroll.deductions.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-600 text-sm mb-2">Additional Deductions:</p>
                <div className="pl-4">
                  {payroll.deductions.map((deduction, index) => (
                    <div key={index} className="flex justify-between mb-1">
                      <span>{deduction.name}</span>
                      <span>{formatCurrency(deduction.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between mt-4 pt-2 border-t">
              <span className="font-medium">Total Deductions:</span>
              <span className="font-medium">{formatCurrency(payroll.totalDeductions)}</span>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">Net Pay:</span>
              <span className="text-xl font-bold">{formatCurrency(payroll.netPay)}</span>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold border-b pb-2 mb-3">Attendance Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Days Worked:</p>
                <p className="font-medium">{payroll.daysWorked} / {payroll.totalWorkingDays}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Hours:</p>
                <p className="font-medium">{payroll.totalHoursWorked.toFixed(1)} hrs</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Overtime Hours:</p>
                <p className="font-medium">{payroll.overtimeHours.toFixed(1)} hrs</p>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold border-b pb-2 mb-3">Payment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Payment Status:</p>
                <p className={`font-medium ${
                  payroll.paymentStatus === 'paid' ? 'text-green-600' : 
                  payroll.paymentStatus === 'pending' ? 'text-yellow-600' : 
                  payroll.paymentStatus === 'processing' ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {payroll.paymentStatus.charAt(0).toUpperCase() + payroll.paymentStatus.slice(1)}
                </p>
              </div>
              {payroll.paymentDate && (
                <div>
                  <p className="text-gray-600 text-sm">Payment Date:</p>
                  <p className="font-medium">{format(new Date(payroll.paymentDate), 'MMMM d, yyyy')}</p>
                </div>
              )}
              <div>
                <p className="text-gray-600 text-sm">Payment Method:</p>
                <p className="font-medium">{payroll.paymentMethod}</p>
              </div>
            </div>

            {/* Bank Details */}
            {staff.bankDetails && staff.bankDetails.bankName && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-600 text-sm mb-2">Bank Details:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <p className="text-gray-600 text-sm">Bank:</p>
                    <p className="font-medium">{staff.bankDetails.bankName}</p>
                  </div>
                  {staff.bankDetails.accountNumber && (
                    <div>
                      <p className="text-gray-600 text-sm">Account Number:</p>
                      <p className="font-medium">
                        {/* Show only last 4 digits for security */}
                        ******{staff.bankDetails.accountNumber.slice(-4)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {payroll.notes && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold border-b pb-2 mb-3">Notes</h2>
              <p>{payroll.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>This document is electronically generated and does not require a signature.</p>
          <p>Generated on: {format(new Date(), 'MMMM d, yyyy')}</p>
        </div>
      </div>
    </div>
  );
};

export default PaySlip;