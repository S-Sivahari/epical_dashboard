import api from '@services/api'
import { getEmployees, getEmployee } from '@services/employeeService'
import { getLeaves } from '@/services/leaveService'
import { listEnrollments, listCourses, type CourseEnrollment, type Course } from '@services/trainingService'
import type { Employee, LeaveRequest } from '@/types'
import { formatDateKey } from '@/pages/admin/Dashboard/dashboardChartUtils'

export type AnalyticsTimesheet = {
  employeeId?: string
  employeeName?: string
  loginTime?: string
  logoutTime?: string
  overriddenHours?: number
  totalHours?: number
  date?: string
}

export type WeekdayHours = { name: string; hours: number }
export type CourseSlice = { name: string; value: number }

export type CourseEnrollmentDetail = {
  employeeId: string
  employeeName: string
  department: string
  status: 'Completed' | 'In Progress' | 'Not Started'
  completedAt?: string
}

export type CourseAnalyticsRow = {
  courseId: string
  courseName: string
  assigned: number
  completed: number
  inProgress: number
  notStarted: number
  completionPercent: number
  rank: number
  isLowCompletion: boolean
  employees: {
    completed: CourseEnrollmentDetail[]
    inProgress: CourseEnrollmentDetail[]
    notStarted: CourseEnrollmentDetail[]
  }
}

export type TrainingAnalyticsSummary = {
  totalCourses: number
  totalEnrollments: number
  totalCompleted: number
  totalInProgress: number
  totalNotStarted: number
  topPerformingCourse: { name: string; percent: number } | null
  overallSlice: CourseSlice[]
}

export type TrainingAnalytics = {
  courses: CourseAnalyticsRow[]
  summary: TrainingAnalyticsSummary
}

const LOW_COMPLETION_THRESHOLD = 50
export type AnalyticsMetrics = {
  totalHours: number
  completedCourses: number
  avgHoursPerWeek: number
}

export type PerformanceTier = 'top' | 'above' | 'below'

export type EmployeePerformanceRow = {
  id: string
  name: string
  employeeId: string
  totalHours: number
  totalWorkingDays: number
  attendancePercent: number
  leaveDays: number
  tier: PerformanceTier
}

export type ComparisonSummary = {
  totalEmployees: number
  totalHours: number
  avgHoursPerEmployee: number
  highestPerformer: { name: string; hours: number } | null
  lowestPerformer: { name: string; hours: number } | null
}

export type TrendPoint = { label: string; hours: number }
export type AttendanceTrendPoint = { label: string; attendance: number }

export type IndividualPerformance = {
  hoursTrend: TrendPoint[]
  attendanceTrend: AttendanceTrendPoint[]
  attendance: AttendanceSummary
}

export function employeeDisplayName(employee: Pick<Employee, 'firstName' | 'lastName'>) {
  return `${employee.firstName}${employee.lastName ? ` ${employee.lastName}` : ''}`.trim()
}

export type AnalyticsPeriodPreset = 'month' | 'this_week' | 'past_week' | 'last_two_weeks'

export type AnalyticsDateRange = { from: string; to: string }

export function getMonday(d: Date) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

export function getMonthRange(year: number, month: number): AnalyticsDateRange {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { from: formatDateKey(start), to: formatDateKey(end) }
}

export function getAnalyticsDateRange(
  preset: AnalyticsPeriodPreset,
  year: number,
  month: number,
): AnalyticsDateRange {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'month':
      return getMonthRange(year, month)
    case 'this_week': {
      const start = getMonday(today)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { from: formatDateKey(start), to: formatDateKey(end) }
    }
    case 'past_week': {
      const thisMon = getMonday(today)
      const start = new Date(thisMon)
      start.setDate(thisMon.getDate() - 7)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { from: formatDateKey(start), to: formatDateKey(end) }
    }
    case 'last_two_weeks': {
      const thisMon = getMonday(today)
      const start = new Date(thisMon)
      start.setDate(thisMon.getDate() - 14)
      const end = new Date(thisMon)
      end.setDate(thisMon.getDate() - 1)
      return { from: formatDateKey(start), to: formatDateKey(end) }
    }
  }
}

