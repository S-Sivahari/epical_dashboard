import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import { getDB } from '../config/db';
import { getUserById } from '../services/authService';
import { resolveEmployeeForAuthUser, getEmployeeOfficialEmail } from '../utils/employeeAuth';
import { syncProjectForTimesheet, getTimesheetWorkflowStatus } from '../utils/syncProject';
import { buildAssignmentIdentityTokens, ensureAssignedTasksForEmployee } from '../utils/assignedTaskSync';
import { finalizeOpenTimesheetsForCheckout } from '../services/projectBreakDeductionService';
import {
  expireBreakForAttendanceRecord,
  finalizeBreakEnd,
  tryExpireBreakForEmployee,
} from '../services/breakAutoResumeService';
import {
  applyDailyCappedBreakDeduction,
  getOrCreateDailyBreakState,
  isDailyBreakSlotUsed,
  markDailyBreakSlotStarted,
  mergeDailyBreakWithOpenSession,
} from '../services/dailyBreakStateService';
import {
  FULL_DAY_TOO_SHORT_MESSAGE,
  isFullDayCheckoutTooShort,
  resolveDefaultCheckoutBreakDeduction,
} from '../services/checkoutBreakPolicy';
import { buildEmployeeVisibleProjectsFilter } from '../utils/assignedProjectsHelper';
import { openAttendanceFilter, timesheetsForCalendarDayFilter } from '../utils/attendanceQueries';
import { computeTotalHoursDecimal } from '../utils/durationFormat';
import { getAutoCheckoutSettings, updateAutoCheckoutSettings } from '../services/autoCheckoutService';
import { env } from '../config/env';
import { restartScheduler } from '../services/timesheetScheduler';
import { sendCheckoutReminderEmail } from '../services/emailService';
import { buildNextSchedulerClockTime, calendarDayBounds, getSchedulerDateKey, getSchedulerHourMinute, resolveSchedulerAutoCheckoutDeadline } from '../utils/istClock';
import {
  closeProductiveSessionsForEmployee,
  resumeProductiveSessionsForEmployee,
  closeProductiveSessionsForProjectEmployee,
  resumeProductiveSessionsForProjectEmployee,
  WORK_SESSION_REASONS,
} from '../services/productiveTimeService';
import {
  beginCellWorkForEmployee,
  listStartableCellsForProject,
} from '../services/employeeCellWorkService';
import {
  activeBreakExpired,
  breakMinTimeReached,
  buildBreaksPayload,
  computeGrossAttendanceMs,
  computeUsedBreakMs,
  isWorkBreakType,
  WORK_BREAKS,
  type WorkBreakType,
} from '../utils/workBreaks';
import { normalizeEmployeeView } from '../utils/employeeView';
import { normalizeCellWorkflow } from '../utils/cellWorkflow';
import { getActiveWorkStage } from '../services/productiveTimeService';
import {
  computeLiveWorkingMs,
  computeSessionWorkedMs,
  computeWorkingHours,
  resolveSessionWorkedMs,
  workingMsToDecimalHours,
  type WorkDayType,
} from '../services/workingTimeService';
import { enrichAttendanceSessionRow } from '../services/workSessionService';

type ResolvedEmployee = {
  id: string;
  name: string;
  email?: string;
  officialEmail?: string;
  employeeName: string;
  employeeId: string;
  identityTokens: string[];
  view: 'Public' | 'Private';
  isTimesheetEligible: boolean;
};

function isWorkDayType(value: unknown): value is WorkDayType {
  return value === 'half_day' || value === 'full_day';
}

function rejectPrivateEmployee(employee: ResolvedEmployee, res: Response): boolean {
  if (employee.isTimesheetEligible) return false;
  res.status(403).json({
    error: 'Timesheet check-in and project tracking are not available for private employee records.',
  });
  return true;
}

function todayDateKey(): string {
  return getSchedulerDateKey(new Date());
}

