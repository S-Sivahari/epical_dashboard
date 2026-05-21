import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { TimesheetModel } from '../models/Timesheet';
import { ProjectModel } from '../models/Project';

const MOCK_EMPLOYEES = [
  { id: 'E-1001', name: 'Asha Menon', department: 'Design', hue: 155 },
  { id: 'E-1002', name: 'Rahul Verma', department: 'Verification', hue: 210 },
  { id: 'E-1003', name: 'Meera Nair', department: 'Hardware', hue: 335 },
  { id: 'E-1004', name: 'Amit Patel', department: 'R&D', hue: 35 },
  { id: 'E-1005', name: 'Priya Das', department: 'Operations', hue: 270 },
  { id: 'E-1006', name: 'Kiran Rao', department: 'Design', hue: 190 },
  { id: 'E-1007', name: 'Sneha Iyer', department: 'Verification', hue: 10 },
  { id: 'E-1008', name: 'Vikram Singh', department: 'R&D', hue: 60 },
];

// Helper to compute total hours
function computeTotalHours(loginTime: Date, logoutTime?: Date, overriddenHours?: number): number {
  if (overriddenHours !== undefined && overriddenHours !== null) {
    return Number(overriddenHours);
  }
  if (!logoutTime) return 0;
  const diffMs = logoutTime.getTime() - loginTime.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}

// Helper to map Mongoose timesheet log to frontend format
function toFrontendTimesheet(t: any) {
  const dateOnly = t.loginTime ? new Date(t.loginTime).toISOString().split('T')[0] : '';
  return {
    id: t._id.toString(),
    employeeId: t.employeeId,
    employeeName: t.employee,
    project: t.project,
    client: t.client || '',
    technologyNode: t.technologyNode || '',
    date: dateOnly,
    loginTime: t.loginTime ? t.loginTime.toISOString() : '',
    logoutTime: t.logoutTime ? t.logoutTime.toISOString() : undefined,
    correctionRequest: t.correctionRequest && t.correctionRequest.requestedLogin ? {
      requestedLogin: t.correctionRequest.requestedLogin.toISOString(),
      requestedLogout: t.correctionRequest.requestedLogout ? t.correctionRequest.requestedLogout.toISOString() : '',
      reason: t.correctionRequest.reason || '',
      message: t.correctionRequest.message || '',
    } : undefined,
    requestStatus: t.requestStatus || 'No Request',
    status: t.status || 'Pending',
    billable: t.billable !== undefined ? t.billable : true,
    task: t.task || '',
    adminNotes: t.adminNotes,
    overriddenHours: t.overriddenHours,
    taskStatus: t.taskStatus || 'Pending',
  };
}

// Helper to update project completion status based on task logs
async function syncProjectStatus(projectName: string): Promise<void> {
  if (!projectName) return;
  const timesheets = await TimesheetModel.find({ project: projectName });
  if (timesheets.length === 0) {
    await ProjectModel.findOneAndUpdate({ projectName }, { status: 'Active' });
    return;
  }
  const allCompleted = timesheets.every(t => t.status === 'Approved');
  const targetStatus = allCompleted ? 'Completed' : 'Active';
  await ProjectModel.findOneAndUpdate({ projectName }, { status: targetStatus });
}

// Helper to build matches for query filters
async function buildMatchStage(req: Request) {
  const { from, to, employee, project, team, status, search } = req.query;
  const match: any = {};

  if (from || to) {
    match.loginTime = {};
    if (from) {
      const startDate = new Date(from as string);
      startDate.setHours(0, 0, 0, 0);
      match.loginTime.$gte = startDate;
    }
    if (to) {
      const endDate = new Date(to as string);
      endDate.setHours(23, 59, 59, 999);
      match.loginTime.$lte = endDate;
    }
  }

  if (employee && employee !== 'all') {
    match.employee = employee;
  }

  if (project && project !== 'all') {
    match.project = project;
  }

  if (status && status !== 'all') {
    match.status = status;
  }


  if (search) {
    const searchRegex = new RegExp(search as string, 'i');
    match.$or = [
      { employee: searchRegex },
      { project: searchRegex },
      { task: searchRegex }
    ];
  }

  if (team && team !== 'all') {
    const dept = (team as string).replace(' Team', '');
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not active');
    }
    const employeesInDept = await db.collection('employees').find({ department: dept }).toArray();
    const employeeNames = employeesInDept.map(e => `${e.firstName} ${e.lastName}`);
    const mockNames = MOCK_EMPLOYEES.filter(e => e.department === dept).map(e => e.name);
    const allNames = Array.from(new Set([...employeeNames, ...mockNames]));
    match.employee = { $in: allNames };
  }

  return match;
}