export function getPeriodLabel(preset: AnalyticsPeriodPreset, year: number, month: number) {
  const range = getAnalyticsDateRange(preset, year, month)
  const from = new Date(`${range.from}T00:00:00`)
  const to = new Date(`${range.to}T00:00:00`)

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  switch (preset) {
    case 'month':
      return from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    case 'this_week':
      return `This week · ${fmt(from)} – ${fmt(to)}`
    case 'past_week':
      return `Past week · ${fmt(from)} – ${fmt(to)}`
    case 'last_two_weeks':
      return `Last 2 weeks · ${fmt(from)} – ${fmt(to)}`
  }
}

function weeksInRange(preset: AnalyticsPeriodPreset, year: number, month: number) {
  switch (preset) {
    case 'this_week':
    case 'past_week':
      return 1
    case 'last_two_weeks':
      return 2
    case 'month':
      return weeksInMonth(year, month)
  }
}

function isDateInRange(isoDate: string, range: AnalyticsDateRange) {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return false
  const from = new Date(`${range.from}T00:00:00`)
  const to = new Date(`${range.to}T23:59:59`)
  return d >= from && d <= to
}

function hoursFromTimesheet(t: AnalyticsTimesheet) {
  if (t.totalHours != null) return Number(t.totalHours)
  if (t.overriddenHours != null) return Number(t.overriddenHours)
  if (!t.loginTime || !t.logoutTime) return 0
  return (
    Math.round(
      ((new Date(t.logoutTime).getTime() - new Date(t.loginTime).getTime()) / 3600000) * 10,
    ) / 10
  )
}

export function aggregateWeekdayHours(timesheets: AnalyticsTimesheet[]): WeekdayHours[] {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const byDay: Record<string, number> = {}

  timesheets.forEach((t) => {
    const raw = t.loginTime || t.date
    if (!raw) return
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return
    const key = weekdays[((d.getDay() + 6) % 7)] // Mon-first index
    byDay[key] = (byDay[key] || 0) + hoursFromTimesheet(t)
  })

  return weekdays.map((name) => ({
    name,
    hours: Math.round((byDay[name] || 0) * 10) / 10,
  }))
}

function weeksInMonth(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate()
  return Math.max(1, Math.ceil(daysInMonth / 7))
}

function normalizePercentages(slices: CourseSlice[]): CourseSlice[] {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) {
    return slices.map((s) => ({ ...s, value: 0 }))
  }
  const rounded = slices.map((s) => ({ ...s, value: Math.round((s.value / total) * 100) }))
  const drift = 100 - rounded.reduce((sum, s) => sum + s.value, 0)
  if (drift !== 0) {
    const maxIdx = rounded.reduce((best, s, i, arr) => (s.value > arr[best].value ? i : best), 0)
    rounded[maxIdx] = { ...rounded[maxIdx], value: rounded[maxIdx].value + drift }
  }
  return rounded
}

export function buildCourseBreakdown(
  employees: Employee[],
  enrollments: CourseEnrollment[],
  selectedEmployeeId: string | 'all',
): CourseSlice[] {
  const labels = ['Done', 'In progress', 'Not started'] as const

  if (selectedEmployeeId !== 'all') {
    const emp = employees.find((e) => e.id === selectedEmployeeId)
    const empEnrollments = enrollments.filter(
      (e) => e.employeeId === selectedEmployeeId || (emp && e.employeeId === emp.employeeId),
    )

    if (empEnrollments.length === 0) {
      return [
        { name: labels[0], value: 0 },
        { name: labels[1], value: 0 },
        { name: labels[2], value: 100 },
      ]
    }

    const done = empEnrollments.filter((e) => e.status === 'Completed').length
    const inProgress = empEnrollments.filter((e) => e.status === 'Enrolled').length
    return normalizePercentages([
      { name: labels[0], value: done },
      { name: labels[1], value: inProgress },
      { name: labels[2], value: 0 },
    ])
  }

  const activeEmployees = employees.filter((e) => e.status === 'Active')
  let done = 0
  let inProgress = 0
  let notStarted = 0

  activeEmployees.forEach((emp) => {
    const empEnrollments = enrollments.filter(
      (e) => e.employeeId === emp.employeeId || e.employeeId === emp.id,
    )
    if (empEnrollments.length === 0) {
      notStarted++
      return
    }
    if (empEnrollments.some((e) => e.status === 'Enrolled')) {
      inProgress++
      return
    }
    if (empEnrollments.some((e) => e.status === 'Completed')) {
      done++
      return
    }
    notStarted++
  })

  if (activeEmployees.length === 0) {
    return [
      { name: labels[0], value: 0 },
      { name: labels[1], value: 0 },
      { name: labels[2], value: 100 },
    ]
  }

  return normalizePercentages([
    { name: labels[0], value: done },
    { name: labels[1], value: inProgress },
    { name: labels[2], value: notStarted },
  ])
}

