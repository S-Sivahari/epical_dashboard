export type WorkBreakType = 'morning' | 'lunch' | 'evening';

export const DAILY_STANDARD_BREAK_MS = 60 * 60 * 1000;

export const WORK_BREAKS: Record<
  WorkBreakType,
  { label: string; durationMs: number; durationMinutes: number }
> = {
  morning: { label: 'Morning break', durationMs: 15 * 60 * 1000, durationMinutes: 15 },
  lunch: { label: 'Lunch break', durationMs: 30 * 60 * 1000, durationMinutes: 30 },
  evening: { label: 'Evening break', durationMs: 15 * 60 * 1000, durationMinutes: 15 },
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

export function computeNetAttendanceMs(
  checkInTime: Date,
  checkOutTime?: Date | null,
  now = new Date(),
): number {
  return Math.max(0, computeGrossAttendanceMs(checkInTime, checkOutTime, now) - DAILY_STANDARD_BREAK_MS);
}

export function computeNetAttendanceHours(
  checkInTime: Date,
  checkOutTime?: Date | null,
  now = new Date(),
): number {
  return Math.round((computeNetAttendanceMs(checkInTime, checkOutTime, now) / (1000 * 60 * 60)) * 10) / 10;
}

type AttendanceBreakFields = {
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  activeBreakType?: WorkBreakType | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
};

export function breakUsedAt(attendance: AttendanceBreakFields, type: WorkBreakType): Date | null {
  const field = BREAK_USED_FIELD[type];
  const value = attendance[field];
  return value ? new Date(value) : null;
}

export function buildBreaksPayload(attendance: AttendanceBreakFields, now = new Date()) {
  const activeBreak =
    attendance.activeBreakType && attendance.activeBreakStartedAt && attendance.activeBreakEndsAt
      ? {
          type: attendance.activeBreakType,
          startedAt: new Date(attendance.activeBreakStartedAt).toISOString(),
          endsAt: new Date(attendance.activeBreakEndsAt).toISOString(),
          remainingMs: Math.max(
            0,
            new Date(attendance.activeBreakEndsAt).getTime() - now.getTime(),
          ),
        }
      : null;

  return {
    morning: {
      label: WORK_BREAKS.morning.label,
      durationMinutes: WORK_BREAKS.morning.durationMinutes,
      used: Boolean(attendance.morningBreakAt),
      usedAt: attendance.morningBreakAt ? new Date(attendance.morningBreakAt).toISOString() : null,
    },
    lunch: {
      label: WORK_BREAKS.lunch.label,
      durationMinutes: WORK_BREAKS.lunch.durationMinutes,
      used: Boolean(attendance.lunchBreakAt),
      usedAt: attendance.lunchBreakAt ? new Date(attendance.lunchBreakAt).toISOString() : null,
    },
    evening: {
      label: WORK_BREAKS.evening.label,
      durationMinutes: WORK_BREAKS.evening.durationMinutes,
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
