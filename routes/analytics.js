const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { 
  authenticateToken, 
  authorizeRole 
} = require('../middleware/auth');
const { validateDateRange } = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// All analytics routes require manager, supervisor, or admin role
router.use(authorizeRole('manager', 'supervisor', 'admin'));

// Coverage analytics
router.get('/coverage', 
  validateDateRange, 
  analyticsController.getCoverageAnalytics
);

// Conflict detection analytics
router.get('/conflicts', 
  validateDateRange, 
  analyticsController.getConflictAnalytics
);

// Employee workload analytics
router.get('/workload', 
  validateDateRange, 
  analyticsController.getWorkloadAnalytics
);

// Utilization summary analytics
router.get('/utilization', 
  validateDateRange, 
  analyticsController.getUtilizationSummary
);

module.exports = router;
