import { Request, Response } from 'express';
import { EmployeeActivitySnapshotModel } from '../models/EmployeeActivitySnapshot';
import { resolveEmployeeForAuthUser } from '../utils/employeeAuth';
import { getSchedulerDateKey } from '../utils/istClock';
import { hasRole } from '../utils/generateToken';

const IDLE_THRESHOLD_MS_DEFAULT = 5 * 60 * 1000;

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export const activityController = {
  postHeartbeat: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const employee = await resolveEmployeeForAuthUser(authUser.id, authUser.email);
      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const idleMs = parsePositiveInt(req.body?.idleMs, 0);
      const idleThresholdMs = parsePositiveInt(req.body?.idleThresholdMs, IDLE_THRESHOLD_MS_DEFAULT);
      const reportedAtRaw = req.body?.reportedAt;
      const reportedAt =
        typeof reportedAtRaw === 'string' && !Number.isNaN(Date.parse(reportedAtRaw))
          ? new Date(reportedAtRaw)
          : new Date();

      const snapshot = await EmployeeActivitySnapshotModel.create({
        employeeId: employee.id,
        employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeId,
        employeeEmail: employee.email,
        date: getSchedulerDateKey(reportedAt),
        idleMs,
        isIdle: idleMs >= idleThresholdMs,
        idleThresholdMs,
        hostname: typeof req.body?.hostname === 'string' ? req.body.hostname.slice(0, 128) : undefined,
        machineId: typeof req.body?.machineId === 'string' ? req.body.machineId.slice(0, 128) : undefined,
        reportedAt,
      });

      res.status(201).json({
        id: snapshot._id.toString(),
        idleMs: snapshot.idleMs,
        isIdle: snapshot.isIdle,
        reportedAt: snapshot.reportedAt.toISOString(),
      });
    } catch (error) {
      console.error('Activity heartbeat error:', error);
      res.status(500).json({ error: 'Failed to record activity heartbeat' });
    }
  },

  getMyTodaySummary: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const employee = await resolveEmployeeForAuthUser(authUser.id, authUser.email);
      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const date = typeof req.query.date === 'string' ? req.query.date : getSchedulerDateKey(new Date());
      const snapshots = await EmployeeActivitySnapshotModel.find({
        employeeId: employee.id,
        date,
      })
        .sort({ reportedAt: 1 })
        .lean();

      const snapshotCount = snapshots.length;
      const idleSnapshotCount = snapshots.filter((s) => s.isIdle).length;
      const maxIdleMs = snapshots.reduce((max, s) => Math.max(max, s.idleMs || 0), 0);
      const avgIdleMs =
        snapshotCount > 0
          ? Math.round(snapshots.reduce((sum, s) => sum + (s.idleMs || 0), 0) / snapshotCount)
          : 0;

      res.json({
        date,
        snapshotCount,
        idleSnapshotCount,
        activeSnapshotCount: snapshotCount - idleSnapshotCount,
        maxIdleMs,
        avgIdleMs,
        lastReportedAt:
          snapshotCount > 0 ? snapshots[snapshots.length - 1].reportedAt.toISOString() : null,
      });
    } catch (error) {
      console.error('Activity summary error:', error);
      res.status(500).json({ error: 'Failed to fetch activity summary' });
    }
  },

  getEmployeeSummary: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser || !hasRole(authUser.role, 'Admin')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const employeeId = String(req.params.employeeId || '').trim();
      if (!employeeId) {
        res.status(400).json({ error: 'employeeId is required' });
        return;
      }

      const date = typeof req.query.date === 'string' ? req.query.date : getSchedulerDateKey(new Date());
      const snapshots = await EmployeeActivitySnapshotModel.find({ employeeId, date })
        .sort({ reportedAt: 1 })
        .lean();

      res.json({
        employeeId,
        date,
        snapshotCount: snapshots.length,
        idleSnapshotCount: snapshots.filter((s) => s.isIdle).length,
        snapshots: snapshots.map((s) => ({
          id: s._id.toString(),
          idleMs: s.idleMs,
          isIdle: s.isIdle,
          hostname: s.hostname,
          reportedAt: s.reportedAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error('Admin activity summary error:', error);
      res.status(500).json({ error: 'Failed to fetch employee activity' });
    }
  },
};
