import { useState } from 'react'
import { Briefcase, ClipboardList, Users } from 'lucide-react'
import { AdminNewsTicker } from '@components/admin/AdminNewsTicker'
import { CommandCenterWelcome } from '@components/command-center/CommandCenterWelcome'
import { ProjectHoursPanel } from '@components/command-center/ProjectHoursPanel'
import { CommandCenterMetricCard } from '@components/command-center/CommandCenterMetricCard'
import { SkeletonBlock } from '@components/command-center/shared'
import { useCommandCenterData } from '@hooks/useCommandCenterData'
import type { ChartPeriod } from './dashboardChartUtils'

export function DashboardHome() {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('This Week')
  const data = useCommandCenterData(chartPeriod)

  const employeesWorking = data.employeeHours.length

  const metricCards = data.loading ? (
    <>
      <SkeletonBlock className="min-h-[72px] flex-1" />
      <SkeletonBlock className="min-h-[72px] flex-1" />
      <SkeletonBlock className="min-h-[72px] flex-1" />
    </>
  ) : (
    <>
      <CommandCenterMetricCard
        className="flex-1"
        title="Employees Working"
        value={employeesWorking}
        icon={Users}
        iconColor="#14b8a6"
        trend="This Week"
        trendUp
      />
      <CommandCenterMetricCard
        className="flex-1"
        title="Pending Leaves"
        value={data.pendingLeavesCount}
        icon={ClipboardList}
        iconColor="#f97316"
        trend={data.pendingLeavesCount > 3 ? 'Needs review' : 'Healthy load'}
        trendUp={data.pendingLeavesCount <= 3}
      />
      <CommandCenterMetricCard
        className="flex-1"
        title="Active Projects"
        value={data.activeProjectsCount}
        icon={Briefcase}
        iconColor="#22c55e"
        trend="Live from projects"
        trendUp
      />
    </>
  )

  return (
    <div className="crewiq-dashboard admin-dashboard-view relative" data-admin-dashboard>
      <div className="crewiq-dash-bg" aria-hidden />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1600px] flex-col gap-2 overflow-hidden px-3 py-2 sm:px-4 sm:py-3">
        <CommandCenterWelcome />

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_180px] grid-rows-[1fr_auto] gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(200px,220px)_minmax(220px,240px)] lg:grid-rows-1 lg:gap-3">
          <ProjectHoursPanel
            loading={data.loading}
            chartData={data.chartData}
            chartPeriod={chartPeriod}
            onPeriodChange={setChartPeriod}
            totalPeriodHours={data.totalPeriodHours}
            className="min-h-0 h-full"
          />

          <div className="col-span-2 flex min-h-0 gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:flex-col lg:gap-2 lg:h-full">
            {metricCards}
          </div>

          <AdminNewsTicker
            variant="brand"
            className="row-start-1 col-start-2 h-full min-h-0 lg:col-start-3"
          />
        </div>
      </div>
    </div>
  )
}
