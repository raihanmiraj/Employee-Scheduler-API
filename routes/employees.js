const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { 
  authenticateToken, 
  authorizeRole, 
  authorizeSelfOrRole, 
  authorizeTeamManager 
} = require('../middleware/auth');
const { 
  validateEmployee, 
  validateEmployeeUpdate, 
  validateId, 
  validatePagination 
} = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Routes accessible by managers, supervisors, and admin
router.get('/', 
  authorizeRole('manager', 'supervisor', 'admin'), 
  validatePagination, 
  employeeController.getEmployees
);

router.get('/stats', 
  authorizeRole('manager', 'admin'), 
  employeeController.getEmployeeStats
);

router.get('/by-role-location', 
  employeeController.getEmployeesByRoleAndLocation
);

router.get('/by-skills', 
  employeeController.getEmployeesBySkills
);

router.get('/available/:day', 
  employeeController.getAvailableEmployeesForDay
);

// Routes accessible by managers and admin only
router.post('/', 
  authorizeRole('manager', 'admin'), 
  validateEmployee, 
  employeeController.createEmployee
);

router.put('/:id', 
  authorizeSelfOrRole('manager', 'admin'), 
  validateId, 
  validateEmployeeUpdate, 
  employeeController.updateEmployee
);

router.delete('/:id', 
  authorizeRole('manager', 'admin'), 
  validateId, 
  employeeController.deleteEmployee
);

// Routes accessible by self or managers, supervisors, admin
router.get('/:id', 
  authorizeSelfOrRole('manager', 'supervisor', 'admin'), 
  validateId, 
  employeeController.getEmployee
);

router.get('/:id/workload', 
  authorizeSelfOrRole('manager', 'supervisor', 'admin'), 
  validateId, 
  employeeController.getEmployeeWorkload
);

module.exports = router;
