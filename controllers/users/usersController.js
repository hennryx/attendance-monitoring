const Users = require("../../models/Users");

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
    const data = req.body;
    console.log(data);
    return;
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
