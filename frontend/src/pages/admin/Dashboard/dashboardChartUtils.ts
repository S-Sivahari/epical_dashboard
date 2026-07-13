export type ChartPeriod = 'This Week' | 'This Month' | 'Last Month' | 'Last 2 Months'

export type ChartSelectionMode = 'preset' | 'days' | 'months' | 'years'

export type ChartDateRange = {
  from: string
  to: string
  selectionMode?: ChartSelectionMode
  preset?: Exclude<ChartQuickFilter, 'Custom'>
  /** Individual days (continuous or non-continuous) */
  selectedDays?: string[]
  /** YYYY-MM */
  selectedMonths?: string[]
  /** YYYY */
  selectedYears?: string[]
  /** When days tab uses a continuous from–to range instead of explicit day list */
  dayRangeMode?: 'individual' | 'continuous'
}

export type ChartQuickFilter = 'This Week' | 'This Month' | 'This Year' | 'Custom'

export const CHART_QUICK_FILTERS: { id: ChartQuickFilter; label: string }[] = [
  { id: 'This Week', label: 'This Week' },
  { id: 'This Month', label: 'This Month' },
  { id: 'This Year', label: 'This Year' },
  { id: 'Custom', label: 'Custom' },
]

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

export function getDefaultChartDateRange(): ChartDateRange {
  return getQuickFilterDateRange('This Week')
}

export function getQuickFilterDateRange(filter: Exclude<ChartQuickFilter, 'Custom'>): ChartDateRange {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let start = new Date(today)
  let end = new Date(today)

  switch (filter) {
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
    case 'This Year':
      start = new Date(today.getFullYear(), 0, 1)
      end = new Date(today)
      break
  }

  return {
    from: formatDateKey(start),
    to: formatDateKey(end),
    selectionMode: 'preset',
    preset: filter,
    selectedDays: undefined,
    selectedMonths: undefined,
    selectedYears: undefined,
    dayRangeMode: undefined,
  }
}

export function matchQuickFilter(range: ChartDateRange): ChartQuickFilter {
  if (range.preset && range.selectionMode === 'preset') return range.preset
  if (range.selectedDays?.length || range.selectedMonths?.length || range.selectedYears?.length) {
    return 'Custom'
  }
  if (!range.from || !range.to) return 'Custom'
  for (const filter of ['This Week', 'This Month', 'This Year'] as const) {
    const preset = getQuickFilterDateRange(filter)
    if (preset.from === range.from && preset.to === range.to) return filter
  }
  return 'Custom'
}

export type ChartPeriodPreset = ChartPeriod | 'Custom'

export function inferChartPeriod(from: string, to: string): ChartPeriodPreset {
  for (const period of CHART_PERIODS) {
    const range = getChartRange(period)
    if (range.from === from && range.to === to) return period
  }
  return 'Custom'
}

export function getChartRangeDayCount(from: string, to: string) {
  if (!from || !to) return 0
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
}

export function normalizeChartDateRange(from: string, to: string): ChartDateRange {
  if (!from) return { from: '', to: '' }
  const end = to || from
  return from <= end ? { from, to: end } : { from: end, to: from }
}

