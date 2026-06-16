import { employeeDisplayName } from '@/services/analyticsService'
import {
  createChildBlock,
  employeesForProject,
  listNoteProjects,
  listProjectEmployees,
  listTimesheetEmployees,
  updateChildBlock,
} from '@/services/notesService'
import type {
  DailyNoteBlock,
  NoteChildBlock,
  NoteProjectEmployee,
  NoteProjectOption,
} from '@/types/notes'
import type { Employee } from '@/types'

export type NotesProjectGroup = {
  projectId: string
  projectName: string
  entries: NoteChildBlock[]
}

export function entryEmployeeKeys(entry: NoteChildBlock): string[] {
  if (entry.employeeIds.length > 0) return entry.employeeIds
  if (entry.employees.length > 0) return entry.employees.map((employee) => employee.id)
  return []
}

export function employeeIdsOnProjectForDay(block: DailyNoteBlock, projectId: string): Set<string> {
  const ids = new Set<string>()
  for (const child of block.childBlocks) {
    if (child.archived || child.projectId !== projectId) continue
    for (const employeeId of entryEmployeeKeys(child)) {
      ids.add(employeeId)
    }
  }
  return ids
}

export function employeesAvailableForProjectDay(
  allEmployees: Employee[],
  block: DailyNoteBlock,
  projectId: string,
): NoteProjectEmployee[] {
  const existing = employeeIdsOnProjectForDay(block, projectId)
  return allEmployees
    .filter((employee) => !existing.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      employeeId: employee.employeeId,
      name: employeeDisplayName(employee),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function findEntryForProjectEmployee(
  block: DailyNoteBlock,
  projectId: string,
  employeeId: string,
): NoteChildBlock | null {
  for (const child of block.childBlocks) {
    if (child.archived || child.projectId !== projectId) continue
    if (entryEmployeeKeys(child).includes(employeeId)) return child
  }
  return null
}

export function needsPerEmployeeNormalization(block: DailyNoteBlock): boolean {
  return block.childBlocks.some(
    (entry) => !entry.archived && entryEmployeeKeys(entry).length > 1,
  )
}

function projectEmployeeKey(projectId: string, employeeId: string) {
  return `${projectId}:${employeeId}`
}

export function expandEntriesPerEmployee(entries: NoteChildBlock[]): NoteChildBlock[] {
  const expanded: NoteChildBlock[] = []

  for (const entry of entries) {
    const employeeIds = entryEmployeeKeys(entry)
    if (employeeIds.length <= 1) {
      expanded.push(entry)
      continue
    }

    const people =
      entry.employees.length > 0
        ? entry.employees
        : employeeIds.map((id) => ({ id, name: '—' }))

    people.forEach((person, index) => {
      expanded.push({
        ...entry,
        employeeIds: [person.id],
        employees: [{ id: person.id, name: person.name }],
        description: index === 0 ? entry.description : '',
      })
    })
  }

  return expanded
}

export function groupEntriesByProject(entries: NoteChildBlock[]): NotesProjectGroup[] {
  const map = new Map<string, NotesProjectGroup>()

  for (const entry of entries) {
    const projectId = entry.projectId || entry.title
    const projectName = entry.projectName || entry.title
    const existing = map.get(projectId)
    if (existing) {
      existing.entries.push(entry)
    } else {
      map.set(projectId, { projectId, projectName, entries: [entry] })
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName))
}

async function resolveProjectEmployees(project: NoteProjectOption, allEmployees: Employee[]) {
  try {
    const fromApi = await listProjectEmployees(project.id)
    if (fromApi.length > 0) return fromApi
  } catch {
    // Fall back to the local timesheet employee directory.
  }

  const resolved = employeesForProject(allEmployees, project)
  if (resolved.length > 0) return resolved

  const names = (project.visibleUsers ?? []).map((name) => name.trim()).filter(Boolean)
  const matched = names
    .map((name) => allEmployees.find((employee) => employeeDisplayName(employee) === name))
    .filter((employee): employee is Employee => Boolean(employee))
    .map((employee) => ({
      id: employee.id,
      employeeId: employee.employeeId,
      name: employeeDisplayName(employee),
    }))

  const unique = new Map(matched.map((employee) => [employee.id, employee]))
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadNotesProjectContext() {
  const [projects, employees] = await Promise.all([listNoteProjects(), listTimesheetEmployees()])
  return { projects, employees }
}

async function migrateCombinedEntries(block: DailyNoteBlock): Promise<DailyNoteBlock> {
  let current = block
  const combined = current.childBlocks.filter(
    (entry) => !entry.archived && entryEmployeeKeys(entry).length > 1,
  )

  for (const entry of combined) {
    const employeeIds = entryEmployeeKeys(entry)
    let first = true

    for (const employeeId of employeeIds) {
      const hasDedicated = current.childBlocks.some(
        (child) =>
          !child.archived &&
          child.projectId === entry.projectId &&
          entryEmployeeKeys(child).length === 1 &&
          entryEmployeeKeys(child)[0] === employeeId,
      )
      if (hasDedicated) continue

      current = await createChildBlock(current._id, {
        title: entry.title,
        projectId: entry.projectId,
        employeeIds: [employeeId],
        description: first ? entry.description : '',
        includeInEmail: entry.includeInEmail,
      })
      first = false
    }

    current = await updateChildBlock(current._id, entry._id, { archived: true })
  }

  return current
}

export async function normalizePerEmployeeEntries(block: DailyNoteBlock): Promise<DailyNoteBlock> {
  return migrateCombinedEntries(block)
}

export async function bootstrapProjectEntries(
  block: DailyNoteBlock,
  projects: NoteProjectOption[],
  allEmployees: Employee[],
): Promise<DailyNoteBlock> {
  let current = await migrateCombinedEntries(block)

  const activeProjects = projects
    .filter((project) => project.status === 'Active')
    .sort((a, b) => a.name.localeCompare(b.name))

  const existingEmployeeKeys = new Set<string>()
  for (const child of current.childBlocks.filter((entry) => !entry.archived && entry.projectId)) {
    const employeeIds = entryEmployeeKeys(child)
    if (employeeIds.length === 0) continue
    for (const employeeId of employeeIds) {
      existingEmployeeKeys.add(projectEmployeeKey(child.projectId, employeeId))
    }
  }

  for (const project of activeProjects) {
    const projectEmployees = await resolveProjectEmployees(project, allEmployees)
    for (const employee of projectEmployees) {
      const key = projectEmployeeKey(project.id, employee.id)
      if (existingEmployeeKeys.has(key)) continue

      current = await createChildBlock(current._id, {
        title: project.name,
        projectId: project.id,
        employeeIds: [employee.id],
        description: '',
        includeInEmail: true,
      })
      existingEmployeeKeys.add(key)
    }
  }

  return current
}

export function employeeNamesLabel(child: DailyNoteBlock['childBlocks'][number]): string {
  if (child.employees.length === 1) {
    return child.employees[0].name
  }
  if (child.employees.length > 1) {
    return child.employees.map((employee) => employee.name).join(' / ')
  }
  return '—'
}
