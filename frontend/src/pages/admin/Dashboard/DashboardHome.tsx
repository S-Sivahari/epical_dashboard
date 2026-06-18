import { useMemo, useState } from 'react'
import { BarChart3, ClipboardList, FileCheck2, Users } from 'lucide-react'
import { DashboardActivityLogPanel } from './DashboardActivityLogPanel'
import { DashboardLeftInsights } from './DashboardLeftInsights'
import { DashboardPendingApprovalsPanel } from './DashboardPendingApprovalsPanel'
import { ContributionHistoryPanel } from '@components/command-center/ContributionHistoryPanel'
import { DashboardKpiStrip } from '@components/command-center/DashboardKpiStrip'
import { ProjectHoursChartPanel } from '@components/command-center/ProjectHoursChartPanel'
import { ROUTES } from '@constants/routes'
import { useCommandCenterData } from '@hooks/useCommandCenterData'
import {
  aggregateProjectTableRows,
  getChartRange,
  inferChartPeriod,
  type ChartPeriod,
} from './dashboardChartUtils'
import { formatEmployeesAddedThisMonth } from './dashboardBackendUtils'

export function DashboardHome() {
  const initialRange = getChartRange('This Week')
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod | 'Custom'>('This Week')
  const [chartStartDate, setChartStartDate] = useState(initialRange.from)
  const [chartEndDate, setChartEndDate] = useState(initialRange.to)

  const chartDateRange = useMemo(
    () => ({ from: chartStartDate, to: chartEndDate }),
    [chartStartDate, chartEndDate],
  )

  const data = useCommandCenterData(chartDateRange)
  const projectTableRows = useMemo(
    () => aggregateProjectTableRows(data.timesheets, data.projects),
    [data.timesheets, data.projects],
  )

  const pendingDocuments = data.pendingDocs.length

  const kpiItems = [
    {
      label: 'Active employees',
      value: data.totalEmployees,
      hint: data.loading
        ? '…'
        : formatEmployeesAddedThisMonth(data.employeesAddedThisMonth),
      icon: Users,
      tone: 'slate' as const,
      route: ROUTES.EMPLOYEES,
      layout: 'minimal' as const,
    },
    {
      label: 'Pending tickets',
      value: data.pendingTicketsCount,
      itemLoading: data.ticketsLoading,
      icon: ClipboardList,
      tone: 'amber' as const,
      route: ROUTES.TICKETS,
      layout: 'minimal' as const,
    },
    {
      label: 'Active projects',
      value: data.activeProjectsCount,
      icon: BarChart3,
      tone: 'blue' as const,
      route: ROUTES.PROJECT_ANALYSIS_PROJECTS,
      layout: 'minimal' as const,
    },
    {
      label: 'Documents pending',
      value: pendingDocuments,
      icon: FileCheck2,
      tone: 'violet' as const,
      route: ROUTES.DOCUMENTS,
      layout: 'minimal' as const,
    },
  ]

  return (
    <div className="crewiq-dashboard admin-dashboard-view relative" data-admin-dashboard>
      <div className="dashboard-page-bg" aria-hidden>
        <div className="dashboard-page-bg-gradient" />
        <div className="dashboard-page-bg-pattern" />
      </div>

      <div className="dashboard-shell relative z-10">
        <div className="dashboard-main-grid min-h-0 flex-1">
          <aside className="dashboard-left-column min-h-0">
            <DashboardKpiStrip items={kpiItems} loading={data.loading} variant="column" />
            <DashboardLeftInsights className="dashboard-left-insights-column min-h-0 flex-1" />
          </aside>

          <div className="dashboard-center-column min-h-0">
            <div className="dashboard-center-stack min-h-0 flex-1">
              <ProjectHoursChartPanel
                loading={data.loading}
                chartData={data.chartData}
                chartPeriod={chartPeriod}
                onPeriodChange={(period) => {
                  const range = getChartRange(period)
                  setChartPeriod(period)
                  setChartStartDate(range.from)
                  setChartEndDate(range.to)
                }}
                startDate={chartStartDate}
                endDate={chartEndDate}
                onDateRangeChange={(start, end) => {
                  setChartStartDate(start)
                  setChartEndDate(end)
                  setChartPeriod(inferChartPeriod(start, end))
                }}
                totalPeriodHours={data.totalPeriodHours}
                className="dashboard-center-chart dashboard-center-stack-section"
              />
              <ContributionHistoryPanel
                loading={data.loading}
                rows={projectTableRows}
                className="dashboard-center-table dashboard-center-stack-section"
              />
            </div>
          </div>

          <aside className="dashboard-right-column min-h-0">
            <div className="dashboard-right-stack min-h-0 flex-1">
              <DashboardPendingApprovalsPanel
                tasks={data.pendingApprovalTasks}
                className="dashboard-right-approvals min-h-0"
              />
              <DashboardActivityLogPanel className="dashboard-right-activity min-h-0" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
