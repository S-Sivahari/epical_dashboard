import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { EmployeeDailyBreakModel } from '../models/EmployeeDailyBreak';
import {
  anyScheduledBreakUsed,
  DAILY_STANDARD_BREAK_MS,
  type WorkBreakType,
  WORK_BREAKS,
} from '../utils/workBreaks';

export type DailyBreakFields = {
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  morningBreakMs?: number | null;
  lunchBreakMs?: number | null;
  eveningBreakMs?: number | null;
  activeBreakType?: WorkBreakType | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
  projectBreakDeductedMs?: number;
};

const SLOT_USED: Record<WorkBreakType, keyof DailyBreakFields> = {
  morning: 'morningBreakAt',
  lunch: 'lunchBreakAt',
  evening: 'eveningBreakAt',
};

const SLOT_MS: Record<WorkBreakType, keyof DailyBreakFields> = {
  morning: 'morningBreakMs',
  lunch: 'lunchBreakMs',
  evening: 'eveningBreakMs',
};

export function remainingDailyBreakBudgetMs(daily: DailyBreakFields): number {
  const used = Number(daily.projectBreakDeductedMs ?? 0) || 0;
  return Math.max(0, DAILY_STANDARD_BREAK_MS - used);
}

export function capDailyBreakDeductionMs(daily: DailyBreakFields, requestedMs: number): number {
  if (requestedMs <= 0) return 0;
  return Math.min(requestedMs, remainingDailyBreakBudgetMs(daily));
}

export function isDailyBreakSlotUsed(daily: DailyBreakFields, breakType: WorkBreakType): boolean {
  return Boolean(daily[SLOT_USED[breakType]]);
}

async function syncDailyBreakFromAttendances(employeeId: string, date: string) {
  const attendances = await EmployeeAttendanceModel.find({ employeeId, date }).lean();
  if (attendances.length === 0) return null;

  const merged: DailyBreakFields = { projectBreakDeductedMs: 0 };
  let defaultDeducted = 0;

  for (const row of attendances) {
    for (const type of ['morning', 'lunch', 'evening'] as WorkBreakType[]) {
      const usedField = SLOT_USED[type];
      const msField = SLOT_MS[type];
      const usedAt = row[usedField as 'morningBreakAt'];
      if (!usedAt) continue;
      if (!merged[usedField]) {
        merged[usedField] = usedAt;
      }
      const storedMs = row[msField as 'morningBreakMs'];
      if (typeof storedMs === 'number' && storedMs >= 0) {
        merged[msField] = storedMs;
      } else if (!merged[msField]) {
        merged[msField] = WORK_BREAKS[type].durationMs;
      }
    }
    if (typeof row.defaultBreakDeductedMs === 'number' && row.defaultBreakDeductedMs > 0) {
      defaultDeducted = Math.max(defaultDeducted, row.defaultBreakDeductedMs);
    }
  }

  merged.projectBreakDeductedMs = anyScheduledBreakUsed(merged)
    ? 0
    : Math.min(DAILY_STANDARD_BREAK_MS, defaultDeducted);
  return merged;
}

export async function getOrCreateDailyBreakState(employeeId: string, date: string) {
  let daily = await EmployeeDailyBreakModel.findOne({ employeeId, date });
  if (daily) return daily;

  const synced = await syncDailyBreakFromAttendances(employeeId, date);
  daily = await EmployeeDailyBreakModel.create({
    employeeId,
    date,
    morningBreakAt: synced?.morningBreakAt ?? undefined,
    lunchBreakAt: synced?.lunchBreakAt ?? undefined,
    eveningBreakAt: synced?.eveningBreakAt ?? undefined,
    morningBreakMs: synced?.morningBreakMs ?? undefined,
    lunchBreakMs: synced?.lunchBreakMs ?? undefined,
    eveningBreakMs: synced?.eveningBreakMs ?? undefined,
    projectBreakDeductedMs: synced?.projectBreakDeductedMs ?? 0,
  });
  return daily;
}

export function mergeDailyBreakWithOpenSession(
  daily: DailyBreakFields,
  openAttendance?: DailyBreakFields | null,
): DailyBreakFields {
  return {
    morningBreakAt: daily.morningBreakAt ?? openAttendance?.morningBreakAt,
    lunchBreakAt: daily.lunchBreakAt ?? openAttendance?.lunchBreakAt,
    eveningBreakAt: daily.eveningBreakAt ?? openAttendance?.eveningBreakAt,
    morningBreakMs: daily.morningBreakMs ?? openAttendance?.morningBreakMs,
    lunchBreakMs: daily.lunchBreakMs ?? openAttendance?.lunchBreakMs,
    eveningBreakMs: daily.eveningBreakMs ?? openAttendance?.eveningBreakMs,
    activeBreakType: openAttendance?.activeBreakType,
    activeBreakStartedAt: openAttendance?.activeBreakStartedAt,
    activeBreakEndsAt: openAttendance?.activeBreakEndsAt,
    projectBreakDeductedMs: daily.projectBreakDeductedMs,
  };
}

export async function markDailyBreakSlotStarted(
  employeeId: string,
  date: string,
  breakType: WorkBreakType,
  startedAt: Date,
) {
  const daily = await getOrCreateDailyBreakState(employeeId, date);
  if (breakType === 'morning' && !daily.morningBreakAt) daily.morningBreakAt = startedAt;
  if (breakType === 'lunch' && !daily.lunchBreakAt) daily.lunchBreakAt = startedAt;
  if (breakType === 'evening' && !daily.eveningBreakAt) daily.eveningBreakAt = startedAt;
  await daily.save();
  return daily;
}

export async function markDailyBreakSlotCompleted(
  employeeId: string,
  date: string,
  breakType: WorkBreakType,
  endedAt: Date,
  breakMs: number,
) {
  const daily = await getOrCreateDailyBreakState(employeeId, date);
  if (breakType === 'morning') {
    if (!daily.morningBreakAt) daily.morningBreakAt = endedAt;
    daily.morningBreakMs = breakMs;
  } else if (breakType === 'lunch') {
    if (!daily.lunchBreakAt) daily.lunchBreakAt = endedAt;
    daily.lunchBreakMs = breakMs;
  } else if (breakType === 'evening') {
    if (!daily.eveningBreakAt) daily.eveningBreakAt = endedAt;
    daily.eveningBreakMs = breakMs;
  }
  await daily.save();
  return daily;
}

export async function applyDailyCappedBreakDeduction(
  employeeId: string,
  date: string,
  requestedMs: number,
): Promise<number> {
  if (requestedMs <= 0) return 0;
  const daily = await getOrCreateDailyBreakState(employeeId, date);
  const applied = capDailyBreakDeductionMs(daily, requestedMs);
  if (applied <= 0) return 0;
  daily.projectBreakDeductedMs = Math.min(
    DAILY_STANDARD_BREAK_MS,
    (daily.projectBreakDeductedMs || 0) + applied,
  );
  await daily.save();
  return applied;
}