export function formatChartRangeLabel(from: string, to: string, selection?: ChartDateRange) {
  if (selection?.selectedYears?.length) return formatSelectedYearsLabel(selection.selectedYears)
  if (selection?.selectedMonths?.length) return formatSelectedMonthsLabel(selection.selectedMonths)
  if (selection?.selectedDays?.length) return formatSelectedDaysLabel(selection.selectedDays)
  if (!from) return 'Select period'
  const normalized = normalizeChartDateRange(from, to)
  const start = new Date(`${normalized.from}T12:00:00`)
  const end = new Date(`${normalized.to}T12:00:00`)
  if (normalized.from === normalized.to) {
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function toMonthKey(year: number, monthIndex: number) {
  return `${year}-${pad(monthIndex + 1)}`
}

export function isMonthKeySelectable(monthKey: string, maxDate: string) {
  return `${monthKey}-01` <= maxDate
}

export function getRangeFromSelectedMonths(months: string[]): ChartDateRange {
  const sorted = [...months].sort()
  if (sorted.length === 0) return { from: '', to: '' }

  const [y1, m1] = sorted[0].split('-').map(Number)
  const [y2, m2] = sorted[sorted.length - 1].split('-').map(Number)
  return {
    from: formatDateKey(new Date(y1, m1 - 1, 1)),
    to: formatDateKey(new Date(y2, m2, 0)),
    selectionMode: 'months',
    selectedMonths: sorted,
    selectedDays: undefined,
    selectedYears: undefined,
    preset: undefined,
    dayRangeMode: undefined,
  }
}

export function getRangeFromSelectedDays(days: string[]): ChartDateRange {
  const sorted = [...days].sort()
  if (sorted.length === 0) return { from: '', to: '' }
  return {
    from: sorted[0],
    to: sorted[sorted.length - 1],
    selectionMode: 'days',
    selectedDays: sorted,
    dayRangeMode: 'individual',
    selectedMonths: undefined,
    selectedYears: undefined,
    preset: undefined,
  }
}

export function getRangeFromSelectedYears(years: string[], maxDate: string): ChartDateRange {
  const sorted = [...years].sort()
  if (sorted.length === 0) return { from: '', to: '' }
  const y1 = Number(sorted[0])
  const y2 = Number(sorted[sorted.length - 1])
  const maxYear = Number(maxDate.slice(0, 4))
  const to =
    y2 >= maxYear
      ? maxDate
      : formatDateKey(new Date(y2, 11, 31))
  return {
    from: formatDateKey(new Date(y1, 0, 1)),
    to,
    selectionMode: 'years',
    selectedYears: sorted,
    selectedDays: undefined,
    selectedMonths: undefined,
    preset: undefined,
    dayRangeMode: undefined,
  }
}

export function formatSelectedDaysLabel(days: string[]) {
  if (days.length === 0) return 'Select days'
  const sorted = [...days].sort()
  if (sorted.length === 1) {
    return new Date(`${sorted[0]}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  if (sorted.length <= 4) {
    return sorted
      .map((d) =>
        new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      )
      .join(', ')
  }
  return `${sorted.length} days selected`
}

export function formatSelectedYearsLabel(years: string[]) {
  if (years.length === 0) return 'Select years'
  const sorted = [...years].sort()
  if (sorted.length === 1) return sorted[0]
  return sorted.join(', ')
}

export function formatChartSelectionLabel(range: ChartDateRange) {
  if (range.selectedYears?.length) return formatSelectedYearsLabel(range.selectedYears)
  if (range.selectedMonths?.length) return formatSelectedMonthsLabel(range.selectedMonths)
  if (range.selectedDays?.length) return formatSelectedDaysLabel(range.selectedDays)
  if (range.preset && range.selectionMode === 'preset') return range.preset
  return formatChartRangeLabel(range.from, range.to)
}

export type ChartBucketKind = 'day' | 'week' | 'month' | 'year'

export function resolveChartBucketKind(range: ChartDateRange): ChartBucketKind {
  if (range.selectedDays?.length) return 'day'
  if (range.selectedMonths?.length) return 'month'
  if (range.selectedYears?.length) return 'year'
  const days = getChartRangeDayCount(range.from, range.to)
  if (days <= 7) return 'day'
  if (days <= 62) return 'week'
  if (days <= 400) return 'month'
  return 'year'
}

export function getChartBucketLabel(kind: ChartBucketKind) {
  switch (kind) {
    case 'day':
      return 'day'
    case 'week':
      return 'week'
    case 'month':
      return 'month'
    case 'year':
      return 'year'
  }
}

export function getChartSubtitleForRange(range: ChartDateRange) {
  const kind = resolveChartBucketKind(range)
  const label = formatChartSelectionLabel(range)
  if (!range.from || !range.to) return 'Choose a period to view project hours'
  return `Hours by ${kind} · ${label}`
}

export function formatSelectedMonthsLabel(months: string[]) {
  if (months.length === 0) return 'Select months'
  const sorted = [...months].sort()
  const sameYear = sorted.every((key) => key.slice(0, 4) === sorted[0].slice(0, 4))

  if (sameYear) {
    const labels = sorted.map((key) => {
      const monthIndex = Number(key.split('-')[1]) - 1
      return MONTH_SHORT[monthIndex] ?? key
    })
    return `${labels.join(', ')} ${sorted[0].slice(0, 4)}`
  }

  return sorted
    .map((key) => {
      const [year, month] = key.split('-')
      const monthIndex = Number(month) - 1
      return `${MONTH_SHORT[monthIndex] ?? month} ${year}`
    })
    .join(', ')
}

function hoursFromTimesheet(
  t: {
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    workedMs?: number
    totalPausedMs?: number
    taskStatus?: string
  },
  now = new Date(),
) {
  if (t.overriddenHours != null) return Number(t.overriddenHours)
  if (!t.loginTime) return 0

  const login = new Date(t.loginTime)
  let end = t.logoutTime ? new Date(t.logoutTime) : now

  if (!t.logoutTime) {
    const elapsedMs = now.getTime() - login.getTime()
    const maxOpenMs = 16 * 60 * 60 * 1000
    if (elapsedMs > maxOpenMs) {
      end = new Date(login.getTime() + maxOpenMs)
    }
  } else {
    if (typeof t.workedMs === 'number' && t.workedMs >= 0) {
      return Math.round((t.workedMs / 3600000) * 10) / 10
    }
    if (t.totalHours != null && t.totalHours > 0) {
      return Number(t.totalHours)
    }
  }

  const paused = t.totalPausedMs ?? 0
  const diffMs = end.getTime() - login.getTime() - paused
  if (diffMs <= 0) return 0
  return Math.round((diffMs / 3600000) * 10) / 10
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
  totalPausedMs?: number
  taskStatus?: string
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

function aggregateDailyChartForRange(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  from: string,
  to: string,
) {
  const buckets: { name: string; start: Date; end: Date }[] = []
  let cursor = new Date(`${from}T00:00:00`)
  const rangeEnd = new Date(`${to}T23:59:59`)

  while (cursor <= rangeEnd) {
    const bucketStart = new Date(cursor)
    const bucketEnd = new Date(cursor)
    bucketEnd.setHours(23, 59, 59, 999)
    buckets.push({
      name: bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start: bucketStart,
      end: bucketEnd,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return buckets.map((bucket) => {
    let hours = 0
    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const d = new Date(t.loginTime)
      if (d >= bucket.start && d <= bucket.end) {
        hours += hoursFromTimesheet(t)
      }
    })
    return { name: bucket.name, hours: Math.round(hours * 10) / 10 }
  })
}

export function aggregateChartDataByMonths(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  months: string[],
) {
  return [...months].sort().map((monthKey) => {
    const [year, month] = monthKey.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59, 999)
    let hours = 0

    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const d = new Date(t.loginTime)
      if (d >= start && d <= end) {
        hours += hoursFromTimesheet(t)
      }
    })

    return {
      name: `${MONTH_SHORT[month - 1]} ${year}`,
      hours: Math.round(hours * 10) / 10,
    }
  })
}

export function aggregateChartDataByDays(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  days: string[],
) {
  return [...days].sort().map((dayKey) => {
    const start = new Date(`${dayKey}T00:00:00`)
    const end = new Date(`${dayKey}T23:59:59`)
    let hours = 0
    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const d = new Date(t.loginTime)
      if (d >= start && d <= end) hours += hoursFromTimesheet(t)
    })
    return {
      name: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: Math.round(hours * 10) / 10,
    }
  })
}

export function aggregateChartDataByYears(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  years: string[],
) {
  return [...years].sort().map((yearKey) => {
    const year = Number(yearKey)
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31, 23, 59, 59, 999)
    let hours = 0
    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const d = new Date(t.loginTime)
      if (d >= start && d <= end) hours += hoursFromTimesheet(t)
    })
    return { name: yearKey, hours: Math.round(hours * 10) / 10 }
  })
}

function aggregateMonthlyBucketsInRange(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  from: string,
  to: string,
) {
  const buckets: { name: string; start: Date; end: Date }[] = []
  const rangeStart = new Date(`${from}T00:00:00`)
  const rangeEnd = new Date(`${to}T23:59:59`)
  let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)

  while (cursor <= rangeEnd) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999)
    buckets.push({
      name: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      start: monthStart < rangeStart ? rangeStart : monthStart,
      end: monthEnd > rangeEnd ? rangeEnd : monthEnd,
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }

  return buckets.map((bucket) => {
    let hours = 0
    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const d = new Date(t.loginTime)
      if (d >= bucket.start && d <= bucket.end) hours += hoursFromTimesheet(t)
    })
    return { name: bucket.name, hours: Math.round(hours * 10) / 10 }
  })
}

function aggregateYearlyBucketsInRange(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  from: string,
  to: string,
) {
  const buckets: { name: string; start: Date; end: Date }[] = []
  const rangeStart = new Date(`${from}T00:00:00`)
  const rangeEnd = new Date(`${to}T23:59:59`)
  let year = rangeStart.getFullYear()

  while (year <= rangeEnd.getFullYear()) {
    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)
    buckets.push({
      name: String(year),
      start: yearStart < rangeStart ? rangeStart : yearStart,
      end: yearEnd > rangeEnd ? rangeEnd : yearEnd,
    })
    year += 1
  }

  return buckets.map((bucket) => {
    let hours = 0
    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const d = new Date(t.loginTime)
      if (d >= bucket.start && d <= bucket.end) hours += hoursFromTimesheet(t)
    })
    return { name: bucket.name, hours: Math.round(hours * 10) / 10 }
  })
}

export function aggregateChartForSelection(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  range: ChartDateRange,
) {
  if (range.selectedDays?.length) {
    return aggregateChartDataByDays(timesheets, range.selectedDays)
  }
  if (range.selectedMonths?.length) {
    return aggregateChartDataByMonths(timesheets, range.selectedMonths)
  }
  if (range.selectedYears?.length) {
    return aggregateChartDataByYears(timesheets, range.selectedYears)
  }

  const kind = resolveChartBucketKind(range)
  if (kind === 'day') return aggregateDailyChartForRange(timesheets, range.from, range.to)
  if (kind === 'week') return aggregateWeeklyBucketsInRange(timesheets, range.from, range.to)
  if (kind === 'month') return aggregateMonthlyBucketsInRange(timesheets, range.from, range.to)
  return aggregateYearlyBucketsInRange(timesheets, range.from, range.to)
}

function aggregateWeeklyBucketsInRange(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  from: string,
  to: string,
) {
  const buckets: { name: string; start: Date; end: Date }[] = []
  let cursor = new Date(`${from}T00:00:00`)
  const rangeEnd = new Date(`${to}T23:59:59`)

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
      if (d >= b.start && d <= b.end) hours += hoursFromTimesheet(t)
    })
    return { name: b.name, hours: Math.round(hours * 10) / 10 }
  })
}

export function aggregateChartDataForRange(
  timesheets: Array<{
    loginTime?: string
    logoutTime?: string
    overriddenHours?: number
    totalHours?: number
    totalPausedMs?: number
  }>,
  from: string,
  to: string,
) {
  return aggregateChartForSelection(timesheets, { from, to })
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

export function getChartDateRangeSubtitle(from: string, to: string) {
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[Number(m) - 1]} ${Number(day)}, ${y}`
  }
  if (!from || !to) return 'Hours logged'
  return from === to
    ? `Hours logged on ${fmt(from)}`
    : `Hours logged ${fmt(from)} – ${fmt(to)}`
}

export function getChartSubtitle(period: ChartPeriod | string, from?: string, to?: string) {
  if (from && to) {
    return getChartDateRangeSubtitle(from, to)
  }

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

/** Pick weekly vs ranged chart aggregation from the selected date span. */
export function chartPeriodForDateRange(from: string, to: string): ChartPeriod {
  const week = getChartRange('This Week')
  return from === week.from && to === week.to ? 'This Week' : 'This Month'
}
