import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { ProjectModel } from '../models/Project';
import { getDB } from '../config/db';
import { getUserById } from '../services/authService';
import { syncProjectForTimesheet, getTimesheetWorkflowStatus } from '../utils/syncProject';
import { buildAssignmentIdentityTokens, ensureAssignedTasksForEmployee } from '../utils/assignedTaskSync';
import { getAutoCheckoutSettings, updateAutoCheckoutSettings } from '../services/autoCheckoutService';
import { restartScheduler } from '../services/timesheetScheduler';

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
}

async function findTimesheetByIdAndEmployee(timesheetId: string, employee: ResolvedEmployee) {
  if (!mongoose.Types.ObjectId.isValid(timesheetId)) return null;
  return TimesheetModel.findOne({
    _id: timesheetId,
    $and: [
      {
        $or: [
          { employeeId: { $in: employee.identityTokens } },
          { employee: { $in: employee.identityTokens } },
        ],
      },
      { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
    ],
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
    totalHours: t.totalHours,
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
  const employeeRecord = user.email
    ? await getDB().collection('employees').findOne({ email: user.email.toLowerCase().trim() })
    : null;

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
  const attendance = await EmployeeAttendanceModel.findOne({
    employeeId,
    checkOutTime: { $exists: false },
  }).sort({ checkInTime: -1 });
  return attendance;
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
  getMyAssignedTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureAssignedTasksForEmployee({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        employeeName: employee.employeeName,
        employeeId: employee.employeeId,
      });

      const recentApprovedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const tasks = await AssignedTaskModel.find({
        $and: [
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
      }).sort({ updatedAt: -1 });

      res.json(tasks.map(toFrontendAssignedTask));
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

      const date = todayDateKey();
      const attendance = await EmployeeAttendanceModel.findOne({ employeeId: employee.id }).sort({ checkInTime: -1 });

      res.json({
        checkedIn: !!(attendance && !attendance.checkOutTime),
        checkInTime: attendance?.checkInTime?.toISOString() ?? null,
        checkOutTime: attendance?.checkOutTime?.toISOString() ?? null,
        date: attendance?.date ?? date,
        sessionStatus: attendance?.sessionStatus ?? null,
        reminderSent: attendance?.reminderSent ?? false,
        autoCheckedOut: attendance?.autoCheckedOut ?? false,
        expectedCheckoutTime: attendance?.expectedCheckoutTime?.toISOString() ?? null,
        autoCheckoutTime: attendance?.autoCheckoutTime?.toISOString() ?? null,
        autoCheckoutEnabled: attendance?.autoCheckoutEnabled ?? true,
      });
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

      const openLogs = await TimesheetModel.find({
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

      const runningLog = openLogs.find(
        (log) => log.taskStatus === 'In Progress' || log.taskStatus === 'Session Incomplete'
      );
      const pausedLogs = openLogs.filter((log) => log.taskStatus === 'Paused');

      const runningAssigned = runningLog
        ? await AssignedTaskModel.findOne({ timesheetId: runningLog._id })
        : null;

      const pausedTasks = await Promise.all(
        pausedLogs.map(async (log) => {
          const assigned = await AssignedTaskModel.findOne({ timesheetId: log._id });
          return {
            timesheet: toFrontendTimesheet(log),
            assignedTask: assigned ? toFrontendAssignedTask(assigned) : null,
          };
        })
      );

      res.json({
        active: runningLog
          ? {
              timesheet: toFrontendTimesheet(runningLog),
              assignedTask: runningAssigned ? toFrontendAssignedTask(runningAssigned) : null,
            }
          : null,
        pausedTasks,
      });
    } catch (error) {
      console.error('Error fetching active task:', error);
      res.status(500).json({ error: 'Failed to fetch active task' });
    }
  },

  getMySessions: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const logs = await TimesheetModel.find({
        $or: [
          { employeeId: { $in: employee.identityTokens } },
          { employee: { $in: employee.identityTokens } },
        ],
      })
        .sort({ loginTime: -1 })
        .limit(100);

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
      const existing = await EmployeeAttendanceModel.findOne({ employeeId: employee.id, date });

      const settings = await getAutoCheckoutSettings();
      const now = new Date();

      const buildExpectedCheckout = () => {
        const [rh, rm] = settings.reminderTime.split(':').map(Number);
        const d = new Date(now);
        d.setHours(rh, rm, 0, 0);
        if (d <= now) d.setDate(d.getDate() + 1);
        return d;
      };
      const buildAutoCheckout = () => {
        const [ah, am] = settings.autoCheckoutTime.split(':').map(Number);
        const d = new Date(now);
        d.setHours(ah, am, 0, 0);
        if (d <= now) d.setDate(d.getDate() + 1);
        return d;
      };

      if (existing) {
        if (!existing.checkOutTime) {
          res.json({
            checkedIn: true,
            checkInTime: existing.checkInTime.toISOString(),
            message: 'Already checked in',
            sessionStatus: existing.sessionStatus,
            reminderSent: existing.reminderSent,
            autoCheckedOut: existing.autoCheckedOut,
            expectedCheckoutTime: existing.expectedCheckoutTime?.toISOString() ?? null,
            autoCheckoutTime: existing.autoCheckoutTime?.toISOString() ?? null,
          });
          return;
        } else {
          existing.checkOutTime = undefined;
          existing.checkInTime = now;
          existing.sessionStatus = 'Active';
          existing.reminderSent = false;
          existing.autoCheckedOut = false;
          existing.autoCheckoutEnabled = true;
          existing.employeeEmail = employee.email;
          existing.expectedCheckoutTime = buildExpectedCheckout();
          existing.autoCheckoutTime = buildAutoCheckout();
          await existing.save();
          res.json({
            checkedIn: true,
            checkInTime: existing.checkInTime.toISOString(),
            message: 'Resumed attendance session',
            sessionStatus: existing.sessionStatus,
            expectedCheckoutTime: existing.expectedCheckoutTime?.toISOString() ?? null,
            autoCheckoutTime: existing.autoCheckoutTime?.toISOString() ?? null,
          });
          return;
        }
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
        checkedIn: true,
        checkInTime: attendance.checkInTime.toISOString(),
        sessionStatus: attendance.sessionStatus,
        expectedCheckoutTime: attendance.expectedCheckoutTime?.toISOString() ?? null,
        autoCheckoutTime: attendance.autoCheckoutTime?.toISOString() ?? null,
      });
    } catch (error) {
      console.error('Error checking in:', error);
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
      if (!assignedTaskId || !description || String(description).trim().length < 3) {
        res.status(400).json({ error: 'Select a task and provide a description (min 3 characters)' });
        return;
      }

      const runningLog = await TimesheetModel.findOne({
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

      if (runningLog) {
        const now = new Date();
        runningLog.taskStatus = 'Paused';
        runningLog.pausedAt = now;
        await runningLog.save();
        await syncProjectForTimesheet(runningLog);
      }

      const assigned = await findAssignedTaskForEmployee(employee, assignedTaskId);
      if (!assigned) {
        res.status(404).json({ error: 'Assigned task not found' });
        return;
      }

      const taskProject = await ProjectModel.findById(assigned.projectId);

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

      if (!taskProject) {
        res.status(400).json({ error: 'Project not found for this task' });
        return;
      }

      const now = new Date();
      const workNote = String(description).trim();
      const taskTitle = assigned?.title || taskProject.projectName;
      const taskLabel = `${taskTitle} — ${workNote}`;
      const session = await mongoose.startSession();

      try {
        let timesheet: any;
        await session.withTransaction(async () => {
          timesheet = new TimesheetModel({
            employee: employee.employeeName || employee.name,
            employeeId: employee.employeeId || employee.id,
            projectId: taskProject._id,
            project: taskProject.projectName,
            client: taskProject.clientName,
            technologyNode: taskProject.technologyNode,
            loginTime: now,
            task: taskLabel,
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

      const { timesheetId } = req.body;
      const openLog = timesheetId
        ? await findTimesheetByIdAndEmployee(timesheetId, employee)
        : await findOpenTimesheet(employee);

      if (!openLog) {
        res.status(400).json({ error: 'No active task to complete' });
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
            linkedAssigned.status = 'pending_review';
            linkedAssigned.timesheetId = openLog._id as Types.ObjectId;
            await linkedAssigned.save({ session });
          } else {
            await AssignedTaskModel.updateMany(
              {
                projectId: openLog.projectId,
                $or: [
                  { timesheetId: openLog._id },
                  { employeeId: { $in: employee.identityTokens } },
                  { employeeName: { $in: employee.identityTokens } },
                ],
              },
              { $set: { status: 'pending_review', timesheetId: openLog._id } },
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

      const attendance = await EmployeeAttendanceModel.findOne({
        employeeId: employee.id,
        checkOutTime: { $exists: false },
      }).sort({ checkInTime: -1 });

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
};
