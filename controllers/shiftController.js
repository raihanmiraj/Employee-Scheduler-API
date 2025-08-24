const Shift = require('../models/Shift');
const Employee = require('../models/Employee');
const TimeOffRequest = require('../models/TimeOffRequest');
const { BusinessLogicError, ShiftConflictError } = require('../middleware/errorHandler');

// @desc    Get all shifts with filtering and pagination
// @route   GET /api/shifts
// @access  Private
  // adjust the path to your shift.js

  const getShifts = async (req, res, next) => {
    try {
      console.log("getShifts called with query:", req.query);
  
      let {
        page = 1,
        limit = 10,
        date,
        startDate,
        endDate,
        location,
        team,
        roleRequirement,
        assignedEmployeeId,
        status,
        search
      } = req.query;
  
      // Sanitize pagination
      page = Math.max(parseInt(page) || 1, 1);
      limit = Math.max(parseInt(limit) || 10, 1);
  
      // Build query
      const query = {};
  
      // --- Single date filter ---
      if (date) {
        const targetDate = new Date(date);
        if (!isNaN(targetDate)) {
          query.date = {
            $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
            $lt: new Date(targetDate.setHours(23, 59, 59, 999))
          };
        }
      }
  
      // --- Date range filter ---
      if (startDate || endDate) {
        const range = {};
        if (startDate) {
          const start = new Date(startDate);
          if (!isNaN(start)) {
            range.$gte = new Date(start.setHours(0, 0, 0, 0));
          }
        }
        if (endDate) {
          const end = new Date(endDate);
          if (!isNaN(end)) {
            range.$lte = new Date(end.setHours(23, 59, 59, 999));
          }
        }
        query.date = range;
      }
  
      if (location) query.location = location;
      if (team) query.team = team;
      if (roleRequirement) query.roleRequirement = roleRequirement;
  
      if (assignedEmployeeId && mongoose.Types.ObjectId.isValid(assignedEmployeeId)) {
        query.assignedEmployeeId = new mongoose.Types.ObjectId(assignedEmployeeId);
      }
  
      if (status) query.status = status;
  
      // Text search in notes
      if (search && search.trim()) {
        query.notes = { $regex: search.trim(), $options: "i" };
      }
  
      const skip = (page - 1) * limit;
      console.log("Final query:", JSON.stringify(query, null, 2));
      console.log("Pagination - skip:", skip, "limit:", limit);
  
      let total = 0;
      let shifts = [];
  
      try {
        total = await Shift.countDocuments(query);
        console.log("Total documents found:", total);
  
        const results = await Shift.find(query)
          .populate("assignedEmployeeId", "name email role team")
          .populate("createdBy", "name email")
          .populate("lastModifiedBy", "name email")
          .sort({ date: 1, startTime: 1 })
          .skip(skip)
          .limit(limit);
  
        if (Array.isArray(results)) {
          shifts = results;
          console.log("Shifts found:", shifts.length);
        } else {
          console.warn("Shift.find did not return an array:", results);
          shifts = [];
        }
      } catch (queryError) {
        console.error("Query execution error:", queryError);
        shifts = [];
      }
  
      return res.json({
        success: true,
        data: {
          shifts,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit
          }
        }
      });
    } catch (error) {
      console.error("getShifts error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Internal Server Error",
        error: "INTERNAL_SERVER_ERROR"
      });
    }
  };
  

 

