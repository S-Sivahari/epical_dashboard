import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { TimesheetModel } from '../models/Timesheet';
import { ProjectModel } from '../models/Project';
import { syncProjectForTimesheet, getTimesheetWorkflowStatus } from '../utils/syncProject';
import {
  buildEmployeeTokenMap,
  fetchAttendanceSessionsForTimesheets,
  resolveAdminTimesheetWorkedMs,
  resolveTimesheetBreakMs,
} from '../utils/timesheetAttendanceEnrichment';
import {
  buildDashboardProjectHoursChart,
  type DashboardChartPeriod,
} from '../services/dashboardProjectHoursService';
import { buildTimesheetEffectiveHoursExpr } from '../utils/timesheetHoursAggregation';
import { listWorkSessionsForAdmin } from '../services/workSessionService';

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
function computeTotalHours(loginTime: Date, logoutTime?: Date, overriddenHours?: number, totalPausedMs = 0): number {
  if (overriddenHours !== undefined && overriddenHours !== null) {
    return Number(overriddenHours);
  }
  // FIXED: For active sessions (no logout), return 0 to let frontend calculate live duration
  if (!logoutTime) return 0;
  const diffMs = logoutTime.getTime() - loginTime.getTime() - (totalPausedMs || 0);
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}

// Helper to map Mongoose timesheet log to frontend format
function toFrontendTimesheet(t: any) {
  const dateOnly = t.loginTime ? new Date(t.loginTime).toISOString().split('T')[0] : '';
  const totalHours = t.totalHours ?? computeTotalHours(t.loginTime, t.logoutTime, t.overriddenHours, t.totalPausedMs);
  
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
    status: t.approvalStatus || t.status || 'Pending',
    approvalStatus: t.approvalStatus || t.status || 'Pending',
    billable: t.billable !== undefined ? t.billable : true,
    task: t.task || '',
    adminNotes: t.adminNotes,
    overriddenHours: t.overriddenHours,
    totalHours,
    workedMs: typeof t.workedMs === 'number' && t.workedMs >= 0 ? t.workedMs : undefined,
    breakMs: typeof t.breakMs === 'number' && t.breakMs >= 0 ? t.breakMs : undefined,
    totalPausedMs: t.totalPausedMs || 0,
    autoCheckedOut: t.autoCheckedOut ?? false,
    taskStatus: t.taskStatus || (t.logoutTime ? 'Pending' : 'Session Incomplete'),
    workflowStatus: getTimesheetWorkflowStatus(t),
    pausedAt: t.pausedAt ? t.pausedAt.toISOString() : undefined,
    isPaused: t.taskStatus === 'Paused',
  };
}

/**
 * Resolves a project by ID or name and returns its ObjectId.
 * Returns null if the project cannot be found.
 */
async function resolveProjectRef(
  idOrName?: string
): Promise<{ _id: Types.ObjectId; projectName: string; clientName: string; technologyNode: string } | null> {
  if (!idOrName) return null;
  const value = String(idOrName).trim();
  if (Types.ObjectId.isValid(value)) {
    const byId = await ProjectModel.findById(value);
    if (byId) {
      return {
        _id: byId._id as Types.ObjectId,
        projectName: byId.projectName,
        clientName: byId.clientName,
        technologyNode: byId.technologyNode,
      };
    }
  }
  const byName = await ProjectModel.findOne({ projectName: value });
  if (byName) {
    return {
      _id: byName._id as Types.ObjectId,
      projectName: byName.projectName,
      clientName: byName.clientName,
      technologyNode: byName.technologyNode,
    };
  }
  return null;
}

function projectMatchClause(
  resolved: { _id: Types.ObjectId; projectName: string } | null,
  fallback?: string
) {
  if (resolved) {
    return { $or: [{ projectId: resolved._id }, { project: resolved.projectName }] };
  }
  if (fallback) return { project: fallback };
  return null;
}

