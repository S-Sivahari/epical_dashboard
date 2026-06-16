import { parseISO } from 'date-fns'
import { getMondayOfWeek, toDateKey } from '@/utils/notesWeek'

export type NotesSearchFilters = {
  q: string
  from: string
  to: string
}

export const EMPTY_NOTES_SEARCH: NotesSearchFilters = {
  q: '',
  from: '',
  to: '',
}

export function readNotesSearchFromParams(params: URLSearchParams): NotesSearchFilters {
  return {
    q: params.get('q') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  }
}

export function readWeekViewFromParams(params: URLSearchParams): Date | null {
  const week = params.get('week')
  if (!week) return null
  try {
    return getMondayOfWeek(parseISO(week))
  } catch {
    return null
  }
}

export function hasActiveNotesSearch(filters: NotesSearchFilters): boolean {
  return Boolean(filters.q.trim() || filters.from || filters.to)
}

export function writeNotesSearchToParams(
  params: URLSearchParams,
  filters: NotesSearchFilters,
  weekViewMonday: Date,
) {
  const setOrDelete = (key: string, value: string) => {
    if (value) params.set(key, value)
    else params.delete(key)
  }

  setOrDelete('q', filters.q.trim())
  setOrDelete('from', filters.from)
  setOrDelete('to', filters.to)

  params.delete('searchWeek')
  params.delete('projectId')
  params.delete('employeeId')
  params.delete('status')

  const currentMonday = toDateKey(getMondayOfWeek(new Date()))
  const viewMonday = toDateKey(weekViewMonday)
  if (viewMonday !== currentMonday) params.set('week', viewMonday)
  else params.delete('week')
}