// @desc    Get single shift by ID
// @route   GET /api/shifts/:id
// @access  Private
const getShift = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .populate('assignedEmployeeId', 'name email role team skills')
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!shift) {
      throw new BusinessLogicError('Shift not found', 404, 'SHIFT_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        shift
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new shift
// @route   POST /api/shifts
// @access  Private (managers, supervisors, admin)
const createShift = async (req, res, next) => {
  try {
    const {
      date,
      startTime,
      endTime,
      roleRequirement,
      skillRequirements,
      requiredSkills,
      assignedEmployeeId,
      location,
      team,
      notes,
      breakDuration,
      hourlyRate
    } = req.body;

    // Use requiredSkills if skillRequirements is not provided (for backward compatibility)
    const finalSkillRequirements = skillRequirements || requiredSkills || [];

    // Validate assigned employee if provided
    if (assignedEmployeeId) {
      const employee = await Employee.findById(assignedEmployeeId);
      if (!employee) {
        throw new BusinessLogicError('Assigned employee not found', 400, 'EMPLOYEE_NOT_FOUND');
      }

      if (!employee.isActive) {
        throw new BusinessLogicError('Cannot assign shift to inactive employee', 400, 'EMPLOYEE_INACTIVE');
      }

      // Check for conflicts
      const conflicts = await Shift.findConflicts(assignedEmployeeId, date, startTime, endTime);
      if (conflicts.length > 0) {
        throw new ShiftConflictError('Employee has conflicting shifts', {
          conflicts: conflicts.map(c => ({
            id: c._id,
            date: c.date,
            startTime: c.startTime,
            endTime: c.endTime
          }))
        });
      }

      // Check if employee is available on this day
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (!employee.isAvailableOnDay(dayOfWeek)) {
        throw new BusinessLogicError('Employee is not available on this day', 400, 'EMPLOYEE_UNAVAILABLE');
      }

      // Check if employee has required skills
      if (finalSkillRequirements && finalSkillRequirements.length > 0) {
        const hasRequiredSkills = finalSkillRequirements.some(skill =>
          employee.skills.includes(skill)
        );
        if (!hasRequiredSkills) {
          throw new BusinessLogicError('Employee does not have required skills', 400, 'INSUFFICIENT_SKILLS');
        }
      }

      // Check if employee has approved time off on this date
      const timeOffConflict = await TimeOffRequest.findOne({
        employeeId: assignedEmployeeId,
        status: 'approved',
        startDate: { $lte: date },
        endDate: { $gte: date }
      });

      if (timeOffConflict) {
        throw new BusinessLogicError('Employee has approved time off on this date', 400, 'TIMEOFF_CONFLICT');
      }
    }

    // Create new shift
    const shift = new Shift({
      date,
      startTime,
      endTime,
      roleRequirement,
      skillRequirements: finalSkillRequirements,
      assignedEmployeeId,
      location,
      team,
      notes,
      breakDuration,
      hourlyRate,
      createdBy: req.employee._id
    });

    await shift.save();

    // Populate employee details
    await shift.populate('assignedEmployeeId', 'name email role team');

    res.status(201).json({
      success: true,
      message: 'Shift created successfully',
      data: {
        shift
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update shift
// @route   PUT /api/shifts/:id
// @access  Private (managers, supervisors, admin)
const updateShift = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      throw new BusinessLogicError('Shift not found', 404, 'SHIFT_NOT_FOUND');
    }

    const {
      date,
      startTime,
      endTime,
      roleRequirement,
      skillRequirements,
      requiredSkills,
      assignedEmployeeId,
      location,
      team,
      status,
      notes,
      breakDuration,
      hourlyRate
    } = req.body;

    // Use requiredSkills if skillRequirements is not provided (for backward compatibility)
    const finalSkillRequirements = skillRequirements || requiredSkills || [];

    // If changing assignment, check for conflicts
    if (assignedEmployeeId && assignedEmployeeId !== shift.assignedEmployeeId.toString()) {
      const employee = await Employee.findById(assignedEmployeeId);
      if (!employee) {
        throw new BusinessLogicError('Assigned employee not found', 400, 'EMPLOYEE_NOT_FOUND');
      }

      if (!employee.isActive) {
        throw new BusinessLogicError('Cannot assign shift to inactive employee', 400, 'EMPLOYEE_INACTIVE');
      }

      // Check for conflicts with new employee
      const conflicts = await Shift.findConflicts(assignedEmployeeId, date || shift.date, startTime || shift.startTime, endTime || shift.endTime, shift._id);
      if (conflicts.length > 0) {
        throw new ShiftConflictError('New employee has conflicting shifts', {
          conflicts: conflicts.map(c => ({
            id: c._id,
            date: c.date,
            startTime: c.startTime,
            endTime: c.endTime
          }))
        });
      }

      // Check availability and skills for new employee
      const dayOfWeek = new Date(date || shift.date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (!employee.isAvailableOnDay(dayOfWeek)) {
        throw new BusinessLogicError('New employee is not available on this day', 400, 'EMPLOYEE_UNAVAILABLE');
      }

      if (finalSkillRequirements && finalSkillRequirements.length > 0) {
        const hasRequiredSkills = finalSkillRequirements.some(skill =>
          employee.skills.includes(skill)
        );
        if (!hasRequiredSkills) {
          throw new BusinessLogicError('New employee does not have required skills', 400, 'INSUFFICIENT_SKILLS');
        }
      }

      // Check time off conflicts for new employee
      const timeOffConflict = await TimeOffRequest.findOne({
        employeeId: assignedEmployeeId,
        status: 'approved',
        startDate: { $lte: date || shift.date },
        endDate: { $gte: date || shift.date }
      });

      if (timeOffConflict) {
        throw new BusinessLogicError('New employee has approved time off on this date', 400, 'TIMEOFF_CONFLICT');
      }
    }

    // Update fields
    if (date) shift.date = date;
    if (startTime) shift.startTime = startTime;
    if (endTime) shift.endTime = endTime;
    if (roleRequirement) shift.roleRequirement = roleRequirement;
    if (finalSkillRequirements.length > 0) shift.skillRequirements = finalSkillRequirements;
    if (assignedEmployeeId) shift.assignedEmployeeId = assignedEmployeeId;
    if (location) shift.location = location;
    if (team) shift.team = team;
    if (status) shift.status = status;
    if (notes !== undefined) shift.notes = notes;
    if (breakDuration !== undefined) shift.breakDuration = breakDuration;
    if (hourlyRate !== undefined) shift.hourlyRate = hourlyRate;

    shift.lastModifiedBy = req.employee._id;
    await shift.save();

    // Populate employee details
    await shift.populate('assignedEmployeeId', 'name email role team');

    res.json({
      success: true,
      message: 'Shift updated successfully',
      data: {
        shift
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete shift
// @route   DELETE /api/shifts/:id
// @access  Private (managers, admin)
const deleteShift = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      throw new BusinessLogicError('Shift not found', 404, 'SHIFT_NOT_FOUND');
    }

    // Check if shift is in progress or completed
    if (shift.status === 'in-progress' || shift.status === 'completed') {
      throw new BusinessLogicError('Cannot delete shift that is in progress or completed', 400, 'SHIFT_CANNOT_DELETE');
    }

    await shift.deleteOne();

    res.json({
      success: true,
      message: 'Shift deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign shift to employee
// @route   PUT /api/shifts/:id/assign
// @access  Private (managers, supervisors, admin)
const assignShift = async (req, res, next) => {
  try {
    const { assignedEmployeeId } = req.body;
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      throw new BusinessLogicError('Shift not found', 404, 'SHIFT_NOT_FOUND');
    }

    if (shift.status !== 'scheduled') {
      throw new BusinessLogicError('Can only assign scheduled shifts', 400, 'SHIFT_NOT_SCHEDULED');
    }

    const employee = await Employee.findById(assignedEmployeeId);
    if (!employee) {
      throw new BusinessLogicError('Employee not found', 400, 'EMPLOYEE_NOT_FOUND');
    }

    if (!employee.isActive) {
      throw new BusinessLogicError('Cannot assign shift to inactive employee', 400, 'EMPLOYEE_INACTIVE');
    }

    // Check for conflicts
    const conflicts = await Shift.findConflicts(assignedEmployeeId, shift.date, shift.startTime, shift.endTime, shift._id);
    if (conflicts.length > 0) {
      throw new ShiftConflictError('Employee has conflicting shifts', {
        conflicts: conflicts.map(c => ({
          id: c._id,
          date: c.date,
          startTime: c.startTime,
          endTime: c.endTime
        }))
      });
    }

    // Check availability
    const dayOfWeek = shift.dayOfWeek;
    if (!employee.isAvailableOnDay(dayOfWeek)) {
      throw new BusinessLogicError('Employee is not available on this day', 400, 'EMPLOYEE_UNAVAILABLE');
    }

    // Check skills
    if (shift.skillRequirements && shift.skillRequirements.length > 0) {
      const hasRequiredSkills = shift.skillRequirements.some(skill =>
        employee.skills.includes(skill)
      );
      if (!hasRequiredSkills) {
        throw new BusinessLogicError('Employee does not have required skills', 400, 'INSUFFICIENT_SKILLS');
      }
    }

    // Check time off
    const timeOffConflict = await TimeOffRequest.findOne({
      employeeId: assignedEmployeeId,
      status: 'approved',
      startDate: { $lte: shift.date },
      endDate: { $gte: shift.date }
    });

    if (timeOffConflict) {
      throw new BusinessLogicError('Employee has approved time off on this date', 400, 'TIMEOFF_CONFLICT');
    }

    // Assign shift
    shift.assignedEmployeeId = assignedEmployeeId;
    shift.lastModifiedBy = req.employee._id;
    await shift.save();

    // Populate employee details
    await shift.populate('assignedEmployeeId', 'name email role team');

    res.json({
      success: true,
      message: 'Shift assigned successfully',
      data: {
        shift
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily schedule
// @route   GET /api/shifts/daily/:date
// @access  Private
const getDailySchedule = async (req, res, next) => {
  try {
    const { date } = req.params;
    const { location, team } = req.query;

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new BusinessLogicError('Invalid date format', 400, 'INVALID_DATE');
    }

    const query = {
      date: {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        $lt: new Date(targetDate.setHours(23, 59, 59, 999))
      }
    };

    if (location) query.location = location;
    if (team) query.team = team;

    const shifts = await Shift.find(query)
      .populate('assignedEmployeeId', 'name email role team')
      .sort({ startTime: 1 });

    // Group by location and team
    const schedule = {};
    shifts.forEach(shift => {
      if (!schedule[shift.location]) {
        schedule[shift.location] = {};
      }
      if (!schedule[shift.location][shift.team]) {
        schedule[shift.location][shift.team] = [];
      }
      schedule[shift.location][shift.team].push(shift);
    });

    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        schedule,
        totalShifts: shifts.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unassigned shifts
// @route   GET /api/shifts/unassigned
// @access  Private
const getUnassignedShifts = async (req, res, next) => {
  try {
    const { date, location, roleRequirement } = req.query;

    let shifts = [];
    try {
      shifts = await Shift.findUnassigned(date, location, roleRequirement)
        .populate('createdBy', 'name email')
        .sort({ date: 1, startTime: 1 });
    } catch (queryError) {
      console.error('findUnassigned query error:', queryError);
      shifts = [];
    }

    res.json({
      success: true,
      data: {
        shifts: shifts || [],
        count: (shifts && shifts.length) ? shifts.length : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShifts,
  getShift,
  createShift,
  updateShift,
  deleteShift,
  assignShift,
  getDailySchedule,
  getUnassignedShifts
};
