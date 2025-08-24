const Shift = require('../models/Shift');
const Employee = require('../models/Employee');
const TimeOffRequest = require('../models/TimeOffRequest');
const { BusinessLogicError } = require('../middleware/errorHandler');

// @desc    Get coverage analytics for a date range
// @route   GET /api/analytics/coverage
// @access  Private (managers, supervisors, admin)
const getCoverageAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, location, team } = req.query;

    if (!startDate || !endDate) {
      throw new BusinessLogicError('Start date and end date are required', 400, 'MISSING_PARAMETERS');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new BusinessLogicError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
    }

    // Build match conditions
    const matchConditions = {
      date: { $gte: start, $lte: end },
      status: { $in: ['scheduled', 'in-progress', 'completed'] }
    };

    if (location) matchConditions.location = location;
    if (team) matchConditions.team = team;

    // Aggregation pipeline for coverage analysis
    const coveragePipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'employees',
          localField: 'assignedEmployeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            location: '$location',
            team: '$team',
            roleRequirement: '$roleRequirement'
          },
          totalShifts: { $sum: 1 },
          totalHours: { $sum: '$duration' },
          assignedShifts: { $sum: { $cond: [{ $ne: ['$assignedEmployeeId', null] }, 1, 0] } },
          unassignedShifts: { $sum: { $cond: [{ $eq: ['$assignedEmployeeId', null] }, 1, 0] } },
          assignedHours: { $sum: { $cond: [{ $ne: ['$assignedEmployeeId', null] }, '$duration', 0] } },
          unassignedHours: { $sum: { $cond: [{ $eq: ['$assignedEmployeeId', null] }, '$duration', 0] } }
        }
      },
      {
        $group: {
          _id: {
            date: '$_id.date',
            location: '$_id.location',
            team: '$_id.team'
          },
          roles: {
            $push: {
              role: '$_id.roleRequirement',
              totalShifts: '$totalShifts',
              totalHours: '$totalHours',
              assignedShifts: '$assignedShifts',
              unassignedShifts: '$unassignedShifts',
              assignedHours: '$assignedHours',
              unassignedHours: '$unassignedHours'
            }
          },
          totalShifts: { $sum: '$totalShifts' },
          totalHours: { $sum: '$totalHours' },
          assignedShifts: { $sum: '$assignedShifts' },
          unassignedShifts: { $sum: '$unassignedShifts' },
          assignedHours: { $sum: '$assignedHours' },
          unassignedHours: { $sum: '$unassignedHours' }
        }
      },
      {
        $addFields: {
          coveragePercentage: {
            $multiply: [
              { $divide: ['$assignedShifts', { $max: ['$totalShifts', 1] }] },
              100
            ]
          },
          hoursCoveragePercentage: {
            $multiply: [
              { $divide: ['$assignedHours', { $max: ['$totalHours', 1] }] },
              100
            ]
          }
        }
      },
      { $sort: { '_id.date': 1, '_id.location': 1, '_id.team': 1 } }
    ];

    const coverageData = await Shift.aggregate(coveragePipeline);

    // Get employee availability data
    const employeeAvailabilityPipeline = [
      {
        $match: {
          isActive: true,
          ...(location && { location }),
          ...(team && { team })
        }
      },
      {
        $project: {
          name: 1,
          role: 1,
          team: 1,
          location: 1,
          skills: 1,
          maxHoursPerWeek: 1,
          availability: 1
        }
      }
    ];

    const employees = await Employee.aggregate(employeeAvailabilityPipeline);

    // Calculate summary statistics
    const summary = {
      dateRange: { start: startDate, end: endDate },
      totalShifts: coverageData.reduce((sum, item) => sum + item.totalShifts, 0),
      totalHours: coverageData.reduce((sum, item) => sum + item.totalHours, 0),
      assignedShifts: coverageData.reduce((sum, item) => sum + item.assignedShifts, 0),
      unassignedShifts: coverageData.reduce((sum, item) => sum + item.unassignedShifts, 0),
      assignedHours: coverageData.reduce((sum, item) => sum + item.assignedHours, 0),
      unassignedHours: coverageData.reduce((sum, item) => sum + item.unassignedHours, 0),
      totalEmployees: employees.length,
      activeEmployees: employees.filter(emp => emp.isActive).length
    };

    summary.coveragePercentage = summary.totalShifts > 0 ? 
      (summary.assignedShifts / summary.totalShifts) * 100 : 0;
    summary.hoursCoveragePercentage = summary.totalHours > 0 ? 
      (summary.assignedHours / summary.totalHours) * 100 : 0;

    res.json({
      success: true,
      data: {
        summary,
        dailyCoverage: coverageData,
        employees,
        filters: { location, team }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conflict detection analytics
// @route   GET /api/analytics/conflicts
// @access  Private (managers, supervisors, admin)
const getConflictAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, location, team } = req.query;

    if (!startDate || !endDate) {
      throw new BusinessLogicError('Start date and end date are required', 400, 'MISSING_PARAMETERS');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new BusinessLogicError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
    }

    // Build match conditions
    const matchConditions = {
      date: { $gte: start, $lte: end },
      status: { $in: ['scheduled', 'in-progress'] }
    };

    if (location) matchConditions.location = location;
    if (team) matchConditions.team = team;

    // Aggregation pipeline for conflict detection
    const conflictPipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'employees',
          localField: 'assignedEmployeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $group: {
          _id: '$assignedEmployeeId',
          employeeName: { $first: '$employee.name' },
          employeeEmail: { $first: '$employee.email' },
          employeeRole: { $first: '$employee.role' },
          shifts: {
            $push: {
              id: '$_id',
              date: '$date',
              startTime: '$startTime',
              endTime: '$endTime',
              duration: '$duration',
              location: '$location',
              team: '$team'
            }
          },
          totalShifts: { $sum: 1 },
          totalHours: { $sum: '$duration' }
        }
      },
      {
        $match: {
          totalShifts: { $gt: 1 }
        }
      },
      {
        $addFields: {
          conflicts: {
            $filter: {
              input: '$shifts',
              as: 'shift',
              cond: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: '$shifts',
                        as: 'otherShift',
                        cond: {
                          $and: [
                            { $ne: ['$$shift.id', '$$otherShift.id'] },
                            { $eq: ['$$shift.date', '$$otherShift.date'] },
                            {
                              $or: [
                                {
                                  $and: [
                                    { $lte: ['$$shift.startTime', '$$otherShift.startTime'] },
                                    { $gt: ['$$shift.endTime', '$$otherShift.startTime'] }
                                  ]
                                },
                                {
                                  $and: [
                                    { $lte: ['$$otherShift.startTime', '$$shift.startTime'] },
                                    { $gt: ['$$otherShift.endTime', '$$shift.startTime'] }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  0
                ]
              }
            }
          }
        }
      },
      {
        $match: {
          'conflicts.0': { $exists: true }
        }
      },
      {
        $addFields: {
          conflictCount: { $size: '$conflicts' },
          conflictHours: {
            $sum: {
              $map: {
                input: '$conflicts',
                as: 'conflict',
                in: '$$conflict.duration'
              }
            }
          }
        }
      },
      { $sort: { conflictCount: -1, totalHours: -1 } }
    ];

    const conflictData = await Shift.aggregate(conflictPipeline);

    // Get time off conflicts
    const timeOffConflictPipeline = [
      {
        $match: {
          status: 'approved',
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      },
      {
        $lookup: {
          from: 'shifts',
          let: { employeeId: '$employeeId', startDate: '$startDate', endDate: '$endDate' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$assignedEmployeeId', '$$employeeId'] },
                    { $gte: ['$date', '$$startDate'] },
                    { $lte: ['$date', '$$endDate'] },
                    { $in: ['$status', ['scheduled', 'in-progress']] }
                  ]
                }
              }
            }
          ],
          as: 'conflictingShifts'
        }
      },
      {
        $match: {
          'conflictingShifts.0': { $exists: true }
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $project: {
          employeeName: '$employee.name',
          employeeEmail: '$employee.email',
          startDate: 1,
          endDate: 1,
          requestType: 1,
          conflictingShifts: 1,
          conflictCount: { $size: '$conflictingShifts' }
        }
      }
    ];

    const timeOffConflicts = await TimeOffRequest.aggregate(timeOffConflictPipeline);

    // Calculate summary statistics
    const summary = {
      dateRange: { start: startDate, end: endDate },
      totalConflicts: conflictData.reduce((sum, item) => sum + item.conflictCount, 0),
      totalConflictHours: conflictData.reduce((sum, item) => sum + item.conflictHours, 0),
      employeesWithConflicts: conflictData.length,
      timeOffConflicts: timeOffConflicts.length,
      totalTimeOffConflictShifts: timeOffConflicts.reduce((sum, item) => sum + item.conflictCount, 0)
    };

    res.json({
      success: true,
      data: {
        summary,
        shiftConflicts: conflictData,
        timeOffConflicts,
        filters: { location, team }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employee workload analytics
// @route   GET /api/analytics/workload
// @access  Private (managers, supervisors, admin)
const getWorkloadAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, location, team, role } = req.query;

    if (!startDate || !endDate) {
      throw new BusinessLogicError('Start date and end date are required', 400, 'MISSING_PARAMETERS');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new BusinessLogicError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
    }

    // Build match conditions
    const matchConditions = {
      date: { $gte: start, $lte: end },
      status: { $in: ['scheduled', 'in-progress', 'completed'] }
    };

    if (location) matchConditions.location = location;
    if (team) matchConditions.team = team;
    if (role) matchConditions.roleRequirement = role;

    // Aggregation pipeline for workload analysis
    const workloadPipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'employees',
          localField: 'assignedEmployeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $group: {
          _id: '$assignedEmployeeId',
          employeeName: { $first: '$employee.name' },
          employeeEmail: { $first: '$employee.email' },
          employeeRole: { $first: '$employee.role' },
          employeeTeam: { $first: '$employee.team' },
          employeeLocation: { $first: '$employee.location' },
          maxHoursPerWeek: { $first: '$employee.maxHoursPerWeek' },
          totalShifts: { $sum: 1 },
          totalHours: { $sum: '$duration' },
          averageShiftDuration: { $avg: '$duration' },
          overnightShifts: { $sum: { $cond: ['$isOvernight', 1, 0] } },
          weekendShifts: {
            $sum: {
              $cond: [
                { $in: [{ $dayOfWeek: '$date' }, [1, 7]] }, // Sunday = 1, Saturday = 7
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          averageHoursPerWeek: {
            $divide: [
              '$totalHours',
              { $ceil: { $divide: [{ $subtract: [end, start] }, 1000 * 60 * 60 * 24 * 7] } }
            ]
          },
          utilizationPercentage: {
            $multiply: [
              {
                $divide: [
                  '$averageHoursPerWeek',
                  { $max: ['$maxHoursPerWeek', 1] }
                ]
              },
              100
            ]
          }
        }
      },
      { $sort: { totalHours: -1 } }
    ];

    const workloadData = await Shift.aggregate(workloadPipeline);

    // Get time off data for workload context
    const timeOffPipeline = [
      {
        $match: {
          status: 'approved',
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      },
      {
        $group: {
          _id: '$employeeId',
          totalTimeOffDays: { $sum: '$totalDays' }
        }
      }
    ];

    const timeOffData = await TimeOffRequest.aggregate(timeOffPipeline);

    // Merge time off data with workload data
    const enrichedWorkloadData = workloadData.map(employee => {
      const timeOff = timeOffData.find(t => t._id.toString() === employee._id.toString());
      return {
        ...employee,
        totalTimeOffDays: timeOff ? timeOff.totalTimeOffDays : 0,
        adjustedUtilizationPercentage: employee.maxHoursPerWeek > 0 ? 
          Math.min(100, (employee.averageHoursPerWeek / employee.maxHoursPerWeek) * 100) : 0
      };
    });

    // Calculate summary statistics
    const summary = {
      dateRange: { start: startDate, end: endDate },
      totalEmployees: enrichedWorkloadData.length,
      totalHours: enrichedWorkloadData.reduce((sum, emp) => sum + emp.totalHours, 0),
      totalShifts: enrichedWorkloadData.reduce((sum, emp) => sum + emp.totalShifts, 0),
      averageHoursPerEmployee: enrichedWorkloadData.length > 0 ? 
        enrichedWorkloadData.reduce((sum, emp) => sum + emp.totalHours, 0) / enrichedWorkloadData.length : 0,
      employeesOverUtilized: enrichedWorkloadData.filter(emp => emp.utilizationPercentage > 100).length,
      employeesUnderUtilized: enrichedWorkloadData.filter(emp => emp.utilizationPercentage < 50).length
    };

    res.json({
      success: true,
      data: {
        summary,
        employeeWorkloads: enrichedWorkloadData,
        filters: { location, team, role }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get utilization summary
// @route   GET /api/analytics/utilization
// @access  Private (managers, supervisors, admin)
const getUtilizationSummary = async (req, res, next) => {
  try {
    const { startDate, endDate, location, team } = req.query;

    if (!startDate || !endDate) {
      throw new BusinessLogicError('Start date and end date are required', 400, 'MISSING_PARAMETERS');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new BusinessLogicError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
    }

    // Build match conditions
    const matchConditions = {
      date: { $gte: start, $lte: end },
      status: { $in: ['scheduled', 'in-progress', 'completed'] }
    };

    if (location) matchConditions.location = location;
    if (team) matchConditions.team = team;

    // Aggregation pipeline for utilization summary
    const utilizationPipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'employees',
          localField: 'assignedEmployeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            location: '$location',
            team: '$team',
            role: '$employee.role'
          },
          totalHours: { $sum: '$duration' },
          totalShifts: { $sum: 1 },
          uniqueEmployees: { $addToSet: '$assignedEmployeeId' }
        }
      },
      {
        $addFields: {
          employeeCount: { $size: '$uniqueEmployees' },
          averageHoursPerEmployee: {
            $cond: [
              { $gt: ['$employeeCount', 0] },
              { $divide: ['$totalHours', '$employeeCount'] },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            date: '$_id.date',
            location: '$_id.location',
            team: '$_id.team'
          },
          roles: {
            $push: {
              role: '$_id.role',
              totalHours: '$totalHours',
              totalShifts: '$totalShifts',
              employeeCount: '$employeeCount',
              averageHoursPerEmployee: '$averageHoursPerEmployee'
            }
          },
          totalHours: { $sum: '$totalHours' },
          totalShifts: { $sum: '$totalShifts' },
          totalEmployees: { $sum: '$employeeCount' }
        }
      },
      {
        $addFields: {
          averageHoursPerEmployee: {
            $cond: [
              { $gt: ['$totalEmployees', 0] },
              { $divide: ['$totalHours', '$totalEmployees'] },
              0
            ]
          }
        }
      },
      { $sort: { '_id.date': 1, '_id.location': 1, '_id.team': 1 } }
    ];

    const utilizationData = await Shift.aggregate(utilizationPipeline);

    // Get employee capacity data
    const capacityPipeline = [
      {
        $match: {
          isActive: true,
          ...(location && { location }),
          ...(team && { team })
        }
      },
      {
        $group: {
          _id: {
            location: '$location',
            team: '$team',
            role: '$role'
          },
          employeeCount: { $sum: 1 },
          totalCapacity: { $sum: '$maxHoursPerWeek' }
        }
      }
    ];

    const capacityData = await Employee.aggregate(capacityPipeline);

    // Calculate summary statistics
    const summary = {
      dateRange: { start: startDate, end: endDate },
      totalHours: utilizationData.reduce((sum, item) => sum + item.totalHours, 0),
      totalShifts: utilizationData.reduce((sum, item) => sum + item.totalShifts, 0),
      totalEmployees: utilizationData.reduce((sum, item) => sum + item.totalEmployees, 0),
      averageHoursPerEmployee: utilizationData.length > 0 ? 
        utilizationData.reduce((sum, item) => sum + item.averageHoursPerEmployee, 0) / utilizationData.length : 0
    };

    res.json({
      success: true,
      data: {
        summary,
        dailyUtilization: utilizationData,
        capacityData,
        filters: { location, team }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCoverageAnalytics,
  getConflictAnalytics,
  getWorkloadAnalytics,
  getUtilizationSummary
};
