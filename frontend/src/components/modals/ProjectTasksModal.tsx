import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Circle, Loader, Sliders, User } from 'lucide-react'
import api from '@/services/api'
import {
  completeProjectTask,
  fetchProjectTimesheets,
  overrideTimesheetLog,
  type ProjectSyncPayload,
} from '@/services/projectSyncService'

interface TimesheetEntry {
  id: string
  projectId?: string
  project: string
  employeeName: string
  employeeId?: string
  task: string
  loginTime: string
  logoutTime?: string
  totalHours?: number
  overriddenHours?: number
  status: 'Approved' | 'Pending' | 'Rejected'
  requestStatus: 'No Request' | 'Pending Review' | 'Corrected' | 'Approved' | 'Rejected'
  taskStatus?: 'Pending' | 'In Progress' | 'Completed' | 'Session Incomplete'
  adminNotes?: string
  correctionRequest?: {
    requestedLogin: string
    requestedLogout: string
    reason: string
    message: string
  }
}

interface ProjectTasksModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  onRefresh?: () => Promise<void> | void
  onProjectSynced?: (project: ProjectSyncPayload | null) => void
}

const toDatetimeLocal = (isoString?: string): string => {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return isoString
  const dateStr = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${dateStr}, ${timeStr}`
}

/** Matches backend rules; treats admin-completed tasks as Completed in the UI. */
const getTaskDisplayStatus = (entry: TimesheetEntry): 'In Progress' | 'Completed' => {
  if (entry.taskStatus === 'Completed' && entry.status === 'Approved') {
    return 'Completed'
  }
  return 'In Progress'
}

const mergeTimesheetFromApi = (prev: TimesheetEntry, updated: Record<string, unknown>): TimesheetEntry => ({
  ...prev,
  ...(updated as Partial<TimesheetEntry>),
  id: String(updated.id ?? prev.id),
  employeeName: String(updated.employeeName ?? prev.employeeName),
  project: String(updated.project ?? prev.project),
  task: String(updated.task ?? prev.task),
  loginTime: String(updated.loginTime ?? prev.loginTime),
  logoutTime: updated.logoutTime ? String(updated.logoutTime) : undefined,
  status: (updated.status as TimesheetEntry['status']) ?? prev.status,
  requestStatus: (updated.requestStatus as TimesheetEntry['requestStatus']) ?? prev.requestStatus,
  taskStatus: (updated.taskStatus as TimesheetEntry['taskStatus']) ?? prev.taskStatus,
})

const formatProjectStatusLabel = (status?: string): string => {
  if (status === 'Completed') return 'Completed'
  if (status === 'Active') return 'In Progress'
  return status || 'In Progress'
}

export function ProjectTasksModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onRefresh,
  onProjectSynced,
}: ProjectTasksModalProps) {
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [projectStats, setProjectStats] = useState<ProjectSyncPayload | null>(null)
  const [overrideEntryId, setOverrideEntryId] = useState<string | null>(null)
  const [overrideForm, setOverrideForm] = useState({
    loginTime: '',
    logoutTime: '',
    hasLogoutTime: true,
    overriddenHours: '' as string | number,
    isOverridden: false,
    adminNotes: '',
  })

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const data = (await fetchProjectTimesheets(projectId, projectName)) as unknown as TimesheetEntry[]
      setEntries(data)
    } catch (error) {
      console.error('Failed to fetch project timesheets:', error)
      toast.error('Failed to load project work entries')
    } finally {
      setLoading(false)
    }
  }, [projectId, projectName])

  useEffect(() => {
    if (isOpen) {
      void loadEntries()
      setOverrideEntryId(null)
      void api.get(`/projects/${projectId}`).then((res) => {
        setProjectStats(res.data)
      }).catch(() => {
        setProjectStats(null)
      })
    }
  }, [isOpen, loadEntries, projectId])

  const completionFromBackend = useMemo(() => {
    if (projectStats?.totalTasks !== undefined) {
      return {
        completed: projectStats.completedTasks ?? 0,
        total: projectStats.totalTasks ?? 0,
        percentage: projectStats.completionPercentage ?? 0,
        status: projectStats.status,
      }
    }
    return {
      completed: 0,
      total: entries.length,
      percentage: 0,
      status: 'Active' as const,
    }
  }, [projectStats, entries.length])

  const assignedEngineers = useMemo(() => {
    const map = new Map<string, { name: string; id?: string; count: number }>()
    entries.forEach((entry) => {
      const key = entry.employeeId || entry.employeeName
      const existing = map.get(key)
      if (existing) {
        existing.count += 1
      } else {
        map.set(key, { name: entry.employeeName, id: entry.employeeId, count: 1 })
      }
    })
    return [...map.values()]
  }, [entries])

  const applySyncResponse = async (
    project: ProjectSyncPayload | null,
    updatedTimesheet?: Record<string, unknown>
  ) => {
    if (updatedTimesheet?.id) {
      const id = String(updatedTimesheet.id)
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? mergeTimesheetFromApi(e, updatedTimesheet) : e))
      )
    }
    if (project) {
      setProjectStats({
        ...project,
        status: project.status,
      })
      onProjectSynced?.(project)
    }
    await loadEntries()
    await onRefresh?.()
  }

  const openOverride = (entry: TimesheetEntry) => {
    setOverrideEntryId(entry.id)
    setOverrideForm({
      loginTime: toDatetimeLocal(entry.loginTime),
      logoutTime: toDatetimeLocal(entry.logoutTime),
      hasLogoutTime: !!entry.logoutTime,
      overriddenHours: entry.overriddenHours !== undefined ? entry.overriddenHours : '',
      isOverridden: entry.overriddenHours !== undefined,
      adminNotes: entry.adminNotes || '',
    })
  }

  const handleSaveOverride = async (entryId: string) => {
    const loginISO = new Date(overrideForm.loginTime).toISOString()
    const logoutISO =
      overrideForm.hasLogoutTime && overrideForm.logoutTime
        ? new Date(overrideForm.logoutTime).toISOString()
        : null

    if (logoutISO && logoutISO < loginISO) {
      toast.error('Logout time cannot be earlier than login time.')
      return
    }

    setSavingId(entryId)
    try {
      await overrideTimesheetLog(entryId, {
        loginTime: loginISO,
        logoutTime: logoutISO,
        overriddenHours: overrideForm.isOverridden ? Number(overrideForm.overriddenHours) : null,
        adminNotes: overrideForm.adminNotes.trim() || null,
      })
      toast.success('Log override saved')
      setOverrideEntryId(null)
      await onRefresh?.()
      await loadEntries()
    } catch (error) {
      console.error('Failed to save override:', error)
      toast.error('Failed to save log override')
    } finally {
      setSavingId(null)
    }
  }

  const getStatusIcon = (entry: TimesheetEntry) => {
    if (getTaskDisplayStatus(entry) === 'Completed') {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
    }
    return <Circle className="h-5 w-5 text-blue-500" />
  }

  const handleMarkCompleted = async (entry: TimesheetEntry) => {
    if (!entry.logoutTime && !entry.correctionRequest) {
      toast.error('Cannot complete — session has no logout time. Use Override Log first.')
      return
    }
    setSavingId(entry.id)
    try {
      const result = await completeProjectTask(projectId, entry.id, {
        applyCorrection: !!entry.correctionRequest,
      })

      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? mergeTimesheetFromApi(e, {
                ...result.timesheet,
                taskStatus: 'Completed',
                status: 'Approved',
              })
            : e
        )
      )

      toast.success('Task marked as completed')
      await applySyncResponse(result.project, result.timesheet)
    } catch (error) {
      console.error('Failed to mark task completed:', error)
      toast.error('Failed to mark task as completed')
    } finally {
      setSavingId(null)
    }
  }

  const { completed, total, percentage, status: projectStatus } = completionFromBackend
  const projectStatusLabel = formatProjectStatusLabel(projectStatus)
  const allCompleted = total > 0 && completed === total && projectStatus === 'Completed'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Project Tasks — ${projectName}`} size="lg">
      <div className="space-y-4">
        {assignedEngineers.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Assigned Engineers ({assignedEngineers.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {assignedEngineers.map((eng) => (
                <span
                  key={eng.id || eng.name}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  <User className="h-3 w-3 text-emerald-600" />
                  {eng.name}
                  <span className="text-[10px] text-slate-400">({eng.count} log{eng.count !== 1 ? 's' : ''})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {total > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Project Completion (backend)
              </span>
              <span className={`text-sm font-bold ${allCompleted ? 'text-emerald-700' : 'text-slate-600'}`}>
                {completed} / {total} · {percentage}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full transition-all duration-300 ${allCompleted ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Project status: <span className="font-bold">{projectStatusLabel}</span>
              {allCompleted && ' — all tasks completed.'}
            </p>
          </div>
        )}

        <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">No work entries linked to this project</p>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50/80"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{getStatusIcon(entry)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {entry.task || 'Untitled work item'}
                        </p>
                        <p className="text-xs text-slate-500">{entry.employeeName}</p>
                      </div>
                      <span
                        className={`whitespace-nowrap rounded px-2 py-1 text-[10px] font-bold ${
                          getTaskDisplayStatus(entry) === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {getTaskDisplayStatus(entry)}
                      </span>
                    </div>

                    <div className="mb-2 grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2">
                      <p>
                        <span className="font-semibold text-slate-400">Login:</span>{' '}
                        {formatDateTime(entry.loginTime)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-400">Logout:</span>{' '}
                        {entry.logoutTime ? formatDateTime(entry.logoutTime) : '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-400">Hours:</span>{' '}
                        {entry.totalHours !== undefined ? `${entry.totalHours}h` : '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-400">Status:</span>{' '}
                        {getTaskDisplayStatus(entry)}
                      </p>
                    </div>

                    {entry.correctionRequest && getTaskDisplayStatus(entry) === 'In Progress' && (
                      <div className="mb-2 rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-900">
                        <p className="font-bold uppercase tracking-wider text-[9px]">Correction request</p>
                        <p>{entry.correctionRequest.message || entry.correctionRequest.reason}</p>
                      </div>
                    )}

                    {overrideEntryId === entry.id ? (
                      <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            type="datetime-local"
                            label="Login"
                            value={overrideForm.loginTime}
                            onChange={(e) =>
                              setOverrideForm((f) => ({ ...f, loginTime: e.target.value }))
                            }
                          />
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-[10px] font-bold uppercase text-slate-500">
                                Logout
                              </label>
                              <label className="flex items-center gap-1 text-[10px] text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={overrideForm.hasLogoutTime}
                                  onChange={(e) =>
                                    setOverrideForm((f) => ({ ...f, hasLogoutTime: e.target.checked }))
                                  }
                                />
                                Has logout
                              </label>
                            </div>
                            <input
                              type="datetime-local"
                              value={overrideForm.logoutTime}
                              disabled={!overrideForm.hasLogoutTime}
                              onChange={(e) =>
                                setOverrideForm((f) => ({ ...f, logoutTime: e.target.value }))
                              }
                              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={overrideForm.isOverridden}
                            onChange={(e) =>
                              setOverrideForm((f) => ({ ...f, isOverridden: e.target.checked }))
                            }
                          />
                          Override total hours
                        </label>
                        {overrideForm.isOverridden && (
                          <Input
                            type="number"
                            step="0.1"
                            label="Hours"
                            value={overrideForm.overriddenHours}
                            onChange={(e) =>
                              setOverrideForm((f) => ({ ...f, overriddenHours: e.target.value }))
                            }
                          />
                        )}
                        <textarea
                          placeholder="Admin notes..."
                          value={overrideForm.adminNotes}
                          onChange={(e) =>
                            setOverrideForm((f) => ({ ...f, adminNotes: e.target.value }))
                          }
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs"
                            disabled={savingId === entry.id}
                            onClick={() => setOverrideEntryId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="bg-emerald-600 text-xs text-white"
                            loading={savingId === entry.id}
                            disabled={savingId === entry.id}
                            onClick={() => void handleSaveOverride(entry.id)}
                          >
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {getTaskDisplayStatus(entry) === 'In Progress' && (
                          <button
                            type="button"
                            disabled={savingId === entry.id}
                            onClick={() => void handleMarkCompleted(entry)}
                            className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Mark as Completed
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={savingId === entry.id}
                          onClick={() => openOverride(entry)}
                          className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          <Sliders className="h-3 w-3" />
                          Override Log
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end border-t border-slate-200 pt-4">
        <Button onClick={onClose} variant="secondary" className="px-3 py-1.5 text-xs">
          Close
        </Button>
      </div>
    </Modal>
  )
}
