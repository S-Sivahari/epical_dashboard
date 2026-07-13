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

const BREAK_MS_FIELD: Record<WorkBreakType, 'morningBreakMs' | 'lunchBreakMs' | 'eveningBreakMs'> = {
  morning: 'morningBreakMs',
  lunch: 'lunchBreakMs',
  evening: 'eveningBreakMs',
};

type AttendanceBreakFields = {
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  morningBreakMs?: number | null;
  lunchBreakMs?: number | null;
  eveningBreakMs?: number | null;
  activeBreakType?: WorkBreakType | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
};

export function isWorkBreakType(value: unknown): value is WorkBreakType {
  return value === 'morning' || value === 'lunch' || value === 'evening';
}

export function anyScheduledBreakUsed(attendance?: AttendanceBreakFields | null): boolean {
  if (!attendance) return false;
  return Boolean(attendance.morningBreakAt || attendance.lunchBreakAt || attendance.eveningBreakAt);
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

/** Project hours for a check-in session: gross attendance minus breaks (and optional default deduction). */
export function computeProjectSessionWorkedMs(
  checkInTime: Date,
  checkOutTime: Date,
  attendance?: AttendanceBreakFields | null,
  additionalBreakMs = 0,
): number {
  const grossMs = computeGrossAttendanceMs(checkInTime, checkOutTime);
  const breakMs = computeUsedBreakMs(attendance, checkOutTime) + Math.max(0, additionalBreakMs);
  return Math.max(0, grossMs - breakMs);
}

export function computeUsedBreakMs(attendance?: AttendanceBreakFields | null, now = new Date()): number {
  if (!attendance) return 0;

  let total = 0;

  const slotDuration = (type: WorkBreakType): number => {
    const usedAt = breakUsedAt(attendance, type);
    if (!usedAt) return 0;
    if (attendance.activeBreakType === type && attendance.activeBreakStartedAt) {
      return 0;
    }
    const stored = attendance[BREAK_MS_FIELD[type]];
    if (typeof stored === 'number' && stored >= 0) {
      return stored;
    }
    return WORK_BREAKS[type].durationMs;
  };

  total += slotDuration('morning');
  total += slotDuration('lunch');
  total += slotDuration('evening');

  if (attendance.activeBreakType && attendance.activeBreakStartedAt) {
    const config = WORK_BREAKS[attendance.activeBreakType];
    const elapsed = now.getTime() - new Date(attendance.activeBreakStartedAt).getTime();
    total += Math.min(Math.max(0, elapsed), config.durationMs);
  }

  return total;
}

/** Persist actual elapsed break time (capped at configured max) when a break ends. */
export function recordCompletedBreakDuration(
  attendance: AttendanceBreakFields,
  breakType: WorkBreakType,
  endedAt = new Date(),
): number {
  const startedAt =
    attendance.activeBreakStartedAt ?? breakUsedAt(attendance, breakType);
  if (!startedAt) return 0;

  const config = WORK_BREAKS[breakType];
  const elapsed = Math.max(0, endedAt.getTime() - new Date(startedAt).getTime());
  const actualMs = Math.min(elapsed, config.durationMs);
  attendance[BREAK_MS_FIELD[breakType]] = actualMs;
  return actualMs;
}

export function computeNetAttendanceMs(
  checkInTime: Date,
  checkOutTime?: Date | null,
  _attendance?: AttendanceBreakFields | null,
  now = new Date(),
): number {
  const grossMs = computeGrossAttendanceMs(checkInTime, checkOutTime, now);
  return Math.max(0, grossMs - DAILY_STANDARD_BREAK_MS);
}

/** Total break time taken (capped per slot). Used for project-hour pause accounting. */
export function computeProjectBreakDeductionMs(
  attendance?: AttendanceBreakFields | null,
  now = new Date(),
): number {
  return computeUsedBreakMs(attendance, now);
}

export function computeNetAttendanceHours(
  checkInTime: Date,
  checkOutTime?: Date | null,
  attendance?: AttendanceBreakFields | null,
  now = new Date(),
): number {
  return Math.round((computeNetAttendanceMs(checkInTime, checkOutTime, attendance, now) / (1000 * 60 * 60)) * 10) / 10;
}

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

  const slotPayload = (type: WorkBreakType) => {
    const config = WORK_BREAKS[type];
    const usedAt = breakUsedAt(attendance, type);
    const storedMs = attendance[BREAK_MS_FIELD[type]];
    const isActive = attendance.activeBreakType === type && attendance.activeBreakStartedAt;
    let actualMs: number | null = null;
    if (typeof storedMs === 'number' && storedMs >= 0) {
      actualMs = storedMs;
    } else if (isActive && attendance.activeBreakStartedAt) {
      const elapsed = now.getTime() - new Date(attendance.activeBreakStartedAt).getTime();
      actualMs = Math.min(Math.max(0, elapsed), config.durationMs);
    }

    return {
      label: config.label,
      durationMinutes: config.durationMinutes,
      minDurationMinutes: config.minDurationMinutes,
      used: Boolean(usedAt),
      usedAt: usedAt ? usedAt.toISOString() : null,
      actualMs,
    };
  };

  return {
    morning: slotPayload('morning'),
    lunch: slotPayload('lunch'),
    evening: slotPayload('evening'),
    activeBreak,
    dailyDeductionMinutes: DAILY_STANDARD_BREAK_MS / (60 * 1000),
  };
}

export function activeBreakExpired(attendance: AttendanceBreakFields, now = new Date()): boolean {
  if (!attendance.activeBreakEndsAt) return false;
  return new Date(attendance.activeBreakEndsAt).getTime() <= now.getTime();
}
