import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaDownload, FaEye } from "react-icons/fa";
import useAuthStore from "../../../../services/stores/authStore";
import axiosTools from "../../../../services/utilities/axiosUtils";
import { ENDPOINT } from "../../../../services/utilities";
import Swal from "sweetalert2";
import { format } from "date-fns";

const PayrollView = () => {
  const navigate = useNavigate();
  const { token, auth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [payrolls, setPayrolls] = useState([]);
  const [yearFilter, setYearFilter] = useState("");
  const [years, setYears] = useState([]);

  useEffect(() => {
    const fetchPayrolls = async () => {
      if (!token || !auth?._id) return;

      setIsLoading(true);
      try {
        // Fetch staff payrolls
        const response = await axiosTools.getData(
          `${ENDPOINT}/payroll/staff/${auth._id}`,
          "",
          token
        );

        if (response.success) {
          setPayrolls(response.data);

          // Extract unique years from payrolls
          const uniqueYears = [
            ...new Set(
              response.data.map((payroll) =>
                new Date(payroll.periodEnd).getFullYear()
              )
            ),
          ].sort((a, b) => b - a); // Sort descending

          setYears(uniqueYears);

          // Set current year as default filter if available
          const currentYear = new Date().getFullYear();
          if (uniqueYears.includes(currentYear)) {
            setYearFilter(currentYear.toString());
          }
        }
      } catch (error) {
        console.error("Error fetching payrolls:", error);
        Swal.fire({
          icon: "error",
          title: "Failed to load payrolls",
          text: error.message || "An error occurred while loading payroll data",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayrolls();
  }, [token, auth]);

  const handleViewPaySlip = (payrollId) => {
    navigate(`/payslip/${payrollId}`);
  };

  const handleDownloadPaySlip = (payrollId) => {
    window.open(`${ENDPOINT}/payroll/payslip/${payrollId}`, "_blank");
  };

  // Filter payrolls by year
  const filteredPayrolls = yearFilter
    ? payrolls.filter(
        (payroll) =>
          new Date(payroll.periodEnd).getFullYear().toString() === yearFilter
      )
    : payrolls;

  if (isLoading && payrolls.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Loading payroll data...</div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-lvh overflow-hidden bg-[linear-gradient(to_bottom,#1b1b1b_25%,#FAFAFA_25%)]">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ffffff] to-[#eceaff] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

      <div className="container mx-auto p-4">
        <h1 className="text-3xl text-white font-semibold mb-6">
          My Payroll History
        </h1>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center">
            <div className="w-full md:w-1/4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Year
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Payroll List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gross Pay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deductions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Pay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayrolls.length > 0 ? (
                  filteredPayrolls.map((payroll) => (
                    <tr key={payroll._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          {format(new Date(payroll.periodStart), "MMM d")} -{" "}
                          {format(new Date(payroll.periodEnd), "MMM d, yyyy")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₱{payroll.grossPay.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₱{payroll.totalDeductions.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        ₱{payroll.netPay.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${
                          payroll.paymentStatus === "paid"
                            ? "bg-green-100 text-green-800"
                            : payroll.paymentStatus === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : payroll.paymentStatus === "processing"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                        }`}
                        >
                          {payroll.paymentStatus.charAt(0).toUpperCase() +
                            payroll.paymentStatus.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => handleViewPaySlip(payroll._id)}
                            title="View Pay Slip"
                          >
                            <FaEye size={18} />
                          </button>
                          <button
                            className="text-green-600 hover:text-green-900"
                            onClick={() => handleDownloadPaySlip(payroll._id)}
                            title="Download Pay Slip"
                          >
                            <FaDownload size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No payroll records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollView;