function resolveEmployee(employees: Employee[], employeeId: string) {
  return employees.find((e) => e.id === employeeId || e.employeeId === employeeId)
}

function enrollmentMatchesEmployee(enrollment: CourseEnrollment, employee: Employee) {
  return (
    enrollment.employeeId === employee.id || enrollment.employeeId === employee.employeeId
  )
}

function mapEnrollmentToDetail(
  enrollment: CourseEnrollment,
  employees: Employee[],
): CourseEnrollmentDetail {
  const emp = resolveEmployee(employees, enrollment.employeeId)
  return {
    employeeId: emp?.employeeId ?? enrollment.employeeId,
    employeeName: enrollment.employeeName || (emp ? employeeDisplayName(emp) : enrollment.employeeId),
    department: emp?.department ?? '—',
    status: enrollment.status === 'Completed' ? 'Completed' : 'In Progress',
    completedAt: enrollment.completedAt,
  }
}

function mapEmployeeNotStarted(employee: Employee): CourseEnrollmentDetail {
  return {
    employeeId: employee.employeeId,
    employeeName: employeeDisplayName(employee),
    department: employee.department ?? '—',
    status: 'Not Started',
  }
}

export function buildTrainingAnalytics(
  courses: Course[],
  enrollments: CourseEnrollment[],
  employees: Employee[],
  selectedEmployeeId: string | 'all',
): TrainingAnalytics {
  const activeEmployees = employees.filter((e) => e.status === 'Active')
  const selectedEmployee =
    selectedEmployeeId === 'all'
      ? null
      : activeEmployees.find(
          (e) => e.id === selectedEmployeeId || e.employeeId === selectedEmployeeId,
        ) ?? null

  const rows: CourseAnalyticsRow[] = courses.map((course) => {
    const courseEnrollments = enrollments.filter((e) => e.courseId === course.id)

    if (selectedEmployee) {
      const enrollment = courseEnrollments.find((e) =>
        enrollmentMatchesEmployee(e, selectedEmployee),
      )
      const completed = enrollment?.status === 'Completed' ? 1 : 0
      const inProgress = enrollment?.status === 'Enrolled' ? 1 : 0
      const notStarted = enrollment ? 0 : 1
      const assigned = 1

      return {
        courseId: course.id,
        courseName: course.title,
        assigned,
        completed,
        inProgress,
        notStarted,
        completionPercent: completed * 100,
        rank: 0,
        isLowCompletion: completed === 0 && assigned > 0,
        employees: {
          completed:
            enrollment?.status === 'Completed'
              ? [mapEnrollmentToDetail(enrollment, employees)]
              : [],
          inProgress:
            enrollment?.status === 'Enrolled'
              ? [mapEnrollmentToDetail(enrollment, employees)]
              : [],
          notStarted: !enrollment ? [mapEmployeeNotStarted(selectedEmployee)] : [],
        },
      }
    }

    const completedEnrollments = courseEnrollments.filter((e) => e.status === 'Completed')
    const inProgressEnrollments = courseEnrollments.filter((e) => e.status === 'Enrolled')
    const notStartedEmployees = activeEmployees.filter(
      (emp) => !courseEnrollments.some((e) => enrollmentMatchesEmployee(e, emp)),
    )

    const completed = completedEnrollments.length
    const inProgress = inProgressEnrollments.length
    const notStarted = notStartedEmployees.length
    const assigned = completed + inProgress + notStarted
    const completionPercent =
      assigned > 0 ? Math.min(100, Math.round((completed / assigned) * 100)) : 0

    return {
      courseId: course.id,
      courseName: course.title,
      assigned,
      completed,
      inProgress,
      notStarted,
      completionPercent,
      rank: 0,
      isLowCompletion: assigned > 0 && completionPercent < LOW_COMPLETION_THRESHOLD,
      employees: {
        completed: completedEnrollments.map((e) => mapEnrollmentToDetail(e, employees)),
        inProgress: inProgressEnrollments.map((e) => mapEnrollmentToDetail(e, employees)),
        notStarted: notStartedEmployees.map(mapEmployeeNotStarted),
      },
    }
  })

  const ranked = [...rows].sort((a, b) => {
    if (b.completionPercent !== a.completionPercent) {
      return b.completionPercent - a.completionPercent
    }
    return b.assigned - a.assigned
  })

  ranked.forEach((row, index) => {
    const target = rows.find((r) => r.courseId === row.courseId)
    if (target) target.rank = index + 1
  })

  const totalEnrollments = rows.reduce((sum, r) => sum + r.completed + r.inProgress, 0)
  const totalCompleted = rows.reduce((sum, r) => sum + r.completed, 0)
  const totalInProgress = rows.reduce((sum, r) => sum + r.inProgress, 0)
  const totalNotStarted = rows.reduce((sum, r) => sum + r.notStarted, 0)

  const withActivity = rows.filter((r) => r.assigned > 0)
  const topPerformingCourse =
    withActivity.length > 0
      ? {
          name: ranked[0].courseName,
          percent: ranked[0].completionPercent,
        }
      : null

  const overallSlice = normalizePercentages([
    { name: 'Completed', value: totalCompleted },
    { name: 'In progress', value: totalInProgress },
    { name: 'Not started', value: totalNotStarted },
  ])

  return {
    courses: rows.sort((a, b) => a.rank - b.rank),
    summary: {
      totalCourses: courses.length,
      totalEnrollments: totalEnrollments,
      totalCompleted,
      totalInProgress,
      totalNotStarted,
      topPerformingCourse,
      overallSlice,
    },
  }
}

