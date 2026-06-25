import { addDays, format, isAfter, isSameDay, startOfDay, startOfWeek } from 'date-fns'
import type { DailyNoteBlock } from '@/types/notes'

const DAYS_IN_WEEK = 7

/** Start of calendar week (Sunday). */
export function getSundayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 0 })
}

/** @deprecated Use getSundayOfWeek — kept for URL param compatibility during migration */
export function getMondayOfWeek(date: Date): Date {
  return getSundayOfWeek(date)
}

export function getCalendarWeekDays(weekSunday: Date): Date[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(weekSunday, index))
}

/** @deprecated Use getCalendarWeekDays */
export function getWorkingWeekdays(weekMonday: Date): Date[] {
  return getCalendarWeekDays(weekMonday)
}

export function orderWeekdaysLatestFirst(weekdays: Date[]): Date[] {
  return [...weekdays].reverse()
}

/** Sun → Sat within the selected week. */
export function orderWeekDaysForDisplay(
  weekSunday: Date,
  weekdays: Date[],
  _today = new Date(),
): Date[] {
  void weekSunday
  return [...weekdays].sort((a, b) => a.getTime() - b.getTime())
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** True when the calendar day is strictly before today (notes are read-only). */
export function isPastNotesDay(dateKey: string, today = new Date()): boolean {
  return dateKey < toDateKey(today)
}

/** True when the calendar day is after today. */
export function isFutureNotesDay(dateKey: string, today = new Date()): boolean {
  return dateKey > toDateKey(today)
}

export function isFutureDate(date: Date, today = new Date()): boolean {
  return isAfter(startOfDay(date), startOfDay(today))
}

export function formatDailyBlockTitle(date: Date): string {
  return format(date, 'EEE dd MMM yyyy')
}

export function formatWeekRangeLabel(weekSunday: Date): string {
  const saturday = addDays(weekSunday, DAYS_IN_WEEK - 1)
  return `${format(weekSunday, 'dd MMM yyyy')} – ${format(saturday, 'dd MMM yyyy')}`
}

export function isCurrentCalendarWeek(weekSunday: Date, today = new Date()): boolean {
  const currentSunday = getSundayOfWeek(today)
  return isSameDay(weekSunday, currentSunday)
}

/** @deprecated Use isCurrentCalendarWeek */
export function isCurrentWorkingWeek(weekMonday: Date, today = new Date()): boolean {
  return isCurrentCalendarWeek(weekMonday, today)
}

export function shiftWeek(weekSunday: Date, direction: -1 | 1): Date {
  return addDays(weekSunday, direction * 7)
}

export type WeekDayEntry = {
  date: Date
  dateKey: string
  block: DailyNoteBlock | null
}

export function buildWeekDays(
  weekSunday: Date,
  blocksByDate: Record<string, DailyNoteBlock | null | undefined>,
): WeekDayEntry[] {
  return orderWeekDaysForDisplay(weekSunday, getCalendarWeekDays(weekSunday)).map((date) => {
    const dateKey = toDateKey(date)
    return { date, dateKey, block: blocksByDate[dateKey] ?? null }
  })
}
