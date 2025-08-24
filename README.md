# Employee Daily Scheduler Backend

A comprehensive, production-ready backend system for managing employee schedules, shifts, time-off requests, and workforce analytics. Built with Node.js, Express.js, and MongoDB.

## 🚀 Features

- **Employee Management**: Complete CRUD operations with role-based access control
- **Shift Scheduling**: Create, assign, and manage shifts with conflict detection
- **Time-Off Management**: Submit, approve, and track time-off requests
- **Recurring Shifts**: Template-based recurring shift creation
- **Advanced Analytics**: Coverage analysis, conflict detection, workload analytics
- **JWT Authentication**: Secure role-based authorization system
- **Conflict Prevention**: Automatic detection of scheduling conflicts and overlaps
- **Performance Optimized**: Comprehensive database indexing strategy

## 🏗️ Architecture

```
├── models/           # MongoDB schemas with validation
├── controllers/      # Business logic and API handlers
├── routes/          # Express route definitions
├── middleware/      # Authentication, validation, error handling
├── scripts/         # Database seeding and utilities
└── server.js        # Main application entry point
```

## 📋 Requirements

- Node.js >= 16.0.0
- MongoDB >= 4.4
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd employee-scheduler-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/employee-scheduler
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=24h
   ```

4. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running on your system
   mongod
   ```

5. **Seed the database**
   ```bash
   npm run seed
   ```

6. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🗄️ Data Models

### Employee
- **Core Fields**: name, email, password, role, skills, team, location
- **Availability**: Weekly schedule with customizable time slots
- **Employment**: Type (full-time, part-time, contract, temporary) and max hours
- **Security**: Password hashing with bcrypt, JWT token management

### Shift
- **Scheduling**: Date, start/end times, duration calculation
- **Requirements**: Role and skill requirements for assignment
- **Assignment**: Employee assignment with conflict validation
- **Status**: scheduled, in-progress, completed, cancelled
- **Special Cases**: Overnight shift handling, break management

### TimeOffRequest
- **Request Details**: Start/end dates, reason, type (vacation, sick-leave, etc.)
- **Workflow**: Pending → Approved/Rejected with approval tracking
- **Validation**: Conflict detection with existing shifts
- **Flexibility**: Half-day support, emergency contact information

### RecurringShiftTemplate
- **Patterns**: Daily, weekly, monthly, custom repeat patterns
- **Assignment Management**: Max assignments with current count tracking
- **Flexibility**: Custom repeat days, intervals, date ranges

## 🔐 Authentication & Authorization

### JWT Token System
- **Token Format**: Bearer token in Authorization header
- **Expiration**: Configurable (default: 24 hours)
- **Refresh**: Token refresh endpoint for extended sessions

### Role-Based Access Control
- **Admin**: Full system access
- **Manager**: Team and location management
- **Supervisor**: Limited team oversight
- **Employee**: Self-service operations

### Permission Matrix
| Operation | Admin | Manager | Supervisor | Employee |
|-----------|-------|---------|------------|----------|
| View All Employees | ✅ | ✅ | ✅ | ❌ |
| Create Employee | ✅ | ✅ | ❌ | ❌ |
| Manage Shifts | ✅ | ✅ | ✅ | ❌ |
| Approve Time-Off | ✅ | ✅ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ❌ |

## 📊 Analytics & Aggregation

### Coverage Analytics
**Endpoint**: `GET /api/analytics/coverage`

**Pipeline**: Joins shifts, employees, and time-off data to compute:
- Daily coverage percentages by location/team
- Assigned vs. unassigned shift counts
- Role-based coverage breakdown
- Employee availability summary

**Use Case**: Identify staffing gaps and coverage needs

### Conflict Detection
**Endpoint**: `GET /api/analytics/conflicts`

**Pipeline**: Analyzes shift assignments for:
- Time overlaps within same day
- Employee double-booking
- Time-off conflicts with scheduled shifts
- Overnight shift boundary issues

**Use Case**: Prevent scheduling conflicts and ensure compliance

### Workload Analytics
**Endpoint**: `GET /api/analytics/workload`

**Pipeline**: Employee performance metrics:
- Hours worked vs. capacity
- Shift distribution patterns
- Overnight and weekend shift counts
- Utilization percentages

**Use Case**: Balance workload and prevent burnout

## 🗂️ Database Indexing Strategy

### Employee Collection
```javascript
// Single field indexes
{ email: 1 }                    // Unique email lookups
{ role: 1 }                     // Role-based filtering
{ team: 1 }                     // Team-based queries
{ location: 1 }                 // Location-based queries
{ isActive: 1 }                 // Active employee filtering

// Compound indexes for common query patterns
{ role: 1, team: 1, location: 1 }           // Role + team + location
{ team: 1, location: 1, isActive: 1 }       // Team + location + status
{ skills: 1, location: 1, isActive: 1 }     // Skills + location + status
```

### Shift Collection
```javascript
// Single field indexes
{ date: 1 }                     // Date-based queries
{ location: 1 }                 // Location filtering
{ team: 1 }                     // Team filtering
{ assignedEmployeeId: 1 }       // Employee shift lookups

// Compound indexes for optimal performance
{ date: 1, location: 1 }                    // Daily schedule by location
{ date: 1, team: 1 }                       // Daily schedule by team
{ assignedEmployeeId: 1, date: 1 }         // Employee schedule
{ status: 1, date: 1 }                     // Status-based date queries
```

