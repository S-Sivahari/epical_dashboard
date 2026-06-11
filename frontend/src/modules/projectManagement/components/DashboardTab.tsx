import { useEffect, useState } from 'react'
import api from '@/services/api'
import { Spinner } from '@components/ui/Spinner'
import { Badge } from '@components/ui/Badge'
import {
  Folder,
  Users,
  Clock,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  BarChart3,
} from 'lucide-react'

interface ProjectCard {
  id: string
  projectName: string
  description: string
  teamLead: string
  assignedEmployeesCount: number
  totalLibraries: number
  totalCells: number
  completedCells: number
  pendingReviews: number
  progress: number
  status: string
}

interface DashboardStats {
  projectCards: ProjectCard[]
  projectsSummary: {
    total: number
    active: number
    completed: number
    pendingReview: number
  }
  workflowSummary: {
    totalLibraries: number
    totalCells: number
    cellsInProgress: number
    cellsPendingReview: number
    cellsCompleted: number
  }
  employeeSummary: {
    assignedEmployees: number
    activeEmployees: number
    reworkTasks: number
  }
  layoutStageDistribution: Record<string, number>
  checklistCompletion: number
  recentlyUpdatedCells: {
    cellId: string
    cellName: string
    viewType: 'Schematic' | 'Symbol' | 'Layout'
    status: string
    progress: number
    lastUpdated: string
  }[]
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Not Started': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  'In Progress': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Pending Review': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Archived': { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
}

