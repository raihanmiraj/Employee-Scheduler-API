const express = require('express');
const router = express.Router();
const timeOffController = require('../controllers/timeOffController');
const { 
  authenticateToken, 
  authorizeRole, 
  authorizeSelfOrRole 
} = require('../middleware/auth');
const { 
  validateTimeOffRequest, 
  validateId, 
  validatePagination, 
  validateDateRange 
} = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Routes accessible by all authenticated users
router.post('/', 
  validateTimeOffRequest, 
  timeOffController.createTimeOffRequest
);

router.get('/', 
  authorizeRole('manager', 'supervisor', 'admin'), 
  validatePagination, 
  validateDateRange, 
  timeOffController.getTimeOffRequests
);

router.get('/pending', 
  authorizeRole('manager', 'supervisor', 'admin'), 
  timeOffController.getPendingTimeOffRequests
);

// Routes accessible by self or managers, supervisors, admin
router.get('/:id', 
  authorizeSelfOrRole('manager', 'supervisor', 'admin'), 
  validateId, 
  timeOffController.getTimeOffRequest
);

router.put('/:id', 
  authorizeSelfOrRole('manager', 'admin'), 
  validateId, 
  validateTimeOffRequest, 
  timeOffController.updateTimeOffRequest
);

router.put('/:id/cancel', 
  authorizeSelfOrRole('manager', 'admin'), 
  validateId, 
  timeOffController.cancelTimeOffRequest
);

// Routes accessible by managers and admin only
router.put('/:id/approve', 
  authorizeRole('manager', 'admin'), 
  validateId, 
  timeOffController.approveTimeOffRequest
);

// Routes accessible by self or managers, supervisors, admin
router.get('/employee/:employeeId', 
  authorizeSelfOrRole('manager', 'supervisor', 'admin'), 
  timeOffController.getEmployeeTimeOffRequests
);

module.exports = router;
