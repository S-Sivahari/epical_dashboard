import { useState } from 'react'
import { ChevronDown, ChevronUp, GraduationCap, Loader2, TrendingDown, Trophy } from 'lucide-react'
import { DepartmentPieChart } from '@components/charts/PieChart'
import type { CourseAnalyticsRow, TrainingAnalytics } from '@/services/analyticsService'
import { cn } from '@/utils/cn'

const COLORS = {
  completed: '#2f6b4f',
  inProgress: '#3a8a62',
  notStarted: '#D1FAE5',
} as const

const PIE_COLORS = [COLORS.completed, COLORS.inProgress, COLORS.notStarted]

function formatCompletedDate(value?: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TrainingKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-training-kpi">
      <p className="admin-training-kpi-label">{label}</p>
      <p className="admin-training-kpi-value">{value}</p>
    </div>
  )
}

function StackedProgressBar({ row }: { row: CourseAnalyticsRow }) {
  const total = row.assigned || 1
  const completedPct = (row.completed / total) * 100
  const inProgressPct = (row.inProgress / total) * 100
  const notStartedPct = (row.notStarted / total) * 100

  return (
    <div className="admin-training-stacked-bar" title={`${row.completionPercent}% complete`}>
      {row.completed > 0 && (
        <div
          className="admin-training-stacked-seg is-completed"
          style={{ width: `${completedPct}%` }}
        />
      )}
      {row.inProgress > 0 && (
        <div
          className="admin-training-stacked-seg is-progress"
          style={{ width: `${inProgressPct}%` }}
        />
      )}
      {row.notStarted > 0 && (
        <div
          className="admin-training-stacked-seg is-not-started"
          style={{ width: `${notStartedPct}%` }}
        />
      )}
    </div>
  )
}

