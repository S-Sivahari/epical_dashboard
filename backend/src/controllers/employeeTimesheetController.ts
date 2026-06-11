import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { ProjectModel } from '../models/Project';
import { getDB } from '../config/db';
import { getUserById } from '../services/authService';
import { resolveEmployeeForAuthUser } from '../utils/employeeAuth';
import { syncProjectForTimesheet, getTimesheetWorkflowStatus } from '../utils/syncProject';
import { buildAssignedProjectsFilter, buildAssignmentIdentityTokens, ensureAssignedTasksForEmployee } from '../utils/assignedTaskSync';
import { openAttendanceFilter } from '../utils/attendanceQueries';
import { computeTotalHoursDecimal } from '../utils/durationFormat';
import { getAutoCheckoutSettings, updateAutoCheckoutSettings } from '../services/autoCheckoutService';
import { restartScheduler } from '../services/timesheetScheduler';
import { sendCheckoutReminderEmail } from '../services/emailService';
import { buildNextSchedulerClockTime, getSchedulerHourMinute } from '../utils/istClock';

type ResolvedEmployee = {
  id: string;
  name: string;
  email?: string;
  employeeName: string;
  employeeId: string;
  identityTokens: string[];
};

function todayDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

function computeAttendanceHours(checkInTime: Date, checkOutTime?: Date | null, now = new Date()): number {
  const end = checkOutTime ?? now;
  const diffMs = end.getTime() - checkInTime.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}

function toFrontendAttendance(a: {
  _id: Types.ObjectId;
  date: string;
  checkInTime: Date;
  checkOutTime?: Date | null;
  sessionStatus?: string;
  autoCheckedOut?: boolean;
}) {
  return {
    id: a._id.toString(),
    date: a.date,
    checkInTime: a.checkInTime.toISOString(),
    checkOutTime: a.checkOutTime ? a.checkOutTime.toISOString() : null,
    hours: computeAttendanceHours(a.checkInTime, a.checkOutTime ?? null),
    sessionStatus: a.sessionStatus ?? 'Active',
    autoCheckedOut: a.autoCheckedOut ?? false,
  };
}

function computeTotalHours(
  loginTime: Date,
  logoutTime?: Date,
  overriddenHours?: number,
  totalPausedMs = 0
): number {
  if (overriddenHours !== undefined && overriddenHours !== null) {
    return Number(overriddenHours);
  }
  if (!logoutTime) return 0;
  const diffMs = logoutTime.getTime() - loginTime.getTime() - (totalPausedMs || 0);
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}

async function findOpenTimesheet(employee: ResolvedEmployee) {
  return TimesheetModel.findOne({
    employeeId: employee.employeeId,
    $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
    taskStatus: { $in: ['In Progress', 'Paused', 'Session Incomplete'] },
  }).sort({ loginTime: -1 });
}

async function findTimesheetByIdAndEmployee(timesheetId: string, employee: ResolvedEmployee) {
  if (!mongoose.Types.ObjectId.isValid(timesheetId)) return null;
  return TimesheetModel.findOne({
    _id: timesheetId,
    employeeId: employee.employeeId,
    $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
  });
}

async function findAssignedTaskForEmployee(employee: ResolvedEmployee, assignedTaskId: string) {
  if (!Types.ObjectId.isValid(assignedTaskId)) return null;
  return AssignedTaskModel.findOne({
    _id: assignedTaskId,
    $or: [
      { employeeId: { $in: employee.identityTokens } },
      { employeeName: { $in: employee.identityTokens } },
    ],
  });
}

function finalizePauseAccumulation(timesheet: { pausedAt?: Date | null; totalPausedMs?: number }) {
  if (!timesheet.pausedAt) return;
  const pausedMs = Date.now() - new Date(timesheet.pausedAt).getTime();
  timesheet.totalPausedMs = (timesheet.totalPausedMs || 0) + Math.max(0, pausedMs);
  timesheet.pausedAt = null;
}

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
    requestStatus: t.requestStatus || 'No Request',
    status: t.approvalStatus || t.status || 'Pending',
    approvalStatus: t.approvalStatus || t.status || 'Pending',
    billable: t.billable !== undefined ? t.billable : true,
    task: t.task || '',
    adminNotes: t.adminNotes,
    overriddenHours: t.overriddenHours,
    totalHours:
      t.totalHours ??
      computeTotalHoursDecimal(t.loginTime, t.logoutTime || new Date(), t.totalPausedMs, t.overriddenHours),
    autoCheckedOut: t.autoCheckedOut ?? false,
    taskStatus: t.taskStatus || (t.logoutTime ? 'Pending' : 'Session Incomplete'),
    workflowStatus: getTimesheetWorkflowStatus(t),
    pausedAt: t.pausedAt ? t.pausedAt.toISOString() : undefined,
    totalPausedMs: t.totalPausedMs || 0,
    isPaused: t.taskStatus === 'Paused',
    createdAt: t.createdAt ? t.createdAt.toISOString() : undefined,
    updatedAt: t.updatedAt ? t.updatedAt.toISOString() : undefined,
  };
}

