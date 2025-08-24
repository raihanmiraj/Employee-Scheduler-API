const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { BusinessLogicError } = require('../middleware/errorHandler');

// Generate JWT token
const generateToken = (employeeId) => {
  return jwt.sign(
    { employeeId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// @desc    Register new employee
// @route   POST /api/auth/register
// @access  Public (only for first admin)
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, skills, team, location, employmentType } = req.body;

    // Check if this is the first employee (allow admin creation)
    const employeeCount = await Employee.countDocuments();
    if (employeeCount === 0) {
      // First employee can be admin
      if (role !== 'admin') {
        throw new BusinessLogicError('First employee must be an admin', 400, 'FIRST_EMPLOYEE_ADMIN_REQUIRED');
      }
    } else {
      // Subsequent employees cannot be admin
      if (role === 'admin') {
        throw new BusinessLogicError('Only the first employee can be an admin', 400, 'ADMIN_CREATION_RESTRICTED');
      }
    }

    // Check if employee already exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      throw new BusinessLogicError('Employee with this email already exists', 400, 'EMPLOYEE_EXISTS');
    }

    // Create new employee
    const employee = new Employee({
      name,
      email,
      password,
      role,
      skills,
      team,
      location,
      employmentType
    });

    await employee.save();

    // Generate token
    const token = generateToken(employee._id);

    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.status(201).json({
      success: true,
      message: 'Employee registered successfully',
      data: {
        employee: employeeResponse,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login employee
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if employee exists
    const employee = await Employee.findOne({ email });
    if (!employee) {
      throw new BusinessLogicError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check if employee is active
    if (!employee.isActive) {
      throw new BusinessLogicError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    }

    // Check password
    const isPasswordValid = await employee.comparePassword(password);
    if (!isPasswordValid) {
      throw new BusinessLogicError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Generate token
    const token = generateToken(employee._id);

    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        employee: employeeResponse,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current employee profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const employee = req.employee;
    
    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.json({
      success: true,
      data: {
        employee: employeeResponse
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current employee profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const employee = req.employee;
    const { name, email, skills, team, location, employmentType, maxHoursPerWeek } = req.body;

    // Check if email is being changed and if it already exists
    if (email && email !== employee.email) {
      const existingEmployee = await Employee.findOne({ email });
      if (existingEmployee) {
        throw new BusinessLogicError('Email already exists', 400, 'EMAIL_EXISTS');
      }
    }

    // Update fields
    if (name) employee.name = name;
    if (email) employee.email = email;
    if (skills) employee.skills = skills;
    if (team) employee.team = team;
    if (location) employee.location = location;
    if (employmentType) employee.employmentType = employmentType;
    if (maxHoursPerWeek !== undefined) employee.maxHoursPerWeek = maxHoursPerWeek;

    await employee.save();

    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        employee: employeeResponse
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const employee = req.employee;
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isCurrentPasswordValid = await employee.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new BusinessLogicError('Current password is incorrect', 400, 'INCORRECT_PASSWORD');
    }

    // Update password
    employee.password = newPassword;
    await employee.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Private
const refreshToken = async (req, res, next) => {
  try {
    const employee = req.employee;
    
    // Generate new token
    const token = generateToken(employee._id);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    // Note: JWT tokens are stateless, so we can't invalidate them server-side
    // The client should remove the token from storage
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  refreshToken,
  logout
};