function EmployeeGroup({
  title,
  employees,
  tone,
}: {
  title: string
  employees: CourseAnalyticsRow['employees']['completed']
  tone: 'completed' | 'progress' | 'not-started'
}) {
  if (employees.length === 0) return null

  return (
    <div className="admin-training-employee-group">
      <p className={cn('admin-training-employee-group-title', `is-${tone}`)}>{title}</p>
      <div className="admin-training-employee-list">
        {employees.map((emp) => (
          <div key={`${emp.employeeId}-${emp.status}`} className="admin-training-employee-row">
            <div className="min-w-0 flex-1">
              <p className="admin-training-employee-name">{emp.employeeName}</p>
              <p className="admin-training-employee-meta">
                {emp.employeeId} · {emp.department}
              </p>
            </div>
            <div className="text-right">
              <span className={cn('admin-training-status-pill', `is-${tone}`)}>{emp.status}</span>
              {emp.status === 'Completed' && (
                <p className="admin-training-completed-date">{formatCompletedDate(emp.completedAt)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CourseRow({
  row,
  expanded,
  onToggle,
}: {
  row: CourseAnalyticsRow
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className={cn('admin-training-course-row', expanded && 'is-expanded', row.isLowCompletion && 'is-low')}>
      <button type="button" className="admin-training-course-header" onClick={onToggle}>
        <div className="admin-training-course-main">
          <div className="admin-training-course-title-row">
            <span className="admin-training-course-rank">#{row.rank}</span>
            <h4 className="admin-training-course-name">{row.courseName}</h4>
            {row.isLowCompletion && (
              <span className="admin-training-low-badge">
                <TrendingDown className="h-3 w-3" />
                Low
              </span>
            )}
          </div>
          <StackedProgressBar row={row} />
          <div className="admin-training-course-stats">
            <span>Assigned: <strong>{row.assigned}</strong></span>
            <span>Done: <strong>{row.completed}</strong></span>
            <span>In progress: <strong>{row.inProgress}</strong></span>
            <span>Not started: <strong>{row.notStarted}</strong></span>
          </div>
        </div>
        <div className="admin-training-course-side">
          <span className="admin-training-course-percent">{row.completionPercent}%</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="admin-training-course-detail">
          <EmployeeGroup title="Employees Completed" employees={row.employees.completed} tone="completed" />
          <EmployeeGroup title="Employees In Progress" employees={row.employees.inProgress} tone="progress" />
          <EmployeeGroup title="Employees Yet to Start" employees={row.employees.notStarted} tone="not-started" />
          {row.assigned === 0 && (
            <p className="admin-training-empty-detail">No employees assigned to this course yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

export function CourseTrainingAnalyticsPanel({
  data,
  loading,
  emptyMessage,
}: {
  data: TrainingAnalytics | null
  loading?: boolean
  emptyMessage?: string
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="admin-analytics-chart-placeholder admin-training-placeholder">
        <Loader2 className="h-6 w-6 animate-spin text-[#2f6b4f]" />
        <p className="text-sm font-medium text-slate-500">Loading training analytics…</p>
      </div>
    )
  }

  if (emptyMessage || !data) {
    return (
      <div className="admin-analytics-chart-placeholder admin-training-placeholder">
        <p className="text-sm font-medium text-slate-500">{emptyMessage ?? 'No training data'}</p>
      </div>
    )
  }

  const { summary, courses } = data
  const lowCourses = courses.filter((c) => c.isLowCompletion && c.assigned > 0)

  return (
    <div className="admin-training-panel">
      <div className="admin-training-summary-row">
        <div className="admin-training-kpi-grid">
          <TrainingKpi label="Courses" value={summary.totalCourses} />
          <TrainingKpi label="Enrollments" value={summary.totalEnrollments} />
          <TrainingKpi label="Completed" value={summary.totalCompleted} />
          <TrainingKpi label="In Progress" value={summary.totalInProgress} />
          <TrainingKpi label="Not Started" value={summary.totalNotStarted} />
        </div>
      </div>

      {(summary.topPerformingCourse || lowCourses.length > 0) && (
        <div className="admin-training-insights">
          {summary.topPerformingCourse && (
            <div className="admin-training-insight is-top">
              <Trophy className="h-3.5 w-3.5 shrink-0" />
              <span>
                Top: <strong>{summary.topPerformingCourse.name}</strong> (
                {summary.topPerformingCourse.percent}%)
              </span>
            </div>
          )}
          {lowCourses.length > 0 && (
            <div className="admin-training-insight is-low">
              <TrendingDown className="h-3.5 w-3.5 shrink-0" />
              <span>
                {lowCourses.length} course{lowCourses.length > 1 ? 's' : ''} below 50% completion
              </span>
            </div>
          )}
        </div>
      )}

      <div className="admin-training-legend-key">
        <span><i className="is-completed" /> Completed</span>
        <span><i className="is-progress" /> In Progress</span>
        <span><i className="is-not-started" /> Not Started</span>
      </div>

      <div className="admin-training-course-list">
        {courses.length === 0 ? (
          <p className="admin-training-empty">No courses found. Add courses in Training management.</p>
        ) : (
          courses.map((row) => (
            <CourseRow
              key={row.courseId}
              row={row}
              expanded={expandedId === row.courseId}
              onToggle={() =>
                setExpandedId((current) => (current === row.courseId ? null : row.courseId))
              }
            />
          ))
        )}
      </div>

      <div className="admin-training-chart-footer">
        <p className="admin-training-chart-footer-label">Overall Completion</p>
        <div className="admin-training-donut-stage">
          <DepartmentPieChart
            data={summary.overallSlice}
            height={172}
            colors={PIE_COLORS}
            variant="analytics"
          />
        </div>
        <div className="admin-training-donut-legend">
          {summary.overallSlice.map((item, i) => (
            <div key={item.name} className="admin-training-donut-legend-item">
              <span
                className={cn(
                  'admin-training-donut-legend-dot',
                  i === 2 && 'is-light',
                )}
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="admin-training-donut-legend-label">{item.name}</span>
              <span className="admin-training-donut-legend-value">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CourseTrainingAnalyticsCard({
  data,
  loading,
  emptyMessage,
  subtitle = 'Course-wise enrollment & completion insights',
}: {
  data: TrainingAnalytics | null
  loading?: boolean
  emptyMessage?: string
  subtitle?: string
}) {
  return (
    <div className="admin-analytics-chart-card admin-analytics-chart-card--training">
      <div className="admin-analytics-chart-head">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 shrink-0 text-white/90" />
          <div className="min-w-0">
            <h3 className="admin-analytics-chart-title font-display">Training Analytics</h3>
            <p className="admin-analytics-chart-subtitle">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="admin-analytics-chart-body admin-analytics-chart-body--training">
        <CourseTrainingAnalyticsPanel data={data} loading={loading} emptyMessage={emptyMessage} />
      </div>
    </div>
  )
}
