const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Shift date is required'],
    index: true
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format']
  },
  roleRequirement: {
    type: String,
    required: [true, 'Role requirement is required'],
    enum: ['manager', 'supervisor', 'employee', 'admin']
  },
  skillRequirements: [{
    type: String,
    required: true,
    trim: true
  }],
  assignedEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Assigned employee is required']
  },
  location: {
    type: String,
    required: [true, 'Shift location is required'],
    trim: true
  },
  team: {
    type: String,
    required: [true, 'Team assignment is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  isOvernight: {
    type: Boolean,
    default: false
  },
  breakDuration: {
    type: Number,
    default: 0,
    min: [0, 'Break duration cannot be negative']
  },
  hourlyRate: {
    type: Number,
    default: 0,
    min: [0, 'Hourly rate cannot be negative']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for shift duration in hours
shiftSchema.virtual('duration').get(function() {
  try {
    if (!this.startTime || !this.endTime) return 0;
    
    const start = new Date(`2000-01-01T${this.startTime}:00`);
    let end = new Date(`2000-01-01T${this.endTime}:00`);
    
    // Handle overnight shifts
    if (this.isOvernight && end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    const durationMs = end - start;
    return Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
  } catch (error) {
    console.error('duration virtual error:', error);
    return 0;
  }
});

// Virtual for total cost
shiftSchema.virtual('totalCost').get(function() {
  try {
    return this.duration * this.hourlyRate;
  } catch (error) {
    console.error('totalCost virtual error:', error);
    return 0;
  }
});

// Virtual for formatted date
shiftSchema.virtual('formattedDate').get(function() {
  try {
    if (!this.date) return '';
    return this.date.toISOString().split('T')[0];
  } catch (error) {
    console.error('formattedDate virtual error:', error);
    return '';
  }
});

// Virtual for day of week
shiftSchema.virtual('dayOfWeek').get(function() {
  try {
    if (!this.date) return 'unknown';
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[this.date.getDay()] || 'unknown';
  } catch (error) {
    console.error('dayOfWeek virtual error:', error);
    return 'unknown';
  }
});

// Indexes for optimal query performance
shiftSchema.index({ date: 1 });
shiftSchema.index({ location: 1 });
shiftSchema.index({ team: 1 });
shiftSchema.index({ roleRequirement: 1 });
shiftSchema.index({ assignedEmployeeId: 1 });
shiftSchema.index({ status: 1 });
shiftSchema.index({ 'skillRequirements': 1 });

// Compound indexes for common query patterns
shiftSchema.index({ date: 1, location: 1 });
shiftSchema.index({ date: 1, team: 1 });
shiftSchema.index({ date: 1, assignedEmployeeId: 1 });
shiftSchema.index({ location: 1, roleRequirement: 1 });
shiftSchema.index({ team: 1, roleRequirement: 1 });
shiftSchema.index({ date: 1, location: 1, roleRequirement: 1 });
shiftSchema.index({ assignedEmployeeId: 1, date: 1 });
shiftSchema.index({ status: 1, date: 1 });

// Pre-save middleware to set overnight flag
shiftSchema.pre('save', function(next) {
  try {
    if (this.startTime && this.endTime) {
      const start = new Date(`2000-01-01T${this.startTime}:00`);
      const end = new Date(`2000-01-01T${this.endTime}:00`);
      this.isOvernight = end < start;
    }
  } catch (error) {
    console.error('Pre-save middleware error:', error);
    this.isOvernight = false;
  }
  next();
});

// Method to check if shift overlaps with another shift
shiftSchema.methods.overlapsWith = function(otherShift) {
  try {
    if (!this.date || !otherShift.date) return false;
    if (this.date.toDateString() !== otherShift.date.toDateString()) {
      return false;
    }
    
    const start1 = new Date(`2000-01-01T${this.startTime}:00`);
    let end1 = new Date(`2000-01-01T${this.endTime}:00`);
    const start2 = new Date(`2000-01-01T${otherShift.startTime}:00`);
    let end2 = new Date(`2000-01-01T${otherShift.endTime}:00`);
    
    // Handle overnight shifts
    if (this.isOvernight && end1 < start1) {
      end1.setDate(end1.getDate() + 1);
    }
    if (otherShift.isOvernight && end2 < start2) {
      end2.setDate(end2.getDate() + 1);
    }
    
    return start1 < end2 && start2 < end1;
  } catch (error) {
    console.error('overlapsWith error:', error);
    return false;
  }
};

// Method to check if employee is available for this shift
shiftSchema.methods.isEmployeeAvailable = function(employee) {
  try {
    // Check if employee is available on this day
    const dayOfWeek = this.dayOfWeek;
    if (!employee.isAvailableOnDay(dayOfWeek)) {
      return false;
    }
    
    // Check if employee has required skills
    if (this.skillRequirements && this.skillRequirements.length > 0) {
      const hasRequiredSkills = this.skillRequirements.some(skill => 
        employee.skills.includes(skill)
      );
      if (!hasRequiredSkills) {
        return false;
      }
    }
    
    // Check if employee matches role requirement
    if (this.roleRequirement && employee.role !== this.roleRequirement) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('isEmployeeAvailable error:', error);
    return false;
  }
};

// Static method to find shifts by date range
shiftSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('assignedEmployeeId', 'name email role team');
};

// Static method to find shifts by location and date
shiftSchema.statics.findByLocationAndDate = function(location, date) {
  return this.find({
    location,
    date: {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lt: new Date(date.setHours(23, 59, 59, 999))
    }
  }).populate('assignedEmployeeId', 'name email role team');
};

// Static method to find unassigned shifts
shiftSchema.statics.findUnassigned = function(date, location, roleRequirement) {
  try {
    const query = { assignedEmployeeId: null, status: 'scheduled' };
    
    if (date) query.date = date;
    if (location) query.location = location;
    if (roleRequirement) query.roleRequirement = roleRequirement;
    
    return this.find(query);
  } catch (error) {
    console.error('findUnassigned error:', error);
    return this.find({ assignedEmployeeId: null, status: 'scheduled' });
  }
};

// Static method to find conflicts for an employee
shiftSchema.statics.findConflicts = function(employeeId, date, startTime, endTime, excludeShiftId = null) {
  try {
    const query = {
      assignedEmployeeId: employeeId,
      date: date,
      status: { $in: ['scheduled', 'in-progress'] }
    };
    
    if (excludeShiftId) {
      query._id = { $ne: excludeShiftId };
    }
    
    return this.find(query);
  } catch (error) {
    console.error('findConflicts error:', error);
    return this.find({ assignedEmployeeId: employeeId });
  }
};

module.exports = mongoose.model('Shift', shiftSchema);
