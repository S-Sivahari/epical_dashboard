import type { Employee } from '@/types'
import api from '@/services/api'
import { employeeDisplayName } from '@/services/analyticsService'
import type {
  ChildBlockInput,
  DailyNoteBlock,
  DailyNotesEmailPreview,
  DailyNotesEmailSendOptions,
  DailyNotesEmailSendResult,
  DailyNoteStatus,
  NoteProjectEmployee,
  NoteProjectOption,
  NotesAccess,
  NotesDelegation,
  NotesSearchFilterOptions,
  NotesSearchParams,
  NotesSearchResponse,
} from '@/types/notes'

type TimesheetProject = {
  id: string
  name: string
  client: string
  technologyNode: string
  status: string
  accessType?: 'public' | 'private'
  visibleUsers?: string[]
}

/** Project directory for Daily Notes (`GET /api/notes/projects`). */
export async function listNoteProjects() {
  const res = await api.get<TimesheetProject[]>('/notes/projects')
  return res.data.map((project) => ({
    id: project.id,
    name: project.name,
    client: project.client,
    technologyNode: project.technologyNode,
    status: project.status,
    accessType: project.accessType,
    visibleUsers: project.visibleUsers ?? [],
  }))
}

/** Active employees for Daily Notes pickers (`GET /api/notes/employees`). */
export async function listTimesheetEmployees() {
  const res = await api.get<Employee[]>('/notes/employees')
  return res.data
}

export function employeesForProject(
  allEmployees: Employee[],
  project: NoteProjectOption | null | undefined,
): NoteProjectEmployee[] {
  if (!project) return []

  const allowedNames = new Set((project.visibleUsers ?? []).map((name) => name.trim()).filter(Boolean))
  const pool =
    project.accessType === 'public' && allowedNames.size === 0
      ? allEmployees
      : allEmployees.filter((employee) => allowedNames.has(employeeDisplayName(employee)))

  return pool
    .map((employee) => ({
      id: employee.id,
      employeeId: employee.employeeId,
      name: employeeDisplayName(employee),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listProjectEmployees(projectId: string) {
  const res = await api.get<NoteProjectEmployee[]>(`/notes/projects/${projectId}/employees`)
  return res.data
}

export async function searchNotes(params: NotesSearchParams) {
  const res = await api.get<NotesSearchResponse>('/notes/search', { params })
  return res.data
}

export async function getNotesSearchOptions() {
  const res = await api.get<NotesSearchFilterOptions>('/notes/search/options')
  return res.data
}

export async function listDailyBlocksInRange(from: string, to: string) {
  const res = await api.get<DailyNoteBlock[]>('/notes', { params: { from, to } })
  return res.data
}

export async function getDailyBlockByDate(date: string) {
  const res = await api.get<DailyNoteBlock>(`/notes/by-date/${date}`)
  return res.data
}

export async function getDailyBlockByDateForCopy(sourceDate: string, targetDate: string) {
  const res = await api.get<DailyNoteBlock>(`/notes/by-date/${sourceDate}`, {
    params: { forCopyTo: targetDate },
  })
  return res.data
}

export async function getLatestDailyBlockBefore(beforeDate: string) {
  const res = await api.get<DailyNoteBlock>(`/notes/latest-before/${beforeDate}`)
  return res.data
}

export async function getOrCreateDailyBlock(date: string, status?: DailyNoteStatus) {
  try {
    return await getDailyBlockByDate(date)
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status !== 404) throw err
  }

  try {
    return await createDailyBlock(date, status)
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 409) {
      return await getDailyBlockByDate(date)
    }
    throw err
  }
}

export async function createDailyBlock(date: string, status?: DailyNoteStatus) {
  const res = await api.post<DailyNoteBlock>('/notes', { date, status })
  return res.data
}

export async function updateDailyBlock(
  id: string,
  patch: { status?: DailyNoteStatus; archived?: boolean },
) {
  const res = await api.patch<DailyNoteBlock>(`/notes/${id}`, patch)
  return res.data
}

export async function deleteDailyBlock(id: string) {
  const res = await api.delete<DailyNoteBlock>(`/notes/${id}`)
  return res.data
}

export async function createChildBlock(dailyBlockId: string, input: ChildBlockInput) {
  const res = await api.post<DailyNoteBlock>(`/notes/${dailyBlockId}/child-blocks`, input)
  return res.data
}

export async function updateChildBlock(
  dailyBlockId: string,
  childBlockId: string,
  patch: Partial<ChildBlockInput> & { archived?: boolean },
) {
  const res = await api.patch<DailyNoteBlock>(
    `/notes/${dailyBlockId}/child-blocks/${childBlockId}`,
    patch,
  )
  return res.data
}

export async function deleteChildBlock(dailyBlockId: string, childBlockId: string) {
  const res = await api.delete<DailyNoteBlock>(
    `/notes/${dailyBlockId}/child-blocks/${childBlockId}`,
  )
  return res.data
}

export async function previewDailyNotesEmail(
  dailyBlockId: string,
  options: DailyNotesEmailSendOptions = {},
) {
  const res = await api.get<DailyNotesEmailPreview>(`/notes/${dailyBlockId}/email/preview`, {
    params:
      options.recipientEmployeeIds && options.recipientEmployeeIds.length > 0
        ? { recipientEmployeeIds: options.recipientEmployeeIds.join(',') }
        : undefined,
  })
  return res.data
}

export async function sendDailyNotesEmail(
  dailyBlockId: string,
  options: DailyNotesEmailSendOptions = {},
) {
  const res = await api.post<DailyNotesEmailSendResult>(`/notes/${dailyBlockId}/email/send`, options)
  return res.data
}

export async function reorderChildBlocks(dailyBlockId: string, childBlockIds: string[]) {
  const res = await api.put<DailyNoteBlock>(
    `/notes/${dailyBlockId}/child-blocks/reorder`,
    { childBlockIds },
  )
  return res.data
}

export async function getNotesAccess(params?: { from?: string; to?: string }) {
  const res = await api.get<NotesAccess>('/notes/access', { params })
  return res.data
}

export async function listNotesDelegations(params?: { from?: string; to?: string }) {
  const res = await api.get<NotesDelegation[]>('/notes/delegations', { params })
  return res.data
}

export async function createNotesDelegation(
  date: string,
  employeeId: string,
  to?: string,
): Promise<NotesDelegation | { items: NotesDelegation[]; count: number }> {
  const res = await api.post<NotesDelegation | { items: NotesDelegation[]; count: number }>(
    '/notes/delegations',
    {
      date,
      employeeId,
      ...(to ? { to } : {}),
    },
  )
  return res.data
}

export async function deleteNotesDelegation(id: string) {
  const res = await api.delete<NotesDelegation>(`/notes/delegations/${id}`)
  return res.data
}
