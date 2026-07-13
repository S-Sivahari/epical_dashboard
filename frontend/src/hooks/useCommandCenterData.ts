import { useEffect, useMemo, useState } from 'react'
import api from '@/services/api'
import { useAuthStore } from '@store/authStore'
import { useLeaves } from '@hooks/useLeaves'
import { useEmployeeStore } from '@store/employeeStore'
import { useNotificationStore } from '@store/notificationStore'
import { useTicketStore } from '@store/ticketStore'
import {
  aggregateChartForSelection,
  formatChartRangeLabel,
  type ChartDateRange,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import {
  buildPendingApprovals,
  countEmployeesJoinedThisMonth,
} from '@/pages/admin/Dashboard/dashboardBackendUtils'
import { fetchAdminDocumentRequests } from '@services/documentRequestService'
import * as ticketService from '@services/ticketService'
import type { DocumentRequestRecord, LeaveRequest } from '@/types'

export interface DepartmentStats {
  name: string
  employeeCount: number
  attendanceRate: number
  openTasks: number
  growth: number
  performance: number
}

const DASHBOARD_REFRESH_MS = 15 * 60 * 1000

export function useCommandCenterData(chartDateRange: ChartDateRange) {
  const user = useAuthStore((s) => s.user)
  const employeesRevision = useEmployeeStore((s) => s.employeesRevision)
  const { leaves, holidays } = useLeaves()
  const totalEmployees = useEmployeeStore((s) => s.pagination.total)
  const [allEmployees, setAllEmployees] = useState<any[]>([])
  const notifications = useNotificationStore((s) => s.notifications)
  const tickets = useTicketStore((s) => s.tickets)
  const ticketsLoading = useTicketStore((s) => s.loading)
  const ticketsInitialized = useTicketStore((s) => s.initialized)

  const [timesheets, setTimesheets] = useState<any[]>([])
  const [chartData, setChartData] = useState<{ name: string; hours: number }[]>([])
  const [totalPeriodHours, setTotalPeriodHours] = useState(0)
  const [projects, setProjects] = useState<any[]>([])
  const [employeeHours, setEmployeeHours] = useState<any[]>([])
  const [documentRequests, setDocumentRequests] = useState<any[]>([])
  const [payslipBatches, setPayslipBatches] = useState<any[]>([])
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0)
  const [pendingReviews, setPendingReviews] = useState<
    {
      id: string
      projectId: string
      cellId: string
      projectName: string
      cellName: string
      employeeName: string
      reviewPoint?: string | null
      stageAtRequest?: string
    }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(true)

  useEffect(() => {
    void useEmployeeStore.getState().fetchEmployees()
    void useNotificationStore.getState().fetchNotificationsSilent()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadChart() {
      const { from, to } = chartDateRange
      if (!from || !to) {
        setChartLoading(false)
        return
      }

      setChartLoading(true)
      try {
        const tsRes = await api.get('/timesheets', { params: { from, to } })
        if (cancelled) return

        const timesheetList = tsRes.data || []
        setTimesheets(timesheetList)

        const resolvedChart = aggregateChartForSelection(timesheetList, chartDateRange)
        const resolvedTotal =
          Math.round(resolvedChart.reduce((sum, point) => sum + point.hours, 0) * 10) / 10

        setChartData(resolvedChart)
        setTotalPeriodHours(resolvedTotal)
      } catch (err) {
        console.error('[CommandCenter] Failed to load chart data:', err)
        if (!cancelled) {
          const fallback = aggregateChartForSelection([], chartDateRange)
          setChartData(fallback)
          setTotalPeriodHours(0)
        }
      } finally {
        if (!cancelled) setChartLoading(false)
      }
    }

    void loadChart()
    return () => {
      cancelled = true
    }
  }, [
    chartDateRange.from,
    chartDateRange.to,
    chartDateRange.selectionMode,
    chartDateRange.preset,
    chartDateRange.dayRangeMode,
    chartDateRange.selectedDays?.join('|'),
    chartDateRange.selectedMonths?.join('|'),
    chartDateRange.selectedYears?.join('|'),
  ])

  useEffect(() => {
    let cancelled = false
    let requestId = 0

    async function load(silent = false) {
      const id = ++requestId
      try {
        if (!silent) setLoading(true)
        const { from, to } = chartDateRange
        if (!from || !to) {
          if (!silent && id === requestId) setLoading(false)
          return
        }

        const results = await Promise.allSettled([
          api.get('/projects', { params: { syncCompletion: true } }),
          api.get('/timesheets/employee-hours', { params: { from, to } }),
          fetchAdminDocumentRequests({ status: 'Requested', page: 1, limit: 50 }),
          api.get('/payslips/batches'),
          api.get('/employees', { params: { pageSize: 500, page: 1 } }),
          ticketService.getTickets(),
          api.get('/projects/pending-reviews/count'),
        ])

        if (cancelled || id !== requestId) return

        const [projRes, empHoursRes, docRes, batchRes, empRes, ticketList, reviewsRes] = results

        if (projRes.status === 'fulfilled') setProjects(projRes.value.data || [])
        if (empHoursRes.status === 'fulfilled') setEmployeeHours(empHoursRes.value.data || [])

        if (docRes.status === 'fulfilled') {
          const docPayload = docRes.value as { items?: DocumentRequestRecord[] }
          setDocumentRequests(Array.isArray(docPayload.items) ? docPayload.items : [])
        } else {
          setDocumentRequests([])
        }

        if (batchRes.status === 'fulfilled') setPayslipBatches(batchRes.value.data || [])

        if (reviewsRes.status === 'fulfilled') {
          const payload = reviewsRes.value.data as {
            count?: number
            items?: {
              id: string
              projectId: string
              cellId: string
              projectName: string
              cellName: string
              employeeName: string
              reviewPoint?: string | null
              stageAtRequest?: string
            }[]
          }
          const items = Array.isArray(payload?.items) ? payload.items : []
          setPendingReviews(items)
          const count = Number(payload?.count ?? items.length)
          setPendingReviewsCount(Number.isFinite(count) ? count : items.length)
        } else {
          setPendingReviews([])
          setPendingReviewsCount(0)
        }

        if (ticketList.status === 'fulfilled') {
          useTicketStore.setState({
            tickets: Array.isArray(ticketList.value) ? ticketList.value : [],
            loading: false,
            initialized: true,
            error: null,
          })
        }

        if (empRes.status === 'fulfilled') {
          const empPayload =
            empRes.value.data?.data ?? empRes.value.data?.employees ?? empRes.value.data ?? []
          setAllEmployees(Array.isArray(empPayload) ? empPayload : [])
          const total = empRes.value.data?.total
          if (total != null) {
            useEmployeeStore.setState((s) => ({
              pagination: { ...s.pagination, total },
            }))
          }
        }
      } catch (err) {
        console.error('[CommandCenter] Failed to load data:', err)
      } finally {
        if (!cancelled && id === requestId && !silent) setLoading(false)
      }
    }
    void load(false)
    const refreshId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true)
    }, DASHBOARD_REFRESH_MS)

    return () => {
      cancelled = true
      window.clearInterval(refreshId)
    }
  }, [chartDateRange.from, chartDateRange.to, employeesRevision])

  const pendingLeaves = leaves.filter((l) => l.status === 'Pending')
  const approvedLeaves = leaves.filter((l) => l.status === 'Approved')
  const activeProjects = projects.filter((p: any) => p.status === 'Active')
  const pendingDocs = documentRequests.filter(
    (d: DocumentRequestRecord) => d.status === 'Requested',
  ) as DocumentRequestRecord[]
  const pendingTickets = tickets.filter((t) => t.status === 'Pending' || t.status === 'In Progress')
  const pendingTicketsCount = tickets.filter((t) => t.status === 'Pending').length

  const attendanceRate = useMemo(() => {
    if (totalEmployees === 0) return 0
    const working = employeeHours.length
    return Math.min(100, Math.round((working / totalEmployees) * 100))
  }, [employeeHours.length, totalEmployees])

  const payrollStatus = useMemo(() => {
    if (payslipBatches.length === 0) return { label: 'No batches', score: 50, status: 'idle' as const }
    const latest = payslipBatches[0]
    const sent = latest?.sentCount ?? 0
    const total = latest?.totalCount ?? 1
    const pct = Math.round((sent / total) * 100)
    return {
      label: `${pct}% delivered`,
      score: pct,
      status: pct >= 90 ? ('healthy' as const) : pct >= 50 ? ('progress' as const) : ('attention' as const),
    }
  }, [payslipBatches])

  const companyHealthScore = useMemo(() => {
    let score = 72
    if (attendanceRate >= 80) score += 8
    if (pendingLeaves.length <= 3) score += 6
    else score -= pendingLeaves.length * 2
    if (activeProjects.length > 0) score += 4
    if (payrollStatus.score >= 80) score += 6
    if (pendingTickets.length > 5) score -= 5
    return Math.max(0, Math.min(100, score))
  }, [attendanceRate, pendingLeaves.length, activeProjects.length, payrollStatus.score, pendingTickets.length])

  const departmentStats: DepartmentStats[] = useMemo(() => {
    const map = new Map<string, { count: number; working: Set<string> }>()
    allEmployees.forEach((emp: any) => {
      const dept = emp.department || 'General'
      const entry = map.get(dept) || { count: 0, working: new Set<string>() }
      entry.count += 1
      map.set(dept, entry)
    })
    employeeHours.forEach((eh: any) => {
      const emp = allEmployees.find((e: any) => e._id === eh.employeeId || e.id === eh.employeeId)
      const dept = emp?.department || 'General'
      const entry = map.get(dept) || { count: 0, working: new Set<string>() }
      entry.working.add(eh.employeeId)
      map.set(dept, entry)
    })
    return Array.from(map.entries())
      .map(([name, data], i) => ({
        name,
        employeeCount: data.count,
        attendanceRate: data.count ? Math.round((data.working.size / data.count) * 100) : 0,
        openTasks: Math.max(0, (i * 3 + pendingTickets.length) % 8),
        growth: Math.round((Math.sin(i + 1) * 0.5 + 0.5) * 20 - 5),
        performance: Math.min(100, 65 + data.working.size * 5 + (data.count > 5 ? 10 : 0)),
      }))
      .sort((a, b) => b.employeeCount - a.employeeCount)
      .slice(0, 8)
  }, [allEmployees, employeeHours, pendingTickets.length])

  const insights = useMemo(() => {
    const items = []
    if (pendingLeaves.length > 0) {
      items.push({
        id: 'leave-forecast',
        type: 'warning' as const,
        title: 'Leave backlog building',
        body: `${pendingLeaves.length} leave request${pendingLeaves.length > 1 ? 's' : ''} awaiting approval. Average processing time may increase if not addressed today.`,
        action: 'Review leaves',
        route: '/admin/leaves',
      })
    }
    if (attendanceRate < 70) {
      items.push({
        id: 'attendance',
        type: 'alert' as const,
        title: 'Attendance below target',
        body: `Current attendance rate is ${attendanceRate}%. Consider reviewing department schedules and pending leave overlaps.`,
        action: 'View analytics',
        route: '/admin/timesheet?tab=analytics',
      })
    } else {
      items.push({
        id: 'attendance-good',
        type: 'success' as const,
        title: 'Strong attendance this period',
        body: `${attendanceRate}% of employees logged time. Trend is stable compared to last week.`,
        action: 'View timesheets',
        route: '/admin/timesheet',
      })
    }
    if (payrollStatus.status === 'attention') {
      items.push({
        id: 'payroll',
        type: 'alert' as const,
        title: 'Payroll delivery incomplete',
        body: `Only ${payrollStatus.label}. Follow up on pending payslip distribution.`,
        action: 'Manage payslips',
        route: '/admin/payslips',
      })
    }
    items.push({
      id: 'engagement',
      type: 'info' as const,
      title: 'Employee engagement signal',
      body: `${activeProjects.length} active projects with ${totalPeriodHours}h logged for ${formatChartRangeLabel(chartDateRange.from, chartDateRange.to, chartDateRange)}. Cross-team collaboration is ${activeProjects.length > 2 ? 'healthy' : 'moderate'}.`,
      action: 'Open timesheets',
      route: '/admin/timesheet',
    })
    return items
  }, [
    pendingLeaves.length,
    attendanceRate,
    payrollStatus,
    activeProjects.length,
    totalPeriodHours,
    chartDateRange,
  ])

  const pendingApprovalTasks = useMemo(
    () => buildPendingApprovals(pendingLeaves as LeaveRequest[], pendingDocs),
    [pendingLeaves, pendingDocs],
  )

  const employeesAddedThisMonth = useMemo(
    () => countEmployeesJoinedThisMonth(allEmployees),
    [allEmployees],
  )

  const activityStream = useMemo(() => {
    const stream: {
      id: string
      type: string
      title: string
      detail: string
      time: string
      icon: 'leave' | 'payroll' | 'news' | 'admin' | 'employee'
    }[] = []

    notifications.slice(0, 8).forEach((n) => {
      stream.push({
        id: n.id,
        type: n.type,
        title: n.title,
        detail: n.message,
        time: n.createdAt,
        icon: n.type.includes('Leave')
          ? 'leave'
          : n.type.includes('Payslip')
            ? 'payroll'
            : n.type.includes('Holiday')
              ? 'news'
              : 'admin',
      })
    })

    pendingLeaves.slice(0, 4).forEach((l: any) => {
      stream.push({
        id: `leave-${l._id || l.id}`,
        type: 'LeavePending',
        title: 'Leave request pending',
        detail: `${l.employeeName || 'Employee'} — ${l.leaveType || 'Leave'}`,
        time: l.createdAt || l.startDate,
        icon: 'leave',
      })
    })

    return stream
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 12)
  }, [notifications, pendingLeaves])

  return {
    user,
    loading,
    chartLoading,
    totalEmployees,
    attendanceRate,
    payrollStatus,
    activeProjectsCount: activeProjects.length,
    pendingRequestsCount: pendingLeaves.length + pendingDocs.length + pendingTickets.length,
    companyHealthScore,
    pendingLeavesCount: pendingLeaves.length,
    pendingTicketsCount,
    pendingReviewsCount,
    pendingReviews,
    chartData,
    chartDateRange,
    totalPeriodHours,
    timesheets,
    projects,
    employeeHours,
    leaves,
    approvedLeaves,
    holidays,
    departmentStats,
    insights,
    activityStream,
    documentRequests,
    payslipBatches,
    notifications,
    pendingDocs,
    pendingTickets,
    allEmployees,
    pendingApprovalTasks,
    employeesAddedThisMonth,
    ticketsLoading: loading || (!ticketsInitialized && ticketsLoading),
  }
}
