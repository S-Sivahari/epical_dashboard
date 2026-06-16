import { addDays, format, isAfter, isSameDay, startOfDay, startOfWeek } from 'date-fns'
import type { DailyNoteBlock } from '@/types/notes'

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

/** Current week: today first, then earlier days, then upcoming days. Other weeks: Fri→Mon. */
export function orderWeekDaysForDisplay(
  weekMonday: Date,
  weekdays: Date[],
  today = new Date(),
): Date[] {
  if (!isCurrentWorkingWeek(weekMonday, today)) {
    return orderWeekdaysLatestFirst(weekdays)
  }

  const todayStart = startOfDay(today)
  const pastAndToday: Date[] = []
  const future: Date[] = []

  for (const day of weekdays) {
    if (isAfter(startOfDay(day), todayStart)) {
      future.push(day)
    } else {
      pastAndToday.push(day)
    }
  }

  return [
    ...orderWeekdaysLatestFirst(pastAndToday),
    ...future.sort((a, b) => a.getTime() - b.getTime()),
  ]
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

export type WeekDayEntry = {
  date: Date
  dateKey: string
  block: DailyNoteBlock | null
}

/** All working weekdays for the selected week (Mon–Fri), latest first. */
export function buildWeekDays(
  weekMonday: Date,
  blocksByDate: Record<string, DailyNoteBlock | null | undefined>,
): WeekDayEntry[] {
  return orderWeekDaysForDisplay(weekMonday, getWorkingWeekdays(weekMonday)).map((date) => {
    const dateKey = toDateKey(date)
    return { date, dateKey, block: blocksByDate[dateKey] ?? null }
  })
}
