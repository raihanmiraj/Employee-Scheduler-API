const RecurringShiftTemplate = require('../models/RecurringShiftTemplate');
const { BusinessLogicError } = require('../middleware/errorHandler');

// @desc    Get all recurring shift templates with filtering and pagination
// @route   GET /api/recurring-shifts
// @access  Private (managers, admin)
const getRecurringShiftTemplates = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      team,
      location,
      roleRequirement,
      isActive,
      search
    } = req.query;

    // Build query
    const query = {};

    if (team) query.team = team;
    if (location) query.location = location;
    if (roleRequirement) query.roleRequirement = roleRequirement;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Text search across name and description
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await RecurringShiftTemplate.countDocuments(query);

    // Execute query with pagination
    const templates = await RecurringShiftTemplate.find(query)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        templates,
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

// @desc    Get single recurring shift template by ID
// @route   GET /api/recurring-shifts/:id
// @access  Private (managers, admin)
const getRecurringShiftTemplate = async (req, res, next) => {
  try {
    const template = await RecurringShiftTemplate.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!template) {
      throw new BusinessLogicError('Recurring shift template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        template
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new recurring shift template
// @route   POST /api/recurring-shifts
// @access  Private (managers, admin)
const createRecurringShiftTemplate = async (req, res, next) => {
  try {
    const {
      name,
      description,
      startTime,
      endTime,
      daysOfWeek,
      team,
      location,
      roleRequirement,
      skillRequirements,
      isOvernight,
      breakDuration,
      hourlyRate,
      isActive
    } = req.body;

    // Validate days of week
    if (!daysOfWeek || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      throw new BusinessLogicError('At least one day of week must be specified', 400, 'INVALID_DAYS_OF_WEEK');
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw new BusinessLogicError('Invalid time format. Use HH:MM format', 400, 'INVALID_TIME_FORMAT');
    }

    // Check if overnight shift and adjust logic
    if (isOvernight && startTime >= endTime) {
      // For overnight shifts, start time should be after end time (e.g., 22:00 to 06:00)
      // This is valid
    } else if (!isOvernight && startTime >= endTime) {
      throw new BusinessLogicError('Start time must be before end time for non-overnight shifts', 400, 'INVALID_TIME_RANGE');
    }

    // Create template
    const template = new RecurringShiftTemplate({
      name,
      description,
      startTime,
      endTime,
      daysOfWeek,
      team,
      location,
      roleRequirement,
      skillRequirements: skillRequirements || [],
      isOvernight: isOvernight || false,
      breakDuration: breakDuration || 0,
      hourlyRate: hourlyRate || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.employee._id,
      lastModifiedBy: req.employee._id
    });

    await template.save();

    // Populate creator details
    await template.populate('createdBy', 'name email');
    await template.populate('lastModifiedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Recurring shift template created successfully',
      data: {
        template
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update recurring shift template
// @route   PUT /api/recurring-shifts/:id
// @access  Private (managers, admin)
const updateRecurringShiftTemplate = async (req, res, next) => {
  try {
    const template = await RecurringShiftTemplate.findById(req.params.id);
    
    if (!template) {
      throw new BusinessLogicError('Recurring shift template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    const {
      name,
      description,
      startTime,
      endTime,
      daysOfWeek,
      team,
      location,
      roleRequirement,
      skillRequirements,
      isOvernight,
      breakDuration,
      hourlyRate,
      isActive
    } = req.body;

    // Validate days of week if being updated
    if (daysOfWeek && (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0)) {
      throw new BusinessLogicError('At least one day of week must be specified', 400, 'INVALID_DAYS_OF_WEEK');
    }

    // Validate time format if being updated
    if (startTime || endTime) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const newStartTime = startTime || template.startTime;
      const newEndTime = endTime || template.endTime;
      
      if (!timeRegex.test(newStartTime) || !timeRegex.test(newEndTime)) {
        throw new BusinessLogicError('Invalid time format. Use HH:MM format', 400, 'INVALID_TIME_FORMAT');
      }

      // Check overnight logic
      const newIsOvernight = isOvernight !== undefined ? isOvernight : template.isOvernight;
      if (newIsOvernight && newStartTime >= newEndTime) {
        // Valid overnight shift
      } else if (!newIsOvernight && newStartTime >= newEndTime) {
        throw new BusinessLogicError('Start time must be before end time for non-overnight shifts', 400, 'INVALID_TIME_RANGE');
      }
    }

    // Update fields
    if (name !== undefined) template.name = name;
    if (description !== undefined) template.description = description;
    if (startTime !== undefined) template.startTime = startTime;
    if (endTime !== undefined) template.endTime = endTime;
    if (daysOfWeek !== undefined) template.daysOfWeek = daysOfWeek;
    if (team !== undefined) template.team = team;
    if (location !== undefined) template.location = location;
    if (roleRequirement !== undefined) template.roleRequirement = roleRequirement;
    if (skillRequirements !== undefined) template.skillRequirements = skillRequirements;
    if (isOvernight !== undefined) template.isOvernight = isOvernight;
    if (breakDuration !== undefined) template.breakDuration = breakDuration;
    if (hourlyRate !== undefined) template.hourlyRate = hourlyRate;
    if (isActive !== undefined) template.isActive = isActive;
    
    template.lastModifiedBy = req.employee._id;

    await template.save();

    // Populate details
    await template.populate('createdBy', 'name email');
    await template.populate('lastModifiedBy', 'name email');

    res.json({
      success: true,
      message: 'Recurring shift template updated successfully',
      data: {
        template
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete recurring shift template
// @route   DELETE /api/recurring-shifts/:id
// @access  Private (managers, admin)
const deleteRecurringShiftTemplate = async (req, res, next) => {
  try {
    const template = await RecurringShiftTemplate.findById(req.params.id);
    
    if (!template) {
      throw new BusinessLogicError('Recurring shift template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Check if template is being used by any active shifts
    // This would require additional logic to check for dependencies
    
    await RecurringShiftTemplate.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Recurring shift template deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle template active status
// @route   PUT /api/recurring-shifts/:id/toggle-status
// @access  Private (managers, admin)
const toggleTemplateStatus = async (req, res, next) => {
  try {
    const template = await RecurringShiftTemplate.findById(req.params.id);
    
    if (!template) {
      throw new BusinessLogicError('Recurring shift template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    template.isActive = !template.isActive;
    template.lastModifiedBy = req.employee._id;

    await template.save();

    // Populate details
    await template.populate('createdBy', 'name email');
    await template.populate('lastModifiedBy', 'name email');

    res.json({
      success: true,
      message: `Template ${template.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        template
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate shifts from template for a date range
// @route   POST /api/recurring-shifts/:id/generate-shifts
// @access  Private (managers, admin)
const generateShiftsFromTemplate = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      throw new BusinessLogicError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      throw new BusinessLogicError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
    }

    const template = await RecurringShiftTemplate.findById(req.params.id);
    if (!template) {
      throw new BusinessLogicError('Recurring shift template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    if (!template.isActive) {
      throw new BusinessLogicError('Cannot generate shifts from inactive template', 400, 'TEMPLATE_INACTIVE');
    }

    // This would implement the logic to generate actual Shift documents
    // based on the template's days of week and time settings
    // For now, return a success message indicating the feature is planned
    
    res.json({
      success: true,
      message: 'Shift generation from template is planned for future implementation',
      data: {
        templateId: template._id,
        dateRange: { startDate: start, endDate: end },
        daysOfWeek: template.daysOfWeek,
        estimatedShifts: 0 // Would calculate based on template and date range
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecurringShiftTemplates,
  getRecurringShiftTemplate,
  createRecurringShiftTemplate,
  updateRecurringShiftTemplate,
  deleteRecurringShiftTemplate,
  toggleTemplateStatus,
  generateShiftsFromTemplate
};