function toFrontendAssignedTask(t: any) {
  return {
    id: t._id.toString(),
    projectId: t.projectId.toString(),
    projectName: t.projectName,
    clientName: t.clientName,
    technologyNode: t.technologyNode,
    title: t.title,
    description: t.description || '',
    status: t.status,
    timesheetId: t.timesheetId ? t.timesheetId.toString() : undefined,
    createdAt: t.createdAt ? t.createdAt.toISOString() : undefined,
    updatedAt: t.updatedAt ? t.updatedAt.toISOString() : undefined,
  };
}

async function resolveEmployee(req: Request): Promise<ResolvedEmployee | null> {
  const userId = req.user?.id;
  if (!userId) return null;
  const user = await getUserById(userId);
  if (!user) return null;
  const employeeRecord = await resolveEmployeeForAuthUser(user.id, user.email);

  const employeeName = employeeRecord
    ? [employeeRecord.firstName, employeeRecord.middleName, employeeRecord.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || user.name
    : user.name;

  const employeeId = String(employeeRecord?.employeeId || user.employeeId || user.id);
  const identityTokens = buildAssignmentIdentityTokens(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId,
    },
    employeeRecord as any
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    employeeName,
    employeeId,
    identityTokens,
  };
}

async function requireOpenAttendance(employeeId: string) {
  const attendance = await EmployeeAttendanceModel.findOne(
    openAttendanceFilter({ employeeId })
  ).sort({ checkInTime: -1 });
  return attendance;
}

function startOfMonthISO(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function buildSessionDateMatch(from?: string, to?: string) {
  if (!from && !to) return null;

  const rangeFilter: Record<string, Date> = {};
  if (from) rangeFilter.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) rangeFilter.$lte = new Date(`${to}T23:59:59.999Z`);

  // FIXED: Only filter on loginTime to ensure sessions are in the requested range
  // Previously used OR with logoutTime, which included sessions that started before the range
  return {
    loginTime: rangeFilter,
  };
}

export type ProjectWiseHoursRow = {
  projectId: string;
  project: string;
  hours: number;
  sessions: number;
};

