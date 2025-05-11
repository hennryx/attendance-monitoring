const FingerPrint = require("../../models/FingerPrint");
const Users = require("../../models/Users");
const {
  processFingerprint,
  compareFingerprints,
} = require("../../utils/fingerprint");

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

    // Call Python API for fingerprint enrollment
    const response = await fetch(
      "http://localhost:5500/api/fingerprint/enroll",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staffId,
          fingerPrint,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || "User Fingerprint Enrollment failed!",
      });
    }

    // Update the user record to indicate they have a fingerprint
    await Users.findByIdAndUpdate(
      { _id: staffId },
      { hasFingerPrint: true },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: result.message || "User Fingerprint Enrolled successfully!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.matchFingerprint = async (req, res) => {
  try {
    const { fingerPrint } = req.body;

    if (!fingerPrint) {
      return res.status(400).json({ error: "Missing fingerprint data" });
    }

    console.log("Calling Python API for fingerprint matching...");

    // Call Python API for fingerprint matching
    const response = await fetch(
      "http://localhost:5500/api/fingerprint/match",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fingerPrint,
        }),
      }
    );

    const result = await response.json();

    if (result.matched) {
      const user = await Users.findById(result.staffId);
      console.log(user.firstname);

      console.log(`Match found: ${result.staffId} with score ${result.score}`);

      res.json({
        success: true,
        matched: true,
        staffId: result.staffId,
        userData: user
          ? {
              name: user.firstname,
              email: user.email,
              // Add other fields you want to return
            }
          : null,
        score: result.score,
      });
    } else {
      const user = await Users.findById(result.staffId);
      console.log(user?.firstname);
      console.log(`No match found. Best score: ${result.bestScore}`);
      res.json({
        success: false,
        matched: false,
        bestScore: result.bestScore,
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

exports.getDepartments = async (req, res) => {
  try {
    const deps = await Users.find()
    const uniqueDepartments = [...new Set(deps.map(item => item.department))];

    res.status(200).json({
      data: uniqueDepartments,
      success: true
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
};
