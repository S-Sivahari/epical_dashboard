import mongoose from 'mongoose';
import { TimesheetModel } from '../models/Timesheet';

export async function resumeBreakPausedTask(
  timesheetId: string | undefined,
  identityTokens: string[],
  breakDurationMs?: number,
) {
  if (!timesheetId || !mongoose.Types.ObjectId.isValid(timesheetId)) return;

  const pausedLog = await TimesheetModel.findOne({
    $and: [
      { _id: timesheetId },
      {
        $or: [
          { employeeId: { $in: identityTokens } },
          { employee: { $in: identityTokens } },
        ],
      },
      { taskStatus: 'Paused' },
      { $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] },
    ],
  });

  if (!pausedLog) return;

  if (breakDurationMs != null && breakDurationMs >= 0) {
    pausedLog.totalPausedMs = (pausedLog.totalPausedMs || 0) + breakDurationMs;
  } else if (pausedLog.pausedAt) {
    const pausedMs = Date.now() - new Date(pausedLog.pausedAt).getTime();
    pausedLog.totalPausedMs = (pausedLog.totalPausedMs || 0) + Math.max(0, pausedMs);
    pausedLog.pausedAt = undefined;
  }
  pausedLog.pausedAt = undefined;
  pausedLog.taskStatus = 'In Progress';
  await pausedLog.save();
}