async function aggregateProjectWiseHoursForEmployee(
  employee: ResolvedEmployee,
  from: string,
  to: string
): Promise<ProjectWiseHoursRow[]> {
  const loginFrom = new Date(`${from}T00:00:00.000Z`);
  const loginTo = new Date(`${to}T23:59:59.999Z`);
  const now = new Date();

  const rows = await TimesheetModel.aggregate([
    {
      $match: {
        $and: [
          {
            $or: [
              { employeeId: { $in: employee.identityTokens } },
              { employee: { $in: employee.identityTokens } },
            ],
          },
          { loginTime: { $gte: loginFrom, $lte: loginTo } },
        ],
      },
    },
    {
      $addFields: {
        effectiveHours: {
          $cond: [
            {
              $and: [
                { $ne: [{ $ifNull: ['$overriddenHours', null] }, null] },
                { $ne: ['$overriddenHours', ''] },
              ],
            },
            { $toDouble: '$overriddenHours' },
            {
              $let: {
                vars: {
                  endMs: { $toLong: { $ifNull: ['$logoutTime', now] } },
                  startMs: { $toLong: '$loginTime' },
                  pausedMs: { $ifNull: ['$totalPausedMs', 0] },
                },
                in: {
                  $max: [
                    0,
                    {
                      $divide: [
                        { $subtract: ['$$endMs', { $add: ['$$startMs', '$$pausedMs'] }] },
                        3600000,
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: { projectId: '$projectId', project: '$project' },
        hours: { $sum: '$effectiveHours' },
        sessions: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        projectId: { $toString: '$_id.projectId' },
        project: '$_id.project',
        hours: 1,
        sessions: 1,
      },
    },
    { $sort: { hours: -1, project: 1 } },
  ]);

  return rows.map((r) => ({
    projectId: r.projectId || '',
    project: r.project || 'Unknown',
    hours: Math.round((typeof r.hours === 'number' ? r.hours : 0) * 10) / 10,
    sessions: r.sessions ?? 0,
  }));
}

async function fetchActiveTaskPayload(employee: ResolvedEmployee) {
  const openAttendance = await requireOpenAttendance(employee.id);
  if (!openAttendance) {
    return { active: null, pausedTasks: [] };
  }

  const openLogs = await TimesheetModel.find({
    $and: [
      {
        $or: [
          { employeeId: { $in: employee.identityTokens } },
          { employee: { $in: employee.identityTokens } },
        ],
      },
      { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
      { loginTime: { $gte: openAttendance.checkInTime } },
      { taskStatus: { $in: ['In Progress', 'Paused', 'Session Incomplete'] } },
    ],
  })
    .sort({ loginTime: -1 })
    .lean();

  const runningLog = openLogs.find(
    (log) => log.taskStatus === 'In Progress' || log.taskStatus === 'Session Incomplete',
  );
  const pausedLogs = openLogs.filter((log) => log.taskStatus === 'Paused');

  const runningAssigned = runningLog
    ? await AssignedTaskModel.findOne({ timesheetId: runningLog._id }).lean()
    : null;

  const pausedTasks = await Promise.all(
    pausedLogs.map(async (log) => {
      const assigned = await AssignedTaskModel.findOne({ timesheetId: log._id }).lean();
      return {
        timesheet: toFrontendTimesheet(log),
        assignedTask: assigned ? toFrontendAssignedTask(assigned) : null,
      };
    }),
  );

  return {
    active: runningLog
      ? {
          timesheet: toFrontendTimesheet(runningLog),
          assignedTask: runningAssigned ? toFrontendAssignedTask(runningAssigned) : null,
        }
      : null,
    pausedTasks,
  };
}

async function fetchAssignedTasksForEmployee(employee: ResolvedEmployee) {
  const recentApprovedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const allottedProjects = await ProjectModel.find(buildAssignedProjectsFilter(employee.identityTokens), {
    _id: 1,
  }).lean();
  const allottedProjectIds = allottedProjects.map((p) => p._id);
  if (allottedProjectIds.length === 0) return [];

  const tasks = await AssignedTaskModel.find({
    $and: [
      { projectId: { $in: allottedProjectIds } },
      {
        $or: [
          { employeeId: { $in: employee.identityTokens } },
          { employeeName: { $in: employee.identityTokens } },
        ],
      },
      {
        $or: [
          { status: { $in: ['assigned', 'in_progress', 'pending_review'] } },
          { status: 'completed', updatedAt: { $gte: recentApprovedCutoff } },
        ],
      },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean();
  return tasks.map(toFrontendAssignedTask);
}

function buildAttendanceResponse(
  openAttendance: Awaited<ReturnType<typeof requireOpenAttendance>>,
  latestAttendance: Awaited<ReturnType<typeof EmployeeAttendanceModel.findOne>>,
) {
  const date = todayDateKey();
  const attendance = (openAttendance ?? latestAttendance) as any;
  return {
    checkedIn: !!openAttendance,
    checkInTime: openAttendance?.checkInTime?.toISOString() ?? null,
    checkOutTime: attendance?.checkOutTime?.toISOString() ?? null,
    date: openAttendance?.date ?? attendance?.date ?? date,
    sessionStatus: openAttendance?.sessionStatus ?? attendance?.sessionStatus ?? null,
    reminderSent: openAttendance?.reminderSent ?? attendance?.reminderSent ?? false,
    autoCheckedOut: attendance?.autoCheckedOut ?? false,
    expectedCheckoutTime: openAttendance?.expectedCheckoutTime?.toISOString() ?? null,
    autoCheckoutTime: openAttendance?.autoCheckoutTime?.toISOString() ?? null,
    autoCheckoutEnabled: openAttendance?.autoCheckoutEnabled ?? attendance?.autoCheckoutEnabled ?? true,
  };
}

async function releaseAssignedTask(timesheetId: string, session?: mongoose.ClientSession) {
  const assignedQuery = AssignedTaskModel.findOne({ timesheetId });
  if (session) assignedQuery.session(session);
  const assignedTask = await assignedQuery;
  if (!assignedTask) return;

  assignedTask.status = 'assigned';
  assignedTask.timesheetId = undefined;
  await assignedTask.save(session ? { session } : undefined);
}

export const employeeTimesheetController = {
  /** One round-trip for timesheet page initial load (this month + this week only). */
  getBootstrap: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      void ensureAssignedTasksForEmployee({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        employeeName: employee.employeeName,
        employeeId: employee.employeeId,
      }).catch((err) => console.error('Background assigned-task sync failed:', err));

      const monthFrom = startOfMonthISO();
      const weekFrom = startOfWeekISO();
      const today = todayDateKey();

      const sessionMatch = {
        $and: [
          {
            $or: [
              { employeeId: { $in: employee.identityTokens } },
              { employee: { $in: employee.identityTokens } },
            ],
          },
          {
            loginTime: { $gte: new Date(`${monthFrom}T00:00:00.000Z`), $lte: new Date(`${today}T23:59:59.999Z`) },
          },
        ],
      };

      const [openAttendance, latestAttendance, activePayload, assignedTasks, sessions, attendanceHistory, projectWiseHours] =
        await Promise.all([
          requireOpenAttendance(employee.id),
          EmployeeAttendanceModel.findOne({ employeeId: employee.id }).sort({ checkInTime: -1 }).lean(),
          fetchActiveTaskPayload(employee),
          fetchAssignedTasksForEmployee(employee),
          TimesheetModel.find(sessionMatch).sort({ loginTime: -1 }).lean(),
          EmployeeAttendanceModel.find({
            employeeId: employee.id,
            date: { $gte: weekFrom, $lte: today },
          })
            .sort({ checkInTime: -1 })
            .lean(),
          aggregateProjectWiseHoursForEmployee(employee, weekFrom, today),
        ]);

      res.json({
        serverTime: new Date().toISOString(),
        attendance: buildAttendanceResponse(openAttendance, latestAttendance),
        active: activePayload.active,
        pausedTasks: activePayload.pausedTasks,
        assignedTasks,
        sessions: sessions.map(toFrontendTimesheet),
        attendanceHistory: attendanceHistory.map((r) => toFrontendAttendance(r as any)),
        projectWiseHours,
      });
    } catch (error) {
      console.error('Error loading timesheet bootstrap:', error);
      res.status(500).json({ error: 'Failed to load timesheet' });
    }
  },

  getMyAssignedTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      void ensureAssignedTasksForEmployee({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        employeeName: employee.employeeName,
        employeeId: employee.employeeId,
      }).catch((err) => console.error('Background assigned-task sync failed:', err));

      res.json(await fetchAssignedTasksForEmployee(employee));
    } catch (error) {
      console.error('Error fetching assigned tasks:', error);
      res.status(500).json({ error: 'Failed to fetch assigned tasks' });
    }
  },

  getMyAttendance: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const openAttendance = await requireOpenAttendance(employee.id);
      const latestAttendance = await EmployeeAttendanceModel.findOne({ employeeId: employee.id }).sort({
        checkInTime: -1,
      });

      res.json(buildAttendanceResponse(openAttendance, latestAttendance));
    } catch (error) {
      console.error('Error fetching attendance:', error);
      res.status(500).json({ error: 'Failed to fetch attendance' });
    }
  },

  getMyActiveTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.json(await fetchActiveTaskPayload(employee));
    } catch (error) {
      console.error('Error fetching active task:', error);
      res.status(500).json({ error: 'Failed to fetch active task' });
    }
  },

  getMyAttendanceHistory: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { from, to } = req.query;
      const match: Record<string, unknown> = { employeeId: employee.id };

      if (from || to) {
        const dateFilter: Record<string, string> = {};
        if (typeof from === 'string' && from) dateFilter.$gte = from;
        if (typeof to === 'string' && to) dateFilter.$lte = to;
        if (Object.keys(dateFilter).length > 0) {
          match.date = dateFilter;
        }
      }

      const records = await EmployeeAttendanceModel.find(match).sort({ checkInTime: -1 });

      res.json(records.map((r) => toFrontendAttendance(r)));
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      res.status(500).json({ error: 'Failed to fetch attendance history' });
    }
  },

  getMyProjectWiseHours: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const from =
        typeof req.query.from === 'string' && req.query.from ? req.query.from : startOfWeekISO();
      const to = typeof req.query.to === 'string' && req.query.to ? req.query.to : todayDateKey();

      const projectWiseHours = await aggregateProjectWiseHoursForEmployee(employee, from, to);
      res.json({ from, to, projects: projectWiseHours });
    } catch (error) {
      console.error('Error fetching project-wise hours:', error);
      res.status(500).json({ error: 'Failed to fetch project-wise hours' });
    }
  },

  getMySessions: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { from, to } = req.query;
      const match: Record<string, any> = {
        $and: [
          {
            $or: [
              { employeeId: { $in: employee.identityTokens } },
              { employee: { $in: employee.identityTokens } },
            ],
          },
        ],
      };

      const dateMatch = buildSessionDateMatch(
        typeof from === 'string' ? from : undefined,
        typeof to === 'string' ? to : undefined
      );
      if (dateMatch) {
        match.$and.push(dateMatch);
      }

      const logs = await TimesheetModel.find(match)
        .sort({ loginTime: -1 })
        .limit(1000) // FIXED: Add safety limit to prevent excessive data transfers
        .lean();

      res.json(logs.map(toFrontendTimesheet));
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Failed to fetch work sessions' });
    }
  },

  checkIn: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const date = todayDateKey();
      const openAttendance = await requireOpenAttendance(employee.id);

      const settings = await getAutoCheckoutSettings();
      const now = new Date();
      const { hours: istHour } = getSchedulerHourMinute(now);
      const isLateCheckIn = istHour >= 21;

      const buildExpectedCheckout = () => {
        if (isLateCheckIn) {
          return now;
        }
        const [rh, rm] = settings.reminderTime.split(':').map(Number);
        return buildNextSchedulerClockTime(now, rh, rm);
      };
      const buildAutoCheckout = () => {
        if (isLateCheckIn) {
          return buildNextSchedulerClockTime(now, 0, 0);
        }
        const [ah, am] = settings.autoCheckoutTime.split(':').map(Number);
        return buildNextSchedulerClockTime(now, ah, am);
      };

      if (openAttendance) {
        res.json({
          checkedIn: true,
          checkInTime: openAttendance.checkInTime.toISOString(),
          message: 'Already checked in',
          sessionStatus: openAttendance.sessionStatus,
          reminderSent: openAttendance.reminderSent,
          autoCheckedOut: openAttendance.autoCheckedOut,
          expectedCheckoutTime: openAttendance.expectedCheckoutTime?.toISOString() ?? null,
          autoCheckoutTime: openAttendance.autoCheckoutTime?.toISOString() ?? null,
        });
        return;
      }

      const attendance = await EmployeeAttendanceModel.create({
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        date,
        checkInTime: now,
        expectedCheckoutTime: buildExpectedCheckout(),
        autoCheckoutTime: buildAutoCheckout(),
        autoCheckoutEnabled: true,
        reminderSent: false,
        autoCheckedOut: false,
        sessionStatus: 'Active',
      });

      res.status(201).json({
        serverTime: new Date().toISOString(),
        checkedIn: true,
        checkInTime: attendance.checkInTime.toISOString(),
        sessionStatus: attendance.sessionStatus,
        expectedCheckoutTime: attendance.expectedCheckoutTime?.toISOString() ?? null,
        autoCheckoutTime: attendance.autoCheckoutTime?.toISOString() ?? null,
      });
    } catch (error: unknown) {
      console.error('Error checking in:', error);
      const mongoCode = (error as { code?: number })?.code;
      if (mongoCode === 11000) {
        res.status(409).json({
          error:
            'Cannot start a new check-in yet. Ask an admin to update the attendance database index, or try again after the server restarts.',
        });
        return;
      }
      res.status(500).json({ error: 'Failed to check in' });
    }
  },

  checkOut: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const attendance = await requireOpenAttendance(employee.id);
      if (!attendance) {
        res.status(400).json({ error: 'You are not checked in' });
        return;
      }

      const now = new Date();
      const session = await mongoose.startSession();

      try {
        let stoppedTasks = 0;
        await session.withTransaction(async () => {
          const openLogs = await TimesheetModel.find({
            $and: [
              {
                $or: [
                  { employeeId: { $in: employee.identityTokens } },
                  { employee: { $in: employee.identityTokens } },
                ],
              },
              { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
            ],
          }).session(session);

          stoppedTasks = openLogs.length;

          for (const log of openLogs) {
            if (log.taskStatus === 'Paused') {
              finalizePauseAccumulation(log);
            }
            log.logoutTime = now;
            log.totalHours = computeTotalHours(
              log.loginTime,
              log.logoutTime,
              log.overriddenHours,
              log.totalPausedMs
            );
            if (log.taskStatus === 'In Progress' || log.taskStatus === 'Paused' || log.taskStatus === 'Session Incomplete') {
              log.taskStatus = 'Pending';
            }
            await log.save({ session });
            await syncProjectForTimesheet(log, session);
            await releaseAssignedTask(log._id.toString(), session);
          }

          attendance.checkOutTime = now;
          attendance.sessionStatus = 'Completed';
          await attendance.save({ session });
        });

        res.json({
          serverTime: new Date().toISOString(),
          checkedIn: false,
          checkOutTime: now.toISOString(),
          stoppedTasks,
          sessionStatus: 'Completed',
        });
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error checking out:', error);
      res.status(500).json({ error: 'Failed to check out' });
    }
  },

  startTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const attendance = await requireOpenAttendance(employee.id);
      if (!attendance) {
        res.status(400).json({ error: 'Please check in before starting a task' });
        return;
      }

      const { assignedTaskId, description } = req.body;
      if (!assignedTaskId) {
        res.status(400).json({ error: 'Select a task before starting' });
        return;
      }

      // FIXED: Check for ANY active/paused task to prevent duplicate Timesheets
      // This addresses the issue where multiple Timesheets with different loginTimes
      // cause timer to show wrong elapsed duration after device shutdown/re-open
      const existingActiveTask = await TimesheetModel.findOne({
        $and: [
          {
            $or: [
              { employeeId: { $in: employee.identityTokens } },
              { employee: { $in: employee.identityTokens } },
            ],
          },
          { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
          { taskStatus: { $in: ['In Progress', 'Paused', 'Session Incomplete'] } },
        ],
      }).sort({ loginTime: -1 });

      if (existingActiveTask && existingActiveTask.taskStatus === 'In Progress') {
        // Only auto-pause if it's explicitly 'In Progress'
        // This preserves the session history without creating duplicates
        const now = new Date();
        existingActiveTask.taskStatus = 'Paused';
        existingActiveTask.pausedAt = now;
        await existingActiveTask.save();
        await syncProjectForTimesheet(existingActiveTask);
      } else if (existingActiveTask) {
        // If there's a paused task, user must explicitly resume or stop it
        res.status(400).json({
          error: 'You have an incomplete task. Please resume or stop it before starting a new one.',
          existingTask: {
            project: existingActiveTask.project,
            startedAt: existingActiveTask.loginTime,
            taskStatus: existingActiveTask.taskStatus,
          },
        });
        return;
      }

      const assigned = await findAssignedTaskForEmployee(employee, assignedTaskId);
      if (!assigned) {
        res.status(404).json({ error: 'Assigned task not found' });
        return;
      }

      let taskProject = await ProjectModel.findById(assigned.projectId);

      if (!taskProject) {
        // Fallback: project may have been archived or deleted.
        // Use the metadata stored on the AssignedTask so the employee is not blocked.
        taskProject = {
          _id: assigned.projectId,
          projectName: assigned.projectName,
          clientName: assigned.clientName || '',
          technologyNode: assigned.technologyNode || '',
        } as any;
      }

      if (assigned.status === 'completed') {
        res.status(400).json({ error: 'This task is already completed' });
        return;
      }

      if (assigned.status !== 'assigned') {
        const linkedTimesheetId = assigned.timesheetId ? assigned.timesheetId.toString() : null;
        const linkedTimesheet = linkedTimesheetId ? await TimesheetModel.findById(linkedTimesheetId) : null;
        const hasOpenLog = !!linkedTimesheet && (!linkedTimesheet.logoutTime || linkedTimesheet.logoutTime === null);

        if (hasOpenLog) {
          res.status(400).json({ error: 'Stop your current task before starting a new one' });
          return;
        }

        assigned.status = 'assigned';
        assigned.timesheetId = undefined;
        await assigned.save();
      }

      if (assigned.status !== 'assigned') {
        res.status(400).json({ error: 'This task is not available to start' });
        return;
      }

      // Pin to a const so TypeScript flow analysis keeps the non-null guarantee inside the async callback
      const resolvedProject = taskProject!;
      const now = new Date();
      const workNote =
        (typeof description === 'string' ? description.trim() : '') ||
        assigned.title ||
        resolvedProject.projectName;
      const session = await mongoose.startSession();

      try {
        let timesheet: any;
        await session.withTransaction(async () => {
          timesheet = new TimesheetModel({
            employee: employee.employeeName || employee.name,
            employeeId: employee.employeeId || employee.id,
            projectId: resolvedProject._id,
            project: resolvedProject.projectName,
            client: resolvedProject.clientName,
            technologyNode: resolvedProject.technologyNode,
            loginTime: now,
            task: workNote,
            billable: true,
            status: 'Pending',
            approvalStatus: 'Pending',
            requestStatus: 'No Request',
            taskStatus: 'In Progress',
          });

          timesheet.totalHours = 0;
          await timesheet.save({ session });
          await syncProjectForTimesheet(timesheet, session);

          if (assigned) {
            assigned.status = 'in_progress';
            assigned.timesheetId = timesheet._id as Types.ObjectId;
            await assigned.save({ session });
          }
        });

        res.status(201).json({
          timesheet: toFrontendTimesheet(timesheet),
          assignedTask: toFrontendAssignedTask(assigned),
          startedAt: now.toISOString(),
        });

        // Trigger reminder email immediately if checking in late (9 PM IST or later)
        const checkInHour = now.getHours();
        if (checkInHour >= 21 && attendance && !attendance.reminderSent) {
          attendance.reminderSent = true;
          await attendance.save();

          const settings = await getAutoCheckoutSettings();
          const autoCheckoutTimeStr = settings.autoCheckoutTime || '00:00';
          const [ah, am] = autoCheckoutTimeStr.split(':').map(Number);
          const period = ah >= 12 ? 'PM' : 'AM';
          const displayH = ah % 12 === 0 ? 12 : ah % 12;
          const displayM = String(am).padStart(2, '0');
          const displayAutoCheckout = `${displayH}:${displayM} ${period}`;

          if (employee.email) {
            void sendCheckoutReminderEmail({
              to: employee.email,
              employeeName: employee.employeeName || employee.name,
              checkInTime: attendance.checkInTime,
              autoCheckoutTime: displayAutoCheckout,
              projectName: resolvedProject.projectName,
              activeDurationMs: 0,
            }).catch((err) => console.error('Failed to send immediate late checkout email:', err));
          }
        }
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error starting task:', error);
      res.status(500).json({ error: 'Failed to start task' });
    }
  },

  stopActiveTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { timesheetId } = req.body;
      const openLog = timesheetId
        ? await findTimesheetByIdAndEmployee(timesheetId, employee)
        : await findOpenTimesheet(employee);

      if (!openLog) {
        res.status(400).json({ error: 'No active task to stop' });
        return;
      }

      const now = new Date();
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          if (openLog.taskStatus === 'Paused') {
            finalizePauseAccumulation(openLog);
          }
          openLog.logoutTime = now;
          openLog.totalHours = computeTotalHours(
            openLog.loginTime,
            openLog.logoutTime,
            openLog.overriddenHours,
            openLog.totalPausedMs
          );
          openLog.taskStatus = 'Pending';
          await openLog.save({ session });
          await syncProjectForTimesheet(openLog, session);
          await releaseAssignedTask(openLog._id.toString(), session);
        });

        res.json({
          timesheet: toFrontendTimesheet(openLog),
          stoppedAt: now.toISOString(),
        });
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error stopping task:', error);
      res.status(500).json({ error: 'Failed to stop task' });
    }
  },

  pauseActiveTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { timesheetId } = req.body;
      const openLog = timesheetId
        ? await findTimesheetByIdAndEmployee(timesheetId, employee)
        : await TimesheetModel.findOne({
            $and: [
              {
                $or: [
                  { employeeId: { $in: employee.identityTokens } },
                  { employee: { $in: employee.identityTokens } },
                ],
              },
              { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
              { taskStatus: { $in: ['In Progress', 'Session Incomplete'] } },
            ],
          });

      if (!openLog) {
        res.status(400).json({ error: 'No active task to pause' });
        return;
      }
      if (openLog.taskStatus === 'Paused') {
        res.status(400).json({ error: 'Task is already paused' });
        return;
      }

      const now = new Date();
      openLog.taskStatus = 'Paused';
      openLog.pausedAt = now;
      await openLog.save();
      await syncProjectForTimesheet(openLog);

      res.json({
        timesheet: toFrontendTimesheet(openLog),
        pausedAt: now.toISOString(),
      });
    } catch (error) {
      console.error('Error pausing task:', error);
      res.status(500).json({ error: 'Failed to pause task' });
    }
  },

  resumeActiveTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { timesheetId } = req.body;
      const openLog = timesheetId
        ? await findTimesheetByIdAndEmployee(timesheetId, employee)
        : await TimesheetModel.findOne({
            $and: [
              {
                $or: [
                  { employeeId: { $in: employee.identityTokens } },
                  { employee: { $in: employee.identityTokens } },
                ],
              },
              { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
              { taskStatus: 'Paused' },
            ],
          }).sort({ updatedAt: -1 });

      if (!openLog || openLog.taskStatus !== 'Paused') {
        res.status(400).json({ error: 'No paused task to resume' });
        return;
      }

      // Automatically pause any running task
      const runningLog = await TimesheetModel.findOne({
        $and: [
          {
            $or: [
              { employeeId: { $in: employee.identityTokens } },
              { employee: { $in: employee.identityTokens } },
            ],
          },
          { _id: { $ne: openLog._id } },
          { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
          { taskStatus: { $in: ['In Progress', 'Session Incomplete'] } },
        ],
      });

      if (runningLog) {
        const now = new Date();
        runningLog.taskStatus = 'Paused';
        runningLog.pausedAt = now;
        await runningLog.save();
        await syncProjectForTimesheet(runningLog);
      }

      finalizePauseAccumulation(openLog);
      openLog.taskStatus = 'In Progress';
      await openLog.save();
      await syncProjectForTimesheet(openLog);

      res.json({
        timesheet: toFrontendTimesheet(openLog),
        resumedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error resuming task:', error);
      res.status(500).json({ error: 'Failed to resume task' });
    }
  },

  completeActiveTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { timesheetId, description } = req.body;
      const openLog = timesheetId
        ? await findTimesheetByIdAndEmployee(timesheetId, employee)
        : await findOpenTimesheet(employee);

      if (!openLog) {
        res.status(400).json({ error: 'No active task to complete' });
        return;
      }

      const completionSummary =
        (typeof description === 'string' ? description.trim() : '') ||
        (typeof openLog.task === 'string' ? openLog.task.trim() : '') ||
        openLog.project ||
        'Session completed';
      const now = new Date();
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          if (openLog.taskStatus === 'Paused') {
            finalizePauseAccumulation(openLog);
          }

          openLog.logoutTime = now;
          openLog.task = completionSummary;
          openLog.totalHours = computeTotalHours(
            openLog.loginTime,
            openLog.logoutTime,
            openLog.overriddenHours,
            openLog.totalPausedMs
          );
          openLog.taskStatus = 'Completed';
          openLog.approvalStatus = 'Pending';
          openLog.status = 'Pending';
          if (openLog.requestStatus !== 'Rejected') {
            openLog.requestStatus = 'No Request';
          }

          await openLog.save({ session });

          const linkedAssigned = await AssignedTaskModel.findOne({
            projectId: openLog.projectId,
            $or: [
              { timesheetId: openLog._id },
              { employeeId: { $in: employee.identityTokens } },
              { employeeName: { $in: employee.identityTokens } },
              { employeeId: openLog.employeeId },
              { employeeName: openLog.employee },
            ],
          }).session(session);

          if (linkedAssigned) {
            linkedAssigned.status = 'assigned';
            linkedAssigned.timesheetId = undefined;
            await linkedAssigned.save({ session });
          } else {
            await AssignedTaskModel.updateMany(
              {
                projectId: openLog.projectId,
                $or: [
                  { timesheetId: openLog._id },
                  { employeeId: { $in: employee.identityTokens } },
                  { employeeName: { $in: employee.identityTokens } },
                  { employeeId: openLog.employeeId },
                  { employeeName: openLog.employee },
                ],
              },
              { $set: { status: 'assigned', timesheetId: undefined } },
              { session }
            );
          }

          await syncProjectForTimesheet(openLog, session);
        });

        res.json({
          timesheet: toFrontendTimesheet(openLog),
          completedAt: now.toISOString(),
        });
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error completing task:', error);
      res.status(500).json({ error: 'Failed to complete task' });
    }
  },

  getAutoCheckoutSettings: async (_req: Request, res: Response): Promise<void> => {
    try {
      const settings = await getAutoCheckoutSettings();
      res.json({
        reminderTime: settings.reminderTime,
        autoCheckoutTime: settings.autoCheckoutTime,
        enabled: settings.enabled,
      });
    } catch (error) {
      console.error('Error fetching auto-checkout settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  },

  updateAutoCheckoutSettings: async (req: Request, res: Response): Promise<void> => {
    try {
      const { reminderTime, autoCheckoutTime, enabled } = req.body;

      if (reminderTime && !/^\d{2}:\d{2}$/.test(reminderTime)) {
        res.status(400).json({ error: 'reminderTime must be in HH:mm format' });
        return;
      }
      if (autoCheckoutTime && !/^\d{2}:\d{2}$/.test(autoCheckoutTime)) {
        res.status(400).json({ error: 'autoCheckoutTime must be in HH:mm format' });
        return;
      }

      const settings = await updateAutoCheckoutSettings({ reminderTime, autoCheckoutTime, enabled });
      await restartScheduler();

      res.json({
        reminderTime: settings.reminderTime,
        autoCheckoutTime: settings.autoCheckoutTime,
        enabled: settings.enabled,
      });
    } catch (error) {
      console.error('Error updating auto-checkout settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  },

  getMySessionStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const attendance = await EmployeeAttendanceModel.findOne(
        openAttendanceFilter({ employeeId: employee.id })
      ).sort({ checkInTime: -1 });

      if (!attendance) {
        res.json({ active: false });
        return;
      }

      const settings = await getAutoCheckoutSettings();

      res.json({
        active: true,
        sessionStatus: attendance.sessionStatus,
        checkInTime: attendance.checkInTime.toISOString(),
        expectedCheckoutTime: attendance.expectedCheckoutTime?.toISOString() ?? null,
        autoCheckoutTime: attendance.autoCheckoutTime?.toISOString() ?? null,
        reminderSent: attendance.reminderSent,
        autoCheckedOut: attendance.autoCheckedOut,
        autoCheckoutEnabled: attendance.autoCheckoutEnabled,
        settings: {
          reminderTime: settings.reminderTime,
          autoCheckoutTime: settings.autoCheckoutTime,
          enabled: settings.enabled,
        },
      });
    } catch (error) {
      console.error('Error fetching session status:', error);
      res.status(500).json({ error: 'Failed to fetch session status' });
    }
  },

  getCurrentElapsed: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const openAttendance = await EmployeeAttendanceModel.findOne(
        openAttendanceFilter({ employeeId: employee.id })
      )
        .sort({ checkInTime: -1 })
        .lean();

      if (!openAttendance) {
        res.json({ hasActiveSession: false, elapsedMs: 0, serverTime: new Date().toISOString() });
        return;
      }

      const now = new Date();
      const checkInTime = new Date(openAttendance.checkInTime);
      const elapsedMs = now.getTime() - checkInTime.getTime();

      const sessionTasks = await TimesheetModel.find({
        $and: [
          {
            $or: [
              { employeeId: { $in: employee.identityTokens } },
              { employee: { $in: employee.identityTokens } },
            ],
          },
          { loginTime: { $gte: checkInTime } },
          { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
        ],
      }).lean();

      let totalPausedMs = sessionTasks.reduce((sum, task) => sum + (task.totalPausedMs || 0), 0);

      // If any task is currently paused, add pause duration
      const pausedTask = sessionTasks.find(t => t.taskStatus === 'Paused' && t.pausedAt);
      if (pausedTask && pausedTask.pausedAt) {
        totalPausedMs += now.getTime() - new Date(pausedTask.pausedAt).getTime();
      }

      res.json({
        hasActiveSession: true,
        checkInTime: openAttendance.checkInTime.toISOString(),
        elapsedMs: Math.max(0, elapsedMs - totalPausedMs),
        totalPausedMs,
        sessionStatus: openAttendance.sessionStatus,
        serverTime: now.toISOString(),
      });
    } catch (error) {
      console.error('Error fetching current elapsed:', error);
      res.status(500).json({ error: 'Failed to fetch elapsed duration' });
    }
  },
};
