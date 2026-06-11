import { env } from '../config/env';

/** Fixed offset for Asia/Kolkata (no DST). */
const SCHEDULER_TZ_OFFSET = '+05:30';

export function getSchedulerDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: env.schedulerTimezone }).format(date);
}

export function getSchedulerHourMinute(date: Date): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.schedulerTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hours: hour === 24 ? 0 : hour, minutes: minute };
}

export function buildClockTimeOnDate(dateKey: string, hours: number, minutes: number): Date {
  return new Date(
    `${dateKey}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00${SCHEDULER_TZ_OFFSET}`,
  );
}

/** Next occurrence of HH:mm in scheduler timezone (IST by default), strictly after `from`. */
export function buildNextSchedulerClockTime(from: Date, hours: number, minutes: number): Date {
  const dateKey = getSchedulerDateKey(from);
  const target = buildClockTimeOnDate(dateKey, hours, minutes);
  if (target.getTime() > from.getTime()) return target;
  const nextDay = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const nextKey = getSchedulerDateKey(nextDay);
  return buildClockTimeOnDate(nextKey, hours, minutes);
}

export function isSchedulerClockTimeReached(from: Date, hours: number, minutes: number): boolean {
  const dateKey = getSchedulerDateKey(from);
  const cutoff = buildClockTimeOnDate(dateKey, hours, minutes);
  return from.getTime() >= cutoff.getTime();
}
