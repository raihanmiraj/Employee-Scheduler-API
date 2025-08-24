const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const TimeOffRequest = require('../models/TimeOffRequest');
const RecurringShiftTemplate = require('../models/RecurringShiftTemplate');

// Sample data
const teams = [
  'Engineering',
  'Sales',
  'Marketing',
  'Customer Support',
  'Operations',
  'Finance',
  'Human Resources',
  'Product Management'
];

const locations = [
  'New York Office',
  'San Francisco Office',
  'London Office',
  'Tokyo Office',
  'Remote',
  'Hybrid'
];

const skills = [
  'JavaScript',
  'Python',
  'React',
  'Node.js',
  'MongoDB',
  'AWS',
  'Sales',
  'Marketing',
  'Customer Service',
  'Project Management',
  'Data Analysis',
  'UI/UX Design',
  'DevOps',
  'Quality Assurance',
  'Business Development'
];

const roles = ['admin', 'manager', 'supervisor', 'employee'];

const employmentTypes = ['full-time', 'part-time', 'contract', 'temporary'];

const timeOffTypes = ['vacation', 'sick-leave', 'personal', 'bereavement', 'jury-duty', 'other'];

// Generate random availability
const generateAvailability = () => {
  const availability = {};
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  days.forEach(day => {
    if (['saturday', 'sunday'].includes(day)) {
      availability[day] = {
        start: '09:00',
        end: '17:00',
        available: Math.random() > 0.7 // 30% chance of weekend availability
      };
    } else {
      availability[day] = {
        start: '09:00',
        end: '17:00',
        available: Math.random() > 0.1 // 90% chance of weekday availability
      };
    }
  });
  
  return availability;
};

// Generate random skills
const generateSkills = () => {
  const numSkills = Math.floor(Math.random() * 4) + 2; // 2-5 skills
  const shuffled = skills.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numSkills);
};

