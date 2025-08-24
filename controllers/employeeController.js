const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const TimeOffRequest = require('../models/TimeOffRequest');
const { BusinessLogicError } = require('../middleware/errorHandler');

// @desc    Get all employees with filtering and pagination
// @route   GET /api/employees
// @access  Private (managers, supervisors, admin)
const getEmployees = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      team,
      location,
      skills,
      employmentType,
      isActive,
      search
    } = req.query;

    // Build query
    const query = {};

    if (role) query.role = role;
    if (team) query.team = team;
    if (location) query.location = location;
    if (employmentType) query.employmentType = employmentType;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (skills) {
      if (Array.isArray(skills)) {
        query.skills = { $in: skills };
      } else {
        query.skills = { $in: [skills] };
      }
    }

    // Text search across name, email, team, and location
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { team: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Employee.countDocuments(query);

    // Execute query with pagination
    const employees = await Employee.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        employees,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single employee by ID
// @route   GET /api/employees/:id
// @access  Private (self or managers, supervisors, admin)
const getEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).select('-password');
    
    if (!employee) {
      throw new BusinessLogicError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        employee
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private (managers, admin)
const createEmployee = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      skills,
      team,
      location,
      availability,
      employmentType,
      maxHoursPerWeek
    } = req.body;

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
      availability,
      employmentType,
      maxHoursPerWeek,
      createdBy: req.employee._id
    });

    await employee.save();

    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: {
        employee: employeeResponse
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private (self or managers, admin)
const updateEmployee = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      skills,
      team,
      location,
      availability,
      employmentType,
      maxHoursPerWeek,
      isActive
    } = req.body;

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      throw new BusinessLogicError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
    }

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
    if (password) employee.password = password;
    if (role) employee.role = role;
    if (skills) employee.skills = skills;
    if (team) employee.team = team;
    if (location) employee.location = location;
    if (availability) employee.availability = availability;
    if (employmentType) employee.employmentType = employmentType;
    if (maxHoursPerWeek !== undefined) employee.maxHoursPerWeek = maxHoursPerWeek;
    if (isActive !== undefined) employee.isActive = isActive;

    employee.lastModifiedBy = req.employee._id;
    await employee.save();

    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: {
        employee: employeeResponse
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private (managers, admin)
const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      throw new BusinessLogicError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
    }

    // Check if employee has active shifts
    const activeShifts = await Shift.find({
      assignedEmployeeId: employee._id,
      status: { $in: ['scheduled', 'in-progress'] }
    });

    if (activeShifts.length > 0) {
      throw new BusinessLogicError('Cannot delete employee with active shifts', 400, 'EMPLOYEE_HAS_ACTIVE_SHIFTS');
    }

    // Check if employee has pending time off requests
    const pendingTimeOff = await TimeOffRequest.find({
      employeeId: employee._id,
      status: 'pending'
    });

    if (pendingTimeOff.length > 0) {
      throw new BusinessLogicError('Cannot delete employee with pending time off requests', 400, 'EMPLOYEE_HAS_PENDING_TIMEOFF');
    }

    // Soft delete by setting isActive to false
    employee.isActive = false;
    employee.lastModifiedBy = req.employee._id;
    await employee.save();

    res.json({
      success: true,
      message: 'Employee deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employees by role and location
// @route   GET /api/employees/by-role-location
// @access  Private
const getEmployeesByRoleAndLocation = async (req, res, next) => {
  try {
    const { role, location } = req.query;

    if (!role || !location) {
      throw new BusinessLogicError('Role and location are required', 400, 'MISSING_PARAMETERS');
    }

    const employees = await Employee.findByRoleAndLocation(role, location)
      .select('-password')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: {
        employees,
        count: employees.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employees by skills
// @route   GET /api/employees/by-skills
// @access  Private
const getEmployeesBySkills = async (req, res, next) => {
  try {
    const { skills } = req.query;

    if (!skills) {
      throw new BusinessLogicError('Skills are required', 400, 'MISSING_PARAMETERS');
    }

    const skillsArray = Array.isArray(skills) ? skills : [skills];
    const employees = await Employee.findBySkills(skillsArray)
      .select('-password')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: {
        employees,
        count: employees.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available employees for a specific day
// @route   GET /api/employees/available/:day
// @access  Private
const getAvailableEmployeesForDay = async (req, res, next) => {
  try {
    const { day } = req.params;
    const { role, skills, location, team } = req.query;

    // Validate day parameter
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(day.toLowerCase())) {
      throw new BusinessLogicError('Invalid day parameter', 400, 'INVALID_DAY');
    }

    let employees = await Employee.findAvailableForDay(day);

    // Apply additional filters
    if (role) {
      employees = employees.filter(emp => emp.role === role);
    }
    if (location) {
      employees = employees.filter(emp => emp.location === location);
    }
    if (team) {
      employees = employees.filter(emp => emp.team === team);
    }
    if (skills) {
      const skillsArray = Array.isArray(skills) ? skills : [skills];
      employees = employees.filter(emp => 
        skillsArray.some(skill => emp.skills.includes(skill))
      );
    }

    // Remove password from response
    const employeesResponse = employees.map(emp => {
      const empObj = emp.toObject();
      delete empObj.password;
      return empObj;
    });

    res.json({
      success: true,
      data: {
        employees: employeesResponse,
        count: employeesResponse.length,
        day: day.toLowerCase()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employee workload summary
// @route   GET /api/employees/:id/workload
// @access  Private (self or managers, supervisors, admin)
const getEmployeeWorkload = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const employeeId = req.params.id;

    // Validate dates
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    if (start > end) {
      throw new BusinessLogicError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
    }

    // Get shifts in date range
    const shifts = await Shift.find({
      assignedEmployeeId: employeeId,
      date: { $gte: start, $lte: end },
      status: { $in: ['scheduled', 'in-progress', 'completed'] }
    });

    // Get time off requests in date range
    const timeOffRequests = await TimeOffRequest.find({
      employeeId: employeeId,
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start }
    });

    // Calculate workload metrics
    const totalHours = shifts.reduce((sum, shift) => sum + shift.duration, 0);
    const totalShifts = shifts.length;
    const totalTimeOffDays = timeOffRequests.reduce((sum, request) => sum + request.totalDays, 0);

    // Group by week for weekly breakdown
    const weeklyBreakdown = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekShifts = shifts.filter(shift => 
        shift.date >= weekStart && shift.date <= weekEnd
      );
      
      const weekHours = weekShifts.reduce((sum, shift) => sum + shift.duration, 0);
      
      weeklyBreakdown.push({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        hours: weekHours,
        shifts: weekShifts.length
      });
      
      currentDate.setDate(currentDate.getDate() + 7);
    }

    res.json({
      success: true,
      data: {
        employeeId,
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        },
        summary: {
          totalHours,
          totalShifts,
          totalTimeOffDays,
          averageHoursPerWeek: totalHours / Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 7))
        },
        weeklyBreakdown,
        shifts: shifts.map(shift => ({
          id: shift._id,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          duration: shift.duration,
          status: shift.status,
          location: shift.location
        })),
        timeOffRequests: timeOffRequests.map(request => ({
          id: request._id,
          startDate: request.startDate,
          endDate: request.endDate,
          totalDays: request.totalDays,
          requestType: request.requestType
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employee statistics
// @route   GET /api/employees/stats
// @access  Private (managers, admin)
const getEmployeeStats = async (req, res, next) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const activeEmployees = await Employee.countDocuments({ isActive: true });
    const inactiveEmployees = totalEmployees - activeEmployees;

    // Count by role
    const roleStats = await Employee.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Count by team
    const teamStats = await Employee.aggregate([
      { $group: { _id: '$team', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Count by location
    const locationStats = await Employee.aggregate([
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Count by employment type
    const employmentTypeStats = await Employee.aggregate([
      { $group: { _id: '$employmentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        roleStats,
        teamStats,
        locationStats,
        employmentTypeStats
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeesByRoleAndLocation,
  getEmployeesBySkills,
  getAvailableEmployeesForDay,
  getEmployeeWorkload,
  getEmployeeStats
};
