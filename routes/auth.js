const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validateEmployee, validateEmployeeUpdate } = require('../middleware/validation');

// Public routes
router.post('/register', validateEmployee, authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, validateEmployeeUpdate, authController.updateProfile);
router.put('/change-password', authenticateToken, authController.changePassword);
router.post('/refresh', authenticateToken, authController.refreshToken);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
