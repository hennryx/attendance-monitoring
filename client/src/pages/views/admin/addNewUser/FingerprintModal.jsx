import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import FingerprintQualityIndicator from "../../../../components/FingerprintQualityIndicator";

export const FingerprintModal = ({
  isOpen,
  onClose,
  onCapture,
  staffId,
  enrollmentDetails,
}) => {
  // ... existing code ...

  // Add new state for fingerprint quality metrics
  const [qualityMetrics, setQualityMetrics] = useState({
    minutiaeCount: 0,
    keypointCount: 0,
  });

  // ... existing code ...

  const handleEnrollment = async (fingerPrintData) => {
    try {
      // Call the onCapture handler with the fingerprint data
      const result = await onCapture({
        staffId,
        fingerPrint: fingerPrintData,
      });

      setCaptureInProgress(false);

      if (result && result.success) {
        // Success - handled by parent component
        console.log("Enrollment successful:", result);

        // Update quality metrics from the result
        if (result.minutiaeCount || result.keypointCount) {
          setQualityMetrics({
            minutiaeCount: result.minutiaeCount || 0,
            keypointCount: result.keypointCount || 0,
          });
        }
      } else {
        // Error
        setCaptureError("Enrollment failed. Please try again.");
      }
    } catch (error) {
      console.error("Enrollment error:", error);
      setCaptureError(`Enrollment failed: ${error.message || "Unknown error"}`);
      setCaptureInProgress(false);
    }
  };

  // ... existing code ...

  // In your render function, add the quality indicator component
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
        {/* ... existing header code ... */}

        {/* Enrollment progress */}
        {renderEnrollmentProgress()}
        {renderStatusMessage()}

        {/* Add fingerprint quality indicator */}
        {fingerprintSample && (
          <div className="mt-3">
            <FingerprintQualityIndicator
              minutiaeCount={qualityMetrics.minutiaeCount}
              keypointCount={qualityMetrics.keypointCount}
              enrollmentStatus={enrollmentDetails?.enrollmentStatus}
              // eslint-disable-next-line no-undef
              enrollmentCount={enrolledCount}
              minEnrollments={minEnrollments}
              maxEnrollments={maxEnrollments}
            />
          </div>
        )}

        {/* ... rest of your existing code ... */}
      </div>
    </div>
  );
};