function computeAttendanceHours(
  checkInTime: Date,
  checkOutTime?: Date | null,
  attendance?: {
    morningBreakAt?: Date | null;
    lunchBreakAt?: Date | null;
    eveningBreakAt?: Date | null;
    morningBreakMs?: number | null;
    lunchBreakMs?: number | null;
    eveningBreakMs?: number | null;
    activeBreakType?: WorkBreakType | null;
    activeBreakStartedAt?: Date | null;
    activeBreakEndsAt?: Date | null;
    workDayType?: WorkDayType | null;
  } | null,
  now = new Date(),
  options?: { taskPausedMs?: number; taskCurrentlyPaused?: boolean },
): number {
  return computeWorkingHours(
    {
      checkInTime,
      checkOutTime: checkOutTime ?? null,
      morningBreakAt: attendance?.morningBreakAt,
      lunchBreakAt: attendance?.lunchBreakAt,
      eveningBreakAt: attendance?.eveningBreakAt,
      morningBreakMs: attendance?.morningBreakMs,
      lunchBreakMs: attendance?.lunchBreakMs,
      eveningBreakMs: attendance?.eveningBreakMs,
      activeBreakType: attendance?.activeBreakType,
      activeBreakStartedAt: attendance?.activeBreakStartedAt,
      activeBreakEndsAt: attendance?.activeBreakEndsAt,
      workDayType: attendance?.workDayType,
    },
    {
      now,
      taskPausedMs: options?.taskPausedMs,
      taskCurrentlyPaused: options?.taskCurrentlyPaused,
    },
  );
}

async function enrichAttendanceHistoryForEmployee(
  records: Array<InstanceType<typeof EmployeeAttendanceModel>>,
  identityTokens: string[],
) {
  return Promise.all(
    records.map(async (record) => {
      const base = toFrontendAttendance(record);
      const session = await enrichAttendanceSessionRow(record, identityTokens);
      return {
        ...base,
        breakMs: session.breakMs,
        project: session.project,
        projects: session.projects,
        displayWorkedMs: session.displayWorkedMs,
      };
    }),
  );
}

