import { useEffect, useState, useCallback, useMemo } from 'react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import { toast } from 'sonner'
import {
  Archive,
  RefreshCw,
  Clock,
  Calendar,
  Layers,
  FileText,
  User,
  ChevronRight,
  ArrowLeft,
  Lock,
  Globe,
  Cpu,
} from 'lucide-react'

interface ArchivedProjectSummary {
  id: string
  originalProjectId: string
  name: string
  client: string
  technologyNode: string
  accessType: 'public' | 'private'
  status: 'Active' | 'Completed' | 'Rejected'
  description: string
  visibleUsers: string[]
  teamLead?: string
  completedTasks: number
  totalTasks: number
  completionPercentage: number
  archivedAt: string
  originalCreatedAt: string
  tasksCount: number
  timesheetsCount: number
}

interface ArchivedProjectDetail {
  project: ArchivedProjectSummary
  assignedTasks: {
    id: string
    employeeId: string
    employeeName: string
    title: string
    description: string
    status: 'assigned' | 'in_progress' | 'pending_review' | 'completed'
    timesheetId?: string
  }[]
  timesheets: {
    id: string
    employeeId: string
    employeeName: string
    projectId: string
    project: string
    client: string
    technologyNode: string
    date: string
    loginTime: string
    logoutTime?: string
    totalHours?: number
    task?: string
    status: string
    workflowStatus: string
  }[]
}