export function buildMetrics(
  timesheets: AnalyticsTimesheet[],
  enrollments: CourseEnrollment[],
  preset: AnalyticsPeriodPreset,
  year: number,
  month: number,
): AnalyticsMetrics {
  const range = getAnalyticsDateRange(preset, year, month)
  const totalHours =
    Math.round(timesheets.reduce((sum, t) => sum + hoursFromTimesheet(t), 0) * 10) / 10

  const completedCourses = enrollments.filter((e) => {
    if (e.status !== 'Completed') return false
    const completedAt = e.completedAt || e.enrolledAt
    if (!completedAt) return false
    return isDateInRange(completedAt, range)
  }).length

  const avgHoursPerWeek =
    Math.round((totalHours / weeksInRange(preset, year, month)) * 10) / 10

  return { totalHours, completedCourses, avgHoursPerWeek }
}

export async function fetchActiveEmployees() {
  const { data } = await getEmployees({ status: 'Active', view: 'Public', pageSize: 500, page: 1 })
  return data.sort((a, b) => employeeDisplayName(a).localeCompare(employeeDisplayName(b)))
}

export type AttendanceSummary = {
  attendancePercentage: number
  totalWorkingDays: number
  presentDays: number
  leaveDays: number
  hoursLogged: number
  productivityScore: number
}

