import React, { useEffect, useState } from 'react';
import { FaDownload, FaCheck, FaSpinner, FaPlus, FaFilter } from 'react-icons/fa';
import useAuthStore from '../../../../services/stores/authStore';
import axiosTools from '../../../../services/utilities/axiosUtils';
import { ENDPOINT } from '../../../../services/utilities';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import PayrollModal from './modal';

const PayrollManagement = () => {
  const { token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [payrolls, setPayrolls] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    const fetchPayrolls = async () => {
      setIsLoading(true);
      try {
        const queryParams = {};
        if (periodStart) queryParams.periodStart = periodStart;
        if (periodEnd) queryParams.periodEnd = periodEnd;
        if (statusFilter) queryParams.status = statusFilter;
        if (departmentFilter) queryParams.department = departmentFilter;

        // Fetch payrolls
        const response = await axiosTools.getData(
          `${ENDPOINT}/payroll/period`,
          queryParams,
          token
        );

        if (response.success) {
          setPayrolls(response.data);
        }

        const deptResponse = await axiosTools.getData(
          `${ENDPOINT}/users/departments`,
          '',
          token
        );

        if (deptResponse.success) {
          setDepartments(deptResponse.data);
        }
      } catch (error) {
        console.error('Error fetching payrolls:', error);
        Swal.fire({
          icon: 'error',
          title: 'Failed to load payrolls',
          text: error.message || 'An error occurred while loading payroll data',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayrolls();
  }, [token, periodStart, periodEnd, statusFilter, departmentFilter]);

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleGeneratePayroll = (payrollData) => {
    // This will be called from the modal when payroll is generated
    // Add the new payroll to the list
    setPayrolls([payrollData, ...payrolls]);
  };

  const handleUpdateStatus = async (payrollId, newStatus) => {
    try {
      const response = await axiosTools.updateData(
        `${ENDPOINT}/payroll/status`,
        {
          payrollId,
          status: newStatus
        },
        token
      );

      if (response.success) {
        // Update payroll status in the list
        setPayrolls(
          payrolls.map(payroll => 
            payroll._id === payrollId 
              ? { ...payroll, paymentStatus: newStatus } 
              : payroll
          )
        );

        Swal.fire({
          icon: 'success',
          title: 'Status Updated',
          text: 'Payroll status has been updated successfully',
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message || 'Failed to update payroll status',
      });
    }
  };

  const handleDownloadPaySlip = (payrollId) => {
    window.open(`${ENDPOINT}/payroll/payslip/${payrollId}`, '_blank');
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = payrolls.slice(indexOfFirstItem, indexOfLastItem);

  // Pagination controls
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Reset filters
  const resetFilters = () => {
    setPeriodStart('');
    setPeriodEnd('');
    setStatusFilter('');
    setDepartmentFilter('');
  };

  if (isLoading && payrolls.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Loading payroll data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Payroll Management</h1>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
          onClick={handleOpenModal}
        >
          <FaPlus />
          Generate Payroll
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center mb-2">
          <FaFilter className="text-gray-500 mr-2" />
          <h2 className="text-lg font-medium">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept, index) => (
                <option key={index} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 text-right">
          <button
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Payroll List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Pay</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Pay</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.length > 0 ? (
                currentItems.map((payroll) => (
                  <tr key={payroll._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {payroll.staffId?.firstname} {payroll.staffId?.lastname}
                      </div>
                      <div className="text-sm text-gray-500">{payroll.staffId?.employeeId || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payroll.staffId?.department || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>{format(new Date(payroll.periodStart), 'MMM d, yyyy')}</div>
                      <div>{format(new Date(payroll.periodEnd), 'MMM d, yyyy')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ${payroll.grossPay.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ${payroll.netPay.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${payroll.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                          payroll.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          payroll.paymentStatus === 'processing' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'}`}>
                        {payroll.paymentStatus.charAt(0).toUpperCase() + payroll.paymentStatus.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => handleDownloadPaySlip(payroll._id)}
                          title="Download Pay Slip"
                        >
                          <FaDownload />
                        </button>
                        
                        {payroll.paymentStatus !== 'paid' && (
                          <button
                            className="text-green-600 hover:text-green-900"
                            onClick={() => handleUpdateStatus(payroll._id, 'paid')}
                            title="Mark as Paid"
                          >
                            <FaCheck />
                          </button>
                        )}
                        
                        {payroll.paymentStatus === 'pending' && (
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => handleUpdateStatus(payroll._id, 'processing')}
                            title="Mark as Processing"
                          >
                            <FaSpinner />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    No payroll records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {payrolls.length > itemsPerPage && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, payrolls.length)}
                  </span>{' '}
                  of <span className="font-medium">{payrolls.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50
                      ${currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    Previous
                  </button>
                  
                  {/* Page numbers */}
                  {[...Array(Math.ceil(payrolls.length / itemsPerPage)).keys()].map(number => (
                    <button
                      key={number + 1}
                      onClick={() => paginate(number + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium
                        ${currentPage === number + 1 
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' 
                          : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      {number + 1}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === Math.ceil(payrolls.length / itemsPerPage)}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50
                      ${currentPage === Math.ceil(payrolls.length / itemsPerPage) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payroll Generation Modal */}
      <PayrollModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onPayrollGenerated={handleGeneratePayroll}
        token={token}
      />
    </div>
  );
};

export default PayrollManagement;