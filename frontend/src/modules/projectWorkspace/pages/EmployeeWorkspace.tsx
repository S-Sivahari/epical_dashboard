import { useState, useEffect, useCallback, useRef } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { toast } from 'sonner'
import api from '@/services/api'
import {
  Layers,
  Send,
  AlertTriangle,
  Lock,
  ArrowRight,
  ClipboardList,
  History,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react'

interface AssignedView {
  id: string
  viewType: 'Schematic' | 'Symbol' | 'Layout'
  status: 'In Progress' | 'Submitted For Review' | 'Completed' | 'Rejected'
  currentStage: string
  completedStages: string[]
  checkpointStatus: {
    checkpoint1: 'None' | 'Pending' | 'Approved' | 'Rejected'
    checkpoint2: 'None' | 'Pending' | 'Approved' | 'Rejected'
  }
  reviewStatus: string
  progress: number
  cellId: string
  cellName: string
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP'
  libraryName: string
  projectName: string
}

interface ChecklistAnswer {
  itemId: string
  text: string
  category: string
  isMandatory: boolean
  response: 'Pass' | 'Fail' | 'None'
  notes?: string
  remarks?: string
  order: number
}

interface ChecklistResponse {
  _id: string
  cellId: string
  viewId: string
  viewType: 'Schematic' | 'Symbol' | 'Layout'
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP'
  templateVersionId: string
  answers: ChecklistAnswer[]
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Approved' | 'Rejected'
  completedCount: number
  totalCount: number
}

interface ReviewComment {
  id: string
  viewType: 'Schematic' | 'Symbol' | 'Layout'
  reviewType: 'Standard' | 'Checkpoint 1' | 'Checkpoint 2'
  status: 'Pending' | 'Approved' | 'Rejected'
  comments?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  cellName: string
  libraryName: string
}

interface AuditLog {
  _id: string
  employeeId: string
  employeeName: string
  action: string
  details?: string
  timestamp: string
}

export function EmployeeWorkspace() {
  const [assignedViews, setAssignedViews] = useState<AssignedView[]>([])
  const [selectedView, setSelectedView] = useState<AssignedView | null>(null)
  
  // Workspace Locking
  const [isLocked, setIsLocked] = useState(false)
  const [lockMessage, setLockMessage] = useState('')
  const inactivityTimerRef = useRef<any>(null)

  // Checklist responses state
  const [checklistResponse, setChecklistResponse] = useState<ChecklistResponse | null>(null)
  const [savingChecklist, setSavingChecklist] = useState(false)

  // Tab state inside workspace canvas
  const [activeTab, setActiveTab] = useState<'checklist' | 'audit'>('checklist')
  const [employeeAuditLogs, setEmployeeAuditLogs] = useState<AuditLog[]>([])

  // Review comments tracker
  const [commentsHistory, setCommentsHistory] = useState<ReviewComment[]>([])

  // Loading state
  const [loading, setLoading] = useState(false)

  // Check check-in & active session status
  const checkSessionStatus = useCallback(async () => {
    try {
      await api.get('/project-management/workspace/dashboard-metrics')
      setIsLocked(false)
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.error === 'restricted_workspace') {
        setIsLocked(true)
        setLockMessage(err.response.data.message || 'Workspace is locked. Please check in and start an active timesheet task to continue.')
      }
    }
  }, [])

  // Auto-pause task on 10 min inactivity
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(async () => {
      // Only pause if not already locked
      if (isLocked) return
      try {
        await api.post('/project-management/workspace/auto-pause')
        toast.info('Workspace automatically paused due to 10 minutes of complete inactivity.')
        setIsLocked(true)
        setLockMessage('Workspace Locked: Paused due to 10 minutes of inactivity. Please resume your session from the Timesheet page.')
      } catch (err) {
        console.error('Auto pause execution failed', err)
      }
    }, 10 * 60 * 1000) // 10 minutes
  }, [isLocked])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart']
    const handler = () => resetInactivityTimer()

    events.forEach(event => {
      window.addEventListener(event, handler)
    })

    resetInactivityTimer()

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handler)
      })
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [resetInactivityTimer])

  // Fetch assigned view tasks
  const fetchAssignedViews = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/project-management/workspace/views')
      setAssignedViews(res.data)
      if (res.data.length > 0 && !selectedView) {
        setSelectedView(res.data[0])
      } else if (res.data.length > 0 && selectedView) {
        // Refresh selected view ref
        const refreshed = res.data.find((v: AssignedView) => v.id === selectedView.id)
        if (refreshed) setSelectedView(refreshed)
      }
      setIsLocked(false)
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.error === 'restricted_workspace') {
        setIsLocked(true)
        setLockMessage(err.response.data.message)
      } else {
        toast.error('Failed to load assigned views workspace')
      }
    } finally {
      setLoading(false)
    }
  }, [selectedView])

  // Fetch review comments
  const fetchReviewComments = useCallback(async () => {
    try {
      const res = await api.get('/project-management/workspace/reviews')
      setCommentsHistory(res.data)
    } catch {}
  }, [])

  // Fetch audit logs
  const fetchEmployeeAuditLogs = useCallback(async () => {
    try {
      const res = await api.get('/project-management/workspace/audit-logs')
      setEmployeeAuditLogs(res.data)
    } catch {}
  }, [])

  useEffect(() => {
    checkSessionStatus()
    fetchAssignedViews()
    fetchReviewComments()
  }, [fetchAssignedViews, fetchReviewComments, checkSessionStatus])

  // Load checklist response for selected view
  useEffect(() => {
    if (selectedView) {
      api.get(`/project-management/checklists/view/${selectedView.id}`)
        .then(res => {
          setChecklistResponse(res.data)
        })
        .catch(() => {
          setChecklistResponse(null)
        })
    } else {
      setChecklistResponse(null)
    }
  }, [selectedView])

  // Refresh logs when tab changes to audit
  useEffect(() => {
    if (activeTab === 'audit') {
      fetchEmployeeAuditLogs()
    }
  }, [activeTab, fetchEmployeeAuditLogs])

  // Autosave checklists with debouncing reference
  const autosaveTimeoutRef = useRef<any>(null)

  const triggerAutosave = useCallback(async (updatedAnswers: ChecklistAnswer[]) => {
    if (!selectedView || !checklistResponse) return

    setSavingChecklist(true)
    try {
      const res = await api.put(`/project-management/checklists/view/${selectedView.id}/autosave`, {
        answers: updatedAnswers
      })
      setChecklistResponse(res.data)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Checklist autosave failed')
    } finally {
      setSavingChecklist(false)
    }
  }, [selectedView, checklistResponse])

  // Update pass/fail response
  const handleUpdateResponse = (itemId: string, response: 'Pass' | 'Fail' | 'None') => {
    if (!checklistResponse || !selectedView) return
    if (selectedView.status === 'Submitted For Review' || selectedView.status === 'Completed') {
      toast.warning('Checklist is locked while view is under review or completed')
      return
    }

    const updated = checklistResponse.answers.map(ans => {
      if (ans.itemId === itemId) {
        return { ...ans, response }
      }
      return ans
    })

    setChecklistResponse(prev => prev ? {
      ...prev,
      answers: updated,
      completedCount: updated.filter(a => a.response === 'Pass' || a.response === 'Fail').length
    } : null)

    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current)
    autosaveTimeoutRef.current = setTimeout(() => {
      triggerAutosave(updated)
    }, 800)
  }

  // Update notes/remarks
  const handleUpdateText = (itemId: string, field: 'notes' | 'remarks', val: string) => {
    if (!checklistResponse || !selectedView) return
    if (selectedView.status === 'Submitted For Review' || selectedView.status === 'Completed') return

    const updated = checklistResponse.answers.map(ans => {
      if (ans.itemId === itemId) {
        return { ...ans, [field]: val }
      }
      return ans
    })

    setChecklistResponse(prev => prev ? { ...prev, answers: updated } : null)

    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current)
    autosaveTimeoutRef.current = setTimeout(() => {
      triggerAutosave(updated)
    }, 1200)
  }

  // Update layout stage
  const handleStageChange = async (targetStage: string) => {
    if (!selectedView) return
    try {
      const res = await api.post(`/project-management/views/${selectedView.id}/stage`, {
        stage: targetStage
      })
      setSelectedView(res.data)
      fetchAssignedViews()
      toast.success(`Workflow progressed to: ${targetStage}`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Stage update failed')
    }
  }

  // Submit standard view or layout checkpoints
  const handleSubmitReview = async () => {
    if (!selectedView) return
    try {
      const res = await api.post(`/project-management/views/${selectedView.id}/submit`)
      setSelectedView(res.data)
      fetchAssignedViews()
      fetchReviewComments()
      toast.success('View submitted successfully. Workspace locked awaiting review.')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed')
    }
  }

  // Helpers to count mandatory checklist compliance
  const getMandatoryStats = () => {
    if (!checklistResponse) return { completed: 0, total: 0, compliant: true }
    const viewItems = checklistResponse.answers.filter(item => item.isMandatory)
    const completedCount = viewItems.filter(item => item.response === 'Pass' || item.response === 'Fail').length
    return {
      completed: completedCount,
      total: viewItems.length,
      compliant: completedCount === viewItems.length
    }
  }

  const mandatoryStats = getMandatoryStats()
  const isViewLocked = selectedView?.status === 'Submitted For Review' || selectedView?.status === 'Completed'

  return (
    <PageWrapper fillViewport>
      {/* Session Lock Overlay Guard */}
      {isLocked && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex flex-col justify-center items-center p-6 text-center animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 max-w-md border border-slate-100 shadow-2xl flex flex-col items-center gap-6">
            <div className="bg-rose-50 p-4 rounded-full text-rose-500 animate-pulse">
              <Lock className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Workspace Locked</h2>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                {lockMessage || 'Workspace requires an active working attendance session. Please check in and start a task to continue.'}
              </p>
            </div>
            <a
              href="/employee/timesheet"
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3 px-4 text-xs font-bold transition-all shadow-md hover:shadow-lg"
            >
              Go to Timesheet Board
              <ArrowRight className="h-4 w-4" />
            </a>
            <Button
              variant="secondary"
              onClick={checkSessionStatus}
              className="text-[11px] font-bold text-slate-500 border-none hover:bg-slate-50 mt-1"
            >
              Verify Active Status Again
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 p-6 max-w-[1600px] mx-auto min-h-0 flex-1 w-full relative">
        <div className="flex flex-col gap-1.5 pb-2 border-b border-slate-100">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Project Workspace</h1>
          <p className="text-xs text-slate-500 font-medium">My Assigned Workspaces</p>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-6 min-h-0 flex-1">
          {/* Left Side: Assigned Views List */}
          <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 leading-none">Assigned Views</h3>
              
              {loading && assignedViews.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">Loading tasks...</p>
              ) : assignedViews.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">No view tasks assigned to you.</p>
              ) : (
                <div className="space-y-2 max-h-[350px] lg:max-h-[500px] overflow-y-auto pr-1">
                  {assignedViews.map(v => {
                    const active = selectedView?.id === v.id
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedView(v)}
                        className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex flex-col gap-2 ${
                          active
                            ? 'border-[var(--emerald-dark)] bg-emerald-50/20 shadow-sm'
                            : 'border-slate-100 bg-slate-50 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-slate-900 truncate">{v.projectName}</span>
                          <Badge variant={v.status === 'Completed' ? 'success' : v.status === 'Submitted For Review' ? 'warning' : 'neutral'}>
                            {v.status}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium leading-tight">
                          {v.libraryName} / {v.cellName} — <span className="font-bold text-slate-800">{v.viewType}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] border-t border-slate-200/50 pt-1.5 mt-0.5">
                          <span className="text-slate-400 font-semibold">Stage: {v.currentStage}</span>
                          <span className="font-mono font-bold text-slate-600">{v.progress}%</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Employee Reviews & comments log panel */}
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card flex-1 flex flex-col min-h-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 leading-none">Review Comments & History</h3>
              <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[250px] lg:max-h-none text-xs">
                {commentsHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium">No review events logged yet.</p>
                ) : (
                  commentsHistory.map(comment => (
                    <div key={comment.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-800">{comment.cellName} ({comment.viewType})</span>
                        <Badge variant={comment.status === 'Approved' ? 'success' : comment.status === 'Rejected' ? 'danger' : 'neutral'}>
                          {comment.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-none">Review: {comment.reviewType} • {new Date(comment.createdAt).toLocaleDateString()}</p>
                      {comment.comments && (
                        <p className="mt-2 text-slate-600 italic bg-white p-2 rounded border border-slate-100 leading-relaxed">" {comment.comments} "</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Workspace Canvas */}
          <div className="flex-1 bg-white rounded-2xl border border-border p-5 shadow-card min-h-0 flex flex-col gap-6">
            {selectedView ? (
              <div className="flex-1 flex flex-col gap-5 min-h-0 animate-fadeIn">
                
                {/* Header Details */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4 shrink-0">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-tight">{selectedView.projectName} — {selectedView.cellName}</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Library: {selectedView.libraryName} • Checklist Type: {selectedView.checklistType}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {savingChecklist && <span className="text-[10px] font-bold text-[var(--emerald-dark)] animate-pulse">Autosaving...</span>}
                    <Badge variant={selectedView.status === 'Completed' ? 'success' : selectedView.status === 'Submitted For Review' ? 'warning' : 'neutral'}>
                      Status: {selectedView.status}
                    </Badge>
                    <span className="font-mono text-xs bg-slate-100 px-3 py-1.5 rounded-lg text-slate-800 font-bold">Progress: {selectedView.progress}%</span>
                  </div>
                </div>

                {/* Layout Stage Progression Editor */}
                {selectedView.viewType === 'Layout' && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-3 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">Layout stages workflow</span>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      {[
                        { stage: 'Floor Plan', label: 'Floor Plan' },
                        { stage: 'DRC Review', label: 'DRC Review' },
                        { stage: 'Routing', label: 'Routing' },
                        { stage: 'DRC', label: 'DRC' },
                        { stage: 'LVS', label: 'LVS' },
                        { stage: 'Submit For Review', label: 'Final Review' }
                      ].map((step, idx) => {
                        const completed = selectedView.completedStages.includes(step.stage)
                        const active = selectedView.currentStage === step.stage
                        const checkpointGate = idx > 2 && selectedView.checkpointStatus.checkpoint1 !== 'Approved'
                        
                        return (
                          <button
                            key={step.stage}
                            disabled={isViewLocked || checkpointGate}
                            onClick={() => handleStageChange(step.stage)}
                            className={`p-2 rounded-lg border text-center transition-all text-xs font-semibold ${
                              active
                                ? 'border-blue-500 bg-blue-50/20 text-blue-700 font-bold shadow-sm'
                                : completed
                                  ? 'bg-emerald-55/40 border-emerald-100 text-emerald-700 font-medium'
                                  : 'bg-slate-100/60 border-transparent text-slate-400'
                            } ${checkpointGate ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <div className="text-[10px] leading-tight mb-1">Step {idx + 1}</div>
                            <div className="truncate">{step.label}</div>
                          </button>
                        )
                      })}
                    </div>
                    
                    {/* Gate Locks Warning */}
                    {selectedView.currentStage === 'DRC Review' && selectedView.checkpointStatus.checkpoint1 !== 'Approved' && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold leading-none mt-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Submit Checkpoint 1 below to unlock Routing stage.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Submissions Control Panel */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                  <div className="text-xs">
                    <span className="font-bold text-slate-700">Mandatory Checklist Requirements:</span>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Completed: <span className="font-bold text-slate-800">{mandatoryStats.completed} / {mandatoryStats.total}</span> mandatory items.
                    </div>
                  </div>
                  
                  <Button
                    disabled={isViewLocked || !mandatoryStats.compliant}
                    onClick={handleSubmitReview}
                    className="bg-[var(--emerald-dark)] hover:bg-emerald-800 text-white font-bold h-9 px-4 text-xs flex items-center gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {selectedView.viewType === 'Layout'
                      ? selectedView.currentStage === 'DRC Review'
                        ? 'Submit Checkpoint 1'
                        : 'Submit Final Review'
                      : 'Submit View for Review'}
                  </Button>
                </div>

                {/* Tabs selection: Checklist responses vs Audit logs */}
                <div className="flex border-b border-slate-100 pb-px shrink-0 gap-4">
                  <button
                    onClick={() => setActiveTab('checklist')}
                    className={`flex items-center gap-1.5 pb-2.5 text-xs font-bold border-b-2 transition-all ${
                      activeTab === 'checklist'
                        ? 'border-[var(--emerald-dark)] text-slate-800'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <ClipboardList className="h-4 w-4" />
                    Workspace Checklist
                  </button>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`flex items-center gap-1.5 pb-2.5 text-xs font-bold border-b-2 transition-all ${
                      activeTab === 'audit'
                        ? 'border-[var(--emerald-dark)] text-slate-800'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <History className="h-4 w-4" />
                    My Audit Logs
                  </button>
                </div>

                {/* Tab Canvas panels */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {activeTab === 'checklist' && (
                    <div className="space-y-4">
                      {checklistResponse ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {checklistResponse.answers.map((answer) => (
                            <div key={answer.itemId} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
                              <div className="flex justify-between items-start gap-2">
                                <span className="bg-slate-100 text-slate-650 font-bold px-2 py-0.5 rounded text-[9px] uppercase">
                                  {answer.category}
                                </span>
                                {answer.isMandatory && (
                                  <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[9px] uppercase">
                                    Mandatory
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-xs text-slate-800 font-semibold leading-relaxed flex-1">
                                {answer.text}
                              </p>

                              {/* Pass/Fail/None Button Group */}
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  disabled={isViewLocked}
                                  onClick={() => handleUpdateResponse(answer.itemId, 'Pass')}
                                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold border transition-all text-center text-[10px] flex items-center justify-center gap-1 ${
                                    answer.response === 'Pass'
                                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-200'
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Pass
                                </button>
                                <button
                                  disabled={isViewLocked}
                                  onClick={() => handleUpdateResponse(answer.itemId, 'Fail')}
                                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold border transition-all text-center text-[10px] flex items-center justify-center gap-1 ${
                                    answer.response === 'Fail'
                                      ? 'bg-red-500 border-red-500 text-white shadow-sm shadow-red-200'
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  <XCircle className="h-3 w-3" />
                                  Fail
                                </button>
                                <button
                                  disabled={isViewLocked}
                                  onClick={() => handleUpdateResponse(answer.itemId, 'None')}
                                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold border transition-all text-center text-[10px] flex items-center justify-center gap-1 ${
                                    answer.response === 'None'
                                      ? 'bg-slate-500 border-slate-500 text-white shadow-sm shadow-slate-200'
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  <Clock className="h-3 w-3" />
                                  None
                                </button>
                              </div>

                              {/* Notes & Remarks inputs */}
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <input
                                  type="text"
                                  disabled={isViewLocked}
                                  value={answer.notes || ''}
                                  onChange={e => handleUpdateText(answer.itemId, 'notes', e.target.value)}
                                  placeholder="Execution comments..."
                                  className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-[11px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-200 font-medium"
                                />
                                <input
                                  type="text"
                                  disabled={isViewLocked}
                                  value={answer.remarks || ''}
                                  onChange={e => handleUpdateText(answer.itemId, 'remarks', e.target.value)}
                                  placeholder="Remarks..."
                                  className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-[11px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-200 font-medium"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-8">No view-specific checklist responses loaded.</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'audit' && (
                    <div className="space-y-4">
                      {employeeAuditLogs.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8">No audit log records found for this workspace.</p>
                      ) : (
                        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-55 border-b border-slate-100 text-slate-550 font-bold">
                                <th className="py-2.5 px-3 w-36">Time</th>
                                <th className="py-2.5 px-3 w-40">Action</th>
                                <th className="py-2.5 px-3">Details</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employeeAuditLogs.map((log) => (
                                <tr key={log._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                  <td className="py-3 px-3 text-slate-500 font-semibold">
                                    {new Date(log.timestamp).toLocaleString()}
                                  </td>
                                  <td className="py-3 px-3">
                                    <Badge variant={log.action.toLowerCase().includes('pause') ? 'warning' : 'neutral'}>
                                      {log.action}
                                    </Badge>
                                  </td>
                                  <td className="py-3 px-3 text-slate-700 leading-normal font-semibold">
                                    {log.details}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center gap-2 text-slate-400">
                <Layers className="h-10 w-10 text-slate-300 animate-pulse" />
                <p className="text-sm font-semibold">Select an assigned view task from the sidebar to begin.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
export default EmployeeWorkspace
