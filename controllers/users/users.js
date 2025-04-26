const Users = require("../../models/Users");

exports.getAllUsers = async (req, res) => {
    try {
        const users = await Users.find();

        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}