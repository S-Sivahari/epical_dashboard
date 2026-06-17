export type ChartPeriod = 'This Week' | 'This Month' | 'Last Month' | 'Last 2 Months'

export const CHART_PERIODS: ChartPeriod[] = [
  'This Week',
  'This Month',
  'Last Month',
  'Last 2 Months',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getChartRange(period: ChartPeriod) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let start = new Date(today)
  let end = new Date(today)

  switch (period) {
    case 'This Week': {
      const day = today.getDay()
      const diffToMon = day === 0 ? -6 : 1 - day
      start.setDate(today.getDate() + diffToMon)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      break
    }
    case 'This Month':
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      break
    case 'Last Month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
      break
    case 'Last 2 Months':
      end = new Date(today)
      start = new Date(today.getFullYear(), today.getMonth() - 2, 1)
      break
  }

  return { from: formatDateKey(start), to: formatDateKey(end) }
}

function hoursFromTimesheet(t: {
  loginTime?: string
  logoutTime?: string
  overriddenHours?: number
  totalHours?: number
  totalPausedMs?: number
}) {
  if (t.totalHours != null) return Number(t.totalHours)
  if (t.overriddenHours != null) return Number(t.overriddenHours)
  if (!t.loginTime || !t.logoutTime) return 0
  const pausedMs = Number(t.totalPausedMs ?? 0)
  return (
    Math.round(
      ((new Date(t.logoutTime).getTime() - new Date(t.loginTime).getTime() - pausedMs) / 3600000) *
        10,
    ) / 10
  )
}

export type ProjectContributionStatus = 'In Progress' | 'Completed' | 'Cancelled'
export type ProjectAccessType = 'public' | 'private'

export type ProjectTableRow = {
  id: string
  project: string
  client: string
  lead: string
  members: string[]
  access: ProjectAccessType
  totalHours: number
  status: ProjectContributionStatus
}

export function normalizeProjectAccess(accessType?: string): ProjectAccessType {
  return accessType === 'private' ? 'private' : 'public'
}

export function formatProjectAccessLabel(access: ProjectAccessType): string {
  return access === 'private' ? 'Private' : 'Public'
}

export function mapProjectContributionStatus(
  projectStatus?: string,
): ProjectContributionStatus {
  const s = (projectStatus || '').trim()
  if (s === 'Completed') return 'Completed'
  if (s === 'Cancelled' || s === 'Rejected') return 'Cancelled'
  return 'In Progress'
}

export function formatProjectMembers(names: string[]): string {
  if (names.length === 0) return '—'
  const sorted = [...names].sort((a, b) => a.localeCompare(b))
  if (sorted.length <= 3) {
    const joined = sorted.join(', ')
    return joined.length > 56 ? `${joined.slice(0, 53)}...` : joined
  }
  return `${sorted.slice(0, 3).join(', ')}, ...`
}

type DashboardProject = {
  id?: string
  _id?: string
  name?: string
  projectName?: string
  client?: string
  clientName?: string
  teamLead?: string
  accessType?: string
  status?: string
  completionPercentage?: number
  completedTasks?: number
  totalTasks?: number
}

function normalizeDashboardProject(raw: DashboardProject): DashboardProject {
  const id = String(raw.id || raw._id || '').trim()
  const name = String(raw.name || raw.projectName || '').trim()
  return {
    ...raw,
    id: id || undefined,
    _id: id || raw._id,
    name: name || undefined,
    client: raw.client || raw.clientName,
    teamLead: raw.teamLead,
  }
}

export function projectCompletionPercent(project?: DashboardProject): number {
  if (!project) return 0
  const total = Number(project.totalTasks ?? 0)
  const completed = Number(project.completedTasks ?? 0)
  if (total > 0) {
    return Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
  }
  const stored = Number(project.completionPercentage ?? 0)
  return Number.isFinite(stored)
    ? Math.min(100, Math.max(0, Math.round(stored)))
    : 0
}

type DashboardTimesheet = {
  project?: string
  projectId?: string
  client?: string
  employeeName?: string
  loginTime?: string
  logoutTime?: string
  overriddenHours?: number
  totalHours?: number
}