// Generate random employee data
const generateEmployees = () => {
  const employees = [];
  
  // Create admin user
  employees.push({
    name: 'Admin User',
    email: 'admin@company.com',
    password: 'Admin123!',
    role: 'admin',
    skills: ['Project Management', 'Business Development'],
    team: 'Operations',
    location: 'New York Office',
    availability: generateAvailability(),
    employmentType: 'full-time',
    maxHoursPerWeek: 40,
    isActive: true
  });

  // Create manager users
  for (let i = 1; i <= 8; i++) {
    employees.push({
      name: `Manager ${i}`,
      email: `manager${i}@company.com`,
      password: 'Manager123!',
      role: 'manager',
      skills: generateSkills(),
      team: teams[i - 1] || teams[0],
      location: locations[Math.floor(Math.random() * locations.length)],
      availability: generateAvailability(),
      employmentType: 'full-time',
      maxHoursPerWeek: 40,
      isActive: true
    });
  }

  // Create supervisor users
  for (let i = 1; i <= 15; i++) {
    employees.push({
      name: `Supervisor ${i}`,
      email: `supervisor${i}@company.com`,
      password: 'Supervisor123!',
      role: 'supervisor',
      skills: generateSkills(),
      team: teams[Math.floor(Math.random() * teams.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      availability: generateAvailability(),
      employmentType: Math.random() > 0.2 ? 'full-time' : 'part-time',
      maxHoursPerWeek: Math.random() > 0.2 ? 40 : 20,
      isActive: true
    });
  }

  // Create regular employees
  for (let i = 1; i <= 50; i++) {
    employees.push({
      name: `Employee ${i}`,
      email: `employee${i}@company.com`,
      password: 'Employee123!',
      role: 'employee',
      skills: generateSkills(),
      team: teams[Math.floor(Math.random() * teams.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      availability: generateAvailability(),
      employmentType: employmentTypes[Math.floor(Math.random() * employmentTypes.length)],
      maxHoursPerWeek: Math.random() > 0.3 ? 40 : (Math.random() > 0.5 ? 30 : 20),
      isActive: Math.random() > 0.1 // 90% chance of being active
    });
  }

  return employees;
};

// Generate random shifts
const generateShifts = (employees) => {
  const shifts = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Start from 30 days ago
  
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30); // End 30 days from now
  
  const activeEmployees = employees.filter(emp => emp.isActive && emp.role !== 'admin');
  
  // Generate shifts for each day
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    
    // Skip weekends for most shifts (but allow some)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (Math.random() > 0.3) continue; // 30% chance of weekend shifts
    }
    
    // Generate 5-15 shifts per day
    const numShifts = Math.floor(Math.random() * 11) + 5;
    
    for (let i = 0; i < numShifts; i++) {
      const startHour = Math.floor(Math.random() * 14) + 6; // 6 AM to 8 PM
      const duration = Math.floor(Math.random() * 6) + 4; // 4-10 hours
      const endHour = startHour + duration;
      
      // Handle overnight shifts
      let endTime, isOvernight;
      if (endHour >= 24) {
        endTime = `${(endHour - 24).toString().padStart(2, '0')}:00`;
        isOvernight = true;
      } else {
        endTime = `${endHour.toString().padStart(2, '0')}:00`;
        isOvernight = false;
      }
      
      const startTime = `${startHour.toString().padStart(2, '0')}:00`;
      
      // Randomly assign employee or leave unassigned
      const assignedEmployee = Math.random() > 0.2 ? 
        activeEmployees[Math.floor(Math.random() * activeEmployees.length)] : null;
      
      const shift = {
        date: new Date(d),
        startTime,
        endTime,
        roleRequirement: roles[Math.floor(Math.random() * roles.length)],
        skillRequirements: generateSkills().slice(0, 2), // 1-2 skill requirements
        assignedEmployeeId: assignedEmployee ? assignedEmployee._id : null,
        location: locations[Math.floor(Math.random() * locations.length)],
        team: teams[Math.floor(Math.random() * teams.length)],
        status: assignedEmployee ? 
          (Math.random() > 0.7 ? 'completed' : (Math.random() > 0.5 ? 'in-progress' : 'scheduled')) : 
          'scheduled',
        notes: Math.random() > 0.7 ? `Shift note ${Math.random().toString(36).substring(7)}` : '',
        isOvernight,
        breakDuration: Math.floor(Math.random() * 2), // 0-1 hour break
        hourlyRate: Math.floor(Math.random() * 30) + 15, // $15-$45 per hour
        createdBy: employees[0]._id // Admin user
      };
      
      shifts.push(shift);
    }
  }
  
  return shifts;
};

// Generate random time off requests
const generateTimeOffRequests = (employees) => {
  const timeOffRequests = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 90); // Future time off
  
  const regularEmployees = employees.filter(emp => emp.role === 'employee' && emp.isActive);
  
  // Generate 20-40 time off requests
  const numRequests = Math.floor(Math.random() * 21) + 20;
  
  for (let i = 0; i < numRequests; i++) {
    const employee = regularEmployees[Math.floor(Math.random() * regularEmployees.length)];
    
    // Random start date in the future
    const requestStart = new Date(startDate);
    requestStart.setDate(requestStart.getDate() + Math.floor(Math.random() * 60) + 1);
    
    // Random duration (1-14 days)
    const duration = Math.floor(Math.random() * 14) + 1;
    const requestEnd = new Date(requestStart);
    requestEnd.setDate(requestEnd.getDate() + duration - 1);
    
    const status = Math.random() > 0.3 ? 'approved' : 
                  (Math.random() > 0.5 ? 'pending' : 'rejected');
    
    const timeOffRequest = {
      employeeId: employee._id,
      startDate: requestStart,
      endDate: requestEnd,
      status,
      reason: `Time off request for ${timeOffTypes[Math.floor(Math.random() * timeOffTypes.length)]}`,
      requestType: timeOffTypes[Math.floor(Math.random() * timeOffTypes.length)],
      totalDays: duration,
      isHalfDay: Math.random() > 0.8, // 20% chance of half day
      halfDayType: Math.random() > 0.5 ? 'morning' : 'afternoon',
      notes: Math.random() > 0.6 ? `Additional notes for time off request ${i + 1}` : '',
      emergencyContact: Math.random() > 0.7 ? {
        name: `Emergency Contact ${i + 1}`,
        phone: `+1-555-${Math.random().toString().slice(2, 6)}-${Math.random().toString().slice(2, 6)}`,
        relationship: ['spouse', 'parent', 'sibling', 'friend'][Math.floor(Math.random() * 4)]
      } : undefined
    };
    
    if (status === 'approved') {
      timeOffRequest.approvedBy = employees[Math.floor(Math.random() * 8) + 1]._id; // Random manager
      timeOffRequest.approvedAt = new Date();
    } else if (status === 'rejected') {
      timeOffRequest.rejectionReason = 'Business needs require your presence during this period';
    }
    
    timeOffRequests.push(timeOffRequest);
  }
  
  return timeOffRequests;
};

