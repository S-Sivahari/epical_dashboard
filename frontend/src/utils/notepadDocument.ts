import { employeeDisplayName } from '@/services/analyticsService'
import type { NoteChildBlock, NoteProjectOption } from '@/types/notes'
import type { Employee } from '@/types'
import { employeeNamesLabel, entryEmployeeKeys, groupEntriesByProject } from '@/utils/notesBootstrap'
import { formatNoteDisplayLine, noteHtmlToPlainText } from '@/utils/notesPlainText'

export type ParsedNotepadEntry = {
  projectId: string
  projectName: string
  employeeIds: string[]
  employeeNames: string[]
  description: string
}

export type NotepadParseResult = {
  entries: ParsedNotepadEntry[]
  warnings: string[]
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function findProjectByHeader(line: string, projects: NoteProjectOption[]): NoteProjectOption | null {
  const trimmed = line.trim()
  if (!trimmed.endsWith(':')) return null
  const header = trimmed.slice(0, -1).trim()
  if (!header) return null
  return (
    projects.find((project) => normalizeName(project.name) === normalizeName(header)) ??
    projects.find((project) => project.name.toUpperCase() === header.toUpperCase()) ??
    null
  )
}

function resolveEmployeeIds(nameLine: string, employees: Employee[]): { ids: string[]; names: string[] } {
  const parts = nameLine
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  const ids: string[] = []
  const names: string[] = []

  for (const part of parts) {
    const normalized = normalizeName(part)
    const employee =
      employees.find((item) => normalizeName(employeeDisplayName(item)) === normalized) ??
      employees.find((item) => normalizeName(item.firstName ?? '') === normalized) ??
      employees.find((item) => normalizeName(part).includes(normalizeName(item.firstName ?? '')))

    if (employee) {
      ids.push(employee.id)
      names.push(employeeDisplayName(employee))
    } else {
      names.push(part)
    }
  }

  return { ids, names }
}

export function serializeBlockToNotepadText(entries: NoteChildBlock[]): string {
  const groups = groupEntriesByProject(
    entries.filter((entry) => !entry.archived).sort((a, b) => a.sortOrder - b.sortOrder),
  )

  const lines: string[] = []

  for (const group of groups) {
    lines.push(`${group.projectName.toUpperCase()}:`)

    for (const entry of group.entries) {
      const names = employeeNamesLabel(entry)
      if (names !== '—') lines.push(names)

      const plain = noteHtmlToPlainText(entry.description)
      for (const line of plain.split('\n').map((item) => item.trim()).filter(Boolean)) {
        lines.push(formatNoteDisplayLine(line))
      }

      lines.push('')
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

export function parseNotepadText(
  text: string,
  projects: NoteProjectOption[],
  employees: Employee[],
): NotepadParseResult {
  const warnings: string[] = []
  const entries: ParsedNotepadEntry[] = []

  let currentProject: NoteProjectOption | null = null
  let currentEmployeeLine: string | null = null
  let currentLines: string[] = []

  const flushEntry = () => {
    if (!currentProject || !currentEmployeeLine) {
      currentEmployeeLine = null
      currentLines = []
      return
    }

    const { ids, names } = resolveEmployeeIds(currentEmployeeLine, employees)
    if (ids.length === 0) {
      warnings.push(`Could not match employees for "${currentEmployeeLine}" under ${currentProject.name}.`)
    }

    entries.push({
      projectId: currentProject.id,
      projectName: currentProject.name,
      employeeIds: ids,
      employeeNames: names,
      description: currentLines.join('\n').trim(),
    })

    currentEmployeeLine = null
    currentLines = []
  }

  const rawLines = text.replace(/\r\n/g, '\n').split('\n')

  for (const rawLine of rawLines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushEntry()
      continue
    }

    const project = findProjectByHeader(trimmed, projects)
    if (project) {
      flushEntry()
      currentProject = project
      continue
    }

    if (trimmed.startsWith('--')) {
      if (!currentProject) {
        warnings.push(`Note line "${trimmed}" has no project heading above it.`)
        continue
      }
      if (!currentEmployeeLine) {
        warnings.push(`Note line "${trimmed}" has no employee name above it.`)
        continue
      }
      currentLines.push(trimmed.replace(/^--\s*/, '').trim())
      continue
    }

    flushEntry()
    if (!currentProject) {
      warnings.push(`Employee line "${trimmed}" has no project heading above it.`)
      continue
    }
    currentEmployeeLine = trimmed
  }

  flushEntry()

  return { entries, warnings }
}

export function sameEmployeeIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  return b.every((id) => setA.has(id))
}

export function matchExistingEntry(
  existing: NoteChildBlock[],
  draft: ParsedNotepadEntry,
): NoteChildBlock | null {
  return existing.find(
    (entry) =>
      !entry.archived &&
      entry.projectId === draft.projectId &&
      sameEmployeeIdSet(entryEmployeeKeys(entry), draft.employeeIds),
  ) ?? null
}