export function ArchivedProjectsModal({
  isOpen,
  onClose,
  onRefreshActiveProjects,
}: {
  isOpen: boolean
  onClose: () => void
  onRefreshActiveProjects: () => Promise<void>
}) {
  const [archivedList, setArchivedList] = useState<ArchivedProjectSummary[]>([])
  const [selectedProject, setSelectedProject] = useState<ArchivedProjectDetail | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch all archived projects
  const fetchArchivedProjects = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await api.get('/projects/archived')
      setArchivedList(res.data)
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to load archived projects.')
    } finally {
      setLoadingList(false)
    }
  }, [])

  // Fetch detailed info of an archived project
  const fetchProjectDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await api.get(`/projects/archived/${id}`)
      setSelectedProject(res.data)
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to load project details.')
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchArchivedProjects()
      setSelectedProject(null)
    }
  }, [isOpen, fetchArchivedProjects])

  // Restore action handler
  const handleRestore = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to restore project "${name}"? It will move back to active dashboard list along with its history.`)) return
    setActionLoading(true)
    try {
      await api.post(`/projects/archived/${id}/restore`)
      toast.success(`Project "${name}" and all history has been restored successfully!`)
      setSelectedProject(null)
      await fetchArchivedProjects()
      await onRefreshActiveProjects()
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to restore project.')
    } finally {
      setActionLoading(false)
    }
  };



  // Date formatter helpers
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString)
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
  }

  const sortedList = useMemo(() => {
    return [...archivedList].sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime())
  }, [archivedList])

  return (
    <Modal
      isOpen={isOpen}
      title=""
      onClose={onClose}
      size={selectedProject ? 'xl' : 'lg'}
    >
      {/* ── HEADER ── */}
      <div className="-mt-10 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 shadow-lg shadow-slate-600/20">
            <Archive className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 leading-tight">
              {selectedProject ? 'Archived Project Inspector' : 'Archived Project Blocks'}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              Review and restore archived project databases.
            </p>
          </div>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {!selectedProject && (
        <div className="space-y-4 animate-fadeIn">
          {loadingList ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner />
              <p className="mt-3 text-xs font-bold text-slate-400">Loading archived projects…</p>
            </div>
          ) : sortedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/30 text-center p-6">
              <Archive className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-500">No projects are currently archived.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs font-semibold leading-relaxed">
                When you choose to delete an active project, you will be given the option to archive it safely here.
              </p>
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-3">
              {sortedList.map((p) => (
                <div
                  key={p.id}
                  onClick={() => fetchProjectDetail(p.id)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-350 cursor-pointer animate-fadeIn"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-extrabold text-xs">
                        {p.name.charAt(p.name.indexOf(' ') + 1) || p.name[0]}
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-700 leading-snug group-hover:text-slate-800 transition-colors">
                          {p.name}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Client: {p.client}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.accessType === 'private' ? (
                        <Badge variant="warning" className="py-0.5 px-2 bg-amber-50 text-amber-700 border border-amber-100 text-[10px]">
                          <Lock className="mr-1 h-3 w-3 text-amber-500" /> Private
                        </Badge>
                      ) : (
                        <Badge variant="info" className="py-0.5 px-2 bg-sky-50 text-sky-700 border border-sky-100 text-[10px]">
                          <Globe className="mr-1 h-3 w-3 text-sky-500" /> Public
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>

                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-3 text-[10px] font-bold text-slate-400">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-150 px-2 py-0.5 font-mono text-slate-500">
                        <Cpu className="h-2.5 w-2.5 text-slate-400" /> {p.technologyNode}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Layers className="h-3 w-3 text-slate-400" /> {p.tasksCount} Tasks
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" /> {p.timesheetsCount} Logs
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 font-semibold">
                      <Calendar className="h-3 w-3" /> Archived on {formatDate(p.archivedAt)}
                      <ChevronRight className="h-4 w-4 ml-1 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={onClose} className="rounded-xl font-bold py-2 px-4">
              Close Portal
            </Button>
          </div>
        </div>
      )}

      {/* ── DETAILED INSPECTION VIEW ── */}
      {selectedProject && (
        <div className="space-y-5 animate-fadeIn">
          {loadingDetail ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Spinner />
              <p className="mt-3 text-xs font-bold text-slate-400">Loading project history logs…</p>
            </div>
          ) : (
            <>
              {/* Top Back Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-150 pb-3.5">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors focus:outline-none"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Archived list
                </button>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleRestore(selectedProject.project.id, selectedProject.project.name)}
                    disabled={actionLoading}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold rounded-xl py-1.5 px-3 flex items-center gap-1.5 border border-emerald-200/50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? 'animate-spin' : ''}`} /> Restore Project
                  </Button>
                </div>
              </div>

              {/* Grid Layout: Left Project details, Right detailed tables */}
              <div className="grid gap-5 lg:grid-cols-3">
                {/* Left details panel */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-4 h-fit">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Project Details</h3>
                    <h4 className="text-base font-black text-slate-800 mt-1 leading-tight">{selectedProject.project.name}</h4>
                    <p className="text-xs text-slate-400 font-semibold mt-1">Client: {selectedProject.project.client}</p>
                    <p className="mt-3 text-xs text-slate-600 font-medium leading-relaxed bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                      {selectedProject.project.description}
                    </p>
                  </div>

                  <div className="border-t border-slate-200/60 pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-400">Technology Node</span>
                      <span className="font-bold text-slate-700 font-mono bg-slate-100 px-2 py-0.5 rounded">{selectedProject.project.technologyNode}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-400">Access Control</span>
                      <span className="font-bold text-slate-700">{selectedProject.project.accessType === 'private' ? 'Private' : 'Public'}</span>
                    </div>
                    {selectedProject.project.teamLead && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-400">Team Lead</span>
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <User className="h-3 w-3 text-emerald-500" /> {selectedProject.project.teamLead}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-400">Archived At</span>
                      <span className="font-bold text-slate-600">{formatDateTime(selectedProject.project.archivedAt)}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/60 pt-3">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Metrics in Archive</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white border border-slate-200/50 rounded-xl p-2 text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Assigned Tasks</p>
                        <p className="text-lg font-black text-slate-700 mt-0.5 tabular-nums">{selectedProject.assignedTasks.length}</p>
                      </div>
                      <div className="bg-white border border-slate-200/50 rounded-xl p-2 text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Timesheet Logs</p>
                        <p className="text-lg font-black text-slate-700 mt-0.5 tabular-nums">{selectedProject.timesheets.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right detailed tabs / sublists */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Task list sub-container */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3">
                      <FileText className="h-4 w-4 text-emerald-600" /> Archived Tasks History ({selectedProject.assignedTasks.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto pr-1 space-y-2">
                      {selectedProject.assignedTasks.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-4 font-semibold">No assigned tasks logged for this project.</p>
                      ) : (
                        selectedProject.assignedTasks.map((t) => (
                          <div key={t.id} className="flex items-center justify-between border border-slate-100 bg-slate-50/30 rounded-xl p-2.5">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 leading-tight">{t.title}</p>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Assigned to: {t.employeeName}</p>
                            </div>
                            <Badge
                              className={`py-0.5 px-2 text-[9px] font-bold uppercase ${
                                t.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : t.status === 'pending_review'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                              }`}
                            >
                              {t.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Timesheets sub-container */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3">
                      <Clock className="h-4 w-4 text-emerald-600" /> Archived Timesheet Logs ({selectedProject.timesheets.length})
                    </h4>
                    <div className="max-h-48 overflow-y-auto pr-1">
                      {selectedProject.timesheets.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-6 font-semibold">No timesheet log history available.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                <th className="pb-2">Employee</th>
                                <th className="pb-2">Date</th>
                                <th className="pb-2">Hours</th>
                                <th className="pb-2">Task Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium text-slate-650">
                              {selectedProject.timesheets.map((ts) => (
                                <tr key={ts.id} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 flex items-center gap-1.5 font-bold text-slate-700">
                                    <Avatar name={ts.employeeName} size="sm" color={`hsl(${hashName(ts.employeeName)},55%,45%)`} />
                                    <span>{ts.employeeName}</span>
                                  </td>
                                  <td className="py-2.5 text-slate-500 font-semibold">{ts.date}</td>
                                  <td className="py-2.5 font-black text-slate-700 tabular-nums">{ts.totalHours ? `${ts.totalHours.toFixed(1)}h` : '—'}</td>
                                  <td className="py-2.5 text-[10px] text-slate-500 font-medium max-w-[150px] truncate" title={ts.task}>{ts.task || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360
  }
  return h
}
