import { RefreshCw, FolderOpen, CheckCircle2, Archive, Folder, Layers, UserCheck, Activity } from 'lucide-react'
import { Spinner } from '@components/ui/Spinner'

interface ProjectsDashboardProps {
  metrics: any
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export function ProjectsDashboard({ metrics, loading, error, onRefresh }: ProjectsDashboardProps) {
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
        <span className="ml-3 text-sm font-semibold text-slate-600">Loading dashboard metrics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <p className="mb-4 text-sm font-semibold text-red-600">{error}</p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg bg-[var(--emerald-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--green-600)]"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  // Map backend response to dashboard metrics
  const dashboardMetrics = metrics ? {
    projects: {
      total: metrics.projectsSummary?.total || 0,
      active: metrics.projectsSummary?.active || 0,
      completed: metrics.projectsSummary?.completed || 0,
      archived: 0, // Not provided by backend yet
    },
    libraries: {
      total: metrics.workflowSummary?.totalLibraries || 0,
      active: metrics.workflowSummary?.totalLibraries || 0, // All non-archived are active
      completed: 0, // Not tracked separately yet
    },
    cells: {
      total: metrics.workflowSummary?.totalCells || 0,
      inProgress: metrics.workflowSummary?.cellsInProgress || 0,
      pendingReview: metrics.workflowSummary?.cellsPendingReview || 0,
      completed: metrics.workflowSummary?.cellsCompleted || 0,
    },
    workflow: {
      pendingReviews: metrics.pendingReviews || 0,
      reworkRequests: metrics.employeeSummary?.reworkTasks || 0,
      approved: 0, // Not tracked in current response
      rejected: 0, // Not tracked in current response
    },
    employees: {
      assigned: metrics.employeeSummary?.assignedEmployees || 0,
      active: metrics.employeeSummary?.activeEmployees || 0,
      withPendingTasks: 0, // Not tracked in current response
    },
  } : {
    projects: { total: 0, active: 0, completed: 0, archived: 0 },
    libraries: { total: 0, active: 0, completed: 0 },
    cells: { total: 0, inProgress: 0, pendingReview: 0, completed: 0 },
    workflow: { pendingReviews: 0, reworkRequests: 0, approved: 0, rejected: 0 },
    employees: { assigned: 0, active: 0, withPendingTasks: 0 },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Executive Overview</h2>
          <p className="mt-1 text-sm text-slate-600">High-level project management metrics</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Project Metrics */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">Project Metrics</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={FolderOpen}
            label="Total Projects"
            value={dashboardMetrics.projects.total}
            color="blue"
          />
          <MetricCard
            icon={Activity}
            label="Active Projects"
            value={dashboardMetrics.projects.active}
            color="green"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Completed Projects"
            value={dashboardMetrics.projects.completed}
            color="emerald"
          />
          <MetricCard
            icon={Archive}
            label="Archived Projects"
            value={dashboardMetrics.projects.archived}
            color="slate"
          />
        </div>
      </section>

      {/* Library Metrics */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">Library Metrics</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={Folder}
            label="Total Libraries"
            value={dashboardMetrics.libraries.total}
            color="purple"
          />
          <MetricCard
            icon={Activity}
            label="Active Libraries"
            value={dashboardMetrics.libraries.active}
            color="indigo"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Completed Libraries"
            value={dashboardMetrics.libraries.completed}
            color="emerald"
          />
        </div>
      </section>

      {/* Cell Metrics */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">Cell Metrics</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Layers}
            label="Total Cells"
            value={dashboardMetrics.cells.total}
            color="blue"
          />
          <MetricCard
            icon={Activity}
            label="Cells In Progress"
            value={dashboardMetrics.cells.inProgress}
            color="amber"
          />
          <MetricCard
            icon={UserCheck}
            label="Pending Review"
            value={dashboardMetrics.cells.pendingReview}
            color="orange"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Cells Completed"
            value={dashboardMetrics.cells.completed}
            color="emerald"
          />
        </div>
      </section>

      {/* Workflow Metrics */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">Workflow Metrics</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={UserCheck}
            label="Pending Reviews"
            value={dashboardMetrics.workflow.pendingReviews}
            color="yellow"
          />
          <MetricCard
            icon={RefreshCw}
            label="Rework Requests"
            value={dashboardMetrics.workflow.reworkRequests}
            color="orange"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Approved Reviews"
            value={dashboardMetrics.workflow.approved}
            color="green"
          />
          <MetricCard
            icon={Archive}
            label="Rejected Reviews"
            value={dashboardMetrics.workflow.rejected}
            color="red"
          />
        </div>
      </section>

      {/* Employee Metrics */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">Employee Metrics</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={Activity}
            label="Assigned Employees"
            value={dashboardMetrics.employees.assigned}
            color="blue"
          />
          <MetricCard
            icon={Activity}
            label="Active Employees"
            value={dashboardMetrics.employees.active}
            color="green"
          />
          <MetricCard
            icon={UserCheck}
            label="With Pending Tasks"
            value={dashboardMetrics.employees.withPendingTasks}
            color="amber"
          />
        </div>
      </section>
    </div>
  )
}

interface MetricCardProps {
  icon: React.ElementType
  label: string
  value: number
  color: 'blue' | 'green' | 'emerald' | 'slate' | 'purple' | 'indigo' | 'amber' | 'orange' | 'yellow' | 'red'
}

function MetricCard({ icon: Icon, label, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg border p-2.5 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}
