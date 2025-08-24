const TimeOffRequest = require('../models/TimeOffRequest');
const Shift = require('../models/Shift');
const Employee = require('../models/Employee');
const { BusinessLogicError, TimeOffConflictError } = require('../middleware/errorHandler');

// @desc    Get all time off requests with filtering and pagination
// @route   GET /api/time-off
// @access  Private
const getTimeOffRequests = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      requestType,
      startDate,
      endDate,
      employeeId,
      search
    } = req.query;

    // Build query
    const query = {};

    if (status) query.status = status;
    if (requestType) query.requestType = requestType;
    if (employeeId) query.employeeId = employeeId;

    if (startDate && endDate) {
      query.startDate = { $lte: new Date(endDate) };
      query.endDate = { $gte: new Date(startDate) };
    }

    // Text search across reason and notes
    if (search) {
      query.$or = [
        { reason: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await TimeOffRequest.countDocuments(query);

    // Execute query with pagination
    const timeOffRequests = await TimeOffRequest.find(query)
      .populate('employeeId', 'name email role team')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        timeOffRequests,
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

// @desc    Get single time off request by ID
// @route   GET /api/time-off/:id
// @access  Private
const getTimeOffRequest = async (req, res, next) => {
  try {
    const timeOffRequest = await TimeOffRequest.findById(req.params.id)
      .populate('employeeId', 'name email role team')
      .populate('approvedBy', 'name email');

    if (!timeOffRequest) {
      throw new BusinessLogicError('Time off request not found', 404, 'TIMEOFF_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        timeOffRequest
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new time off request
// @route   POST /api/time-off
// @access  Private
const createTimeOffRequest = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      reason,
      requestType,
      isHalfDay,
      halfDayType,
      notes,
      emergencyContact
    } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      throw new BusinessLogicError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
    }

    if (start < new Date()) {
      throw new BusinessLogicError('Cannot request time off for past dates', 400, 'PAST_DATE_NOT_ALLOWED');
    }

    // Check for conflicts with existing shifts
    const shiftConflicts = await Shift.find({
      assignedEmployeeId: req.employee._id,
      date: { $gte: start, $lte: end },
      status: { $in: ['scheduled', 'in-progress'] }
    });

    if (shiftConflicts.length > 0) {
      throw new TimeOffConflictError('Time off request conflicts with existing shifts', {
        conflicts: shiftConflicts.map(shift => ({
          id: shift._id,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime
        }))
      });
    }

    // Check for conflicts with existing approved time off
    const existingTimeOff = await TimeOffRequest.find({
      employeeId: req.employee._id,
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start }
    });

    if (existingTimeOff.length > 0) {
      throw new TimeOffConflictError('Time off request overlaps with existing approved time off', {
        conflicts: existingTimeOff.map(request => ({
          id: request._id,
          startDate: request.startDate,
          endDate: request.endDate
        }))
      });
    }

    // Create time off request
    const timeOffRequest = new TimeOffRequest({
      employeeId: req.employee._id,
      startDate: start,
      endDate: end,
      reason,
      requestType,
      isHalfDay,
      halfDayType,
      notes,
      emergencyContact
    });

    await timeOffRequest.save();

    // Populate employee details
    await timeOffRequest.populate('employeeId', 'name email role team');

    res.status(201).json({
      success: true,
      message: 'Time off request created successfully',
      data: {
        timeOffRequest
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update time off request
// @route   PUT /api/time-off/:id
// @access  Private (self or managers, admin)
const updateTimeOffRequest = async (req, res, next) => {
  try {
    const timeOffRequest = await TimeOffRequest.findById(req.params.id);
    if (!timeOffRequest) {
      throw new BusinessLogicError('Time off request not found', 404, 'TIMEOFF_NOT_FOUND');
    }

    // Only allow updates if request is pending
    if (timeOffRequest.status !== 'pending') {
      throw new BusinessLogicError('Can only update pending time off requests', 400, 'CANNOT_UPDATE_APPROVED');
    }

    // Only allow employee to update their own request, or managers/admin
    if (timeOffRequest.employeeId.toString() !== req.employee._id.toString() && 
        !['manager', 'admin'].includes(req.employee.role)) {
      throw new BusinessLogicError('Cannot update another employee\'s time off request', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    const {
      startDate,
      endDate,
      reason,
      requestType,
      isHalfDay,
      halfDayType,
      notes,
      emergencyContact
    } = req.body;

    // Validate dates if being changed
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        throw new BusinessLogicError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
      }

      if (start < new Date()) {
        throw new BusinessLogicError('Cannot request time off for past dates', 400, 'PAST_DATE_NOT_ALLOWED');
      }

      // Check for conflicts with existing shifts
      const shiftConflicts = await Shift.find({
        assignedEmployeeId: timeOffRequest.employeeId,
        date: { $gte: start, $lte: end },
        status: { $in: ['scheduled', 'in-progress'] }
      });

      if (shiftConflicts.length > 0) {
        throw new TimeOffConflictError('Updated time off request conflicts with existing shifts', {
          conflicts: shiftConflicts.map(shift => ({
            id: shift._id,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime
          }))
        });
      }

      // Check for conflicts with existing approved time off (excluding this request)
      const existingTimeOff = await TimeOffRequest.find({
        employeeId: timeOffRequest.employeeId,
        status: 'approved',
        _id: { $ne: timeOffRequest._id },
        startDate: { $lte: end },
        endDate: { $gte: start }
      });

      if (existingTimeOff.length > 0) {
        throw new TimeOffConflictError('Updated time off request overlaps with existing approved time off', {
          conflicts: existingTimeOff.map(request => ({
            id: request._id,
            startDate: request.startDate,
            endDate: request.endDate
          }))
        });
      }
    }

    // Update fields
    if (startDate) timeOffRequest.startDate = startDate;
    if (endDate) timeOffRequest.endDate = endDate;
    if (reason) timeOffRequest.reason = reason;
    if (requestType) timeOffRequest.requestType = requestType;
    if (isHalfDay !== undefined) timeOffRequest.isHalfDay = isHalfDay;
    if (halfDayType) timeOffRequest.halfDayType = halfDayType;
    if (notes !== undefined) timeOffRequest.notes = notes;
    if (emergencyContact) timeOffRequest.emergencyContact = emergencyContact;

    await timeOffRequest.save();

    // Populate employee details
    await timeOffRequest.populate('employeeId', 'name email role team');

    res.json({
      success: true,
      message: 'Time off request updated successfully',
      data: {
        timeOffRequest
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve/reject time off request
// @route   PUT /api/time-off/:id/approve
// @access  Private (managers, admin)
const approveTimeOffRequest = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const timeOffRequest = await TimeOffRequest.findById(req.params.id);

    if (!timeOffRequest) {
      throw new BusinessLogicError('Time off request not found', 404, 'TIMEOFF_NOT_FOUND');
    }

    if (timeOffRequest.status !== 'pending') {
      throw new BusinessLogicError('Can only approve/reject pending requests', 400, 'REQUEST_NOT_PENDING');
    }

    if (!['approved', 'rejected'].includes(status)) {
      throw new BusinessLogicError('Status must be approved or rejected', 400, 'INVALID_STATUS');
    }

    // If rejecting, require rejection reason
    if (status === 'rejected' && !rejectionReason) {
      throw new BusinessLogicError('Rejection reason is required', 400, 'REJECTION_REASON_REQUIRED');
    }

    // Update status
    timeOffRequest.status = status;
    if (status === 'approved') {
      timeOffRequest.approvedBy = req.employee._id;
      timeOffRequest.approvedAt = new Date();
    } else {
      timeOffRequest.rejectionReason = rejectionReason;
    }

    await timeOffRequest.save();

    // Populate details
    await timeOffRequest.populate('employeeId', 'name email role team');
    await timeOffRequest.populate('approvedBy', 'name email');

    res.json({
      success: true,
      message: `Time off request ${status} successfully`,
      data: {
        timeOffRequest
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel time off request
// @route   PUT /api/time-off/:id/cancel
// @access  Private (self or managers, admin)
const cancelTimeOffRequest = async (req, res, next) => {
  try {
    const timeOffRequest = await TimeOffRequest.findById(req.params.id);
    if (!timeOffRequest) {
      throw new BusinessLogicError('Time off request not found', 404, 'TIMEOFF_NOT_FOUND');
    }

    // Only allow cancellation if request is pending or approved
    if (!['pending', 'approved'].includes(timeOffRequest.status)) {
      throw new BusinessLogicError('Cannot cancel this time off request', 400, 'CANNOT_CANCEL');
    }

    // Only allow employee to cancel their own request, or managers/admin
    if (timeOffRequest.employeeId.toString() !== req.employee._id.toString() && 
        !['manager', 'admin'].includes(req.employee.role)) {
      throw new BusinessLogicError('Cannot cancel another employee\'s time off request', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    // If approved, check if it's in the future
    if (timeOffRequest.status === 'approved' && timeOffRequest.startDate <= new Date()) {
      throw new BusinessLogicError('Cannot cancel time off that has already started', 400, 'CANNOT_CANCEL_STARTED');
    }

    timeOffRequest.status = 'cancelled';
    await timeOffRequest.save();

    // Populate details
    await timeOffRequest.populate('employeeId', 'name email role team');

    res.json({
      success: true,
      message: 'Time off request cancelled successfully',
      data: {
        timeOffRequest
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending time off requests
// @route   GET /api/time-off/pending
// @access  Private (managers, supervisors, admin)
const getPendingTimeOffRequests = async (req, res, next) => {
  try {
    const timeOffRequests = await TimeOffRequest.findPending()
      .populate('employeeId', 'name email role team')
      .sort({ startDate: 1 });

    res.json({
      success: true,
      data: {
        timeOffRequests,
        count: timeOffRequests.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employee's time off requests
// @route   GET /api/time-off/employee/:employeeId
// @access  Private (self or managers, supervisors, admin)
const getEmployeeTimeOffRequests = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, status } = req.query;

    // Check permissions
    if (employeeId !== req.employee._id.toString() && 
        !['manager', 'supervisor', 'admin'].includes(req.employee.role)) {
      throw new BusinessLogicError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    const query = { employeeId };

    if (status) query.status = status;
    if (startDate && endDate) {
      query.startDate = { $lte: new Date(endDate) };
      query.endDate = { $gte: new Date(startDate) };
    }

    const timeOffRequests = await TimeOffRequest.find(query)
      .populate('approvedBy', 'name email')
      .sort({ startDate: -1 });

    res.json({
      success: true,
      data: {
        timeOffRequests,
        count: timeOffRequests.length
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTimeOffRequests,
  getTimeOffRequest,
  createTimeOffRequest,
  updateTimeOffRequest,
  approveTimeOffRequest,
  cancelTimeOffRequest,
  getPendingTimeOffRequests,
  getEmployeeTimeOffRequests
};