export const timesheetController = {
  // GET /api/timesheets
  getAll: async (req: Request, res: Response): Promise<void> => {
    try {
      const match = await buildMatchStage(req);
      const entries = await TimesheetModel.find(match).sort({ loginTime: -1 });
      res.json(entries.map(toFrontendTimesheet));
    } catch (error) {
      console.error('Error fetching timesheets:', error);
      res.status(500).json({ error: 'Failed to fetch timesheets' });
    }
  },

  // GET /api/timesheets/hours-by-project
  getHoursByProject: async (req: Request, res: Response): Promise<void> => {
    try {
      const match = await buildMatchStage(req);
      const agg = [
        { $match: match },
        {
          $project: {
            project: 1,
            hours: {
              $cond: {
                if: {
                  $and: [
                    { $ne: [{ $type: "$overriddenHours" }, "missing"] },
                    { $ne: [{ $type: "$overriddenHours" }, "null"] },
                    { $ne: ["$overriddenHours", null] },
                    { $ne: ["$overriddenHours", "null"] }
                  ]
                },
                then: "$overriddenHours",
                else: {
                  $cond: {
                    if: { $and: ["$logoutTime", { $gt: ["$logoutTime", "$loginTime"] }] },
                    then: {
                      $divide: [
                        { $subtract: ["$logoutTime", "$loginTime"] },
                        3600000
                      ]
                    },
                    else: 0
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: "$project",
            totalHours: { $sum: "$hours" }
          }
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            hours: { $round: ["$totalHours", 1] }
          }
        },
        { $sort: { hours: -1 as const } }
      ];

      const results = await TimesheetModel.aggregate(agg);
      res.json(results);
    } catch (error) {
      console.error('Error compiling hours by project:', error);
      res.status(500).json({ error: 'Failed to compile project hours' });
    }
  },

  // GET /api/timesheets/employee-hours (leaderboard)
  getEmployeeHours: async (req: Request, res: Response): Promise<void> => {
    try {
      const match = await buildMatchStage(req);
      const agg = [
        { $match: match },
        {
          $project: {
            employee: 1,
            hours: {
              $cond: {
                if: {
                  $and: [
                    { $ne: [{ $type: "$overriddenHours" }, "missing"] },
                    { $ne: [{ $type: "$overriddenHours" }, "null"] },
                    { $ne: ["$overriddenHours", null] },
                    { $ne: ["$overriddenHours", "null"] }
                  ]
                },
                then: "$overriddenHours",
                else: {
                  $cond: {
                    if: { $and: ["$logoutTime", { $gt: ["$logoutTime", "$loginTime"] }] },
                    then: {
                      $divide: [
                        { $subtract: ["$logoutTime", "$loginTime"] },
                        3600000
                      ]
                    },
                    else: 0
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: "$employee",
            totalHours: { $sum: "$hours" }
          }
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            hours: { $round: ["$totalHours", 1] }
          }
        },
        { $sort: { hours: -1 as const } }
      ];

      const results = await TimesheetModel.aggregate(agg);
      
      const enhancedResults = await Promise.all(results.map(async (item) => {
        let dept = 'R&D';
        let hue = 200;
        const emp = MOCK_EMPLOYEES.find(e => e.name === item.name);
        if (emp) {
          dept = emp.department;
          hue = emp.hue;
        } else {
          const [firstName, lastName] = item.name.split(' ');
          const db = mongoose.connection.db;
          if (db) {
            const dbEmp = await db.collection('employees').findOne({
              firstName,
              lastName
            });
            if (dbEmp) {
              dept = dbEmp.department;
            }
          }
        }
        return {
          name: item.name,
          dept,
          hours: item.hours,
          hue
        };
      }));

      res.json(enhancedResults);
    } catch (error) {
      console.error('Error compiling employee hours:', error);
      res.status(500).json({ error: 'Failed to compile employee hours' });
    }
  },

  // GET /api/timesheets/:id
  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const entry = await TimesheetModel.findById(req.params.id);
      if (!entry) {
        res.status(404).json({ error: 'Timesheet entry not found' });
        return;
      }
      res.json(toFrontendTimesheet(entry));
    } catch (error) {
      console.error('Error fetching timesheet:', error);
      res.status(500).json({ error: 'Failed to fetch timesheet' });
    }
  },

  // POST /api/timesheets
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, employeeName, project, client, technologyNode, loginTime, logoutTime, task, billable } = req.body;
      if (!employeeId || !project || !loginTime) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const timesheet = new TimesheetModel({
        employee: employeeName || 'Unknown',
        employeeId,
        project,
        client: client || '',
        technologyNode: technologyNode || '',
        loginTime: new Date(loginTime),
        logoutTime: logoutTime ? new Date(logoutTime) : undefined,
        task: task || '',
        billable: billable !== undefined ? billable : true,
        status: 'Pending',
        requestStatus: 'No Request',
      });

      timesheet.totalHours = computeTotalHours(timesheet.loginTime, timesheet.logoutTime);

      await timesheet.save();
      await syncProjectStatus(timesheet.project);
      res.status(201).json(toFrontendTimesheet(timesheet));
    } catch (error) {
      console.error('Error creating timesheet entry:', error);
      res.status(500).json({ error: 'Failed to create timesheet entry' });
    }
  },

  // PUT /api/timesheets/:id
  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        loginTime,
        logoutTime,
        overriddenHours,
        adminNotes,
        status,
        requestStatus,
        applyCorrection,
      } = req.body;

      const timesheet = await TimesheetModel.findById(req.params.id);
      if (!timesheet) {
        res.status(404).json({ error: 'Timesheet entry not found' });
        return;
      }

      if (applyCorrection && timesheet.correctionRequest) {
        timesheet.loginTime = timesheet.correctionRequest.requestedLogin;
        timesheet.logoutTime = timesheet.correctionRequest.requestedLogout;
        timesheet.status = 'Approved';
        timesheet.requestStatus = 'Approved';
      } else {
        if (loginTime) timesheet.loginTime = new Date(loginTime);
        if (logoutTime !== undefined) {
          timesheet.logoutTime = logoutTime ? new Date(logoutTime) : undefined;
        }
        
        // Handle overridden hours clean deletion or set
        if (overriddenHours !== undefined) {
          timesheet.overriddenHours = (overriddenHours === '' || overriddenHours === null) ? undefined : Number(overriddenHours);
        }
        
        if (adminNotes !== undefined) timesheet.adminNotes = adminNotes;
        if (status) timesheet.status = status;
        if (requestStatus) timesheet.requestStatus = requestStatus;
      }

      // Re-compute total hours using helper
      timesheet.totalHours = computeTotalHours(timesheet.loginTime, timesheet.logoutTime, timesheet.overriddenHours);

      await timesheet.save();
      await syncProjectStatus(timesheet.project);
      res.json(toFrontendTimesheet(timesheet));
    } catch (error) {
      console.error('Error updating timesheet entry:', error);
      res.status(500).json({ error: 'Failed to update timesheet entry' });
    }
  },

  // PATCH /api/timesheets/:id/override
  override: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        loginTime,
        logoutTime,
        overriddenHours,
        adminNotes,
        status,
        requestStatus,
      } = req.body;

      const timesheet = await TimesheetModel.findById(req.params.id);
      if (!timesheet) {
        res.status(404).json({ error: 'Timesheet entry not found' });
        return;
      }

      if (loginTime) timesheet.loginTime = new Date(loginTime);
      if (logoutTime !== undefined) {
        timesheet.logoutTime = logoutTime ? new Date(logoutTime) : undefined;
      }
      
      // Handle overridden hours clean deletion or set
      if (overriddenHours !== undefined) {
        timesheet.overriddenHours = (overriddenHours === '' || overriddenHours === null) ? undefined : Number(overriddenHours);
      }
      
      if (adminNotes !== undefined) timesheet.adminNotes = adminNotes;
      if (status) timesheet.status = status;
      if (requestStatus) timesheet.requestStatus = requestStatus;

      // Re-compute total hours using helper
      timesheet.totalHours = computeTotalHours(timesheet.loginTime, timesheet.logoutTime, timesheet.overriddenHours);

      await timesheet.save();
      await syncProjectStatus(timesheet.project);
      res.json(toFrontendTimesheet(timesheet));
    } catch (error) {
      console.error('Error overriding timesheet entry:', error);
      res.status(500).json({ error: 'Failed to override timesheet entry' });
    }
  },

  // DELETE /api/timesheets/:id
  delete: async (req: Request, res: Response): Promise<void> => {
    try {
      const timesheet = await TimesheetModel.findById(req.params.id);
      if (!timesheet) {
        res.status(404).json({ error: 'Timesheet entry not found' });
        return;
      }
      const projectName = timesheet.project;
      await TimesheetModel.findByIdAndDelete(req.params.id);
      await syncProjectStatus(projectName);
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      console.error('Error deleting timesheet entry:', error);
      res.status(500).json({ error: 'Failed to delete timesheet entry' });
    }
  },
};
