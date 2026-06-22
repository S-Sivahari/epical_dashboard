export type WorkBreakType = 'morning' | 'lunch' | 'evening';

/** Auto-deducted when no breaks were taken for the day. */
export const DAILY_STANDARD_BREAK_MS = 50 * 60 * 1000;

export const WORK_BREAKS: Record<
  WorkBreakType,
  {
    label: string;
    durationMs: number;
    durationMinutes: number;
    minDurationMs: number;
    minDurationMinutes: number;
  }
> = {
  morning: {
    label: 'Morning break',
    durationMs: 10 * 60 * 1000,
    durationMinutes: 10,
    minDurationMs: 5 * 60 * 1000,
    minDurationMinutes: 5,
  },
  lunch: {
    label: 'Lunch break',
    durationMs: 30 * 60 * 1000,
    durationMinutes: 30,
    minDurationMs: 15 * 60 * 1000,
    minDurationMinutes: 15,
  },
  evening: {
    label: 'Evening break',
    durationMs: 10 * 60 * 1000,
    durationMinutes: 10,
    minDurationMs: 5 * 60 * 1000,
    minDurationMinutes: 5,
  },
};

const BREAK_USED_FIELD: Record<WorkBreakType, 'morningBreakAt' | 'lunchBreakAt' | 'eveningBreakAt'> = {
  morning: 'morningBreakAt',
  lunch: 'lunchBreakAt',
  evening: 'eveningBreakAt',
};

export function isWorkBreakType(value: unknown): value is WorkBreakType {
  return value === 'morning' || value === 'lunch' || value === 'evening';
}

export function computeGrossAttendanceMs(
  checkInTime: Date,
  checkOutTime?: Date | null,
  now = new Date(),
): number {
  const end = checkOutTime ?? now;
  const diffMs = end.getTime() - checkInTime.getTime();
  return diffMs > 0 ? diffMs : 0;
}

export function computeUsedBreakMs(attendance?: AttendanceBreakFields | null): number {
  if (!attendance) return 0;
  let total = 0;
  if (attendance.morningBreakAt) total += WORK_BREAKS.morning.durationMs;
  if (attendance.lunchBreakAt) total += WORK_BREAKS.lunch.durationMs;
  if (attendance.eveningBreakAt) total += WORK_BREAKS.evening.durationMs;
  return total;
}

export function computeNetAttendanceMs(
  checkInTime: Date,
  checkOutTime?: Date | null,
  attendance?: AttendanceBreakFields | null,
  now = new Date(),
): number {
  const gross = computeGrossAttendanceMs(checkInTime, checkOutTime, now);
  const usedBreakMs = computeUsedBreakMs(attendance);
  const deduction = usedBreakMs > 0 ? usedBreakMs : DAILY_STANDARD_BREAK_MS;
  return Math.max(0, gross - deduction);
}

export function computeNetAttendanceHours(
  checkInTime: Date,
  checkOutTime?: Date | null,
  attendance?: AttendanceBreakFields | null,
  now = new Date(),
): number {
  return Math.round((computeNetAttendanceMs(checkInTime, checkOutTime, attendance, now) / (1000 * 60 * 60)) * 10) / 10;
}

type AttendanceBreakFields = {
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  activeBreakType?: WorkBreakType | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
};

export function breakMinEndsAt(attendance: AttendanceBreakFields): Date | null {
  if (!attendance.activeBreakType || !attendance.activeBreakStartedAt) return null;
  const config = WORK_BREAKS[attendance.activeBreakType];
  return new Date(new Date(attendance.activeBreakStartedAt).getTime() + config.minDurationMs);
}

export function breakMinTimeReached(attendance: AttendanceBreakFields, now = new Date()): boolean {
  const minEnd = breakMinEndsAt(attendance);
  if (!minEnd) return true;
  return now.getTime() >= minEnd.getTime();
}

export function breakUsedAt(attendance: AttendanceBreakFields, type: WorkBreakType): Date | null {
  const field = BREAK_USED_FIELD[type];
  const value = attendance[field];
  return value ? new Date(value) : null;
}

export function buildBreaksPayload(attendance: AttendanceBreakFields, now = new Date()) {
  const minEndsAt = breakMinEndsAt(attendance);
  const activeBreak =
    attendance.activeBreakType && attendance.activeBreakStartedAt && attendance.activeBreakEndsAt
      ? {
          type: attendance.activeBreakType,
          startedAt: new Date(attendance.activeBreakStartedAt).toISOString(),
          endsAt: new Date(attendance.activeBreakEndsAt).toISOString(),
          minEndsAt: minEndsAt ? minEndsAt.toISOString() : null,
          remainingMs: Math.max(
            0,
            new Date(attendance.activeBreakEndsAt).getTime() - now.getTime(),
          ),
          minRemainingMs: minEndsAt
            ? Math.max(0, minEndsAt.getTime() - now.getTime())
            : 0,
          canEnd: breakMinTimeReached(attendance, now),
        }
      : null;

  return {
    morning: {
      label: WORK_BREAKS.morning.label,
      durationMinutes: WORK_BREAKS.morning.durationMinutes,
      minDurationMinutes: WORK_BREAKS.morning.minDurationMinutes,
      used: Boolean(attendance.morningBreakAt),
      usedAt: attendance.morningBreakAt ? new Date(attendance.morningBreakAt).toISOString() : null,
    },
    lunch: {
      label: WORK_BREAKS.lunch.label,
      durationMinutes: WORK_BREAKS.lunch.durationMinutes,
      minDurationMinutes: WORK_BREAKS.lunch.minDurationMinutes,
      used: Boolean(attendance.lunchBreakAt),
      usedAt: attendance.lunchBreakAt ? new Date(attendance.lunchBreakAt).toISOString() : null,
    },
    evening: {
      label: WORK_BREAKS.evening.label,
      durationMinutes: WORK_BREAKS.evening.durationMinutes,
      minDurationMinutes: WORK_BREAKS.evening.minDurationMinutes,
      used: Boolean(attendance.eveningBreakAt),
      usedAt: attendance.eveningBreakAt ? new Date(attendance.eveningBreakAt).toISOString() : null,
    },
    activeBreak,
    dailyDeductionMinutes: DAILY_STANDARD_BREAK_MS / (60 * 1000),
  };
}

export function activeBreakExpired(attendance: AttendanceBreakFields, now = new Date()): boolean {
  if (!attendance.activeBreakEndsAt) return false;
  return new Date(attendance.activeBreakEndsAt).getTime() <= now.getTime();
}