export function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/project-management/dashboard/metrics')
      .then(res => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-emerald-600" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 font-medium">
        Failed to load dashboard statistics.
      </div>
    )
  }

  const stagesList = [
    { stage: 'Floor Plan', count: stats.layoutStageDistribution['Floor Plan'] || 0 },
    { stage: 'DRC Review', count: stats.layoutStageDistribution['DRC Review'] || 0 },
    { stage: 'Routing', count: stats.layoutStageDistribution['Routing'] || 0 },
    { stage: 'DRC', count: stats.layoutStageDistribution['DRC'] || 0 },
    { stage: 'LVS', count: stats.layoutStageDistribution['LVS'] || 0 },
    { stage: 'Submit For Review', count: stats.layoutStageDistribution['Submit For Review'] || 0 },
    { stage: 'Completed', count: stats.layoutStageDistribution['Completed'] || 0 },
  ]

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* ── PROJECT CARDS ──────────────────────────────────────── */}
      {stats.projectCards.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Folder className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Projects Assigned</h2>
            <span className="ml-auto text-xs font-bold text-slate-400">{stats.projectCards.length} project(s)</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {stats.projectCards.map((proj) => {
              const st = STATUS_STYLES[proj.status] || STATUS_STYLES['Not Started']
              return (
                <div
                  key={proj.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                >
                  {/* Header with status badge */}
                  <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-base font-extrabold text-slate-800 leading-tight line-clamp-2">{proj.projectName}</h3>
                      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${st.bg} ${st.text} ${st.border}`}>
                        {proj.status}
                      </span>
                    </div>
                    {proj.description && (
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mt-1">{proj.description}</p>
                    )}
                    {proj.teamLead && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-2">
                        <span className="text-slate-400">Lead:</span> {proj.teamLead}
                      </p>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="px-6 py-3 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Progress</span>
                      <span className="text-sm font-black text-slate-700">{proj.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${proj.progress}%`,
                          background: proj.progress === 100
                            ? 'linear-gradient(90deg, #059669, #10b981)'
                            : proj.progress > 50
                              ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                              : 'linear-gradient(90deg, #6366f1, #818cf8)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="px-6 py-4 grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <span className="block text-lg font-black text-slate-800">{proj.totalLibraries}</span>
                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Libraries</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-lg font-black text-slate-800">{proj.totalCells}</span>
                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Cells</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-lg font-black text-emerald-600">{proj.completedCells}</span>
                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Done</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <Users className="h-3.5 w-3.5" />
                      <span>{proj.assignedEmployeesCount} assigned</span>
                    </div>
                    {proj.pendingReviews > 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{proj.pendingReviews} pending</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center">
          <Folder className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">No projects found</p>
          <p className="text-xs text-slate-400 mt-1">Create libraries under a project to get started.</p>
        </div>
      )}

      {/* ── SUMMARY METRICS ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Projects Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-indigo-50">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Projects Summary</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xl font-black text-slate-800">{stats.projectsSummary.total}</span>
              <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">Total</span>
            </div>
            <div>
              <span className="text-xl font-black text-blue-600">{stats.projectsSummary.active}</span>
              <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">Active</span>
            </div>
            <div>
              <span className="text-xl font-black text-emerald-600">{stats.projectsSummary.completed}</span>
              <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">Completed</span>
            </div>
            <div>
              <span className="text-xl font-black text-amber-600">{stats.projectsSummary.pendingReview}</span>
              <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">Pending Review</span>
            </div>
          </div>
        </div>

        {/* Workflow Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-emerald-50">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Workflow Summary</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Libraries</span>
              <span className="text-sm font-black text-slate-800">{stats.workflowSummary.totalLibraries}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total Cells</span>
              <span className="text-sm font-black text-slate-800">{stats.workflowSummary.totalCells}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-500 uppercase">In Progress</span>
              <span className="text-sm font-black text-blue-600">{stats.workflowSummary.cellsInProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-500 uppercase">Pending Review</span>
              <span className="text-sm font-black text-amber-600">{stats.workflowSummary.cellsPendingReview}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-500 uppercase">Completed</span>
              <span className="text-sm font-black text-emerald-600">{stats.workflowSummary.cellsCompleted}</span>
            </div>
          </div>
        </div>

        {/* Employee Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-amber-50">
              <Users className="h-4 w-4 text-amber-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Employee Summary</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xl font-black text-slate-800">{stats.employeeSummary.assignedEmployees}</span>
              <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">Assigned</span>
            </div>
            <div>
              <span className="text-xl font-black text-emerald-600">{stats.employeeSummary.activeEmployees}</span>
              <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">Active</span>
            </div>
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <span className="text-xl font-black text-rose-600">{stats.employeeSummary.reworkTasks}</span>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Rework Tasks</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ANALYTICS BREAKDOWN ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Layout Stage Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm lg:col-span-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 leading-tight">Layout Stages Distribution</h3>
            <p className="text-[10px] text-slate-400 font-medium">Currently active layouts across the workspace</p>
          </div>
          <div className="space-y-4">
            {stagesList.map((item, idx) => {
              const maxCount = Math.max(...stagesList.map(s => s.count), 1)
              const pct = (item.count / maxCount) * 100
              return (
                <div key={idx} className="flex items-center gap-4 text-xs font-semibold">
                  <span className="w-28 text-slate-600 truncate">{item.stage}</span>
                  <div className="flex-1 bg-slate-50 h-3 rounded-full overflow-hidden border border-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.stage === 'Completed' ? 'bg-teal-500' :
                        item.stage === 'Submit For Review' ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-bold text-slate-700">{item.count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Checklist Completion Gauge */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm lg:col-span-4 flex flex-col gap-6 items-center justify-between">
          <div className="flex flex-col gap-1 pb-3 border-b border-slate-100 w-full">
            <h3 className="text-sm font-bold text-slate-800 leading-tight">Overall Checklist Progress</h3>
            <p className="text-[10px] text-slate-400 font-medium text-center lg:text-left">Completed checklist verification items</p>
          </div>
          <div className="relative flex items-center justify-center w-36 h-36">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" className="stroke-slate-100" strokeWidth="10" fill="transparent" />
              <circle
                cx="50" cy="50" r="40"
                className="stroke-emerald-600 transition-all duration-700 ease-out"
                strokeWidth="10"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * stats.checklistCompletion) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center gap-0.5">
              <span className="text-2xl font-black text-slate-800 tracking-tight leading-none">{stats.checklistCompletion}%</span>
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider leading-none">Completed</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 leading-none">
            <ClipboardList className="h-4 w-4 text-slate-350" />
            <span>Real-time checking metrics</span>
          </div>
        </div>
      </div>

      {/* ── RECENTLY UPDATED CELLS ──────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col gap-1 pb-4 border-b border-slate-100 mb-4">
          <h3 className="text-sm font-bold text-slate-800 leading-tight">Recently Updated Cells</h3>
          <p className="text-[10px] text-slate-400 font-medium">Activity logs of recent workspace updates</p>
        </div>
        {stats.recentlyUpdatedCells.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No recent updates logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50/50">
                  <th className="py-2.5 px-4">Cell Name</th>
                  <th className="py-2.5 px-4">View Type</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Progress</th>
                  <th className="py-2.5 px-4">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentlyUpdatedCells.map((cell) => (
                  <tr key={cell.cellId + cell.viewType} className="border-b border-slate-100 bg-white hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">{cell.cellName}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        cell.viewType === 'Layout' ? 'bg-violet-50 text-violet-600' :
                        cell.viewType === 'Schematic' ? 'bg-sky-50 text-sky-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {cell.viewType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={
                        cell.status === 'Completed' ? 'success' :
                        cell.status === 'Submitted For Review' ? 'warning' :
                        cell.status === 'Rejected' ? 'danger' : 'neutral'
                      }>
                        {cell.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-slate-150 h-2 rounded-full overflow-hidden border border-slate-50">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${cell.progress}%` }} />
                        </div>
                        <span className="font-mono font-bold text-slate-600">{cell.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-semibold">{new Date(cell.lastUpdated).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