// Generate recurring shift templates
const generateRecurringShiftTemplates = (employees) => {
  const templates = [];
  const managers = employees.filter(emp => emp.role === 'manager' && emp.isActive);
  
  // Daily morning shift template
  templates.push({
    name: 'Morning Shift Template',
    description: 'Standard morning shift for customer support',
    roleRequirement: 'employee',
    skillRequirements: ['Customer Service'],
    startTime: '09:00',
    endTime: '17:00',
    repeatPattern: 'daily',
    startDate: new Date(),
    location: 'New York Office',
    team: 'Customer Support',
    maxAssignments: 3,
    currentAssignments: 0,
    notes: 'Standard morning shift template',
    createdBy: managers[0]._id
  });
  
  // Weekly weekend template
  templates.push({
    name: 'Weekend Shift Template',
    description: 'Weekend coverage for essential services',
    roleRequirement: 'supervisor',
    skillRequirements: ['Customer Service', 'Project Management'],
    startTime: '10:00',
    endTime: '18:00',
    repeatPattern: 'weekly',
    repeatDays: ['saturday', 'sunday'],
    startDate: new Date(),
    location: 'San Francisco Office',
    team: 'Operations',
    maxAssignments: 2,
    currentAssignments: 0,
    notes: 'Weekend coverage template',
    createdBy: managers[1]._id
  });
  
  // Monthly maintenance template
  templates.push({
    name: 'Monthly Maintenance Template',
    description: 'Monthly system maintenance shift',
    roleRequirement: 'employee',
    skillRequirements: ['DevOps', 'Quality Assurance'],
    startTime: '22:00',
    endTime: '06:00',
    repeatPattern: 'monthly',
    startDate: new Date(),
    location: 'Remote',
    team: 'Engineering',
    maxAssignments: 1,
    currentAssignments: 0,
    notes: 'Monthly overnight maintenance window',
    createdBy: managers[2]._id
  });
  
  return templates;
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/employee-scheduler');
    console.log('Connected to MongoDB');
    
    // Clear existing data
    console.log('Clearing existing data...');
    await Employee.deleteMany({});
    await Shift.deleteMany({});
    await TimeOffRequest.deleteMany({});
    await RecurringShiftTemplate.deleteMany({});
    console.log('Existing data cleared');
    
    // Generate and insert employees
    console.log('Generating employees...');
    const employeeData = generateEmployees();
    const employees = await Employee.insertMany(employeeData);
    console.log(`${employees.length} employees created`);
    
    // Generate and insert shifts
    console.log('Generating shifts...');
    const shiftData = generateShifts(employees);
    const shifts = await Shift.insertMany(shiftData);
    console.log(`${shifts.length} shifts created`);
    
    // Generate and insert time off requests
    console.log('Generating time off requests...');
    const timeOffData = generateTimeOffRequests(employees);
    const timeOffRequests = await TimeOffRequest.insertMany(timeOffData);
    console.log(`${timeOffRequests.length} time off requests created`);
    
    // Generate and insert recurring shift templates
    console.log('Generating recurring shift templates...');
    const templateData = generateRecurringShiftTemplates(employees);
    const templates = await RecurringShiftTemplate.insertMany(templateData);
    console.log(`${templates.length} recurring shift templates created`);
    
    // Create indexes for optimal performance
    console.log('Creating database indexes...');
    await Employee.createIndexes();
    await Shift.createIndexes();
    await TimeOffRequest.createIndexes();
    await RecurringShiftTemplate.createIndexes();
    console.log('Database indexes created');
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • ${employees.length} employees`);
    console.log(`   • ${shifts.length} shifts`);
    console.log(`   • ${timeOffRequests.length} time off requests`);
    console.log(`   • ${templates.length} recurring shift templates`);
    
    console.log('\n🔑 Default login credentials:');
    console.log('   • Admin: admin@company.com / Admin123!');
    console.log('   • Manager: manager1@company.com / Manager123!');
    console.log('   • Employee: employee1@company.com / Employee123!');
    
    console.log('\n🚀 You can now start the server and test the API endpoints!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
