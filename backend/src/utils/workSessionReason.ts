export const WORK_SESSION_REASONS = {
  WORKING: 'working',
  HOLD: 'hold',
  PENDING_REVIEW: 'pending_review',
  PENDING_APPROVAL: 'pending_approval',
  REJECTED_WAITING: 'rejected_waiting',
  PROJECT_CHECKED_OUT: 'project_checked_out',
  SESSION_EXPIRED: 'session_expired',
  INACTIVE: 'inactive',
} as const;

export type WorkSessionReason = (typeof WORK_SESSION_REASONS)[keyof typeof WORK_SESSION_REASONS];

export function isCountableWorkSession(reason?: string | null): boolean {
  if (!reason || reason === WORK_SESSION_REASONS.WORKING) return true;
  return false;
}

/** Logs that contribute to productive-time totals (open working sessions + closed work with recorded time). */
export function filterCountableLogs<T extends { reason?: string | null; checkOutTime?: Date | null; workedMs?: number }>(
  logs: T[],
): T[] {
  return logs.filter((log) => {
    if (log.checkOutTime != null) {
      return (log.workedMs ?? 0) > 0 || isCountableWorkSession(log.reason);
    }
    return isCountableWorkSession(log.reason);
  });
}