function countWorkingDaysInRange(range: AnalyticsDateRange): number {
  let count = 0
  const start = new Date(`${range.from}T00:00:00`)
  const end = new Date(`${range.to}T00:00:00`)
  const cursor = new Date(start)
  while (cursor <= end) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

function countPresentDays(timesheets: AnalyticsTimesheet[], range: AnalyticsDateRange): number {
  const dates = new Set<string>()
  timesheets.forEach((t) => {
    const raw = t.loginTime || t.date
    if (!raw) return
    if (!isDateInRange(raw, range)) return
    if (hoursFromTimesheet(t) <= 0) return
    const d = new Date(raw)
    if (d.getDay() === 0 || d.getDay() === 6) return
    dates.add(formatDateKey(d))
  })
  return dates.size
}

function countLeaveDaysInRange(
  leaves: LeaveRequest[],
  employee: Employee,
  range: AnalyticsDateRange,
): number {
  const reportFrom = new Date(`${range.from}T00:00:00`)
  const reportTo = new Date(`${range.to}T23:59:59`)
  let total = 0

  leaves.forEach((leave) => {
    if (leave.status !== 'Approved') return
    if (leave.employeeId !== employee.employeeId && leave.employeeId !== employee.id) return

    const leaveFrom = new Date(leave.from)
    const leaveTo = new Date(leave.to)
    if (Number.isNaN(leaveFrom.getTime()) || Number.isNaN(leaveTo.getTime())) return

    const overlapStart = new Date(Math.max(leaveFrom.getTime(), reportFrom.getTime()))
    const overlapEnd = new Date(Math.min(leaveTo.getTime(), reportTo.getTime()))
    if (overlapStart > overlapEnd) return

    const dayWeight = leave.leaveDuration === 'Half Day' ? 0.5 : 1
    const cursor = new Date(overlapStart)
    cursor.setHours(0, 0, 0, 0)
    const end = new Date(overlapEnd)
    end.setHours(0, 0, 0, 0)

    while (cursor <= end) {
      const dow = cursor.getDay()
      if (dow !== 0 && dow !== 6) total += dayWeight
      cursor.setDate(cursor.getDate() + 1)
    }
  })

  return Math.round(total * 10) / 10
}

export function buildAttendanceSummary(
  timesheets: AnalyticsTimesheet[],
  leaves: LeaveRequest[],
  employee: Employee,
  preset: AnalyticsPeriodPreset,
  year: number,
  month: number,
): AttendanceSummary {
  const range = getAnalyticsDateRange(preset, year, month)
  const totalWorkingDays = countWorkingDaysInRange(range)
  const presentDays = countPresentDays(timesheets, range)
  const leaveDays = countLeaveDaysInRange(leaves, employee, range)
  const hoursLogged =
    Math.round(timesheets.reduce((sum, t) => sum + hoursFromTimesheet(t), 0) * 10) / 10

  const attendancePercentage =
    totalWorkingDays > 0 ? Math.min(100, Math.round((presentDays / totalWorkingDays) * 100)) : 0

  const productivityScore =
    presentDays > 0
      ? Math.min(100, Math.round((hoursLogged / (presentDays * 8)) * 100))
      : 0

  return {
    attendancePercentage,
    totalWorkingDays,
    presentDays,
    leaveDays,
    hoursLogged,
    productivityScore,
  }
}

type TrendBucket = { label: string; from: Date; to: Date }

function getTrendBuckets(preset: AnalyticsPeriodPreset, year: number, month: number): TrendBucket[] {
  const range = getAnalyticsDateRange(preset, year, month)
  const start = new Date(`${range.from}T00:00:00`)
  const end = new Date(`${range.to}T00:00:00`)

  if (preset === 'month') {
    const buckets: TrendBucket[] = []
    let cursor = new Date(start)
    let weekNum = 1
    while (cursor <= end) {
      const bucketEnd = new Date(cursor)
      bucketEnd.setDate(bucketEnd.getDate() + 6)
      if (bucketEnd > end) bucketEnd.setTime(end.getTime())
      buckets.push({ label: `Week ${weekNum}`, from: new Date(cursor), to: new Date(bucketEnd) })
      cursor = new Date(bucketEnd)
      cursor.setDate(cursor.getDate() + 1)
      weekNum++
    }
    return buckets
  }

  const buckets: TrendBucket[] = []
  const cursor = new Date(start)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  while (cursor <= end) {
    const label =
      preset === 'last_two_weeks'
        ? cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : dayNames[cursor.getDay()]
    buckets.push({ label, from: new Date(cursor), to: new Date(cursor) })
    cursor.setDate(cursor.getDate() + 1)
  }
  return buckets
}

function isDateInBucket(d: Date, from: Date, to: Date) {
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(23, 59, 59, 999)
  return day >= start && day <= end
}

function countWorkingDaysBetween(from: Date, to: Date): number {
  let count = 0
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

function filterTimesheetsForEmployee(timesheets: AnalyticsTimesheet[], employee: Employee) {
  const name = employeeDisplayName(employee)
  return timesheets.filter(
    (t) =>
      t.employeeId === employee.employeeId ||
      t.employeeId === employee.id ||
      t.employeeName === name,
  )
}

export function buildHoursTrend(
  timesheets: AnalyticsTimesheet[],
  preset: AnalyticsPeriodPreset,
  year: number,
  month: number,
): TrendPoint[] {
  const buckets = getTrendBuckets(preset, year, month)
  return buckets.map((bucket) => {
    let hours = 0
    timesheets.forEach((t) => {
      const raw = t.loginTime || t.date
      if (!raw) return
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) return
      if (isDateInBucket(d, bucket.from, bucket.to)) {
        hours += hoursFromTimesheet(t)
      }
    })
    return { label: bucket.label, hours: Math.round(hours * 10) / 10 }
  })
}

export function buildAttendanceTrend(
  timesheets: AnalyticsTimesheet[],
  preset: AnalyticsPeriodPreset,
  year: number,
  month: number,
): AttendanceTrendPoint[] {
  const buckets = getTrendBuckets(preset, year, month)
  return buckets.map((bucket) => {
    const workingDays = countWorkingDaysBetween(bucket.from, bucket.to)
    const presentDates = new Set<string>()
    timesheets.forEach((t) => {
      const raw = t.loginTime || t.date
      if (!raw) return
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) return
      if (!isDateInBucket(d, bucket.from, bucket.to)) return
      if (hoursFromTimesheet(t) <= 0) return
      if (d.getDay() === 0 || d.getDay() === 6) return
      presentDates.add(formatDateKey(d))
    })
    const attendance =
      workingDays > 0 ? Math.min(100, Math.round((presentDates.size / workingDays) * 100)) : 0
    return { label: bucket.label, attendance }
  })
}