// Helper to build matches for query filters
async function buildMatchStage(req: Request) {
  const { from, to, employee, project, projectId, team, status, search } = req.query;
  const and: Record<string, unknown>[] = [];

  // FIXED: Use UTC timestamps to match employee controller and prevent timezone discrepancies
  if (from || to) {
    const loginTime: Record<string, Date> = {};
    if (from) {
      loginTime.$gte = new Date(`${from}T00:00:00.000Z`);
    }
    if (to) {
      loginTime.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    and.push({ loginTime });
  }

  if (employee && employee !== 'all') {
    and.push({ employee });
  }

  if (project && project !== 'all') {
    const resolved = await resolveProjectRef(project as string);
    const clause = projectMatchClause(resolved, project as string);
    if (clause) and.push(clause);
  }

  if (projectId && projectId !== 'all') {
    const resolved = await resolveProjectRef(projectId as string);
    const clause = projectMatchClause(resolved, projectId as string);
    if (clause) and.push(clause);
  }

  if (status && status !== 'all') {
    if (status === 'Session Incomplete') {
      and.push({
        $or: [
          { logoutTime: { $exists: false } },
          { logoutTime: null },
          { taskStatus: 'Session Incomplete' },
        ],
      });
    } else {
      and.push({ status });
    }
  }

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');
    and.push({
      $or: [{ employee: searchRegex }, { project: searchRegex }, { task: searchRegex }],
    });
  }

  if (team && team !== 'all') {
    const dept = (team as string).replace(' Team', '');
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not active');
    }
    const employeesInDept = await db.collection('employees').find({ department: dept }).toArray();
    const employeeNames = employeesInDept.map((e) => `${e.firstName} ${e.lastName}`);
    const mockNames = MOCK_EMPLOYEES.filter((e) => e.team === dept).map((e) => e.name);
    const allNames = Array.from(new Set([...employeeNames, ...mockNames]));
    and.push({ employee: { $in: allNames } });
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { $and: and };
}

