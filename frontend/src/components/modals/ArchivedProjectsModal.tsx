import { useEffect, useState, useCallback, useMemo } from 'react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import { toast } from 'sonner'
import {
  Archive,
  RefreshCw,
  Clock,
  Calendar,
  Layers,
  Lock,
  Globe,
  Cpu,
  UserCheck,
  CheckCircle2,
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
  const [loadingList, setLoadingList] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const fetchArchivedProjects = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await api.get('/projects/archived')
      setArchivedList(res.data)
    } catch (err: unknown) {
      console.error(err)
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(message || 'Failed to load archived projects.')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchArchivedProjects()
    }
  }, [isOpen, fetchArchivedProjects])

  const handleRestore = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Restore "${name}"? It will return to the active projects list with its archived history.`
      )
    ) {
      return
    }
    setRestoringId(id)
    try {
      await api.post(`/projects/archived/${id}/restore`)
      await fetchArchivedProjects()
      await onRefreshActiveProjects()
    } catch (err: unknown) {
      console.error(err)
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(message || 'Failed to restore project.')
    } finally {
      setRestoringId(null)
    }
  }

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString)
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
  }

  const sortedList = useMemo(() => {
    return [...archivedList].sort(
      (a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
    )
  }, [archivedList])

  return (
    <Modal isOpen={isOpen} title="" onClose={onClose} size="xl">
      <div className="dashboard-surface">
      <div className="-mt-8 mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 shadow-sm">
            <Archive className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="type-card-title text-slate-800">Archived Projects</h2>
            <p className="type-body-sm text-slate-500">
              Review details and restore projects to the active dashboard.
            </p>
          </div>
        </div>
        {!loadingList && sortedList.length > 0 && (
          <span className="type-metric rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
            {sortedList.length} archived
          </span>
        )}
      </div>

      {loadingList ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner />
          <p className="mt-3 text-xs font-semibold text-slate-500">Loading archived projects…</p>
        </div>
      ) : sortedList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
          <Archive className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">No projects are currently archived.</p>
          <p className="mt-1 max-w-sm text-xs font-medium text-slate-500">
            Archiving moves a project and its history here while keeping data intact for restore.
          </p>
        </div>
      ) : (
        <div className="timesheet-panel-scroll max-h-[min(70vh,36rem)] space-y-3 overflow-y-auto pr-1">
          {sortedList.map((p) => {
            const initial = p.name.charAt(p.name.indexOf(' ') + 1) || p.name.charAt(0)
            const isRestoring = restoringId === p.id

            return (
              <article
                key={p.id}
                className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-extrabold text-slate-700">
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="type-card-title text-[15px] leading-snug text-slate-800">{p.name}</h3>
                        {p.status === 'Completed' ? (
                          <Badge
                            variant="neutral"
                            className="border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
                          </Badge>
                        ) : (
                          <Badge
                            variant="info"
                            className="border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700"
                          >
                            {p.status === 'Active' ? 'In Progress' : p.status}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        Client · {p.client}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                    {p.accessType === 'private' ? (
                      <Badge
                        variant="warning"
                        className="border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"
                      >
                        <Lock className="mr-1 h-3 w-3 text-amber-600" /> Private
                      </Badge>
                    ) : (
                      <Badge
                        variant="info"
                        className="border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800"
                      >
                        <Globe className="mr-1 h-3 w-3 text-sky-600" /> Public
                      </Badge>
                    )}
                  </div>
                </div>

                {p.description ? (
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-3">{p.description}</p>
                ) : (
                  <p className="mt-2 text-xs italic text-slate-400">No description provided.</p>
                )}

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tech node</p>
                    <p className="type-metric mt-0.5 flex items-center gap-1 text-xs text-slate-700">
                      <Cpu className="h-3 w-3 text-emerald-600" />
                      {p.technologyNode || '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tasks</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-700">
                      <Layers className="h-3 w-3 text-slate-500" />
                      {p.tasksCount} assigned
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Timesheets</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-700">
                      <Clock className="h-3 w-3 text-slate-500" />
                      {p.timesheetsCount} logs
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Archived</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-700">
                      <Calendar className="h-3 w-3 text-slate-500" />
                      <span className="truncate" title={formatDateTime(p.archivedAt)}>
                        {formatDateTime(p.archivedAt)}
                      </span>
                    </p>
                  </div>
                </div>

                {p.accessType === 'private' && (p.teamLead || p.visibleUsers.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                    {p.teamLead && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-emerald-800">
                        <UserCheck className="h-3.5 w-3.5" />
                        Lead: {p.teamLead}
                      </span>
                    )}
                    {p.visibleUsers.length > 0 && (
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                        {p.visibleUsers.length} restricted user{p.visibleUsers.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
                  <Button
                    onClick={() => handleRestore(p.id, p.name)}
                    disabled={isRestoring}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-0 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                    Restore Project
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
        <Button variant="secondary" onClick={onClose} className="h-9 rounded-lg px-4 text-xs font-bold">
          Close
        </Button>
      </div>
      </div>
    </Modal>
  )
}
