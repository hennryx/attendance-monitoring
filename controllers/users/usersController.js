const FingerPrint = require("../../models/FingerPrint");
const Users = require("../../models/Users");
const { extractFeatures, compareFeatures } = require("../../utils/fingerprint");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await Users.find({ role: { $ne: "ADMIN" } });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    let data = req.body;

    if (!data?._id) {
      return res.status(400).json({
        error: "Missing ID",
        message: "No ID provided for updating User",
      });
    }

    const user = await Users.findByIdAndUpdate(data._id, data, { new: true });
    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      message: "User Updated successfully",
      user: userData,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({
        success: false,
        error: "Missing ID",
        message: "No ID provided for deletion",
      });
    }

    const user = await Users.findByIdAndDelete(_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "User not found",
      });
    }

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      message: "User deleted successfully",
      user: userData,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.enrollUSer = async (req, res) => {
  try {
    const { staffId, fingerPrint } = req.body;

    if (!staffId) {
      return res.status(400).json({
        success: false,
        error: "Missing ID",
        message: "No ID provided for Staff",
      });
    }

    // Extract fingerprint features using OpenCV
    const features = await extractFeatures(fingerPrint);

    const existingStaff = await FingerPrint.findOne({ staffId });

    if (existingStaff) {
      await FingerPrint.findOneAndUpdate(
        { staffId },
        { fingerPrint, features },
        { new: true }
      );
      return res.status(200).json({
        success: true,
        message: "User Fingerprint updated successfully!",
      });
    }

    const newFingerprint = await FingerPrint.create({
      staffId,
      fingerPrint,
      features,
    });

    await Users.findByIdAndUpdate(
      { _id: staffId },
      { hasFingerPrint: true },
      { new: true }
    );

    if (!newFingerprint) {
      return res.status(400).json({
        success: false,
        message: "User Fingerprint Enrollment failed!",
      });
    }

    res.status(200).json({
      success: true,
      message: "User Fingerprint Enrolled successfully!",
    });
  } catch (error) {
    console.error("Enrollment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update the matchFingerprint function to use the new compareFeatures
exports.matchFingerprint = async (req, res) => {
  try {
    const { fingerPrint } = req.body;

    if (!fingerPrint) {
      return res.status(400).json({ error: "Missing fingerprint data" });
    }

    console.log("Processing fingerprint for matching...");

    // Extract features from the probe fingerprint with OpenCV
    const probeFeatures = await extractFeatures(fingerPrint);

    // Fetch all stored fingerprints from database
    const storedFingerprints = await FingerPrint.find();

    let bestMatch = {
      staffId: null,
      score: 0,
    };

    // Set a higher threshold for the OpenCV-based matching
    // ORB descriptor matching tends to be more accurate
    const MATCH_THRESHOLD = 0.5; // Adjust based on testing

    console.log(
      `Comparing against ${storedFingerprints.length} stored fingerprints...`
    );

    // Compare with each stored fingerprint
    for (const stored of storedFingerprints) {
      // Use the new OpenCV-based comparison
      const score = await compareFeatures(probeFeatures, stored.features);

      console.log(`Score with user ${stored.staffId}: ${score}`);

      if (score > bestMatch.score) {
        bestMatch = {
          staffId: stored.staffId,
          score,
        };
      }
    }

    // Check if best match exceeds threshold
    if (bestMatch.score >= MATCH_THRESHOLD) {
      const user = await Users.findById(bestMatch.staffId);

      console.log(
        `Match found: ${bestMatch.staffId} with score ${bestMatch.score}`
      );

      res.json({
        success: true,
        matched: true,
        staffId: bestMatch.staffId,
        userData: user
          ? {
              name: user.name,
              email: user.email,
              // Add other fields you want to return
            }
          : null,
        score: bestMatch.score,
      });
    } else {
      console.log(`No match found. Best score: ${bestMatch.score}`);
      res.json({
        success: false,
        matched: false,
        bestScore: bestMatch.score,
      });
    }
  } catch (error) {
    console.error("Error verifying fingerprint:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
};

exports.verifyFingerprint = async (req, res) => {};
