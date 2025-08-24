const { body, param, query, validationResult } = require('express-validator');

// Middleware to check for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Employee validation rules
const validateEmployee = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .isIn(['manager', 'supervisor', 'employee', 'admin'])
    .withMessage('Role must be one of: manager, supervisor, employee, admin'),
  
  body('skills')
    .isArray({ min: 1 })
    .withMessage('At least one skill is required'),
  
  body('skills.*')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each skill must be between 2 and 50 characters'),
  
  body('team')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Team must be between 2 and 100 characters'),
  
  body('location')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  
  body('employmentType')
    .isIn(['full-time', 'part-time', 'contract', 'temporary'])
    .withMessage('Employment type must be one of: full-time, part-time, contract, temporary'),
  
  body('maxHoursPerWeek')
    .optional()
    .isFloat({ min: 0, max: 168 })
    .withMessage('Max hours per week must be between 0 and 168'),
  
  handleValidationErrors
];

// Employee update validation rules (password optional)
const validateEmployeeUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .optional()
    .isIn(['manager', 'supervisor', 'employee', 'admin'])
    .withMessage('Role must be one of: manager, supervisor, employee, admin'),
  
  body('skills')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one skill is required'),
  
  body('skills.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each skill must be between 2 and 50 characters'),
  
  body('team')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Team must be between 2 and 100 characters'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  
  body('employmentType')
    .optional()
    .isIn(['full-time', 'part-time', 'contract', 'temporary'])
    .withMessage('Employment type must be one of: full-time, part-time, contract, temporary'),
  
  body('maxHoursPerWeek')
    .optional()
    .isFloat({ min: 0, max: 168 })
    .withMessage('Max hours per week must be between 0 and 168'),
  
  handleValidationErrors
];

// Shift validation rules
const validateShift = [
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO date'),
  
  body('startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  
  body('roleRequirement')
    .isIn(['manager', 'supervisor', 'employee', 'admin'])
    .withMessage('Role requirement must be one of: manager, supervisor, employee, admin'),
  
  body('skillRequirements')
    .optional()
    .isArray()
    .withMessage('Skill requirements must be an array'),
  
  body('skillRequirements.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each skill requirement must be between 2 and 50 characters'),
  
  body('assignedEmployeeId')
    .isMongoId()
    .withMessage('Assigned employee ID must be a valid MongoDB ID'),
  
  body('location')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  
  body('team')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Team must be between 2 and 100 characters'),
  
  body('status')
    .optional()
    .isIn(['scheduled', 'in-progress', 'completed', 'cancelled'])
    .withMessage('Status must be one of: scheduled, in-progress, completed, cancelled'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  body('breakDuration')
    .optional()
    .isFloat({ min: 0, max: 24 })
    .withMessage('Break duration must be between 0 and 24 hours'),
  
  body('hourlyRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be a positive number'),
  
  handleValidationErrors
];

// Time off request validation rules
const validateTimeOffRequest = [
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid ISO date'),
  
  body('reason')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  
  body('requestType')
    .isIn(['vacation', 'sick-leave', 'personal', 'bereavement', 'jury-duty', 'other'])
    .withMessage('Request type must be one of: vacation, sick-leave, personal, bereavement, jury-duty, other'),
  
  body('isHalfDay')
    .optional()
    .isBoolean()
    .withMessage('isHalfDay must be a boolean'),
  
  body('halfDayType')
    .optional()
    .isIn(['morning', 'afternoon'])
    .withMessage('Half day type must be one of: morning, afternoon'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  body('emergencyContact.name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Emergency contact name must be between 2 and 100 characters'),
  
  body('emergencyContact.phone')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Emergency contact phone must be a valid phone number'),
  
  body('emergencyContact.relationship')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Emergency contact relationship must be between 2 and 50 characters'),
  
  handleValidationErrors
];

// Recurring shift template validation rules
const validateRecurringShiftTemplate = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Template name must be between 2 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('roleRequirement')
    .isIn(['manager', 'supervisor', 'employee', 'admin'])
    .withMessage('Role requirement must be one of: manager, supervisor, employee, admin'),
  
  body('skillRequirements')
    .optional()
    .isArray()
    .withMessage('Skill requirements must be an array'),
  
  body('skillRequirements.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each skill requirement must be between 2 and 50 characters'),
  
  body('startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  
  body('repeatPattern')
    .isIn(['daily', 'weekly', 'monthly', 'custom'])
    .withMessage('Repeat pattern must be one of: daily, weekly, monthly, custom'),
  
  body('repeatDays')
    .optional()
    .isArray()
    .withMessage('Repeat days must be an array'),
  
  body('repeatDays.*')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Repeat days must be valid days of the week'),
  
  body('repeatInterval')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Repeat interval must be between 1 and 365'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO date'),
  
  body('location')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  
  body('team')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Team must be between 2 and 100 characters'),
  
  body('maxAssignments')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Max assignments must be between 1 and 100'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  handleValidationErrors
];

// Query parameter validation
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO date'),
  
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

// ID parameter validation
const validateId = [
  param('id')
    .isMongoId()
    .withMessage('ID must be a valid MongoDB ID'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateEmployee,
  validateEmployeeUpdate,
  validateShift,
  validateTimeOffRequest,
  validateRecurringShiftTemplate,
  validateDateRange,
  validatePagination,
  validateId
};
