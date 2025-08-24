const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
        error: 'MISSING_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find employee and attach to request
    const employee = await Employee.findById(decoded.employeeId).select('-password');
    if (!employee) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - employee not found',
        error: 'INVALID_TOKEN'
      });
    }

    if (!employee.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        error: 'ACCOUNT_DEACTIVATED'
      });
    }

    req.employee = employee;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        error: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        error: 'TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: 'AUTH_ERROR'
    });
  }
};

// Middleware to check if user has required role
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.employee) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }

    if (!roles.includes(req.employee.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRole: req.employee.role
      });
    }

    next();
  };
};

// Middleware to check if user can access/modify their own data
const authorizeSelfOrRole = (...roles) => {
  return (req, res, next) => {
    if (!req.employee) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }

    const resourceId = req.params.id || req.params.employeeId;
    
    // Allow if user has required role
    if (roles.includes(req.employee.role)) {
      return next();
    }

    // Allow if user is accessing their own data
    if (resourceId && resourceId === req.employee._id.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
      error: 'INSUFFICIENT_PERMISSIONS'
    });
  };
};

// Middleware to check if user can manage team
const authorizeTeamManager = () => {
  return async (req, res, next) => {
    if (!req.employee) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Admin and managers can manage any team
    if (['admin', 'manager'].includes(req.employee.role)) {
      return next();
    }

    // Supervisors can manage their own team
    if (req.employee.role === 'supervisor') {
      const targetTeam = req.body.team || req.params.team || req.query.team;
      if (targetTeam && targetTeam === req.employee.team) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to manage team',
      error: 'INSUFFICIENT_PERMISSIONS'
    });
  };
};

// Middleware to check if user can manage location
const authorizeLocationManager = () => {
  return async (req, res, next) => {
    if (!req.employee) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Admin and managers can manage any location
    if (['admin', 'manager'].includes(req.employee.role)) {
      return next();
    }

    // Supervisors can manage their own location
    if (req.employee.role === 'supervisor') {
      const targetLocation = req.body.location || req.params.location || req.query.location;
      if (targetLocation && targetLocation === req.employee.location) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to manage location',
      error: 'INSUFFICIENT_PERMISSIONS'
    });
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  authorizeSelfOrRole,
  authorizeTeamManager,
  authorizeLocationManager
};
