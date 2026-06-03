import { useEffect, useState, useCallback, useMemo } from 'react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import { toast } from 'sonner'
import {
  Archive,
  RefreshCw,
  Clock,
  Calendar,
  Layers,
  Cpu,
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
      toast.success(`Restored "${name}" successfully.`)
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
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }

  const sortedList = useMemo(() => {
    return [...archivedList].sort(
      (a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
    )
  }, [archivedList])

  return (
    <Modal isOpen={isOpen} title="" onClose={onClose} size="xl" theme="light">
      <div className="admin-projects-view font-body text-slate-800 antialiased p-1 overflow-x-hidden">
        {/* Header Section */}
        <div className="-mt-8 mb-6 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/60 shadow-sm">
              <Archive className="h-5 w-5 text-[var(--emerald-dark)]" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold tracking-tight text-[var(--emerald-dark)]">Archived Workspace</h2>
              <p className="font-body text-xs font-semibold text-slate-500">
                Review legacy projects and restore them to active directory when needed.
              </p>
            </div>
          </div>
          {!loadingList && sortedList.length > 0 && (
            <span className="font-mono text-xs font-bold tabular-nums rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
              {sortedList.length} Archived
            </span>
          )}
        </div>

        {/* List Content */}
        {loadingList ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Spinner className="text-[var(--emerald-dark)]" />
            <p className="mt-3 text-xs font-semibold text-slate-400">Loading archived projects…</p>
          </div>
        ) : sortedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
            <Archive className="mb-3 h-12 w-12 text-slate-350" />
            <p className="text-sm font-bold text-slate-700">No archived projects found</p>
            <p className="mt-1 max-w-sm text-xs font-medium text-slate-450 px-4">
              Projects you archive from your active workspace directory will be shown here.
            </p>
          </div>
        ) : (
          <div className="timesheet-panel-scroll max-h-[min(65vh,34rem)] space-y-4 overflow-y-auto pr-1">
            {sortedList.map((p) => {
              const initial = p.name.charAt(p.name.indexOf(' ') + 1) || p.name.charAt(0)
              const isRestoring = restoringId === p.id

              const memberCount = p.visibleUsers.length
              const visibleNames = p.visibleUsers.slice(0, 2)
              const remainingCount = memberCount - 2
              const membersText = memberCount > 0 
                ? visibleNames.join(', ') + (remainingCount > 0 ? ` +${remainingCount} more` : '')
                : (p.accessType === 'public' ? 'All Members' : 'None')

              return (
                <article
                  key={p.id}
                  className="relative rounded-2xl border border-emerald-200/50 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-emerald-300/70 overflow-hidden"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-emerald-400 rounded-l-2xl" />
                  
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-3 pl-1">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-extrabold text-emerald-700 border border-emerald-200">
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-[15px] font-bold tracking-tight text-slate-800">{p.name}</h3>
                          {p.status === 'Completed' ? (
                            <span className="inline-flex items-center rounded-md border border-emerald-500/15 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-blue-500/15 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              {p.status === 'Active' ? 'In Progress' : p.status}
                            </span>
                          )}
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                            p.accessType === 'private'
                              ? 'border-amber-500/15 bg-amber-50 text-amber-600'
                              : 'border-sky-500/15 bg-sky-50 text-sky-700'
                          }`}>
                            {p.accessType === 'private' ? 'Private' : 'Public'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-slate-400">
                          Client: {p.client}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end">
                      <Button
                        onClick={() => handleRestore(p.id, p.name)}
                        disabled={isRestoring}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-50 px-3 py-0 text-xs font-bold text-[var(--emerald-dark)] hover:bg-emerald-100/80 disabled:opacity-60"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                        Restore
                      </Button>
                    </div>
                  </div>

                  {p.description ? (
                    <p className="mt-3 text-xs leading-relaxed text-slate-500 pl-1">{p.description}</p>
                  ) : (
                    <p className="mt-3 text-xs italic text-slate-400 pl-1">No description provided.</p>
                  )}

                  {/* Info Grid */}
                  <div className="mt-4 grid gap-2.5 grid-cols-2 sm:grid-cols-4 pl-1">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 px-2.5 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Tech Node</p>
                      <p className="font-mono mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-700 truncate">
                        <Cpu className="h-3 w-3 shrink-0 text-[var(--emerald-dark)]" />
                        <span className="truncate">{p.technologyNode || '—'}</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 px-2.5 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Tasks</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-700">
                        <Layers className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span>{p.tasksCount} assigned</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 px-2.5 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Timesheets</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-700">
                        <Clock className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span>{p.timesheetsCount} logs</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 px-2.5 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Archived Date</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-700">
                        <Calendar className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span className="truncate" title={formatDateTime(p.archivedAt)}>
                          {formatDateTime(p.archivedAt)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Team Lead & Members (No Avatars) */}
                  <div className="mt-3.5 border-t border-slate-100 pt-3.5 pl-1 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center">
                      <span className="font-semibold text-slate-400 w-16 shrink-0">Lead:</span>
                      <span className="font-bold text-slate-700 truncate">{p.teamLead || 'Not assigned'}</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="font-semibold text-slate-400 w-16 shrink-0">Members:</span>
                      <span className="font-medium text-slate-650 truncate flex-1">
                        {membersText}
                        {memberCount > 0 && (
                          <span className="ml-1 text-[10px] text-slate-400 font-bold">({memberCount})</span>
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <Button 
            variant="secondary" 
            onClick={onClose} 
            className="h-9 rounded-lg px-4 text-xs font-bold border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            Close Window
          </Button>
        </div>
      </div>
    </Modal>
  )
}