### TimeOffRequest Collection
```javascript
// Single field indexes
{ employeeId: 1 }               // Employee time-off lookups
{ status: 1 }                   // Status-based filtering
{ startDate: 1 }                // Start date queries
{ endDate: 1 }                  // End date queries

// Compound indexes for range queries
{ employeeId: 1, startDate: 1, endDate: 1 } // Employee date range
{ status: 1, startDate: 1, endDate: 1 }     // Status + date range
```

## ⚠️ Conflict Detection Logic

### Shift Conflicts
1. **Time Overlap Detection**
   ```javascript
   // Check if shifts overlap on the same day
   const overlaps = (start1 < end2) && (start2 < end1)
   ```

2. **Overnight Shift Handling**
   ```javascript
   // Adjust end time for overnight shifts
   if (endTime < startTime) {
     endTime.setDate(endTime.getDate() + 1)
   }
   ```

3. **Employee Availability Check**
   ```javascript
   // Verify employee is available on shift day
   const isAvailable = employee.availability[dayOfWeek].available
   ```

### Time-Off Conflicts
1. **Shift Overlap Prevention**
   ```javascript
   // Block time-off if employee has scheduled shifts
   const hasConflicts = await Shift.find({
     assignedEmployeeId: employeeId,
     date: { $gte: startDate, $lte: endDate },
     status: { $in: ['scheduled', 'in-progress'] }
   })
   ```

2. **Existing Time-Off Validation**
   ```javascript
   // Prevent overlapping approved time-off
   const existingTimeOff = await TimeOffRequest.find({
     employeeId,
     status: 'approved',
     startDate: { $lte: endDate },
     endDate: { $gte: startDate }
   })
   ```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Employee registration
- `POST /api/auth/login` - Employee login
- `GET /api/auth/profile` - Get current profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Employees
- `GET /api/employees` - List employees with filtering
- `POST /api/employees` - Create new employee
- `GET /api/employees/:id` - Get employee details
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Deactivate employee
- `GET /api/employees/:id/workload` - Get workload summary

### Shifts
- `GET /api/shifts` - List shifts with filtering
- `POST /api/shifts` - Create new shift
- `GET /api/shifts/:id` - Get shift details
- `PUT /api/shifts/:id` - Update shift
- `PUT /api/shifts/:id/assign` - Assign shift to employee
- `DELETE /api/shifts/:id` - Delete shift
- `GET /api/shifts/daily/:date` - Get daily schedule
- `GET /api/shifts/unassigned` - Get unassigned shifts

### Time-Off Requests
- `GET /api/time-off` - List time-off requests
- `POST /api/time-off` - Submit time-off request
- `GET /api/time-off/:id` - Get request details
- `PUT /api/time-off/:id` - Update request
- `PUT /api/time-off/:id/approve` - Approve/reject request
- `PUT /api/time-off/:id/cancel` - Cancel request
- `GET /api/time-off/pending` - Get pending requests

### Analytics
- `GET /api/analytics/coverage` - Coverage analysis
- `GET /api/analytics/conflicts` - Conflict detection
- `GET /api/analytics/workload` - Workload analytics
- `GET /api/analytics/utilization` - Utilization summary

## 📝 Example Requests

### Create Employee
```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@company.com",
    "password": "SecurePass123!",
    "role": "employee",
    "skills": ["JavaScript", "React"],
    "team": "Engineering",
    "location": "New York Office",
    "employmentType": "full-time"
  }'
```

### Create Shift
```bash
curl -X POST http://localhost:3000/api/shifts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "startTime": "09:00",
    "endTime": "17:00",
    "roleRequirement": "employee",
    "skillRequirements": ["JavaScript"],
    "location": "New York Office",
    "team": "Engineering"
  }'
```

### Submit Time-Off Request
```bash
curl -X POST http://localhost:3000/api/time-off \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-02-01",
    "endDate": "2024-02-05",
    "reason": "Family vacation",
    "requestType": "vacation"
  }'
```

### Get Coverage Analytics
```bash
curl -X GET "http://localhost:3000/api/analytics/coverage?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Test Coverage
```bash
npm run test:coverage
```

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Variables
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-production-secret
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://yourdomain.com
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Performance Considerations

### Database Optimization
- **Index Strategy**: Compound indexes for common query patterns
- **Aggregation Pipelines**: Efficient data processing for analytics
- **Connection Pooling**: Optimized MongoDB connections

### API Performance
- **Pagination**: Limit result sets for large queries
- **Caching**: Redis integration for frequently accessed data
- **Rate Limiting**: Prevent API abuse

### Monitoring
- **Health Checks**: `/health` endpoint for system status
- **Logging**: Comprehensive request and error logging
- **Metrics**: Performance monitoring and alerting

## 🔒 Security Features

- **Password Hashing**: bcrypt with configurable rounds
- **JWT Security**: Secure token management with expiration
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configurable cross-origin restrictions
- **Helmet Security**: Security headers and middleware
- **Rate Limiting**: API abuse prevention

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the example requests

## 🔄 Changelog

### v1.0.0
- Initial release with complete employee scheduling system
- JWT authentication and role-based authorization
- Comprehensive conflict detection and prevention
- Advanced analytics and reporting capabilities
- Production-ready codebase with comprehensive testing
