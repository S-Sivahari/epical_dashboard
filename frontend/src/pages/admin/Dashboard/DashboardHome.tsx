import { useMemo, useState } from 'react'
import { BarChart3, ClipboardList, FileCheck2, Users } from 'lucide-react'
import { AdminNewsTicker } from '@components/admin/AdminNewsTicker'
import { ContributionHistoryPanel } from '@components/command-center/ContributionHistoryPanel'
import { DashboardKpiStrip } from '@components/command-center/DashboardKpiStrip'
import { DashboardQuickActionsSidebar } from '@components/command-center/DashboardQuickActionsSidebar'
import { ProjectHoursChartPanel } from '@components/command-center/ProjectHoursChartPanel'
import { ROUTES } from '@constants/routes'
import { useCommandCenterData } from '@hooks/useCommandCenterData'
import { useNotificationCounts } from '@hooks/useNotificationCounts'
import {
  aggregateProjectTableRows,
  type ChartPeriod,
} from './dashboardChartUtils'

export function DashboardHome() {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('This Week')
  const data = useCommandCenterData(chartPeriod)
  const { counts: notificationCounts } = useNotificationCounts()

  const projectTableRows = useMemo(
    () => aggregateProjectTableRows(data.timesheets, data.projects),
    [data.timesheets, data.projects],
  )

  const totalProjects = data.projects.length
  const pendingDocuments = data.pendingDocs.length
  const pendingLeavesNotification = Math.max(
    notificationCounts.leaves ?? 0,
    data.pendingLeavesCount,
  )
  const pendingDocumentsNotification = Math.max(
    notificationCounts.documents ?? 0,
    pendingDocuments,
  )

  const kpiItems = [
    {
      label: 'Total Employees',
      value: data.totalEmployees,
      subtext: 'Active employees',
      icon: Users,
      tone: 'slate' as const,
      route: ROUTES.EMPLOYEES,
    },
    {
      label: 'Pending Leaves',
      value: data.pendingLeavesCount,
      subtext: 'Requires approval',
      icon: ClipboardList,
      tone: 'amber' as const,
      route: ROUTES.LEAVES,
      notificationCount: pendingLeavesNotification,
    },
    {
      label: 'Active Projects',
      value: data.activeProjectsCount,
      subtext: `${totalProjects} total projects`,
      icon: BarChart3,
      tone: 'blue' as const,
      route: ROUTES.PROJECTS,
    },
    {
      label: 'Documents Pending',
      value: pendingDocuments,
      subtext: 'Requires review',
      icon: FileCheck2,
      tone: 'violet' as const,
      route: ROUTES.DOCUMENTS,
      notificationCount: pendingDocumentsNotification,
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
            <DashboardQuickActionsSidebar />
          </aside>

          <div className="dashboard-center-column min-h-0">
            <ProjectHoursChartPanel
              loading={data.loading}
              chartData={data.chartData}
              chartPeriod={chartPeriod}
              onPeriodChange={setChartPeriod}
              totalPeriodHours={data.totalPeriodHours}
              className="dashboard-center-chart"
            />
            <ContributionHistoryPanel
              loading={data.loading}
              rows={projectTableRows}
              className="dashboard-center-table"
            />
          </div>

          <aside className="dashboard-right-column min-h-0">
            <AdminNewsTicker
              variant="brand"
              scrollMode="static"
              className="dashboard-news-column min-h-0 flex-1"
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
