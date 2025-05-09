const FingerPrint = require("../../models/FingerPrint");
const Users = require("../../models/Users");
const FingerprintUtil = require("../../utils/fingerprintUtil");

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
      message: error.message,
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

    // Also delete any associated fingerprint data
    await FingerPrint.deleteOne({ staffId: _id });

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

// Fingerprint device operations
exports.getDeviceList = async (req, res) => {
  try {
    const result = await FingerprintUtil.listDevices();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting devices:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.captureFingerprint = async (req, res) => {
  try {
    const { deviceId, timeout = 30000 } = req.body;

    const result = await FingerprintUtil.captureFingerprint({
      deviceId,
      timeout,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || "Failed to capture fingerprint",
      });
    }

    res.status(200).json({
      success: true,
      image: result.image,
      features: result.features,
      quality: result.quality,
    });
  } catch (error) {
    console.error("Error capturing fingerprint:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.enrollUSer = async (req, res) => {
  try {
    const { staffId, fingerPrint, features } = req.body;

    if (!staffId) {
      return res.status(400).json({
        success: false,
        error: "Missing ID",
        message: "No ID provided for Staff",
      });
    }

    if (!fingerPrint && !features) {
      return res.status(400).json({
        success: false,
        error: "Missing Data",
        message: "No fingerprint data provided",
      });
    }

    // Use the features from the request or the fingerprint image
    const fingerprintFeatures = features || fingerPrint;

    const existingStaff = await FingerPrint.findOne({ staffId });

    if (existingStaff) {
      await FingerPrint.findOneAndUpdate(
        { staffId },
        { fingerPrint, features: fingerprintFeatures },
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
      features: fingerprintFeatures,
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
    console.error("Error enrolling fingerprint:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.matchFingerprint = async (req, res) => {
  try {
    const { fingerPrint, features } = req.body;

    if (!fingerPrint && !features) {
      return res.status(400).json({
        success: false,
        error: "Missing Data",
        message: "No fingerprint data or features provided",
      });
    }

    // Use the features from the request or the fingerprint image
    const fingerprintFeatures = features || fingerPrint;

    // Fetch all stored fingerprints from database
    const storedFingerprints = await FingerPrint.find().lean();

    if (storedFingerprints.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No registered fingerprints found",
      });
    }

    // Format stored fingerprints for matching
    const templates = storedFingerprints.map((fp) => ({
      id: fp.staffId,
      features: fp.features,
    }));

    // Find the best match
    const matchResult = await FingerprintUtil.matchFingerprint({
      features: fingerprintFeatures,
      templates: templates,
    });

    if (!matchResult.matched) {
      return res.status(200).json({
        success: false,
        matched: false,
        message: "No matching fingerprint found",
      });
    }

    // Get user details for the matched fingerprint
    const userInfo = await Users.findById(matchResult.staffId).select(
      "-password"
    );

    if (!userInfo) {
      return res.status(404).json({
        success: false,
        message: "User not found for the matched fingerprint",
      });
    }

    res.status(200).json({
      success: true,
      matched: true,
      score: matchResult.score,
      user: userInfo,
    });
  } catch (error) {
    console.error("Error matching fingerprint:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.verifyFingerprint = async (req, res) => {
  try {
    const { userId, fingerPrint, features } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Missing ID",
        message: "No user ID provided for verification",
      });
    }

    if (!fingerPrint && !features) {
      return res.status(400).json({
        success: false,
        error: "Missing Data",
        message: "No fingerprint data or features provided",
      });
    }

    // Use the features from the request or the fingerprint image
    const fingerprintFeatures = features || fingerPrint;

    // Find the stored fingerprint for this user
    const storedFingerprint = await FingerPrint.findOne({
      staffId: userId,
    }).lean();

    if (!storedFingerprint) {
      return res.status(404).json({
        success: false,
        message: "No registered fingerprint found for this user",
      });
    }

    // Format for matching
    const templates = [
      {
        id: storedFingerprint.staffId,
        features: storedFingerprint.features,
      },
    ];

    // Verify the fingerprint
    const matchResult = await FingerprintUtil.matchFingerprint({
      features: fingerprintFeatures,
      templates: templates,
    });

    if (!matchResult.matched) {
      return res.status(200).json({
        success: false,
        verified: false,
        message: "Fingerprint verification failed",
      });
    }

    // Get user details
    const userInfo = await Users.findById(userId).select("-password");

    res.status(200).json({
      success: true,
      verified: true,
      score: matchResult.score,
      user: userInfo,
    });
  } catch (error) {
    console.error("Error verifying fingerprint:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
