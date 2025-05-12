import React, { useEffect, useState } from "react";

const FingerprintQualityIndicator = ({
  minutiaeCount = 0,
  keypointCount = 0,
  enrollmentStatus = null,
  enrollmentCount = 0,
  minEnrollments = 2,
  maxEnrollments = 5,
}) => {
  const [quality, setQuality] = useState({
    score: 0,
    label: "Poor",
    color: "red",
    message: "Insufficient features detected",
  });

  const getEnrollmentStatusMessage = () => {
    if (!enrollmentStatus) return "";

    if (enrollmentStatus === "complete") {
      return `Enrollment complete (${enrollmentCount}/${minEnrollments} samples)`;
    } else {
      const remaining = Math.max(0, minEnrollments - enrollmentCount);
      return `Enrollment in progress - ${remaining} more sample${
        remaining !== 1 ? "s" : ""
      } recommended`;
    }
  };

  useEffect(() => {
    // Calculate quality score (0-100)
    let score = 0;

    // Minutiae quality (0-50 points)
    if (minutiaeCount >= 40) score += 50;
    else if (minutiaeCount >= 25) score += 40;
    else if (minutiaeCount >= 15) score += 25;
    else if (minutiaeCount >= 8) score += 15;
    else score += Math.min(10, minutiaeCount);

    // Keypoint quality (0-50 points)
    if (keypointCount >= 100) score += 50;
    else if (keypointCount >= 50) score += 40;
    else if (keypointCount >= 25) score += 25;
    else if (keypointCount >= 10) score += 15;
    else score += Math.min(10, keypointCount);

    // Determine quality label and color
    let label, color, message;

    if (score >= 80) {
      label = "Excellent";
      color = "green-600";
      message = "High quality fingerprint with many features";
    } else if (score >= 60) {
      label = "Good";
      color = "green-500";
      message = "Good quality fingerprint, suitable for matching";
    } else if (score >= 40) {
      label = "Average";
      color = "yellow-500";
      message = "Average quality, more samples recommended";
    } else if (score >= 20) {
      label = "Poor";
      color = "orange-500";
      message = "Low quality, try placing finger flat on scanner";
    } else {
      label = "Very Poor";
      color = "red-500";
      message = "Insufficient features, try again with better pressure";
    }

    setQuality({ score, label, color, message });
  }, [minutiaeCount, keypointCount]);

  return (
    <div className="bg-gray-100 p-3 rounded-lg">
      <div className="mb-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Fingerprint Quality:</span>
          <span className={`text-sm font-bold text-${quality.color}`}>
            {quality.label} ({quality.score}%)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
          <div
            className={`h-2.5 rounded-full bg-${quality.color}`}
            style={{ width: `${quality.score}%` }}
          ></div>
        </div>
      </div>

      <div className="text-xs text-gray-600 mt-1">{quality.message}</div>

      {/* Feature details */}
      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
        <div>
          <span className="font-medium">Minutiae: </span>
          <span
            className={
              minutiaeCount >= 15 ? "text-green-600" : "text-orange-500"
            }
          >
            {minutiaeCount}
          </span>
        </div>
        <div>
          <span className="font-medium">Keypoints: </span>
          <span
            className={
              keypointCount >= 25 ? "text-green-600" : "text-orange-500"
            }
          >
            {keypointCount}
          </span>
        </div>
      </div>

      {/* Enrollment status */}
      {enrollmentStatus && (
        <div className="mt-2 text-xs font-medium">
          <span
            className={
              enrollmentStatus === "complete"
                ? "text-green-600"
                : "text-amber-600"
            }
          >
            {getEnrollmentStatusMessage()}
          </span>

          {/* Enrollment progress */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
            <div
              className={`h-1.5 rounded-full ${
                enrollmentStatus === "complete"
                  ? "bg-green-600"
                  : "bg-amber-500"
              }`}
              style={{ width: `${(enrollmentCount / minEnrollments) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FingerprintQualityIndicator;
