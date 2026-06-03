import { useState } from 'react'
import { toast } from 'sonner'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { SearchableEmployeeSelect } from '@components/analytics/SearchableEmployeeSelect'
import { AnalyticsPeriodFilter } from '@components/analytics/AnalyticsPeriodFilter'
import { CourseTrainingAnalyticsCard } from '@components/analytics/CourseTrainingAnalyticsPanel'
import {
  EmployeeComparisonChart,
  EmployeeComparisonTable,
} from '@components/analytics/EmployeeComparisonChart'
import { IndividualPerformancePanel } from '@components/analytics/IndividualPerformancePanel'
import { useAnalyticsData } from '@/hooks/useAnalyticsData'
import { fetchEmployeeAnalyticsReport, getPeriodLabel, type AnalyticsPeriodPreset } from '@/services/analyticsService'
import { exportEmployeeAnalyticsReport } from '@/utils/exportEmployeeAnalyticsReport'
import { useAuthStore } from '@store/authStore'
import { FileText, Loader2, RotateCcw, Users } from 'lucide-react'

const now = new Date()
const DEFAULT_YEAR = now.getFullYear()
const DEFAULT_MONTH = now.getMonth() + 1

function ChartPlaceholder({ message = '', loading }: { message?: string; loading?: boolean }) {
  return (
    <div className="admin-analytics-chart-placeholder">
      {loading ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-[#2f6b4f]" />
          <p className="text-sm font-medium text-slate-500">Loading analytics…</p>
        </>
      ) : (
        <p className="text-sm font-medium text-slate-500">{message}</p>
      )}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="admin-analytics-summary-stat">
      <p className="admin-analytics-summary-stat-label">{label}</p>
      <p className="admin-analytics-summary-stat-value font-display">{value}</p>
      {sub && <p className="admin-analytics-summary-stat-sub">{sub}</p>}
    </div>
  )
}

