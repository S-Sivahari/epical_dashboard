/**
 * Shared duration helpers for timesheets, auto-checkout, and emails.
 */

export function computeWorkedMs(
  loginTime: Date,
  logoutTime: Date,
  totalPausedMs = 0
): number {
  const diffMs = logoutTime.getTime() - loginTime.getTime() - (totalPausedMs || 0);
  return Math.max(0, diffMs);
}

export function computeTotalHoursDecimal(
  loginTime: Date,
  logoutTime?: Date | null,
  totalPausedMs = 0,
  overriddenHours?: number | null
): number {
  if (overriddenHours !== undefined && overriddenHours !== null) {
    return Number(overriddenHours);
  }
  if (!logoutTime) return 0;
  const workedMs = computeWorkedMs(loginTime, logoutTime, totalPausedMs);
  if (workedMs <= 0) return 0;
  return Math.round((workedMs / (1000 * 60 * 60)) * 10) / 10;
}

/** Format milliseconds as "5h 42m", "18m", "1h 08m". */
export function formatDurationFromMs(ms: number, padMinutes = false): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalMinutes = Math.floor(safeMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0 && minutes === 0) return '0m';
  if (hours === 0) return `${minutes}m`;
  const minPart = padMinutes || hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours}h ${minPart}m`;
}

/** Format decimal hours as "5h 42m". */
export function formatDurationFromHours(hours: number, padMinutes = false): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0m';
  return formatDurationFromMs(Math.round(hours * 60 * 60 * 1000), padMinutes);
}

/** Format workflow duration with optional days: "45m", "3h", "8h 25m", "1d 4h", "2d 6h 30m". */
export function formatWorkflowDurationFromMs(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    const parts = [`${days}d`];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ');
  }
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '0m';
}

export function sumTimesheetWorkedMs(
  logs: Array<{
    loginTime: Date;
    logoutTime?: Date | null;
    totalPausedMs?: number;
    totalHours?: number;
    overriddenHours?: number | null;
  }>,
  fallbackEnd: Date
): number {
  return logs.reduce((sum, log) => {
    if (log.overriddenHours !== undefined && log.overriddenHours !== null) {
      return sum + Math.max(0, Number(log.overriddenHours)) * 3600000;
    }
    if (log.totalHours !== undefined && log.totalHours !== null && log.totalHours > 0) {
      return sum + log.totalHours * 3600000;
    }
    const end = log.logoutTime ?? fallbackEnd;
    return sum + computeWorkedMs(log.loginTime, end, log.totalPausedMs);
  }, 0);
}
