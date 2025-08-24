const mongoose = require('mongoose');

const timeOffRequestSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee ID is required'],
    index: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    index: true
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },
  reason: {
    type: String,
    required: [true, 'Reason for time off is required'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  requestType: {
    type: String,
    enum: ['vacation', 'sick-leave', 'personal', 'bereavement', 'jury-duty', 'other'],
    required: [true, 'Request type is required']
  },
  totalDays: {
    type: Number,
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  isHalfDay: {
    type: Boolean,
    default: false
  },
  halfDayType: {
    type: String,
    enum: ['morning', 'afternoon'],
    required: function() { return this.isHalfDay; }
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for request duration in days
timeOffRequestSchema.virtual('durationInDays').get(function() {
  if (!this.startDate || !this.endDate) return 0;
  
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  const timeDiff = end.getTime() - start.getTime();
  const daysDiff = timeDiff / (1000 * 3600 * 24);
  
  return Math.ceil(daysDiff) + 1; // Include both start and end dates
});

// Virtual for formatted date range
timeOffRequestSchema.virtual('formattedDateRange').get(function() {
  if (!this.startDate || !this.endDate) return '';
  
  const start = this.startDate.toISOString().split('T')[0];
  const end = this.endDate.toISOString().split('T')[0];
  
  if (start === end) {
    return start;
  }
  
  return `${start} to ${end}`;
});

// Virtual for is active (not cancelled or rejected)
timeOffRequestSchema.virtual('isActive').get(function() {
  return this.status === 'pending' || this.status === 'approved';
});

// Indexes for optimal query performance
timeOffRequestSchema.index({ employeeId: 1 });
timeOffRequestSchema.index({ startDate: 1 });
timeOffRequestSchema.index({ endDate: 1 });
timeOffRequestSchema.index({ status: 1 });
timeOffRequestSchema.index({ requestType: 1 });

// Compound indexes for common query patterns
timeOffRequestSchema.index({ employeeId: 1, status: 1 });
timeOffRequestSchema.index({ employeeId: 1, startDate: 1 });
timeOffRequestSchema.index({ status: 1, startDate: 1 });
timeOffRequestSchema.index({ status: 1, endDate: 1 });
timeOffRequestSchema.index({ employeeId: 1, startDate: 1, endDate: 1 });
timeOffRequestSchema.index({ startDate: 1, endDate: 1, status: 1 });

// Pre-save middleware to calculate total days
timeOffRequestSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);
    this.totalDays = Math.ceil(daysDiff) + 1; // Include both start and end dates
  }
  next();
});

// Pre-save middleware to set approval timestamp
timeOffRequestSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'approved' && !this.approvedAt) {
    this.approvedAt = new Date();
  }
  next();
});

// Method to check if time off overlaps with a date range
timeOffRequestSchema.methods.overlapsWithDateRange = function(startDate, endDate) {
  if (!this.startDate || !this.endDate) return false;
  
  const requestStart = new Date(this.startDate);
  const requestEnd = new Date(this.endDate);
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  
  // Check for overlap
  return requestStart <= rangeEnd && requestEnd >= rangeStart;
};

// Method to check if time off overlaps with a specific date
timeOffRequestSchema.methods.overlapsWithDate = function(date) {
  if (!this.startDate || !this.endDate) return false;
  
  const requestStart = new Date(this.startDate);
  const requestEnd = new Date(this.endDate);
  const checkDate = new Date(date);
  
  return checkDate >= requestStart && checkDate <= requestEnd;
};

// Method to check if time off conflicts with shifts
timeOffRequestSchema.methods.conflictsWithShifts = async function() {
  const Shift = mongoose.model('Shift');
  
  const shifts = await Shift.find({
    assignedEmployeeId: this.employeeId,
    date: {
      $gte: this.startDate,
      $lte: this.endDate
    },
    status: { $in: ['scheduled', 'in-progress'] }
  });
  
  return shifts.length > 0;
};

// Static method to find time off requests by date range
timeOffRequestSchema.statics.findByDateRange = function(startDate, endDate, status = null) {
  const query = {
    startDate: { $lte: endDate },
    endDate: { $gte: startDate }
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query).populate('employeeId', 'name email role team');
};

// Static method to find pending time off requests
timeOffRequestSchema.statics.findPending = function() {
  return this.find({ status: 'pending' }).populate('employeeId', 'name email role team');
};

// Static method to find approved time off requests for an employee
timeOffRequestSchema.statics.findApprovedForEmployee = function(employeeId, startDate, endDate) {
  return this.find({
    employeeId,
    status: 'approved',
    startDate: { $lte: endDate },
    endDate: { $gte: startDate }
  });
};

// Static method to find time off requests by status and date range
timeOffRequestSchema.statics.findByStatusAndDateRange = function(status, startDate, endDate) {
  return this.find({
    status,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate }
  }).populate('employeeId', 'name email role team');
};

module.exports = mongoose.model('TimeOffRequest', timeOffRequestSchema);