export function Analytics() {
  const user = useAuthStore((s) => s.user)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | 'all'>('all')
  const [periodPreset, setPeriodPreset] = useState<AnalyticsPeriodPreset>('month')
  const [year, setYear] = useState(DEFAULT_YEAR)
  const [month, setMonth] = useState(DEFAULT_MONTH)
  const [exporting, setExporting] = useState(false)

  const isAllEmployees = selectedEmployeeId === 'all'

  const filtersActive =
    selectedEmployeeId !== 'all' ||
    periodPreset !== 'month' ||
    year !== DEFAULT_YEAR ||
    month !== DEFAULT_MONTH

  function clearFilters() {
    setSelectedEmployeeId('all')
    setPeriodPreset('month')
    setYear(DEFAULT_YEAR)
    setMonth(DEFAULT_MONTH)
  }

  const {
    employees,
    employeesLoading,
    dataLoading,
    error,
    trainingAnalytics,
    comparison,
    comparisonSummary,
    individualPerformance,
    hasData,
  } = useAnalyticsData(selectedEmployeeId, periodPreset, year, month)

  const periodLabel = getPeriodLabel(periodPreset, year, month)
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

  const heroKpis = isAllEmployees
    ? [
        { label: 'Total Employees', value: String(comparisonSummary.totalEmployees) },
        { label: 'Total Hours', value: `${comparisonSummary.totalHours} hrs` },
        { label: 'Avg / Employee', value: `${comparisonSummary.avgHoursPerEmployee} hrs` },
      ]
    : [
        { label: 'Hours Logged', value: `${individualPerformance?.attendance.hoursLogged ?? 0} hrs` },
        { label: 'Attendance', value: `${individualPerformance?.attendance.attendancePercentage ?? 0}%` },
        { label: 'Productivity', value: `${individualPerformance?.attendance.productivityScore ?? 0}%` },
      ]

  async function handleExportPdf() {
    if (selectedEmployeeId === 'all') {
      toast.error('Select an employee to export their analytics report.')
      return
    }
    if (employeesLoading || dataLoading) {
      toast.error('Please wait for analytics data to finish loading.')
      return
    }

    setExporting(true)
    try {
      const report = await fetchEmployeeAnalyticsReport({
        employeeId: selectedEmployeeId,
        preset: periodPreset,
        year,
        month,
        employees,
      })
      await exportEmployeeAnalyticsReport({
        ...report,
        generatedBy: user?.name || 'Admin',
      })
      toast.success('Employee analytics report exported.')
    } catch (err) {
      console.error('[Analytics] PDF export failed:', err)
      toast.error('Failed to export analytics report.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <PageWrapper className="admin-hub-page-wrap relative z-10 py-3 font-body">
      <div className="crewiq-dashboard admin-analytics-view relative">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>
        <div className="admin-analytics-shell relative z-10 animate-fadeIn">
          <header className="admin-analytics-hub-header">
            <div className="admin-analytics-hero-top">
              <h1 className="admin-analytics-hero-title font-display">Workforce Analytics Hub</h1>
              <Button
                variant="secondary"
                className="admin-analytics-export-btn h-7 gap-1 rounded-md px-2.5 text-[11px] font-bold"
                loading={exporting}
                disabled={exporting || employeesLoading}
                onClick={() => void handleExportPdf()}
              >
                <FileText className="h-3 w-3" />
                Export PDF
              </Button>
            </div>
            <div className="admin-analytics-metrics-band" role="group" aria-label="Analytics metrics">
              {heroKpis.map((m) => (
                <div key={m.label} className="admin-analytics-metric-tile">
                  <p className="admin-analytics-metric-label">{m.label}</p>
                  <p className="admin-analytics-metric-value font-display">
                    {dataLoading ? '—' : m.value}
                  </p>
                </div>
              ))}
            </div>
          </header>

          <div className="admin-analytics-filters-bar">
            <SearchableEmployeeSelect
              employees={employees}
              value={selectedEmployeeId}
              onChange={setSelectedEmployeeId}
              loading={employeesLoading}
            />
            <AnalyticsPeriodFilter
              preset={periodPreset}
              year={year}
              month={month}
              onPresetChange={setPeriodPreset}
              onMonthChange={(y, m) => {
                setYear(y)
                setMonth(m)
              }}
            />
            <div className="admin-analytics-clear-wrap">
              <button
                type="button"
                className="admin-analytics-clear-btn"
                onClick={clearFilters}
                disabled={!filtersActive || dataLoading}
                aria-label="Clear all filters"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear filters
              </button>
            </div>
          </div>

          {error && (
            <div className="admin-analytics-error" role="alert">
              {error}
            </div>
          )}

          <div className="admin-analytics-main-panel">
            <div className="admin-analytics-panel-header">
              <div>
                <h2 className="admin-analytics-panel-title font-display text-sm font-bold">
                  {isAllEmployees ? 'Team Performance Comparison' : 'Individual Performance'}
                </h2>
                <p className="text-xs font-medium text-slate-600">
                  {periodLabel}
                  {!isAllEmployees && selectedEmployee && (
                    <>
                      {' · '}
                      {selectedEmployee.employeeId}
                    </>
                  )}
                </p>
              </div>
            </div>

            {isAllEmployees ? (
              <>
                <div className="admin-analytics-summary-row">
                  <SummaryStat
                    label="Total Employees"
                    value={dataLoading ? '—' : String(comparisonSummary.totalEmployees)}
                  />
                  <SummaryStat
                    label="Total Hours Logged"
                    value={dataLoading ? '—' : `${comparisonSummary.totalHours} hrs`}
                  />
                  <SummaryStat
                    label="Average Hours / Employee"
                    value={dataLoading ? '—' : `${comparisonSummary.avgHoursPerEmployee} hrs`}
                  />
                </div>

                <div className="admin-analytics-charts-split">
                  <div className="admin-analytics-chart-card admin-analytics-chart-card--performance">
                    <div className="admin-analytics-chart-head">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-white/90" />
                        <div className="min-w-0">
                          <h3 className="admin-analytics-chart-title font-display">
                            Team Performance Analysis
                          </h3>
                          <p className="admin-analytics-chart-subtitle">
                            Hours logged by employee — sorted highest to lowest
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="admin-analytics-chart-body admin-analytics-chart-body--comparison">
                      {dataLoading ? (
                        <ChartPlaceholder loading />
                      ) : comparison.length === 0 ? (
                        <ChartPlaceholder message="No active employees found" />
                      ) : !hasData && comparison.every((r) => r.totalHours === 0) ? (
                        <ChartPlaceholder message="No timesheet data for this period" />
                      ) : (
                        <>
                          <div className="admin-analytics-comparison-chart-scroll">
                            <EmployeeComparisonChart data={comparison} />
                          </div>
                          <EmployeeComparisonTable data={comparison} />
                        </>
                      )}
                    </div>
                  </div>

                  <CourseTrainingAnalyticsCard
                    data={trainingAnalytics}
                    loading={dataLoading}
                    emptyMessage={
                      employees.length === 0 && !employeesLoading
                        ? 'No active employees found'
                        : undefined
                    }
                    subtitle="Course-wise enrollment & completion across employees"
                  />
                </div>
              </>
            ) : (
              <div className="admin-analytics-charts-split">
                <div className="admin-analytics-chart-card admin-analytics-chart-card--performance">
                  <div className="admin-analytics-chart-head">
                    <h3 className="admin-analytics-chart-title font-display">Performance Dashboard</h3>
                    <p className="admin-analytics-chart-subtitle">
                      Hours, attendance, leave usage & productivity
                    </p>
                  </div>
                  <div className="admin-analytics-chart-body admin-analytics-chart-body--individual">
                    {dataLoading ? (
                      <ChartPlaceholder loading />
                    ) : !individualPerformance ? (
                      <ChartPlaceholder message="Select an employee to view performance" />
                    ) : (
                      <IndividualPerformancePanel performance={individualPerformance} />
                    )}
                  </div>
                </div>

                <CourseTrainingAnalyticsCard
                  data={trainingAnalytics}
                  loading={dataLoading}
                  subtitle="Course progress for selected employee"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