function toFrontendAttendance(a: {
  _id: Types.ObjectId;
  date: string;
  checkInTime: Date;
  checkOutTime?: Date | null;
  sessionStatus?: string;
  autoCheckedOut?: boolean;
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  morningBreakMs?: number | null;
  lunchBreakMs?: number | null;
  eveningBreakMs?: number | null;
  activeBreakType?: WorkBreakType | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
  workDayType?: WorkDayType | null;
  sessionWorkedMs?: number | null;
}) {
  const workedMs = resolveSessionWorkedMs(a);
  return {
    id: a._id.toString(),
    date: a.date,
    checkInTime: a.checkInTime.toISOString(),
    checkOutTime: a.checkOutTime ? a.checkOutTime.toISOString() : null,
    sessionWorkedMs: a.checkOutTime ? workedMs : undefined,
    hours: workingMsToDecimalHours(workedMs),
    workDayType: a.workDayType ?? null,
    sessionStatus: a.sessionStatus ?? 'Active',
    autoCheckedOut: a.autoCheckedOut ?? false,
    breaks: buildBreaksPayload(a),
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
    workedMs: typeof t.workedMs === 'number' && t.workedMs >= 0 ? t.workedMs : undefined,
    breakMs: typeof t.breakMs === 'number' && t.breakMs >= 0 ? t.breakMs : undefined,
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

  const view = normalizeEmployeeView(employeeRecord?.view as string | undefined);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    officialEmail: employeeRecord
      ? getEmployeeOfficialEmail(employeeRecord as { email?: string; personalEmail?: string })
      : undefined,
    employeeName,
    employeeId,
    identityTokens,
    view,
    isTimesheetEligible: view === 'Public',
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
              $cond: [
                {
                  $and: [
                    { $ne: [{ $ifNull: ['$workedMs', null] }, null] },
                    { $gte: ['$workedMs', 0] },
                  ],
                },
                { $divide: ['$workedMs', 3600000] },
                {
                  $let: {
                    vars: {
                      endMs: { $toLong: { $ifNull: ['$logoutTime', now] } },
                      startMs: { $toLong: '$loginTime' },
                      pausedMs: {
                        $add: [
                          { $ifNull: ['$totalPausedMs', 0] },
                          {
                            $cond: [
                              {
                                $and: [
                                  { $eq: ['$taskStatus', 'Paused'] },
                                  { $ne: [{ $ifNull: ['$pausedAt', null] }, null] },
                                  { $eq: [{ $ifNull: ['$logoutTime', null] }, null] },
                                ],
                              },
                              { $subtract: [{ $toLong: now }, { $toLong: '$pausedAt' }] },
                              0,
                            ],
                          },
                        ],
                      },
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
          ],
        },
      },
    },
    {
      $group: {
        _id: '$projectId',
        project: { $first: '$project' },
        hours: { $sum: '$effectiveHours' },
        sessions: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        projectId: { $toString: '$_id' },
        project: '$project',
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
  if (!employee.isTimesheetEligible) return [];

  const recentApprovedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const visibleProjectFilter = await buildEmployeeVisibleProjectsFilter(employee.identityTokens);
  const eligibleProjects = await ProjectModel.find(visibleProjectFilter, { _id: 1 }).lean();
  const eligibleProjectIds = eligibleProjects.map((p) => p._id);
  if (eligibleProjectIds.length === 0) return [];

  const tasks = await AssignedTaskModel.find({
    $and: [
      { projectId: { $in: eligibleProjectIds } },
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
  dailyBreaks?: Awaited<ReturnType<typeof getOrCreateDailyBreakState>>,
) {
  const date = todayDateKey();
  const attendance = (openAttendance ?? latestAttendance) as any;
  const mergedBreaks = dailyBreaks
    ? mergeDailyBreakWithOpenSession(dailyBreaks, openAttendance ?? undefined)
    : openAttendance ?? latestAttendance ?? {};
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
    breaks: buildBreaksPayload(mergedBreaks as any),
  };
}

async function buildAttendanceResponseForEmployee(
  employeeId: string,
  openAttendance: Awaited<ReturnType<typeof requireOpenAttendance>>,
  latestAttendance: Awaited<ReturnType<typeof EmployeeAttendanceModel.findOne>>,
) {
  const date = openAttendance?.date ?? latestAttendance?.date ?? todayDateKey();
  const dailyBreaks = await getOrCreateDailyBreakState(employeeId, date);
  return buildAttendanceResponse(openAttendance, latestAttendance, dailyBreaks);
}

async function pauseRunningTaskForBreak(employee: ResolvedEmployee, attendance: InstanceType<typeof EmployeeAttendanceModel>) {
  const openLog = await TimesheetModel.findOne({
    $and: [
      {
        $or: [
          { employeeId: { $in: employee.identityTokens } },
          { employee: { $in: employee.identityTokens } },
        ],
      },
      { loginTime: { $gte: attendance.checkInTime } },
      { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
      { taskStatus: { $in: ['In Progress', 'Session Incomplete'] } },
    ],
  }).sort({ loginTime: -1 });

  if (!openLog) return null;

  const now = new Date();
  openLog.taskStatus = 'Paused';
  openLog.pausedAt = now;
  await openLog.save();
  return openLog._id.toString();
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

async function captureResumeCellForCheckout(
  employee: ResolvedEmployee,
  openLog: { projectId: Types.ObjectId } | null,
): Promise<{ resumeProjectId?: string; resumeCellId?: string }> {
  if (!openLog) return {};

  const cells = await ProjectCellModel.find({
    projectId: openLog.projectId,
    assignedEmployeeId: { $in: employee.identityTokens },
    status: 'in_progress',
    onHold: { $ne: true },
  })
    .select({ workflow: 1 })
    .lean();

  for (const cell of cells) {
    const workflow = normalizeCellWorkflow(cell.workflow ?? []);
    if (getActiveWorkStage(workflow)) {
      return {
        resumeProjectId: openLog.projectId.toString(),
        resumeCellId: String(cell._id),
      };
    }
  }

  return {};
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

      let openAttendance = await requireOpenAttendance(employee.id);
      if (openAttendance) {
        await expireBreakForAttendanceRecord(openAttendance);
        openAttendance = await requireOpenAttendance(employee.id);
      }

      const [latestAttendance, activePayload, assignedTasks, sessions, attendanceHistory, projectWiseHours] =
        await Promise.all([
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
        timesheetEligible: employee.isTimesheetEligible,
        employeeView: employee.view,
        attendance: await buildAttendanceResponseForEmployee(employee.id, openAttendance, latestAttendance),
        active: activePayload.active,
        pausedTasks: activePayload.pausedTasks,
        assignedTasks,
        sessions: sessions.map(toFrontendTimesheet),
        attendanceHistory: await enrichAttendanceHistoryForEmployee(
          attendanceHistory as Array<InstanceType<typeof EmployeeAttendanceModel>>,
          employee.identityTokens,
        ),
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

      let openAttendance = await requireOpenAttendance(employee.id);
      if (openAttendance) {
        await expireBreakForAttendanceRecord(openAttendance);
        openAttendance = await requireOpenAttendance(employee.id);
      }
      const latestAttendance = await EmployeeAttendanceModel.findOne({ employeeId: employee.id }).sort({
        checkInTime: -1,
      });

      res.json(await buildAttendanceResponseForEmployee(employee.id, openAttendance, latestAttendance));
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

      const enriched = await enrichAttendanceHistoryForEmployee(records, employee.identityTokens);

      res.json(enriched);
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
      if (rejectPrivateEmployee(employee, res)) return;

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
        const checkoutClock = settings.autoCheckoutTime || env.DEFAULT_AUTO_CHECKOUT_TIME;
        return resolveSchedulerAutoCheckoutDeadline(now, checkoutClock);
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
        employeeEmail: employee.officialEmail || employee.email,
        date,
        checkInTime: now,
        expectedCheckoutTime: buildExpectedCheckout(),
        autoCheckoutTime: buildAutoCheckout(),
        autoCheckoutEnabled: true,
        reminderSent: false,
        autoCheckedOut: false,
        sessionStatus: 'Active',
      });

      // Cell productive time resumes when a project task is started (see startTask).

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
      if (rejectPrivateEmployee(employee, res)) return;

      const attendance = await requireOpenAttendance(employee.id);
      if (!attendance) {
        res.status(400).json({ error: 'You are not checked in' });
        return;
      }

      const workDayTypeRaw = req.body?.workDayType;
      const workDayType: WorkDayType = isWorkDayType(workDayTypeRaw) ? workDayTypeRaw : 'full_day';

      const now = new Date();
      if (attendance.activeBreakType) {
        res.status(400).json({ error: 'End your break before checking out.' });
        return;
      }

      const sessionBreakMs = computeUsedBreakMs(attendance, now);
      const grossMs = computeGrossAttendanceMs(attendance.checkInTime, now);

      const defaultBreakDeductionMs =
        workDayType === 'half_day'
          ? 0
          : await resolveDefaultCheckoutBreakDeduction(
              employee.id,
              attendance.date,
              sessionBreakMs,
            );

      if (
        workDayType === 'full_day' &&
        isFullDayCheckoutTooShort(grossMs, sessionBreakMs, defaultBreakDeductionMs)
      ) {
        res.status(400).json({
          error: FULL_DAY_TOO_SHORT_MESSAGE,
          code: 'USE_HALF_DAY_CHECKOUT',
        });
        return;
      }

      const sessionPreview = computeSessionWorkedMs(
        attendance.checkInTime,
        now,
        attendance,
        workDayType,
        defaultBreakDeductionMs,
      );
      const session = await mongoose.startSession();

      try {
        let stoppedTasks = 0;
        let resumeCell: { resumeProjectId?: string; resumeCellId?: string } = {};
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
          resumeCell = await captureResumeCellForCheckout(
            employee,
            openLogs[0] ?? null,
          );

          const updatedLogs = finalizeOpenTimesheetsForCheckout(attendance, openLogs, now, {
            workDayType,
            defaultBreakDeductionMs,
          });

          const openLogIds = new Set(openLogs.map((log) => log._id.toString()));
          for (const log of updatedLogs) {
            await log.save({ session });
            await syncProjectForTimesheet(log, session);
            if (openLogIds.has(log._id.toString())) {
              await releaseAssignedTask(log._id.toString(), session);
            }
          }

          attendance.checkOutTime = now;
          attendance.sessionStatus = 'Completed';
          attendance.workDayType = workDayType;
          attendance.sessionWorkedMs =
            typeof updatedLogs[0]?.workedMs === 'number' && updatedLogs[0].workedMs >= 0
              ? updatedLogs[0].workedMs
              : undefined;
          attendance.defaultBreakDeductedMs = sessionPreview.defaultDeductedMs;
          attendance.resumeProjectId = resumeCell.resumeProjectId;
          attendance.resumeCellId = resumeCell.resumeCellId;
          await attendance.save({ session });
        });

        if (defaultBreakDeductionMs > 0) {
          await applyDailyCappedBreakDeduction(
            employee.id,
            attendance.date,
            defaultBreakDeductionMs,
          );
        }

        void closeProductiveSessionsForEmployee(
          employee.identityTokens,
          WORK_SESSION_REASONS.PROJECT_CHECKED_OUT,
          now,
        ).catch((err) => console.error('[timesheet] productive time checkout sync failed:', err));

        res.json({
          serverTime: new Date().toISOString(),
          checkedIn: false,
          checkOutTime: now.toISOString(),
          stoppedTasks,
          sessionStatus: 'Completed',
          workDayType,
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
      if (rejectPrivateEmployee(employee, res)) return;

      const attendance = await requireOpenAttendance(employee.id);
      if (!attendance) {
        res.status(400).json({ error: 'Please check in before starting a task' });
        return;
      }

      if (attendance.activeBreakType && !activeBreakExpired(attendance)) {
        res.status(400).json({ error: 'Finish your break before starting work again' });
        return;
      }

      const { assignedTaskId, description, cellId } = req.body as {
        assignedTaskId?: string;
        description?: string;
        cellId?: string;
      };
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

        void resumeProductiveSessionsForProjectEmployee(
          resolvedProject._id.toString(),
          employee.identityTokens,
          { userId: employee.id, userName: employee.employeeName || employee.name, role: 'Employee' },
          now,
        ).catch((err) => console.error('[timesheet] productive time start-task sync failed:', err));

        let cellWorkStarted: { cellId: string; cellName: string } | null = null;
        let cellWorkError: string | null = null;
        let optionalCellId = typeof cellId === 'string' ? cellId.trim() : '';

        if (!optionalCellId) {
          const lastCompleted = await EmployeeAttendanceModel.findOne({
            employeeId: employee.id,
            date: attendance.date,
            checkOutTime: { $exists: true, $ne: null },
            resumeCellId: { $exists: true, $ne: null },
          })
            .sort({ checkOutTime: -1 })
            .lean();

          if (
            lastCompleted?.resumeCellId &&
            lastCompleted.resumeProjectId === resolvedProject._id.toString()
          ) {
            optionalCellId = lastCompleted.resumeCellId;
          }
        }

        if (optionalCellId) {
          try {
            const { cell } = await beginCellWorkForEmployee(
              resolvedProject._id.toString(),
              optionalCellId,
              employee.identityTokens,
              { userId: employee.id, userName: employee.employeeName || employee.name, role: 'Employee' },
            );
            cellWorkStarted = { cellId: cell._id.toString(), cellName: cell.name };
          } catch (cellErr) {
            cellWorkError = cellErr instanceof Error ? cellErr.message : 'Failed to start cell work';
            console.error('[timesheet] optional cell work start failed:', cellErr);
          }
        }

        res.status(201).json({
          timesheet: toFrontendTimesheet(timesheet),
          assignedTask: toFrontendAssignedTask(assigned),
          startedAt: now.toISOString(),
          cellWorkStarted,
          cellWorkError,
        });

        // Trigger reminder email immediately if checking in late (9 PM IST or later)
        const { hours: checkInHour } = getSchedulerHourMinute(now);
        if (checkInHour >= 21 && attendance && !attendance.reminderSent) {
          attendance.reminderSent = true;
          await attendance.save();

          const settings = await getAutoCheckoutSettings();
          const autoCheckoutTimeStr = settings.autoCheckoutTime || env.DEFAULT_AUTO_CHECKOUT_TIME;
          const [ah, am] = autoCheckoutTimeStr.split(':').map(Number);
          const period = ah >= 12 ? 'PM' : 'AM';
          const displayH = ah % 12 === 0 ? 12 : ah % 12;
          const displayM = String(am).padStart(2, '0');
          const displayAutoCheckout = `${displayH}:${displayM} ${period}`;

          const checkoutEmail = employee.officialEmail || employee.email;
          if (checkoutEmail) {
            void sendCheckoutReminderEmail({
              to: checkoutEmail,
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

        void closeProductiveSessionsForProjectEmployee(
          openLog.projectId.toString(),
          employee.identityTokens,
          WORK_SESSION_REASONS.PROJECT_CHECKED_OUT,
          now,
        ).catch((err) => console.error('[timesheet] productive time stop-task sync failed:', err));

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

      void closeProductiveSessionsForProjectEmployee(
        openLog.projectId.toString(),
        employee.identityTokens,
        WORK_SESSION_REASONS.PROJECT_CHECKED_OUT,
        now,
      ).catch((err) => console.error('[timesheet] productive time pause sync failed:', err));

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

      void resumeProductiveSessionsForProjectEmployee(
        openLog.projectId.toString(),
        employee.identityTokens,
        { userId: employee.id, userName: employee.employeeName || employee.name, role: 'Employee' },
      ).catch((err) => console.error('[timesheet] productive time resume sync failed:', err));

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

        await closeProductiveSessionsForProjectEmployee(
          openLog.projectId.toString(),
          employee.identityTokens,
          WORK_SESSION_REASONS.PROJECT_CHECKED_OUT,
          now,
        );

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

      const now = new Date();
      await tryExpireBreakForEmployee(employee.id, now);

      const openAttendance = await EmployeeAttendanceModel.findOne(
        openAttendanceFilter({ employeeId: employee.id })
      )
        .sort({ checkInTime: -1 })
        .lean();

      if (!openAttendance) {
        res.json({ hasActiveSession: false, elapsedMs: 0, serverTime: new Date().toISOString() });
        return;
      }

      const checkInTime = new Date(openAttendance.checkInTime);

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

      const pausedTask = sessionTasks.find((t) => t.taskStatus === 'Paused' && t.pausedAt);
      const taskCurrentlyPaused = Boolean(pausedTask?.pausedAt);
      if (pausedTask?.pausedAt) {
        totalPausedMs += now.getTime() - new Date(pausedTask.pausedAt).getTime();
      }

      const workingElapsedMs = computeLiveWorkingMs(openAttendance, {
        taskPausedMs: totalPausedMs,
        taskCurrentlyPaused,
        now,
      });

      const runningTask = sessionTasks.find(
        (t) => t.taskStatus === 'In Progress' || t.taskStatus === 'Session Incomplete',
      );
      const taskAnchor = runningTask?.loginTime
        ? new Date(runningTask.loginTime)
        : pausedTask?.loginTime
          ? new Date(pausedTask.loginTime)
          : null;

      let taskElapsedMs: number | null = null;
      if (taskAnchor) {
        let taskPausedMs = (runningTask || pausedTask)?.totalPausedMs || 0;
        if (pausedTask?.pausedAt) {
          taskPausedMs += now.getTime() - new Date(pausedTask.pausedAt).getTime();
        }
        taskElapsedMs = Math.max(0, now.getTime() - taskAnchor.getTime() - taskPausedMs);
      }

      res.json({
        hasActiveSession: true,
        checkInTime: openAttendance.checkInTime.toISOString(),
        elapsedMs: workingElapsedMs,
        taskElapsedMs: taskElapsedMs ?? workingElapsedMs,
        taskLoginTime: taskAnchor?.toISOString() ?? null,
        totalPausedMs,
        onBreak: Boolean(openAttendance.activeBreakType),
        sessionStatus: openAttendance.sessionStatus,
        serverTime: now.toISOString(),
      });
    } catch (error) {
      console.error('Error fetching current elapsed:', error);
      res.status(500).json({ error: 'Failed to fetch elapsed duration' });
    }
  },

  startBreak: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (rejectPrivateEmployee(employee, res)) return;

      const breakType = req.body?.breakType;
      if (!isWorkBreakType(breakType)) {
        res.status(400).json({ error: 'Invalid break type' });
        return;
      }

      const attendance = await requireOpenAttendance(employee.id);
      if (!attendance) {
        res.status(400).json({ error: 'You are not checked in' });
        return;
      }

      await expireBreakForAttendanceRecord(attendance);

      const daily = await getOrCreateDailyBreakState(employee.id, attendance.date);
      if (isDailyBreakSlotUsed(daily, breakType)) {
        res.status(400).json({ error: `${WORK_BREAKS[breakType].label} has already been used today` });
        return;
      }

      if (attendance.activeBreakType) {
        res.status(400).json({ error: 'Another break is already in progress' });
        return;
      }

      const now = new Date();
      const breakConfig = WORK_BREAKS[breakType];
      const pausedTimesheetId = await pauseRunningTaskForBreak(employee, attendance);

      const usedField =
        breakType === 'morning' ? 'morningBreakAt' : breakType === 'lunch' ? 'lunchBreakAt' : 'eveningBreakAt';
      attendance[usedField as 'morningBreakAt' | 'lunchBreakAt' | 'eveningBreakAt'] = now;
      attendance.activeBreakType = breakType;
      attendance.activeBreakStartedAt = now;
      attendance.activeBreakEndsAt = new Date(now.getTime() + breakConfig.durationMs);
      attendance.breakPausedTimesheetId = pausedTimesheetId ?? undefined;
      await attendance.save();
      await markDailyBreakSlotStarted(employee.id, attendance.date, breakType, now);

      void closeProductiveSessionsForEmployee(
        employee.identityTokens,
        WORK_SESSION_REASONS.HOLD,
        now,
      ).catch((err) => console.error('[timesheet] cell break hold sync failed:', err));

      const activePayload = await fetchActiveTaskPayload(employee);
      const mergedDaily = await getOrCreateDailyBreakState(employee.id, attendance.date);

      res.json({
        serverTime: now.toISOString(),
        breaks: buildBreaksPayload(mergeDailyBreakWithOpenSession(mergedDaily, attendance) as any, now),
        active: activePayload.active,
        pausedTasks: activePayload.pausedTasks,
      });
    } catch (error) {
      console.error('Error starting break:', error);
      res.status(500).json({ error: 'Failed to start break' });
    }
  },

  endBreak: async (req: Request, res: Response): Promise<void> => {
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

      if (!attendance.activeBreakType) {
        res.status(400).json({ error: 'No break is currently active' });
        return;
      }

      const now = new Date();
      if (!breakMinTimeReached(attendance, now)) {
        const minEndsAt = attendance.activeBreakStartedAt && attendance.activeBreakType
          ? new Date(
              new Date(attendance.activeBreakStartedAt).getTime()
                + WORK_BREAKS[attendance.activeBreakType].minDurationMs,
            )
          : null;
        res.status(400).json({
          error: 'Please wait until the minimum break time has passed before returning to work.',
          code: 'BREAK_MIN_NOT_REACHED',
          minEndsAt: minEndsAt?.toISOString() ?? null,
          remainingMs: minEndsAt ? Math.max(0, minEndsAt.getTime() - now.getTime()) : 0,
        });
        return;
      }

      const timesheetId = attendance.breakPausedTimesheetId;
      const breakType = attendance.activeBreakType;
      if (breakType) {
        await finalizeBreakEnd(attendance, breakType, now, timesheetId ?? undefined);
      }
      attendance.activeBreakType = undefined;
      attendance.activeBreakStartedAt = undefined;
      attendance.activeBreakEndsAt = undefined;
      attendance.breakPausedTimesheetId = undefined;
      await attendance.save();

      const activePayload = await fetchActiveTaskPayload(employee);
      const mergedDaily = await getOrCreateDailyBreakState(employee.id, attendance.date);

      res.json({
        serverTime: new Date().toISOString(),
        breaks: buildBreaksPayload(mergeDailyBreakWithOpenSession(mergedDaily, attendance) as any),
        active: activePayload.active,
        pausedTasks: activePayload.pausedTasks,
      });
    } catch (error) {
      console.error('Error ending break:', error);
      res.status(500).json({ error: 'Failed to end break' });
    }
  },

  getStartableCells: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const assignedTaskId = String(req.query.assignedTaskId || '').trim();
      if (!assignedTaskId || !Types.ObjectId.isValid(assignedTaskId)) {
        res.status(400).json({ error: 'assignedTaskId is required' });
        return;
      }

      const assigned = await findAssignedTaskForEmployee(employee, assignedTaskId);
      if (!assigned) {
        res.status(404).json({ error: 'Assigned task not found' });
        return;
      }

      const cells = await listStartableCellsForProject(
        assigned.projectId.toString(),
        employee.identityTokens,
      );
      res.json({ projectId: assigned.projectId.toString(), cells });
    } catch (error) {
      console.error('Error loading startable cells:', error);
      res.status(500).json({ error: 'Failed to load startable cells' });
    }
  },

  startCellWork: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const attendance = await requireOpenAttendance(employee.id);
      if (!attendance) {
        res.status(400).json({ error: 'Please check in before starting cell work' });
        return;
      }

      const { projectId, cellId } = req.body as { projectId?: string; cellId?: string };
      if (!projectId || !cellId) {
        res.status(400).json({ error: 'projectId and cellId are required' });
        return;
      }

      const { cell } = await beginCellWorkForEmployee(
        projectId,
        cellId,
        employee.identityTokens,
        { userId: employee.id, userName: employee.employeeName || employee.name, role: 'Employee' },
      );

      res.status(201).json({
        cellId: cell._id.toString(),
        cellName: cell.name,
        projectId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start cell work';
      console.error('Error starting cell work:', error);
      res.status(400).json({ error: message });
    }
  },
};