export function aggregateProjectTableRows(
  timesheets: DashboardTimesheet[],
  projects: DashboardProject[],
): ProjectTableRow[] {
  const hoursByKey = new Map<string, number>()
  const membersByKey = new Map<string, Set<string>>()

  const addMember = (key: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (!membersByKey.has(key)) membersByKey.set(key, new Set())
    membersByKey.get(key)!.add(trimmed)
  }

  timesheets.forEach((t) => {
    const hours = hoursFromTimesheet(t)
    if (hours <= 0) return
    const key = (t.projectId || t.project || '').trim()
    if (!key) return
    hoursByKey.set(key, (hoursByKey.get(key) || 0) + hours)
    if (t.employeeName) addMember(key, t.employeeName)
  })

  const normalizedProjects = projects.map((p) => normalizeDashboardProject(p))

  const projectById = new Map<string, DashboardProject>()
  const projectByName = new Map<string, DashboardProject>()
  normalizedProjects.forEach((p) => {
    const id = String(p.id || p._id || '').trim()
    if (id) projectById.set(id, p)
    if (p.name) projectByName.set(p.name, p)
  })

  type RowDraft = Omit<ProjectTableRow, 'members' | 'status'>
  const rows = new Map<string, RowDraft>()

  const upsertRow = (key: string, partial: Omit<RowDraft, 'id' | 'totalHours'> & { totalHours?: number }) => {
    const existing = rows.get(key)
    const hours = partial.totalHours ?? existing?.totalHours ?? 0
    rows.set(key, {
      id: key,
      project: partial.project,
      client: partial.client,
      lead: partial.lead,
      access: partial.access ?? existing?.access ?? 'public',
      totalHours: Math.round(hours * 10) / 10,
    })
  }

  normalizedProjects
    .filter((p) => p.status === 'Active')
    .forEach((p) => {
      const id = String(p.id || p._id || p.name || '').trim()
      if (!id) return
      const hours = hoursByKey.get(id) ?? (p.name ? hoursByKey.get(p.name) : 0) ?? 0
      upsertRow(id, {
        project: p.name || 'Untitled Project',
        client: p.client || '—',
        lead: p.teamLead || '—',
        access: normalizeProjectAccess(p.accessType),
        totalHours: hours,
      })
    })

  hoursByKey.forEach((hours, key) => {
    if (rows.has(key)) {
      const row = rows.get(key)!
      row.totalHours = Math.round(hours * 10) / 10
      return
    }

    const matched = projectById.get(key) || projectByName.get(key)
    const sampleTs = timesheets.find((t) => t.projectId === key || t.project === key)
    upsertRow(key, {
      project: matched?.name || key,
      client: matched?.client || sampleTs?.client || '—',
      lead: matched?.teamLead || '—',
      access: normalizeProjectAccess(matched?.accessType),
      totalHours: hours,
    })
  })

  const sorted = Array.from(rows.values())
    .sort((a, b) => b.totalHours - a.totalHours || a.project.localeCompare(b.project))
    .slice(0, 10)

  const membersForRow = (row: RowDraft): string[] => {
    const fromId = membersByKey.get(row.id)
    const fromName = membersByKey.get(row.project)
    const combined = new Set<string>([...(fromId ?? []), ...(fromName ?? [])])
    return Array.from(combined)
  }

  return sorted.map((row) => {
    const project =
      projectById.get(row.id) ||
      projectByName.get(row.id) ||
      projectByName.get(row.project)
    return {
      ...row,
      members: membersForRow(row),
      access: normalizeProjectAccess(project?.accessType ?? row.access),
      status: mapProjectContributionStatus(project?.status),
    }
  })
}

function formatBucketLabel(start: Date, end: Date): string {
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (sameMonth) {
    return `${startLabel}–${end.getDate()}`
  }
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${startLabel}–${endLabel}`
}

export function aggregateChartData(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  period: ChartPeriod,
) {
  if (period === 'This Week') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const byDay: Record<string, number> = {}

    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const key = dayNames[new Date(t.loginTime).getDay()]
      byDay[key] = (byDay[key] || 0) + hoursFromTimesheet(t)
    })

    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => ({
      name,
      hours: Math.round((byDay[name] || 0) * 10) / 10,
    }))
  }

  const range = getChartRange(period)
  const buckets: { name: string; start: Date; end: Date }[] = []
  let cursor = new Date(`${range.from}T00:00:00`)
  const rangeEnd = new Date(`${range.to}T23:59:59`)

  while (cursor <= rangeEnd) {
    const bucketStart = new Date(cursor)
    const bucketEnd = new Date(cursor)
    bucketEnd.setDate(bucketEnd.getDate() + 6)
    if (bucketEnd > rangeEnd) bucketEnd.setTime(rangeEnd.getTime())

    buckets.push({
      name: formatBucketLabel(bucketStart, bucketEnd),
      start: bucketStart,
      end: bucketEnd,
    })

    cursor.setDate(cursor.getDate() + 7)
  }

  return buckets.map((b) => {
    let hours = 0
    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const d = new Date(t.loginTime)
      if (d >= b.start && d <= b.end) {
        hours += hoursFromTimesheet(t)
      }
    })
    return { name: b.name, hours: Math.round(hours * 10) / 10 }
  })
}

export function getChartSubtitle(period: ChartPeriod) {
  switch (period) {
    case 'This Week':
      return 'Hours logged this week (Mon–Sun)'
    case 'This Month':
      return 'Hours logged this month by week'
    case 'Last Month':
      return 'Hours logged last month by week'
    case 'Last 2 Months':
      return 'Hours logged over the last two months by week'
    default:
      return 'Hours logged'
  }
}
