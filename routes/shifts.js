const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { 
  authenticateToken, 
  authorizeRole, 
  authorizeTeamManager, 
  authorizeLocationManager 
} = require('../middleware/auth');
const { 
  validateShift, 
  validateId, 
  validatePagination, 
  validateDateRange 
} = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Routes accessible by all authenticated users
router.get('/', 
  validatePagination, 
  validateDateRange, 
  shiftController.getShifts
);

router.get('/:id', 
  validateId, 
  shiftController.getShift
);

router.get('/daily/:date', 
  shiftController.getDailySchedule
);

router.get('/unassigned', 
  shiftController.getUnassignedShifts
);

// Routes accessible by managers, supervisors, and admin
router.post('/', 
  authorizeRole('manager', 'supervisor', 'admin'), 
  validateShift, 
  shiftController.createShift
);

router.put('/:id', 
  authorizeRole('manager', 'supervisor', 'admin'), 
  validateId, 
  validateShift, 
  shiftController.updateShift
);

router.put('/:id/assign', 
  authorizeRole('manager', 'supervisor', 'admin'), 
  validateId, 
  shiftController.assignShift
);

// Routes accessible by managers and admin only
router.delete('/:id', 
  authorizeRole('manager', 'admin'), 
  validateId, 
  shiftController.deleteShift
);

module.exports = router;