export function buildEmployeeComparison(
  employees: Employee[],
  timesheets: AnalyticsTimesheet[],
  leaves: LeaveRequest[],
  preset: AnalyticsPeriodPreset,
  year: number,
  month: number,
): EmployeePerformanceRow[] {
  const range = getAnalyticsDateRange(preset, year, month)
  const totalWorkingDays = countWorkingDaysInRange(range)
  const activeEmployees = employees.filter((e) => e.status === 'Active')

  const rows = activeEmployees.map((emp) => {
    const empTimesheets = filterTimesheetsForEmployee(timesheets, emp)
    const totalHours =
      Math.round(empTimesheets.reduce((sum, t) => sum + hoursFromTimesheet(t), 0) * 10) / 10
    const presentDays = countPresentDays(empTimesheets, range)
    const leaveDays = countLeaveDaysInRange(leaves, emp, range)
    const attendancePercent =
      totalWorkingDays > 0 ? Math.min(100, Math.round((presentDays / totalWorkingDays) * 100)) : 0

    return {
      id: emp.id,
      name: employeeDisplayName(emp),
      employeeId: emp.employeeId,
      totalHours,
      totalWorkingDays,
      attendancePercent,
      leaveDays,
      tier: 'below' as PerformanceTier,
    }
  })

  rows.sort((a, b) => b.totalHours - a.totalHours)

  const avgHours =
    rows.length > 0 ? rows.reduce((sum, row) => sum + row.totalHours, 0) / rows.length : 0

  return rows.map((row, index) => ({
    ...row,
    tier:
      index === 0 && row.totalHours > 0
        ? 'top'
        : row.totalHours >= avgHours
          ? 'above'
          : 'below',
  }))
}

export function buildComparisonSummary(rows: EmployeePerformanceRow[]): ComparisonSummary {
  if (rows.length === 0) {
    return {
      totalEmployees: 0,
      totalHours: 0,
      avgHoursPerEmployee: 0,
      highestPerformer: null,
      lowestPerformer: null,
    }
  }

  const totalHours = Math.round(rows.reduce((sum, row) => sum + row.totalHours, 0) * 10) / 10
  const withHours = rows.filter((row) => row.totalHours > 0)
  const highest = withHours[0] ?? rows[0]
  const lowest = withHours.length > 0 ? withHours[withHours.length - 1] : rows[rows.length - 1]

  return {
    totalEmployees: rows.length,
    totalHours,
    avgHoursPerEmployee: Math.round((totalHours / rows.length) * 10) / 10,
    highestPerformer: highest ? { name: highest.name, hours: highest.totalHours } : null,
    lowestPerformer: lowest ? { name: lowest.name, hours: lowest.totalHours } : null,
  }
}

