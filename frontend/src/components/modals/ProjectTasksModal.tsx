import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Circle, Loader, Sliders, User } from 'lucide-react'
import { TimesheetLogOverrideModal, type TimesheetLogEntry } from '@components/modals/TimesheetLogOverrideModal'
import api from '@/services/api'
import {
  completeProjectTask,
  fetchProjectTimesheets,
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
  approvalStatus?: 'Approved' | 'Pending' | 'Rejected'
  requestStatus: 'No Request' | 'Pending Review' | 'Corrected' | 'Approved' | 'Rejected'
  taskStatus?: 'Pending' | 'In Progress' | 'Paused' | 'Completed' | 'Session Incomplete'
  workflowStatus?: 'Pending' | 'In Progress' | 'Completed' | 'Rejected' | 'Session Incomplete' | 'Pending Review'
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
}

const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return isoString
  const dateStr = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${dateStr}, ${timeStr}`
}

const getTaskDisplayStatus = (entry: TimesheetEntry): string => {
  const approval = entry.approvalStatus || entry.status
  if (entry.taskStatus === 'Completed' && approval === 'Approved') return 'Completed'
  if (entry.taskStatus === 'Completed') return 'Pending'
  if (entry.workflowStatus) return entry.workflowStatus
  if (approval === 'Rejected') return 'Rejected'
  if (entry.taskStatus === 'Paused') return 'Paused'
  if (entry.taskStatus === 'Session Incomplete' || !entry.logoutTime) return 'Session Incomplete'
  if (entry.requestStatus === 'Pending Review') return 'Pending'
  if (entry.taskStatus === 'In Progress') return 'In Progress'
  if (entry.logoutTime) return 'Pending'
  return 'Pending'
}

/** Admin can approve only after the employee marks the task complete. */
const canMarkComplete = (entry: TimesheetEntry): boolean => {
  const approval = entry.approvalStatus || entry.status
  if (approval === 'Approved' || approval === 'Rejected') return false
  return entry.taskStatus === 'Completed'
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
  approvalStatus: (updated.approvalStatus as TimesheetEntry['approvalStatus']) ?? prev.approvalStatus,
  requestStatus: (updated.requestStatus as TimesheetEntry['requestStatus']) ?? prev.requestStatus,
  taskStatus: (updated.taskStatus as TimesheetEntry['taskStatus']) ?? prev.taskStatus,
  workflowStatus: (updated.workflowStatus as TimesheetEntry['workflowStatus']) ?? prev.workflowStatus,
  totalHours: updated.totalHours !== undefined ? Number(updated.totalHours) : prev.totalHours,
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
}: ProjectTasksModalProps) {
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [pendingAssignments, setPendingAssignments] = useState<
    {
      id: string
      employeeId?: string
      employeeName: string
      title: string
      status: string
      timesheetId?: string
    }[]
  >([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [projectStats, setProjectStats] = useState<ProjectSyncPayload | null>(null)
  const [overrideEntry, setOverrideEntry] = useState<TimesheetLogEntry | null>(null)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const [data, assignedRes] = await Promise.all([
        fetchProjectTimesheets(projectId, projectName),
        api.get(`/projects/${projectId}/assigned-tasks`),
      ])
      const assignments = (assignedRes.data ?? []) as typeof pendingAssignments
      let mergedEntries = (Array.isArray(data) ? data : []) as unknown as TimesheetEntry[]
      const knownIds = new Set(mergedEntries.map((e) => e.id))

      const missingTimesheetIds = assignments
        .filter((a) => a.timesheetId && !knownIds.has(a.timesheetId))
        .map((a) => a.timesheetId as string)

      if (missingTimesheetIds.length > 0) {
        const extras = await Promise.all(
          missingTimesheetIds.map((id) =>
            api.get(`/timesheets/${id}`).then((r) => r.data as TimesheetEntry).catch(() => null)
          )
        )
        mergedEntries = [...mergedEntries, ...extras.filter((e): e is TimesheetEntry => !!e)]
      }

      setEntries(mergedEntries)
      setPendingAssignments(assignments)
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
      setOverrideEntry(null)
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
      total: 0,
      percentage: 0,
      status: 'Active' as const,
    }
  }, [projectStats])

  const assignedEngineers = useMemo(() => {
    const map = new Map<string, { name: string; id?: string; count: number }>()

    const addEngineer = (name: string, id?: string) => {
      const key = id || name
      const existing = map.get(key)
      if (existing) return
      map.set(key, { name, id, count: 0 })
    }

    pendingAssignments.forEach((a) => addEngineer(a.employeeName, a.employeeId))
    entries.forEach((entry) => {
      const key = entry.employeeId || entry.employeeName
      const existing = map.get(key)
      if (existing) {
        existing.count += 1
      } else {
        map.set(key, { name: entry.employeeName, id: entry.employeeId, count: 1 })
      }
    })

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [entries, pendingAssignments])

  const loggedTimesheetIds = useMemo(
    () => new Set(entries.map((e) => e.id)),
    [entries]
  )

  const normalizeName = (value?: string) => (value || '').trim().toLowerCase()

  const assignmentMatchesEntry = useCallback(
    (
      assignment: { employeeId?: string; employeeName: string },
      entry: { employeeId?: string; employeeName: string }
    ) => {
      if (assignment.employeeId && entry.employeeId && assignment.employeeId === entry.employeeId) {
        return true
      }
      const aName = normalizeName(assignment.employeeName)
      const eName = normalizeName(entry.employeeName)
      return !!aName && !!eName && (aName === eName || aName.includes(eName) || eName.includes(aName))
    },
    []
  )

  const assignmentHasLoggedEntry = useCallback(
    (assignment: { id: string; employeeId?: string; employeeName: string; timesheetId?: string }) => {
      if (assignment.timesheetId && loggedTimesheetIds.has(assignment.timesheetId)) {
        return true
      }
      return entries.some(
        (e) => assignmentMatchesEntry(assignment, e) && !!e.logoutTime
      )
    },
    [entries, loggedTimesheetIds, assignmentMatchesEntry]
  )

  /** Only tasks not yet started by the employee. */
  const activeAssignments = useMemo(
    () =>
      pendingAssignments.filter(
        (a) =>
          a.status === 'assigned' &&
          !a.timesheetId &&
          !assignmentHasLoggedEntry(a)
      ),
    [pendingAssignments, assignmentHasLoggedEntry]
  )

  /** Employee submitted work — show as Pending until admin approves. */
  const pendingReviewAssignments = useMemo(
    () =>
      pendingAssignments.filter(
        (a) =>
          a.status === 'pending_review' &&
          !entries.some((e) => e.id === a.timesheetId)
      ),
    [pendingAssignments, entries]
  )

  const completedAssignments = useMemo(
    () => pendingAssignments.filter((a) => a.status === 'completed'),
    [pendingAssignments]
  )

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
    }
    await loadEntries()
    await onRefresh?.()
  }

  const getStatusIcon = (entry: TimesheetEntry) => {
    const status = getTaskDisplayStatus(entry)
    if (status === 'Completed') {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
    }
    if (status === 'Paused') {
      return <AlertCircle className="h-5 w-5 text-violet-500" />
    }
    if (status === 'Session Incomplete') {
      return <AlertCircle className="h-5 w-5 text-amber-500" />
    }
    return <Circle className="h-5 w-5 text-blue-500" />
  }

  const getStatusBadgeClass = (status: string) => {
    if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    if (status === 'Rejected') return 'bg-red-50 text-red-700 border border-red-200'
    if (status === 'Paused') return 'bg-violet-50 text-violet-700 border border-violet-200'
    if (status === 'Session Incomplete') return 'bg-amber-50 text-amber-700 border border-amber-200'
    if (status === 'Pending') return 'bg-blue-50 text-blue-700 border border-blue-200'
    if (status === 'Pending Review') return 'bg-blue-50 text-blue-700 border border-blue-200'
    return 'bg-blue-50 text-blue-700 border border-blue-200'
  }

  const handleMarkCompleted = async (entry: TimesheetEntry) => {
    if (entry.taskStatus !== 'Completed') {
      toast.error('Cannot complete — employee has not finished this task yet.')
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

  const assignmentCount = pendingAssignments.length
  const { completed, total, percentage, status: projectStatus } = completionFromBackend
  const displayTotal = total > 0 ? total : assignmentCount
  const displayCompleted =
    total > 0 ? completed : completedAssignments.length
  const displayPercentage =
    displayTotal > 0 ? Math.round((displayCompleted / displayTotal) * 100) : percentage
  const projectStatusLabel = formatProjectStatusLabel(projectStatus)
  const allCompleted =
    displayTotal > 0 && displayCompleted === displayTotal && projectStatus === 'Completed'

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={`Project Details — ${projectName}`} size="lg">
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
                  <span className="text-[10px] text-slate-400">
                    ({eng.count} log{eng.count !== 1 ? 's' : ''})
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {displayTotal > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Project Completion
              </span>
              <span className={`text-sm font-bold ${allCompleted ? 'text-emerald-700' : 'text-slate-600'}`}>
                {displayCompleted} / {displayTotal} · {displayPercentage}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full transition-all duration-300 ${allCompleted ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                style={{ width: `${displayPercentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Project status: <span className="font-bold">{projectStatusLabel}</span>
              {allCompleted && ' — all items completed.'}
            </p>
          </div>
        )}

        <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : entries.length === 0 &&
            activeAssignments.length === 0 &&
            completedAssignments.length === 0 &&
            pendingReviewAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No engineers assigned to this project</p>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Add team members under Allowed Users when editing the project, or set the project to public.
              </p>
            </div>
          ) : (
            <>
              {pendingReviewAssignments.map((assignment) => (
                <div
                  key={`pending-review-${assignment.id}`}
                  className="rounded-lg border border-blue-200 bg-blue-50/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{assignment.title}</p>
                          <p className="text-xs text-slate-500">{assignment.employeeName}</p>
                        </div>
                        <span
                          className={`whitespace-nowrap rounded px-2 py-1 text-[10px] font-bold ${getStatusBadgeClass('Pending')}`}
                        >
                          Pending
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-800">
                        Employee marked this project complete. Review and approve below.
                      </p>
                      {assignment.timesheetId && (
                        <div className="mt-3 flex justify-end border-t border-blue-100 pt-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            loading={savingId === assignment.timesheetId}
                            disabled={savingId === assignment.timesheetId}
                            onClick={() => {
                              const entry = entries.find((e) => e.id === assignment.timesheetId)
                              if (entry) {
                                void handleMarkCompleted(entry)
                              }
                            }}
                          >
                            Complete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {activeAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <Circle className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{assignment.title}</p>
                          <p className="text-xs text-slate-500">{assignment.employeeName}</p>
                        </div>
                        <span className="whitespace-nowrap rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                          Assigned
                        </span>
                      </div>
                      <div className="mb-2 grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2">
                        <p>
                          <span className="font-semibold text-slate-400">Login:</span> —
                        </p>
                        <p>
                          <span className="font-semibold text-slate-400">Logout:</span> —
                        </p>
                        <p>
                          <span className="font-semibold text-slate-400">Hours:</span> —
                        </p>
                        <p>
                          <span className="font-semibold text-slate-400">Status:</span> Awaiting start
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-505">
                        Employee can start this from Timesheet → Check In → select project → Start Project.
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {completedAssignments.map((assignment) => (
                <div
                  key={`completed-${assignment.id}`}
                  className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{assignment.title}</p>
                          <p className="text-xs text-slate-500">{assignment.employeeName}</p>
                        </div>
                        <span className="whitespace-nowrap rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                          Completed
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        Marked complete by admin.
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {entries.map((entry) => (
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
                        className={`whitespace-nowrap rounded px-2 py-1 text-[10px] font-bold ${getStatusBadgeClass(getTaskDisplayStatus(entry))}`}
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

                    {entry.correctionRequest && canMarkComplete(entry) && (
                      <div className="mb-2 rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-900">
                        <p className="font-bold uppercase tracking-wider text-[9px]">Correction request</p>
                        <p>{entry.correctionRequest.message || entry.correctionRequest.reason}</p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      {canMarkComplete(entry) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          loading={savingId === entry.id}
                          disabled={savingId === entry.id}
                          onClick={() => void handleMarkCompleted(entry)}
                        >
                          Complete
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={savingId === entry.id}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setOverrideEntry({
                            id: entry.id,
                            projectId: entry.projectId ?? projectId,
                            project: entry.project || projectName,
                            employeeName: entry.employeeName,
                            employeeId: entry.employeeId,
                            task: entry.task,
                            loginTime: entry.loginTime,
                            logoutTime: entry.logoutTime,
                            billable: true,
                            adminNotes: entry.adminNotes,
                          })
                        }}
                      >
                        <Sliders className="h-3.5 w-3.5" />
                        Override Log
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end border-t border-slate-200 pt-4">
        <Button onClick={onClose} variant="secondary" className="px-3 py-1.5 text-xs">
          Close
        </Button>
      </div>

    </Modal>

    {overrideEntry && (
      <TimesheetLogOverrideModal
        isOpen
        onClose={() => setOverrideEntry(null)}
        entry={overrideEntry}
        defaultProjectId={projectId}
        projectName={projectName}
        onSaved={async () => {
          await loadEntries()
          await onRefresh?.()
        }}
      />
    )}
    </>
  )
}
