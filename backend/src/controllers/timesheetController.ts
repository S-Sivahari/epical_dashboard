import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { TimesheetModel } from '../models/Timesheet';
import { ProjectModel } from '../models/Project';
import { syncProjectForTimesheet } from '../utils/syncProject';

const MOCK_EMPLOYEES = [
  { id: 'E-1001', name: 'Asha Menon', team: 'Design', hue: 155 },
  { id: 'E-1002', name: 'Rahul Verma', team: 'Verification', hue: 210 },
  { id: 'E-1003', name: 'Meera Nair', team: 'Hardware', hue: 335 },
  { id: 'E-1004', name: 'Amit Patel', team: 'R&D', hue: 35 },
  { id: 'E-1005', name: 'Priya Das', team: 'Operations', hue: 270 },
  { id: 'E-1006', name: 'Kiran Rao', team: 'Design', hue: 190 },
  { id: 'E-1007', name: 'Sneha Iyer', team: 'Verification', hue: 10 },
  { id: 'E-1008', name: 'Vikram Singh', team: 'R&D', hue: 60 },
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
    projectId: t.projectId ? t.projectId.toString() : '',
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
    totalHours: t.totalHours,
    taskStatus: t.taskStatus || (t.logoutTime ? 'Pending' : 'Session Incomplete'),
  };
}

/**
 * Resolves a project by ID or name and returns its ObjectId.
 * Returns null if the project cannot be found.
 */
async function resolveProjectId(projectId?: string, projectName?: string): Promise<{ _id: Types.ObjectId; projectName: string; clientName: string; technologyNode: string } | null> {
  if (projectId) {
    try {
      const byId = await ProjectModel.findById(projectId);
      if (byId) return { _id: byId._id as Types.ObjectId, projectName: byId.projectName, clientName: byId.clientName, technologyNode: byId.technologyNode };
    } catch {
      // Invalid ObjectId format — fall through to name lookup
    }
  }

  if (projectName) {
    const byName = await ProjectModel.findOne({ projectName });
    if (byName) return { _id: byName._id as Types.ObjectId, projectName: byName.projectName, clientName: byName.clientName, technologyNode: byName.technologyNode };
  }

  return null;
}

// Helper to build matches for query filters
async function buildMatchStage(req: Request) {
  const { from, to, employee, project, projectId, team, status, search } = req.query;
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
    // Also resolve by ObjectId if possible
    const resolved = await resolveProjectId(undefined, project as string);
    if (resolved) {
      match.$or = [...(match.$or || []), { projectId: resolved._id }, { project }];
    } else {
      match.$or = [...(match.$or || []), { project }];
    }
  }

  if (projectId && projectId !== 'all') {
    try {
      const objId = new Types.ObjectId(projectId as string);
      match.$or = [...(match.$or || []), { projectId: objId }];
    } catch {
      match.$or = [...(match.$or || []), { project: projectId }];
    }
  }

  if (status && status !== 'all') {
    if (status === 'Session Incomplete') {
      match.$or = [
        ...(match.$or || []),
        { logoutTime: { $exists: false } },
        { logoutTime: null },
        { taskStatus: 'Session Incomplete' },
      ];
    } else {
      match.status = status;
    }
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
    const mockNames = MOCK_EMPLOYEES.filter(e => e.team === dept).map(e => e.name);
    match.employee = { $in: mockNames };
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
          dept = emp.team;
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
              dept = dbEmp.role || '—';
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
      const { employeeId, employeeName, projectId, project, client, technologyNode, loginTime, logoutTime, task, billable, taskStatus } = req.body;
      if (!employeeId || !project || !loginTime) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Resolve project to a valid ObjectId — fail if not found
      const resolvedProject = await resolveProjectId(projectId, project);
      if (!resolvedProject) {
        res.status(400).json({ error: 'Could not resolve project. Please provide a valid project name or ID.' });
        return;
      }

      const timesheet = new TimesheetModel({
        employee: employeeName || 'Unknown',
        employeeId,
        projectId: resolvedProject._id,
        project: resolvedProject.projectName,
        client: client || resolvedProject.clientName || '',
        technologyNode: technologyNode || resolvedProject.technologyNode || '',
        loginTime: new Date(loginTime),
        logoutTime: logoutTime ? new Date(logoutTime) : undefined,
        task: task || '',
        billable: billable !== undefined ? billable : true,
        status: 'Pending',
        requestStatus: 'No Request',
        taskStatus: taskStatus || (logoutTime ? 'Pending' : 'Session Incomplete'),
      });

      timesheet.totalHours = computeTotalHours(timesheet.loginTime, timesheet.logoutTime);

      await timesheet.save();
      await syncProjectForTimesheet(timesheet);
      res.status(201).json(toFrontendTimesheet(timesheet));
    } catch (error) {
      console.error('Error creating timesheet entry:', error);
      res.status(500).json({ error: 'Failed to create timesheet entry' });
    }
  },

  // PUT /api/timesheets/:id — operational log updates only (no workflow approval)
  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        loginTime,
        logoutTime,
        overriddenHours,
        adminNotes,
        task,
        billable,
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
      if (overriddenHours !== undefined) {
        timesheet.overriddenHours = (overriddenHours === '' || overriddenHours === null) ? undefined : Number(overriddenHours);
      }
      if (adminNotes !== undefined) timesheet.adminNotes = adminNotes;
      if (task !== undefined) timesheet.task = task;
      if (billable !== undefined) timesheet.billable = billable;
      if (!timesheet.logoutTime) {
        timesheet.taskStatus = 'Session Incomplete';
      } else if (timesheet.taskStatus === 'Session Incomplete') {
        timesheet.taskStatus = 'Pending';
      }

      timesheet.totalHours = computeTotalHours(timesheet.loginTime, timesheet.logoutTime, timesheet.overriddenHours);

      await timesheet.save();
      await syncProjectForTimesheet(timesheet);
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
        task,
        billable,
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
      if (task !== undefined) timesheet.task = task;
      if (billable !== undefined) timesheet.billable = billable;
      if (!timesheet.logoutTime) {
        timesheet.taskStatus = 'Session Incomplete';
      } else if (timesheet.taskStatus === 'Session Incomplete') {
        timesheet.taskStatus = 'Pending';
      }

      timesheet.totalHours = computeTotalHours(timesheet.loginTime, timesheet.logoutTime, timesheet.overriddenHours);

      await timesheet.save();
      await syncProjectForTimesheet(timesheet);
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
      await TimesheetModel.findByIdAndDelete(req.params.id);
      await syncProjectForTimesheet(timesheet);
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      console.error('Error deleting timesheet entry:', error);
      res.status(500).json({ error: 'Failed to delete timesheet entry' });
    }
  },

};
