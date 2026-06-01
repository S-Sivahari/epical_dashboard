import { useState } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { HoursBarChart } from '@components/charts/BarChart'
import { DepartmentPieChart } from '@components/charts/PieChart'
import { exportAnalyticsPdf } from '@/utils/exportPDF'
import { BarChart3, BookOpen, Clock, FileText, Sparkles, TrendingUp } from 'lucide-react'

const PIE_GREEN = ['#266b1c', '#2f7d24', '#3a912d']

export function Analytics() {
  const [month, setMonth] = useState('5')
  const [year, setYear] = useState('2026')

  const weekly = [
    { name: 'Mon', hours: 7 },
    { name: 'Tue', hours: 8 },
    { name: 'Wed', hours: 6 },
    { name: 'Thu', hours: 7 },
    { name: 'Fri', hours: 5 },
  ]

  const courses = [
    { name: 'Done', value: 68 },
    { name: 'In progress', value: 22 },
    { name: 'Not started', value: 10 },
  ]

  const metrics = [
    { label: 'Total Hours', value: 182, icon: Clock },
    { label: 'Completed Courses', value: 24, icon: BookOpen },
    { label: 'Avg Hours / Week', value: 36, icon: BarChart3 },
  ]

  return (
    <PageWrapper className="relative z-10 py-3 font-body">
      <div className="crewiq-dashboard admin-analytics-view">
        <div className="admin-analytics-shell animate-fadeIn">
          {/* Hero — title, export, KPI metrics */}
          <div className="admin-analytics-hero">
            <div className="admin-analytics-hero-top">
              <div className="min-w-0">
                <h1 className="admin-analytics-hero-title font-display">Workforce Analytics</h1>
                <p className="admin-analytics-hero-sub">
                  Track hours, training progress, and team performance
                </p>
              </div>
              <Button
                variant="secondary"
                className="admin-analytics-export-btn h-8 gap-1.5 rounded-md px-3 text-[11px] font-bold"
                onClick={() => void exportAnalyticsPdf(`analytics-${year}-${month}.pdf`)}
              >
                <FileText className="h-3.5 w-3.5" />
                Export PDF
              </Button>
            </div>
            <div className="admin-analytics-metrics-band">
              {metrics.map((m) => (
                <div key={m.label} className="admin-analytics-metric-glass">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="admin-analytics-metric-label">{m.label}</p>
                      <p className="admin-analytics-metric-value font-display">{m.value}</p>
                    </div>
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20">
                      <m.icon className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-analytics-body-grid">
            {/* Filters sidebar */}
            <aside className="admin-analytics-sidebar space-y-4">
              <p className="admin-analytics-sidebar-title">Filters</p>
              <p className="text-xs font-medium leading-relaxed text-[var(--emerald-dark)]/80">
                Narrow analytics by employee and reporting period.
              </p>
              <SelectField
                label="Employee"
                id="analytics-employee"
                options={[
                  { value: 'all', label: 'All employees' },
                  { value: 'E-1001', label: 'Asha Menon' },
                  { value: 'E-1002', label: 'Rahul Verma' },
                ]}
                defaultValue="all"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Month"
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
                <Input
                  label="Year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
              <div className="admin-analytics-tip-box rounded-lg p-3 text-xs font-medium leading-relaxed">
                <Sparkles className="mb-1.5 h-3.5 w-3.5 text-[var(--emerald-dark)]" />
                Reporting period: {month}/{year}. Export PDF to share with leadership.
              </div>
            </aside>

            {/* Charts main panel */}
            <div className="admin-analytics-main-panel space-y-4">
              <div className="admin-analytics-panel-header">
                <div>
                  <h2 className="font-display text-sm font-bold text-[var(--emerald-dark)]">
                    Performance Overview
                  </h2>
                  <p className="text-xs font-medium text-slate-600">
                    Weekly hours and course completion for the selected period
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--emerald-dark)]">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Live snapshot
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="admin-analytics-chart-card">
                  <div className="admin-analytics-chart-head">
                    <h3 className="font-display text-xs font-bold uppercase tracking-wide">
                      Weekly Performance
                    </h3>
                    <p className="text-[10px] font-medium opacity-80">Hours logged per weekday</p>
                  </div>
                  <div className="admin-analytics-chart-body min-h-[17rem]">
                    <HoursBarChart
                      data={weekly}
                      height={260}
                      animate={false}
                      colorScheme="dashboard"
                      fillParent
                    />
                  </div>
                </div>

                <div className="admin-analytics-chart-card">
                  <div className="admin-analytics-chart-head">
                    <h3 className="font-display text-xs font-bold uppercase tracking-wide">
                      Course Completion
                    </h3>
                    <p className="text-[10px] font-medium opacity-80">Training status breakdown</p>
                  </div>
                  <div className="admin-analytics-chart-body flex min-h-[17rem] flex-col">
                    <div className="flex flex-1 items-center justify-center">
                      <DepartmentPieChart data={courses} height={240} colors={PIE_GREEN} />
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-3 px-2 pb-1">
                      {courses.map((c, i) => (
                        <div key={c.name} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: PIE_GREEN[i % PIE_GREEN.length] }}
                          />
                          {c.name} ({c.value}%)
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
