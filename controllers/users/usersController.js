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

    const user = await Users.findById(result.staffId);
    if (result.matched) {
      console.log(user.firstname);

      console.log(`Match found: ${result.staffId} with score ${result.score}`);

      res.status(200).json({
        success: true,
        matched: true,
        staffId: result.staffId,
        message: "Success, match found!",
        userData: user
          ? {
              name: user.firstname,
              email: user.email,
            }
          : null,
        score: result.score,
      });
    } else {
      console.log(user?.firstname);
      console.log(`No match found. Best score: ${result.bestScore}`);
      res.status(404).json({
        success: false,
        matched: false,
        message: "No match found.",
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
    const deps = await Users.find();
    const uniqueDepartments = [...new Set(deps.map((item) => item.department))];

    res.status(200).json({
      data: uniqueDepartments,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { firstname, middlename, lastname, email } = req.body;

    // Find the user
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update profile fields
    if (firstname) user.firstname = firstname;
    if (middlename !== undefined) user.middlename = middlename;
    if (lastname) user.lastname = lastname;

    // Check if email is being updated and is different
    if (email && email !== user.email) {
      // Check if new email already exists
      const existingUser = await Users.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }

      user.email = email;
    }

    // Handle profile image upload
    if (req.file) {
      // Delete previous profile image if exists
      if (user.profileImage) {
        const oldImagePath = path.join(
          __dirname,
          "../../assets/profiles",
          user.profileImage
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Save new profile image
      user.profileImage = req.file.filename;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        firstname: user.firstname,
        middlename: user.middlename,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const user = await Users.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
