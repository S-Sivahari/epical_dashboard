import type { DailyNoteBlock, NoteChildBlock } from '@/types/notes'
import { entryEmployeeKeys, expandEntriesPerEmployee } from '@/utils/notesBootstrap'
import { noteHtmlToPlainText } from '@/utils/notesPlainText'
import { formatDateTime } from '@/utils/formatDate'

export type NotesDayStats = {
  totalNotes: number
  totalEmployees: number
  totalProjects: number
}

export function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function formatNoteTime(value?: string): string {
  if (!value) return '—'
  return formatDateTime(value)
}

export function entryHasNoteContent(entry: NoteChildBlock): boolean {
  return noteHtmlToPlainText(entry.description).trim().length > 0
}

export function computeDayStats(block: DailyNoteBlock | null): NotesDayStats {
  if (!block) {
    return { totalNotes: 0, totalEmployees: 0, totalProjects: 0 }
  }

  const entries = block.childBlocks.filter((child) => !child.archived)
  const expanded = expandEntriesPerEmployee(entries)
  const employees = new Set<string>()
  const projects = new Set<string>()
  let totalNotes = 0

  for (const entry of expanded) {
    if (entryHasNoteContent(entry)) totalNotes += 1
    entryEmployeeKeys(entry).forEach((id) => employees.add(id))
    if (entry.projectId) projects.add(entry.projectId)
  }

  return {
    totalNotes,
    totalEmployees: employees.size,
    totalProjects: projects.size,
  }
}

