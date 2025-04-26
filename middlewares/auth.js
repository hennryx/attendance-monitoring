// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const Users = require('../models/Users');

// Protect routes
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith(process.env.JWT_HEADER)) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await Users.findById(decoded.userId).select('-password');
            
            next(); 
        } catch (error) {
            return res.status(401).json({ message: "Not Authorized, invalid token" });
        }
    } else {
        return res.status(401).json({ message: "Not Authorized, no token provided" });
    }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};