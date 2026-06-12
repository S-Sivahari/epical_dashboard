import { addDays, format, isSameDay, startOfWeek } from 'date-fns'

const WEEKDAY_COUNT = 5

export function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function getWorkingWeekdays(weekMonday: Date): Date[] {
  return Array.from({ length: WEEKDAY_COUNT }, (_, index) => addDays(weekMonday, index))
}

export function orderWeekdaysLatestFirst(weekdays: Date[]): Date[] {
  return [...weekdays].reverse()
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatDailyBlockTitle(date: Date): string {
  return format(date, 'EEE dd MMM yyyy')
}

export function formatWeekRangeLabel(weekMonday: Date): string {
  const friday = addDays(weekMonday, WEEKDAY_COUNT - 1)
  return `${format(weekMonday, 'dd MMM yyyy')} – ${format(friday, 'dd MMM yyyy')}`
}

export function isCurrentWorkingWeek(weekMonday: Date, today = new Date()): boolean {
  const currentMonday = getMondayOfWeek(today)
  return isSameDay(weekMonday, currentMonday)
}

export function shiftWeek(weekMonday: Date, direction: -1 | 1): Date {
  return addDays(weekMonday, direction * 7)
}
