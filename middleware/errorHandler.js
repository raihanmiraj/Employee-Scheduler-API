// Error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.employee ? req.employee._id : 'unauthenticated'
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      message,
      statusCode: 404,
      error: 'RESOURCE_NOT_FOUND'
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error = {
      message,
      statusCode: 400,
      error: 'DUPLICATE_FIELD',
      field
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message,
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      details: Object.values(err.errors).map(val => ({
        field: val.path,
        message: val.message,
        value: val.value
      }))
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = {
      message,
      statusCode: 401,
      error: 'INVALID_TOKEN'
    };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = {
      message,
      statusCode: 401,
      error: 'TOKEN_EXPIRED'
    };
  }

  // Business logic errors
  if (err.name === 'BusinessLogicError') {
    error = {
      message: err.message,
      statusCode: err.statusCode || 400,
      error: err.error || 'BUSINESS_LOGIC_ERROR',
      details: err.details
    };
  }

  // Shift conflict errors
  if (err.name === 'ShiftConflictError') {
    error = {
      message: err.message,
      statusCode: 409,
      error: 'SHIFT_CONFLICT',
      details: err.details
    };
  }

  // Time off conflict errors
  if (err.name === 'TimeOffConflictError') {
    error = {
      message: err.message,
      statusCode: 409,
      error: 'TIMEOFF_CONFLICT',
      details: err.details
    };
  }

  // Employee availability errors
  if (err.name === 'EmployeeAvailabilityError') {
    error = {
      message: err.message,
      statusCode: 400,
      error: 'EMPLOYEE_UNAVAILABLE',
      details: err.details
    };
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    error: error.error || 'INTERNAL_SERVER_ERROR',
    ...(error.details && { details: error.details }),
    ...(error.field && { field: error.field }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Custom error classes
class BusinessLogicError extends Error {
  constructor(message, statusCode = 400, error = 'BUSINESS_LOGIC_ERROR', details = null) {
    super(message);
    this.name = 'BusinessLogicError';
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }
}

class ShiftConflictError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ShiftConflictError';
    this.details = details;
  }
}

class TimeOffConflictError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'TimeOffConflictError';
    this.details = details;
  }
}

class EmployeeAvailabilityError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'EmployeeAvailabilityError';
    this.details = details;
  }
}

module.exports = {
  errorHandler,
  BusinessLogicError,
  ShiftConflictError,
  TimeOffConflictError,
  EmployeeAvailabilityError
};
