const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middlewares/auth');
const { getAllUsers, updateUser, deleteUser } = require('../../controllers/users/usersController');

// Get all users - admin only
router.get('/getAll', protect, authorize('ADMIN'), getAllUsers);
router.delete('/delete', protect, deleteUser);
router.put('/update', protect, updateUser);

module.exports = router;