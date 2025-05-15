const Users = require("../../models/Users");
const fingerprintService = require("../../service/fingerprintService");

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
    const { staffId, fingerPrint, email } = req.body;

    console.log(`Enrolling single fingerprint: staffId=${staffId}`);

    if (!staffId || !fingerPrint) {
      return res.status(400).json({
        success: false,
        error: "Missing Data",
        message: "Staff ID and fingerprint data are required",
      });
    }

    // Process with the fingerprint service
    const enrollResult = await fingerprintService.enrollFingerprint({
      staffId,
      fingerPrint,
      email,
    });

    if (!enrollResult || !enrollResult.success) {
      return res.status(400).json({
        success: false,
        message: enrollResult?.message || "User Fingerprint Enrollment failed!",
      });
    }

    res.status(200).json({
      success: true,
      message:
        enrollResult.message || "User Fingerprint Enrolled successfully!",
      quality_score: enrollResult.quality_score,
      duration: enrollResult.duration,
    });
  } catch (error) {
    console.error("Fingerprint enrollment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to enroll fingerprint",
    });
  }
};

exports.matchFingerprint = async (req, res) => {
  try {
    const { fingerPrint } = req.body;

    if (!fingerPrint) {
      return res.status(400).json({
        success: false,
        error: "Missing fingerprint data",
      });
    }

    console.log("Matching fingerprint...");

    const matchResult = await fingerprintService.matchFingerprint({
      fingerPrint,
    });

    if (matchResult.matched) {
      const staffId = matchResult.staffId;
      const user = await Users.findById(staffId);

      console.log(user);

      console.log(`Match found: ${staffId} with score ${matchResult.score}`);

      res.status(200).json({
        success: true,
        matched: true,
        staffId: staffId,
        message: "Success, match found!",
        userData: user
          ? {
              name: user.firstname,
              email: user.email,
              staffId: user._id,
            }
          : matchResult.userData || null,
        score: matchResult.score,
        confidence: matchResult.confidence,
      });
    } else {
      console.log(`No match found. Best score: ${matchResult.bestScore || 0}`);
      res.status(404).json({
        success: false,
        matched: false,
        message: matchResult.message || "No match found.",
        bestScore: matchResult.bestScore || 0,
      });
    }
  } catch (error) {
    console.error("Error matching fingerprint:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
};

exports.verifyFingerprint = async (req, res) => {
  try {
    const { fingerPrint, staffId } = req.body;

    if (!fingerPrint || !staffId) {
      return res.status(400).json({
        success: false,
        error: "Missing Data",
        message: "Both fingerprint data and staff ID are required",
      });
    }

    const verifyResult = await fingerprintService.verifyFingerprint({
      fingerPrint,
      staffId,
    });

    if (verifyResult.verified) {
      const user = await Users.findById(staffId);

      res.status(200).json({
        success: true,
        verified: true,
        staffId: staffId,
        message: "Fingerprint verified successfully!",
        userData: user
          ? {
              name: user.firstname,
              email: user.email,
              staffId: user._id,
            }
          : null,
        score: verifyResult.score,
        confidence: verifyResult.confidence,
      });
    } else {
      res.status(403).json({
        success: false,
        verified: false,
        message: verifyResult.message || "Verification failed.",
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

exports.updateFingerprints = async (req, res) => {
  try {
    const result = await fingerprintService.updateAllTemplates();

    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating fingerprints:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
};

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
      if (existingUser && existingUser._id.toString() !== userId.toString()) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }

      user.email = email;
    }

    if (req.file) {
      if (user.profileImage) {
        try {
          const oldImagePath = path.join(
            __dirname,
            "../../assets/profiles",
            user.profileImage
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (fileError) {
          console.error("Error deleting old profile image:", fileError);
        }
      }

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
    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile",
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
