const express = require('express');
const router = express.Router();
const { 
  authenticateToken, 
  authorizeRole 
} = require('../middleware/auth');
const { 
  validateRecurringShiftTemplate, 
  validateId 
} = require('../middleware/validation');

const {
  getRecurringShiftTemplates,
  getRecurringShiftTemplate,
  createRecurringShiftTemplate,
  updateRecurringShiftTemplate,
  deleteRecurringShiftTemplate,
  toggleTemplateStatus,
  generateShiftsFromTemplate
} = require('../controllers/recurringShiftController');

// All routes require authentication
router.use(authenticateToken);

// All recurring shift routes require manager or admin role
router.use(authorizeRole('manager', 'admin'));

// Get all recurring shift templates
router.get('/', getRecurringShiftTemplates);

// Get single recurring shift template
router.get('/:id', validateId, getRecurringShiftTemplate);

// Create new recurring shift template
router.post('/', validateRecurringShiftTemplate, createRecurringShiftTemplate);

// Update recurring shift template
router.put('/:id', validateId, validateRecurringShiftTemplate, updateRecurringShiftTemplate);

// Delete recurring shift template
router.delete('/:id', validateId, deleteRecurringShiftTemplate);

// Toggle template active status
router.put('/:id/toggle-status', validateId, toggleTemplateStatus);

// Generate shifts from template
router.post('/:id/generate-shifts', validateId, generateShiftsFromTemplate);

module.exports = router;
