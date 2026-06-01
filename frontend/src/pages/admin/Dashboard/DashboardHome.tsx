import { useState } from 'react'
import { motion } from 'framer-motion'
import { AdminNewsTicker } from '@components/admin/AdminNewsTicker'
import { ExecutiveOverview } from '@components/command-center/ExecutiveOverview'
import { CompanyInsightsCenter } from '@components/command-center/CompanyInsightsCenter'
import { AnalyticsWall } from '@components/command-center/AnalyticsWall'
import { LiveOperationsHub } from '@components/command-center/LiveOperationsHub'
import { DepartmentPerformanceGrid } from '@components/command-center/DepartmentPerformanceGrid'
import { SmartCalendarHub } from '@components/command-center/SmartCalendarHub'
import { NotificationIntelligencePanel } from '@components/command-center/NotificationIntelligencePanel'
import { RecentDocumentsReports } from '@components/command-center/RecentDocumentsReports'
import { AIAssistantPanel } from '@components/command-center/AIAssistantPanel'
import { CommandPalette } from '@components/command-center/CommandPalette'
import { DashboardWidget } from '@components/command-center/DashboardWidget'
import { useCommandCenterData } from '@hooks/useCommandCenterData'
import { useDashboardStore } from '@store/dashboardStore'
import type { ChartPeriod } from './dashboardChartUtils'

export function DashboardHome() {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('This Week')
  const widgetOrder = useDashboardStore((s) => s.widgetOrder)
  const resetLayout = useDashboardStore((s) => s.resetLayout)

  const data = useCommandCenterData(chartPeriod)

  const widgets: Record<string, React.ReactNode> = {
    executive: (
      <ExecutiveOverview
        loading={data.loading}
        totalEmployees={data.totalEmployees}
        attendanceRate={data.attendanceRate}
        payrollStatus={data.payrollStatus}
        activeProjectsCount={data.activeProjectsCount}
        pendingRequestsCount={data.pendingRequestsCount}
        companyHealthScore={data.companyHealthScore}
      />
    ),
    insights: <CompanyInsightsCenter insights={data.insights} />,
    analytics: (
      <AnalyticsWall
        loading={data.loading}
        chartData={data.chartData}
        chartPeriod={chartPeriod}
        onPeriodChange={setChartPeriod}
        totalPeriodHours={data.totalPeriodHours}
        departmentStats={data.departmentStats}
        pendingLeavesCount={data.pendingLeavesCount}
      />
    ),
    operations: <LiveOperationsHub activities={data.activityStream} />,
    departments: (
      <DepartmentPerformanceGrid departments={data.departmentStats} loading={data.loading} />
    ),
    calendar: <SmartCalendarHub leaves={data.leaves} holidays={data.holidays} />,
    notifications: <NotificationIntelligencePanel notifications={data.notifications} />,
    documents: (
      <RecentDocumentsReports
        documentRequests={data.documentRequests}
        payslipBatches={data.payslipBatches}
        loading={data.loading}
      />
    ),
    'ai-assistant': null,
  }

  return (
    <div className="cmd-dashboard min-h-full">
      <CommandPalette />
      <AIAssistantPanel />

      <div className="cmd-dashboard-inner mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-5 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <AdminNewsTicker variant="brand" />
        </motion.div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-subtle)]">
            Drag section handles to customize layout ·{' '}
            <span className="text-[var(--text-blue-soft)]">Saved automatically</span>
          </p>
          <button
            type="button"
            onClick={resetLayout}
            className="cmd-reset-layout text-xs font-medium text-[var(--green-600)] hover:underline"
          >
            Reset layout
          </button>
        </div>

        <div className="cmd-dashboard-grid grid grid-cols-1 gap-6 xl:grid-cols-12">
          {widgetOrder.map((id) => {
            if (id === 'ai-assistant') return null
            const content = widgets[id]
            if (!content) return null

            const layoutClass =
              id === 'executive'
                ? 'xl:col-span-12'
                : id === 'insights' || id === 'analytics'
                  ? 'xl:col-span-12'
                  : id === 'operations' || id === 'calendar'
                    ? 'xl:col-span-6'
                    : id === 'departments'
                      ? 'xl:col-span-12'
                      : 'xl:col-span-6'

            return (
              <DashboardWidget
                key={id}
                id={id}
                fullWidth={id === 'executive' || id === 'departments' || id === 'analytics'}
                className={layoutClass}
              >
                {content}
              </DashboardWidget>
            )
          })}
        </div>
      </div>
    </div>
  )
}
