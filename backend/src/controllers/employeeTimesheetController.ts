import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { ProjectModel } from '../models/Project';
import { getUserById } from '../services/authService';
import { syncProjectForTimesheet } from '../utils/syncProject';

function todayDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

function computeTotalHours(loginTime: Date, logoutTime?: Date, overriddenHours?: number): number {
  if (overriddenHours !== undefined && overriddenHours !== null) {
    return Number(overriddenHours);
  }
  if (!logoutTime) return 0;
  const diffMs = logoutTime.getTime() - loginTime.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
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
    status: t.status || 'Pending',
    billable: t.billable !== undefined ? t.billable : true,
    task: t.task || '',
    adminNotes: t.adminNotes,
    overriddenHours: t.overriddenHours,
    totalHours: t.totalHours,
    taskStatus: t.taskStatus || (t.logoutTime ? 'Pending' : 'Session Incomplete'),
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
  };
}

async function resolveEmployee(req: Request) {
  const userId = req.user?.id;
  if (!userId) return null;
  const user = await getUserById(userId);
  if (!user) return null;
  return { id: user.id, name: user.name };
}

async function requireOpenAttendance(employeeId: string) {
  const date = todayDateKey();
  const attendance = await EmployeeAttendanceModel.findOne({
    employeeId,
    date,
    checkOutTime: { $exists: false },
  });
  return attendance;
}

export const employeeTimesheetController = {
  getMyAssignedTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      const employee = await resolveEmployee(req);
      if (!employee) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const tasks = await AssignedTaskModel.find({
        employeeId: employee.id,
        status: 'assigned',
      }).sort({ createdAt: -1 });

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
      const attendance = await EmployeeAttendanceModel.findOne({ employeeId: employee.id, date });

      res.json({
        checkedIn: !!(attendance && !attendance.checkOutTime),
        checkInTime: attendance?.checkInTime?.toISOString() ?? null,
        checkOutTime: attendance?.checkOutTime?.toISOString() ?? null,
        date,
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

      const openLog = await TimesheetModel.findOne({
        employeeId: employee.id,
        $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
        taskStatus: { $in: ['In Progress', 'Session Incomplete'] },
      }).sort({ loginTime: -1 });

      if (!openLog) {
        res.json({ active: null });
        return;
      }

      const assigned = await AssignedTaskModel.findOne({
        timesheetId: openLog._id,
      });

      res.json({
        active: {
          timesheet: toFrontendTimesheet(openLog),
          assignedTask: assigned ? toFrontendAssignedTask(assigned) : null,
        },
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
        $or: [{ employeeId: employee.id }, { employee: employee.name }],
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

      if (existing && !existing.checkOutTime) {
        res.json({
          checkedIn: true,
          checkInTime: existing.checkInTime.toISOString(),
          message: 'Already checked in for today',
        });
        return;
      }

      const attendance = await EmployeeAttendanceModel.create({
        employeeId: employee.id,
        employeeName: employee.name,
        date,
        checkInTime: new Date(),
      });

      res.status(201).json({
        checkedIn: true,
        checkInTime: attendance.checkInTime.toISOString(),
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

      const openLogs = await TimesheetModel.find({
        employeeId: employee.id,
        $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
      });

      for (const log of openLogs) {
        log.logoutTime = now;
        log.totalHours = computeTotalHours(log.loginTime, log.logoutTime, log.overriddenHours);
        if (log.taskStatus === 'In Progress' || log.taskStatus === 'Session Incomplete') {
          log.taskStatus = 'Pending';
        }
        await log.save();
        await syncProjectForTimesheet(log);
      }

      attendance.checkOutTime = now;
      await attendance.save();

      res.json({
        checkedIn: false,
        checkOutTime: now.toISOString(),
        stoppedTasks: openLogs.length,
      });
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

      const existingOpen = await TimesheetModel.findOne({
        employeeId: employee.id,
        $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
      });
      if (existingOpen) {
        res.status(400).json({ error: 'Stop your current task before starting a new one' });
        return;
      }

      const assigned = await AssignedTaskModel.findById(assignedTaskId);
      if (!assigned || assigned.employeeId !== employee.id) {
        res.status(404).json({ error: 'Assigned task not found' });
        return;
      }
      if (assigned.status !== 'assigned') {
        res.status(400).json({ error: 'This task is not available to start' });
        return;
      }

      const project = await ProjectModel.findById(assigned.projectId);
      if (!project) {
        res.status(400).json({ error: 'Project not found for this task' });
        return;
      }

      const now = new Date();
      const workNote = String(description).trim();
      const taskLabel = `${assigned.title} — ${workNote}`;

      const timesheet = new TimesheetModel({
        employee: employee.name,
        employeeId: employee.id,
        projectId: project._id,
        project: project.projectName,
        client: project.clientName,
        technologyNode: project.technologyNode,
        loginTime: now,
        task: taskLabel,
        billable: true,
        status: 'Pending',
        requestStatus: 'No Request',
        taskStatus: 'In Progress',
      });

      timesheet.totalHours = 0;
      await timesheet.save();
      await syncProjectForTimesheet(timesheet);

      assigned.status = 'in_progress';
      assigned.timesheetId = timesheet._id as Types.ObjectId;
      await assigned.save();

      res.status(201).json({
        timesheet: toFrontendTimesheet(timesheet),
        assignedTask: toFrontendAssignedTask(assigned),
        startedAt: now.toISOString(),
      });
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

      const openLog = await TimesheetModel.findOne({
        employeeId: employee.id,
        $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
      }).sort({ loginTime: -1 });

      if (!openLog) {
        res.status(400).json({ error: 'No active task to stop' });
        return;
      }

      const now = new Date();
      openLog.logoutTime = now;
      openLog.totalHours = computeTotalHours(openLog.loginTime, openLog.logoutTime, openLog.overriddenHours);
      openLog.taskStatus = 'Pending';
      await openLog.save();
      await syncProjectForTimesheet(openLog);

      res.json({
        timesheet: toFrontendTimesheet(openLog),
        stoppedAt: now.toISOString(),
      });
    } catch (error) {
      console.error('Error stopping task:', error);
      res.status(500).json({ error: 'Failed to stop task' });
    }
  },
};