export const timesheetController = {
  // GET /api/timesheets/work-sessions — one row per check-in/check-out session
  getWorkSessions: async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to, employee, search } = req.query;
      const rows = await listWorkSessionsForAdmin({
        from: typeof from === 'string' ? from : undefined,
        to: typeof to === 'string' ? to : undefined,
        employee: typeof employee === 'string' ? employee : undefined,
        search: typeof search === 'string' ? search : undefined,
      });
      res.json(rows);
    } catch (error) {
      console.error('Error fetching work sessions:', error);
      res.status(500).json({ error: 'Failed to fetch work sessions' });
    }
  },

  // GET /api/timesheets
  getAll: async (req: Request, res: Response): Promise<void> => {
    try {
      const match = await buildMatchStage(req);
      const entries = await TimesheetModel.find(match)
        .select({
          employee: 1,
          employeeId: 1,
          projectId: 1,
          project: 1,
          client: 1,
          technologyNode: 1,
          loginTime: 1,
          logoutTime: 1,
          correctionRequest: 1,
          requestStatus: 1,
          status: 1,
          approvalStatus: 1,
          billable: 1,
          task: 1,
          adminNotes: 1,
          overriddenHours: 1,
          totalHours: 1,
          workedMs: 1,
          breakMs: 1,
          totalPausedMs: 1,
          autoCheckedOut: 1,
          taskStatus: 1,
          pausedAt: 1,
        })
        .sort({ loginTime: -1 })
        .limit(5000)
        .lean();
      const employeeTokenMap = await buildEmployeeTokenMap(entries);
      const attendanceSessions = await fetchAttendanceSessionsForTimesheets(
        entries,
        employeeTokenMap,
      );
      res.json(
        entries.map((t) => {
          const row = toFrontendTimesheet(t);
          const displayWorkedMs = resolveAdminTimesheetWorkedMs(
            t,
            attendanceSessions,
            employeeTokenMap,
          );
          return {
            ...row,
            breakMs: resolveTimesheetBreakMs(t, attendanceSessions, employeeTokenMap),
            displayWorkedMs,
          };
        }),
      );
    } catch (error) {
      console.error('Error fetching timesheets:', error);
      res.status(500).json({ error: 'Failed to fetch timesheets' });
    }
  },

  // GET /api/timesheets/hours-by-project
  getHoursByProject: async (req: Request, res: Response): Promise<void> => {
    try {
      const match = await buildMatchStage(req);
      
      // FIXED: Include active sessions and properly calculate hours with pause time
      const agg = [
        { $match: match },
        {
          $project: {
            project: 1,
            projectId: 1,
            hours: buildTimesheetEffectiveHoursExpr(),
          }
        },
        {
          $group: {
            _id: "$project",
            projectId: { $first: "$projectId" },
            totalHours: { $sum: { $max: [0, "$hours"] } } // Ensure no negative hours
          }
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            projectId: { $toString: "$projectId" },
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
      
      // FIXED: Include active sessions and properly calculate hours with pause time
      const agg = [
        { $match: match },
        {
          $project: {
            employee: 1,
            employeeId: 1,
            hours: buildTimesheetEffectiveHoursExpr(),
          }
        },
        {
          $group: {
            _id: "$employee",
            employeeId: { $first: "$employeeId" },
            totalHours: { $sum: { $max: [0, "$hours"] } } // Ensure no negative hours
          }
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            employeeId: "$employeeId",
            hours: { $round: ["$totalHours", 1] }
          }
        },
        { $sort: { hours: -1 as const } }
      ];

      const results = await TimesheetModel.aggregate(agg);
      
      const enhancedResults = await Promise.all(results.map(async (item) => {
        let dept = 'R&D';
        let hue = 200;
        const emp = MOCK_EMPLOYEES.find(e => e.name === item.name || e.id === item.employeeId);
        if (emp) {
          dept = emp.team;
          hue = emp.hue;
        } else {
          const [firstName, lastName] = (item.name || '').split(' ');
          const db = mongoose.connection.db;
          if (db && firstName) {
            const dbEmp = await db.collection('employees').findOne({
              firstName,
              lastName
            }, { projection: { documents: 0, 'photo.data': 0 } });
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
      const { employeeId, employeeName, projectId, client, technologyNode, loginTime, logoutTime, task, billable, taskStatus } = req.body;
      if (!employeeId || !projectId || !loginTime) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Resolve project to a valid ObjectId — fail if not found
      const resolvedProject = await resolveProjectRef(projectId);
      if (!resolvedProject) {
        res.status(400).json({ error: 'Could not resolve project. Please provide a valid project ID.' });
        return;
      }

      const session = await mongoose.startSession();
      try {
        let timesheet: any;
        await session.withTransaction(async () => {
          timesheet = new TimesheetModel({
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
            approvalStatus: 'Pending',
            requestStatus: 'No Request',
            taskStatus: taskStatus || (logoutTime ? 'Pending' : 'Session Incomplete'),
          });

          timesheet.totalHours = computeTotalHours(timesheet.loginTime, timesheet.logoutTime);

          await timesheet.save({ session });
          await syncProjectForTimesheet(timesheet, session);
        });

        res.status(201).json(toFrontendTimesheet(timesheet));
      } finally {
        session.endSession();
      }
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

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
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
            timesheet.approvalStatus = 'Pending';
            timesheet.status = 'Pending';
          } else if (timesheet.taskStatus === 'Session Incomplete') {
            timesheet.taskStatus = 'Pending';
          }

          timesheet.totalHours = computeTotalHours(timesheet.loginTime, timesheet.logoutTime, timesheet.overriddenHours);

          await timesheet.save({ session });
          await syncProjectForTimesheet(timesheet, session);
        });

        res.json(toFrontendTimesheet(timesheet));
      } finally {
        session.endSession();
      }
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

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
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
            timesheet.approvalStatus = 'Pending';
            timesheet.status = 'Pending';
          } else if (timesheet.taskStatus === 'Session Incomplete') {
            timesheet.taskStatus = 'Pending';
          }

          timesheet.totalHours = computeTotalHours(timesheet.loginTime, timesheet.logoutTime, timesheet.overriddenHours);

          await timesheet.save({ session });
          await syncProjectForTimesheet(timesheet, session);
        });

        res.json(toFrontendTimesheet(timesheet));
      } finally {
        session.endSession();
      }
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
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await TimesheetModel.findByIdAndDelete(req.params.id, { session });
          await syncProjectForTimesheet(timesheet, session);
        });

        res.json({ message: 'Deleted successfully' });
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error deleting timesheet entry:', error);
      res.status(500).json({ error: 'Failed to delete timesheet entry' });
    }
  },

  // GET /api/timesheets/project-hours-chart
  getProjectHoursChart: async (req: Request, res: Response): Promise<void> => {
    try {
      const period = (req.query.period as DashboardChartPeriod) || 'This Week';
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      const payload = await buildDashboardProjectHoursChart(period, from, to);
      res.json(payload);
    } catch (error) {
      console.error('Error building dashboard project hours chart:', error);
      res.status(500).json({ error: 'Failed to build project hours chart' });
    }
  },

};
