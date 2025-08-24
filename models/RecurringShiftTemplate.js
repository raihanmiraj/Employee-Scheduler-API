const mongoose = require('mongoose');

const recurringShiftTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
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
  repeatPattern: {
    type: String,
    required: [true, 'Repeat pattern is required'],
    enum: ['daily', 'weekly', 'monthly', 'custom']
  },
  repeatDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  repeatInterval: {
    type: Number,
    default: 1,
    min: [1, 'Repeat interval must be at least 1']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  team: {
    type: String,
    required: [true, 'Team is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxAssignments: {
    type: Number,
    default: 1,
    min: [1, 'Max assignments must be at least 1']
  },
  currentAssignments: {
    type: Number,
    default: 0,
    min: [0, 'Current assignments cannot be negative']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
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
recurringShiftTemplateSchema.virtual('duration').get(function() {
  if (!this.startTime || !this.endTime) return 0;
  
  const start = new Date(`2000-01-01T${this.startTime}:00`);
  let end = new Date(`2000-01-01T${this.endTime}:00`);
  
  // Handle overnight shifts
  if (end < start) {
    end.setDate(end.getDate() + 1);
  }
  
  const durationMs = end - start;
  return Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
});

// Virtual for is overnight shift
recurringShiftTemplateSchema.virtual('isOvernight').get(function() {
  if (!this.startTime || !this.endTime) return false;
  
  const start = new Date(`2000-01-01T${this.startTime}:00`);
  const end = new Date(`2000-01-01T${this.endTime}:00`);
  
  return end < start;
});

// Virtual for available slots
recurringShiftTemplateSchema.virtual('availableSlots').get(function() {
  return Math.max(0, this.maxAssignments - this.currentAssignments);
});

// Virtual for is fully assigned
recurringShiftTemplateSchema.virtual('isFullyAssigned').get(function() {
  return this.currentAssignments >= this.maxAssignments;
});

// Indexes for optimal query performance
recurringShiftTemplateSchema.index({ isActive: 1 });
recurringShiftTemplateSchema.index({ location: 1 });
recurringShiftTemplateSchema.index({ team: 1 });
recurringShiftTemplateSchema.index({ roleRequirement: 1 });
recurringShiftTemplateSchema.index({ startDate: 1 });
recurringShiftTemplateSchema.index({ endDate: 1 });
recurringShiftTemplateSchema.index({ repeatPattern: 1 });
recurringShiftTemplateSchema.index({ 'skillRequirements': 1 });

// Compound indexes for common query patterns
recurringShiftTemplateSchema.index({ isActive: 1, location: 1 });
recurringShiftTemplateSchema.index({ isActive: 1, team: 1 });
recurringShiftTemplateSchema.index({ isActive: 1, roleRequirement: 1 });
recurringShiftTemplateSchema.index({ location: 1, team: 1, isActive: 1 });
recurringShiftTemplateSchema.index({ startDate: 1, endDate: 1, isActive: 1 });

// Pre-save middleware to validate repeat days for weekly pattern
recurringShiftTemplateSchema.pre('save', function(next) {
  if (this.repeatPattern === 'weekly' && (!this.repeatDays || this.repeatDays.length === 0)) {
    return next(new Error('Weekly repeat pattern requires at least one repeat day'));
  }
  
  if (this.repeatPattern === 'weekly' && this.repeatDays.length > 7) {
    return next(new Error('Weekly repeat pattern cannot have more than 7 days'));
  }
  
  next();
});

// Method to check if template is active for a specific date
recurringShiftTemplateSchema.methods.isActiveForDate = function(date) {
  if (!this.isActive) return false;
  
  const checkDate = new Date(date);
  
  // Check if date is within template date range
  if (this.startDate && checkDate < this.startDate) return false;
  if (this.endDate && checkDate > this.endDate) return false;
  
  // Check repeat pattern
  if (this.repeatPattern === 'daily') {
    return true;
  } else if (this.repeatPattern === 'weekly') {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = days[checkDate.getDay()];
    return this.repeatDays.includes(dayOfWeek);
  } else if (this.repeatPattern === 'monthly') {
    // Check if it's the same day of month
    const startDay = this.startDate.getDate();
    return checkDate.getDate() === startDay;
  }
  
  return false;
};

// Method to generate next occurrence date
recurringShiftTemplateSchema.methods.getNextOccurrence = function(fromDate = new Date()) {
  if (!this.isActive) return null;
  
  let currentDate = new Date(fromDate);
  
  if (this.repeatPattern === 'daily') {
    return currentDate;
  } else if (this.repeatPattern === 'weekly') {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = currentDate.getDay();
    
    for (let i = 1; i <= 7; i++) {
      const nextDay = (currentDay + i) % 7;
      if (this.repeatDays.includes(days[nextDay])) {
        const nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + i);
        return nextDate;
      }
    }
  } else if (this.repeatPattern === 'monthly') {
    const nextDate = new Date(currentDate);
    nextDate.setMonth(currentDate.getMonth() + 1);
    nextDate.setDate(this.startDate.getDate());
    return nextDate;
  }
  
  return null;
};

// Method to check if employee is suitable for this template
recurringShiftTemplateSchema.methods.isEmployeeSuitable = function(employee) {
  // Check role requirement
  if (this.roleRequirement && employee.role !== this.roleRequirement) {
    return false;
  }
  
  // Check skill requirements
  if (this.skillRequirements.length > 0) {
    const hasRequiredSkills = this.skillRequirements.some(skill => 
      employee.skills.includes(skill)
    );
    if (!hasRequiredSkills) {
      return false;
    }
  }
  
  // Check if employee is available on repeat days
  if (this.repeatPattern === 'weekly' && this.repeatDays) {
    const isAvailableOnRepeatDays = this.repeatDays.some(day => 
      employee.isAvailableOnDay(day)
    );
    if (!isAvailableOnRepeatDays) {
      return false;
    }
  }
  
  return true;
};

// Static method to find active templates by location and team
recurringShiftTemplateSchema.statics.findActiveByLocationAndTeam = function(location, team) {
  return this.find({
    isActive: true,
    location,
    team
  });
};

// Static method to find templates by role requirement
recurringShiftTemplateSchema.statics.findByRoleRequirement = function(roleRequirement) {
  return this.find({
    isActive: true,
    roleRequirement
  });
};

// Static method to find templates that need assignments
recurringShiftTemplateSchema.statics.findNeedingAssignments = function() {
  return this.find({
    isActive: true,
    $expr: { $lt: ['$currentAssignments', '$maxAssignments'] }
  });
};

module.exports = mongoose.model('RecurringShiftTemplate', recurringShiftTemplateSchema);
