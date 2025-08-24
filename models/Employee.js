const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Employee name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long']
  },
  role: {
    type: String,
    required: [true, 'Employee role is required'],
    enum: ['manager', 'supervisor', 'employee', 'admin'],
    default: 'employee'
  },
  skills: [{
    type: String,
    required: true,
    trim: true
  }],
  team: {
    type: String,
    required: [true, 'Team assignment is required'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Work location is required'],
    trim: true
  },
  availability: {
    monday: { start: String, end: String, available: { type: Boolean, default: true } },
    tuesday: { start: String, end: String, available: { type: Boolean, default: true } },
    wednesday: { start: String, end: String, available: { type: Boolean, default: true } },
    thursday: { start: String, end: String, available: { type: Boolean, default: true } },
    friday: { start: String, end: String, available: { type: Boolean, default: true } },
    saturday: { start: String, end: String, available: { type: Boolean, default: false } },
    sunday: { start: String, end: String, available: { type: Boolean, default: false } }
  },
  employmentType: {
    type: String,
    required: [true, 'Employment type is required'],
    enum: ['full-time', 'part-time', 'contract', 'temporary'],
    default: 'full-time'
  },
  maxHoursPerWeek: {
    type: Number,
    default: 40,
    min: [0, 'Max hours cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  hireDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for total skills count
employeeSchema.virtual('skillsCount').get(function() {
  return Array.isArray(this.skills) ? this.skills.length : 0;
});

// Indexes for optimal query performance
employeeSchema.index({ email: 1 });
employeeSchema.index({ role: 1 });
employeeSchema.index({ team: 1 });
employeeSchema.index({ location: 1 });
employeeSchema.index({ isActive: 1 });
employeeSchema.index({ 'availability.monday.available': 1 });
employeeSchema.index({ 'availability.tuesday.available': 1 });
employeeSchema.index({ 'availability.wednesday.available': 1 });
employeeSchema.index({ 'availability.thursday.available': 1 });
employeeSchema.index({ 'availability.friday.available': 1 });
employeeSchema.index({ 'availability.saturday.available': 1 });
employeeSchema.index({ 'availability.sunday.available': 1 });

// Compound indexes for common query performance
employeeSchema.index({ role: 1, team: 1, location: 1 });
employeeSchema.index({ team: 1, location: 1, isActive: 1 });
employeeSchema.index({ skills: 1, location: 1, isActive: 1 });

// Pre-save middleware to hash password
employeeSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
employeeSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if employee is available on a specific day
employeeSchema.methods.isAvailableOnDay = function(dayOfWeek) {
  const day = dayOfWeek.toLowerCase();
  return this.availability[day] && this.availability[day].available;
};
// Method to get availability for a specific day
employeeSchema.methods.getDayAvailability = function(dayOfWeek) {
  const day = dayOfWeek.toLowerCase();
  return this.availability[day] || null;
};

// Static method to find employees by role and location
employeeSchema.statics.findByRoleAndLocation = function(role, location) {
  return this.find({ role, location, isActive: true });
};

// Static method to find employees by skills
employeeSchema.statics.findBySkills = function(skills) {
  return this.find({ 
    skills: { $in: skills }, 
    isActive: true 
  });
};

// Static method to find available employees for a specific day
employeeSchema.statics.findAvailableForDay = function(dayOfWeek) {
  const day = dayOfWeek.toLowerCase();
  return this.find({ 
    [`availability.${day}.available`]: true, 
    isActive: true 
  });
};

module.exports = mongoose.model('Employee', employeeSchema);
