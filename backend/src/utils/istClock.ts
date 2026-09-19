import { env } from '../config/env';

/** Fixed offset for Asia/Kolkata (no DST). Must match env.schedulerTimezone when set to IST. */
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

/** Parse HH:mm configured in admin auto-checkout settings (interpreted in scheduler timezone). */
export function parseSchedulerClockTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return { hours: 0, minutes: 0 };
  }
  return { hours, minutes };
}

export function buildClockTimeOnDate(dateKey: string, hours: number, minutes: number): Date {
  return new Date(
    `${dateKey}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00${SCHEDULER_TZ_OFFSET}`,
  );
}

export function calendarDayBounds(dateKey: string): { start: Date; end: Date } {
  const start = buildClockTimeOnDate(dateKey, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
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

/** First scheduled auto-checkout instant after check-in (scheduler timezone wall clock). */
export function resolveSchedulerAutoCheckoutDeadline(
  checkInTime: Date,
  autoCheckoutTime = '23:59',
): Date {
  const { hours, minutes } = parseSchedulerClockTime(autoCheckoutTime);
  return buildNextSchedulerClockTime(checkInTime, hours, minutes);
}

/**
 * Two-tier auto-checkout deadline:
 * - Checked in before the intermediate checkout time (same day) → that day's intermediate
 *   checkout time is the deadline (e.g. 8:30 PM).
 * - Checked in at/after the intermediate checkout time → the session skips that tier
 *   entirely and falls back to the next occurrence of the final auto-checkout time
 *   (e.g. 11:59 PM), same as before the intermediate tier existed.
 */
export function resolveTieredAutoCheckoutDeadline(
  checkInTime: Date,
  intermediateCheckoutTime: string,
  autoCheckoutTime: string,
): Date {
  const dateKey = getSchedulerDateKey(checkInTime);
  const { hours: iHours, minutes: iMinutes } = parseSchedulerClockTime(intermediateCheckoutTime);
  const intermediateOnCheckInDay = buildClockTimeOnDate(dateKey, iHours, iMinutes);

  if (checkInTime.getTime() < intermediateOnCheckInDay.getTime()) {
    return intermediateOnCheckInDay;
  }

  return resolveSchedulerAutoCheckoutDeadline(checkInTime, autoCheckoutTime);
}

/** True while `now` still falls in the intermediate-checkout tier for this check-in
 *  (i.e. the session hasn't yet skipped past the intermediate cutoff for its check-in day). */
export function isInIntermediateCheckoutTier(
  checkInTime: Date,
  intermediateCheckoutTime: string,
): boolean {
  const dateKey = getSchedulerDateKey(checkInTime);
  const { hours, minutes } = parseSchedulerClockTime(intermediateCheckoutTime);
  const intermediateOnCheckInDay = buildClockTimeOnDate(dateKey, hours, minutes);
  return checkInTime.getTime() < intermediateOnCheckInDay.getTime();
}

export function isSchedulerClockTimeReached(from: Date, hours: number, minutes: number): boolean {
  const dateKey = getSchedulerDateKey(from);
  const cutoff = buildClockTimeOnDate(dateKey, hours, minutes);
  return from.getTime() >= cutoff.getTime();
}

/** Format an instant for logs/UI in scheduler timezone. */
export function formatSchedulerDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: env.schedulerTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}