export function buildIndividualPerformance(
  timesheets: AnalyticsTimesheet[],
  leaves: LeaveRequest[],
  employee: Employee,
  preset: AnalyticsPeriodPreset,
  year: number,
  month: number,
): IndividualPerformance {
  const empTimesheets = filterTimesheetsForEmployee(timesheets, employee)
  return {
    hoursTrend: buildHoursTrend(empTimesheets, preset, year, month),
    attendanceTrend: buildAttendanceTrend(empTimesheets, preset, year, month),
    attendance: buildAttendanceSummary(empTimesheets, leaves, employee, preset, year, month),
  }
}

export async function fetchEmployeeAnalyticsReport({
  employeeId,
  preset,
  year,
  month,
  employees,
}: {
  employeeId: string
  preset: AnalyticsPeriodPreset
  year: number
  month: number
  employees: Employee[]
}) {
  let employee = employees.find((e) => e.id === employeeId || e.employeeId === employeeId)
  if (!employee) {
    employee = await getEmployee(employeeId)
  }
  if (!employee) {
    throw new Error('Employee not found')
  }

  const [analytics, leaves] = await Promise.all([
    fetchAnalyticsData({
      preset,
      year,
      month,
      selectedEmployeeId: employeeId,
      employees,
    }),
    getLeaves(),
  ])

  const attendance = buildAttendanceSummary(
    analytics.timesheets,
    leaves,
    employee,
    preset,
    year,
    month,
  )

  return {
    employee,
    preset,
    year,
    month,
    periodLabel: getPeriodLabel(preset, year, month),
    weekly: analytics.weekly,
    courses: analytics.courses,
    metrics: analytics.metrics,
    attendance,
  }
}

export async function fetchAnalyticsData({
  preset,
  year,
  month,
  selectedEmployeeId,
  employees,
}: {
  preset: AnalyticsPeriodPreset
  year: number
  month: number
  selectedEmployeeId: string | 'all'
  employees: Employee[]
}) {
  const { from, to } = getAnalyticsDateRange(preset, year, month)
  const selectedEmployee =
    selectedEmployeeId === 'all'
      ? null
      : employees.find((e) => e.id === selectedEmployeeId) ?? null

  const employeeName = selectedEmployee ? employeeDisplayName(selectedEmployee) : undefined
  const enrollmentFilter =
    selectedEmployeeId === 'all'
      ? undefined
      : selectedEmployee?.employeeId ?? selectedEmployeeId

  const [timesheetsRes, enrollments, leaves, courseCatalog] = await Promise.all([
    api.get<AnalyticsTimesheet[]>('/timesheets', {
      params: {
        from,
        to,
        ...(employeeName ? { employee: employeeName } : {}),
      },
    }),
    listEnrollments(enrollmentFilter ? { employee: enrollmentFilter } : {}),
    getLeaves(),
    listCourses(),
  ])

  let timesheets = timesheetsRes.data || []

  if (selectedEmployee) {
    timesheets = timesheets.filter(
      (t) =>
        t.employeeId === selectedEmployee.employeeId ||
        t.employeeId === selectedEmployee.id ||
        t.employeeName === employeeName,
    )
  }

  const weekly = aggregateWeekdayHours(timesheets)
  const courses = buildCourseBreakdown(employees, enrollments, selectedEmployeeId)
  const trainingAnalytics = buildTrainingAnalytics(
    courseCatalog,
    enrollments,
    employees,
    selectedEmployeeId,
  )
  const metrics = buildMetrics(timesheets, enrollments, preset, year, month)

  const comparison =
    selectedEmployeeId === 'all'
      ? buildEmployeeComparison(employees, timesheetsRes.data || [], leaves, preset, year, month)
      : []

  const comparisonSummary = buildComparisonSummary(comparison)

  const individualPerformance =
    selectedEmployee != null
      ? buildIndividualPerformance(
          timesheets,
          leaves,
          selectedEmployee,
          preset,
          year,
          month,
        )
      : null

  return {
    weekly,
    courses,
    trainingAnalytics,
    metrics,
    timesheets,
    enrollments,
    comparison,
    comparisonSummary,
    individualPerformance,
  }
}
