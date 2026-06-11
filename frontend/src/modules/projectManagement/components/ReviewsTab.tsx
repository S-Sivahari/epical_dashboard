import { useEffect, useState, useCallback } from 'react'
import api from '@/services/api'
import { Spinner } from '@components/ui/Spinner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { toast } from 'sonner'
import {
  UserCheck,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  AlertTriangle,
  ChevronRight,
  ClipboardList
} from 'lucide-react'

interface Review {
  id: string
  viewId: string
  viewType: 'Schematic' | 'Symbol' | 'Layout'
  reviewType: 'Standard' | 'Checkpoint 1' | 'Checkpoint 2'
  status: 'Pending' | 'Approved' | 'Rejected'
  comments?: string
  correctiveAction?: string
  returnStage?: string
  submittedBy: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  cellName: string
  libraryName: string
  projectName: string
  stagesCompleted: string[]
}

interface ReviewQueues {
  pendingReviews: Review[]
  checkpoint1Reviews: Review[]
  checkpoint2Reviews: Review[]
  rejectedWork: Review[]
  approvedWork: Review[]
  recentlySubmitted: Review[]
}

interface ChecklistResponse {
  _id: string
  answers: {
    itemId: string
    text: string
    category: string
    isMandatory: boolean
    response: 'Pass' | 'Fail' | 'None'
    notes?: string
    remarks?: string
  }[]
  completedCount: number
  totalCount: number
}

export function ReviewsTab() {
  const [queues, setQueues] = useState<ReviewQueues | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeQueue, setActiveQueue] = useState<'pending' | 'checkpoint1' | 'checkpoint2' | 'approved' | 'rejected'>('pending')

  // Action modal states
  const [actionOpen, setActionOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [actionType, setActionType] = useState<'Approve' | 'Reject'>('Approve')

  // Form states
  const [comments, setComments] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [returnStage, setReturnStage] = useState('')

  // Checklist view state
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [checklistData, setChecklistData] = useState<ChecklistResponse | null>(null)
  const [loadingChecklist, setLoadingChecklist] = useState(false)

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/project-management/reviews/admin')
      setQueues(res.data)
    } catch {
      toast.error('Failed to load review queues')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const openActionModal = (review: Review, type: 'Approve' | 'Reject') => {
    setSelectedReview(review)
    setActionType(type)
    setComments('')
    setCorrectiveAction('')
    
    // Default return stage depending on view type and checkpoint type
    if (review.viewType === 'Layout') {
      if (review.reviewType === 'Checkpoint 1') {
        setReturnStage('Floor Plan')
      } else {
        setReturnStage('Routing')
      }
    } else {
      setReturnStage('Design')
    }
    
    setActionOpen(true)
  }

  const openChecklistModal = async (review: Review) => {
    try {
      setLoadingChecklist(true)
      setChecklistOpen(true)
      const res = await api.get(`/project-management/checklists/view/${review.viewId}`)
      setChecklistData(res.data)
    } catch {
      toast.error('Checklist response not found for this view')
      setChecklistOpen(false)
    } finally {
      setLoadingChecklist(false)
    }
  }

  const handleAction = async () => {
    if (!selectedReview) return

    if (actionType === 'Reject') {
      if (!comments.trim()) {
        toast.error('Rejection reason (comments) is required')
        return
      }
      if (!correctiveAction.trim()) {
        toast.error('Corrective action is required')
        return
      }
      if (!returnStage) {
        toast.error('Return stage is required')
        return
      }
    }

    try {
      const status = actionType === 'Approve' ? 'Approved' : 'Rejected'
      await api.post(`/project-management/reviews/${selectedReview.id}/action`, {
        status,
        comments: comments.trim(),
        correctiveAction: actionType === 'Reject' ? correctiveAction.trim() : undefined,
        returnStage: actionType === 'Reject' ? returnStage : undefined
      })
      toast.success(`Submission successfully ${status === 'Approved' ? 'approved' : 'rejected'}`)
      setActionOpen(false)
      fetchReviews()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-emerald-650" />
      </div>
    )
  }

  const reviewList = queues
    ? activeQueue === 'pending'
      ? queues.pendingReviews
      : activeQueue === 'checkpoint1'
      ? queues.checkpoint1Reviews
      : activeQueue === 'checkpoint2'
      ? queues.checkpoint2Reviews
      : activeQueue === 'approved'
      ? queues.approvedWork
      : queues.rejectedWork
    : []

  const tabs = [
    { id: 'pending', label: 'Standard Reviews', count: queues?.pendingReviews.length || 0, icon: Clock },
    { id: 'checkpoint1', label: 'Checkpoint 1 (FP/DRC)', count: queues?.checkpoint1Reviews.length || 0, icon: AlertTriangle },
    { id: 'checkpoint2', label: 'Checkpoint 2 (DRC/LVS)', count: queues?.checkpoint2Reviews.length || 0, icon: UserCheck },
    { id: 'approved', label: 'Approved History', count: queues?.approvedWork.length || 0, icon: CheckCircle },
    { id: 'rejected', label: 'Rejected / Rework', count: queues?.rejectedWork.length || 0, icon: XCircle }
  ]

  // Layout return stages depending on review type
  const getLayoutReturnStages = (review: Review) => {
    if (review.reviewType === 'Checkpoint 1') {
      return [
        { value: 'Floor Plan', label: 'Floor Plan' },
        { value: 'DRC Review', label: 'DRC Review' }
      ]
    } else {
      return [
        { value: 'Floor Plan', label: 'Floor Plan' },
        { value: 'DRC Review', label: 'DRC Review' },
        { value: 'Routing', label: 'Routing' },
        { value: 'DRC', label: 'DRC' },
        { value: 'LVS', label: 'LVS' },
        { value: 'Submit For Review', label: 'Submit For Review' }
      ]
    }
  }

  // Draw the stage pipeline color indicators
  const renderPipeline = (review: Review) => {
    if (review.viewType !== 'Layout') return null

    const PIPELINE_STEPS = [
      { key: 'Floor Plan', label: 'Floor Plan', isCheckpoint: false },
      { key: 'DRC Review', label: 'DRC Review', isCheckpoint: false },
      { key: 'Checkpoint 1', label: 'Checkpoint 1', isCheckpoint: true },
      { key: 'Routing', label: 'Routing', isCheckpoint: false },
      { key: 'DRC', label: 'DRC', isCheckpoint: false },
      { key: 'LVS', label: 'LVS', isCheckpoint: false },
      { key: 'Submit For Review', label: 'Submit', isCheckpoint: false },
      { key: 'Checkpoint 2', label: 'Checkpoint 2', isCheckpoint: true },
      { key: 'Completed', label: 'Completed', isCheckpoint: false }
    ]

    // Determine current index & status values
    const completedSet = new Set(review.stagesCompleted || [])
    const isActive = review.status === 'Pending'
    const isApproved = review.status === 'Approved'
    const isRejected = review.status === 'Rejected'

    return (
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Layout Workflow Progress</span>
        <div className="flex flex-wrap items-center gap-y-3 gap-x-2 text-xs">
          {PIPELINE_STEPS.map((step, index) => {
            let color = 'bg-slate-200 text-slate-500 border-transparent'
            let statusLabel = 'Pending'

            if (step.isCheckpoint) {
              if (step.key === 'Checkpoint 1') {
                if (completedSet.has('Routing') || completedSet.has('DRC') || completedSet.has('LVS') || completedSet.has('Submit For Review') || review.reviewType === 'Checkpoint 2' || isApproved) {
                  color = 'bg-emerald-500 text-white border-transparent'
                  statusLabel = 'Approved'
                } else if (review.reviewType === 'Checkpoint 1') {
                  if (isActive) {
                    color = 'bg-blue-500 text-white border-transparent animate-pulse'
                    statusLabel = 'Pending Review'
                  } else if (isRejected) {
                    color = 'bg-red-500 text-white border-transparent'
                    statusLabel = 'Rejected'
                  }
                }
              } else if (step.key === 'Checkpoint 2') {
                if (isApproved) {
                  color = 'bg-emerald-500 text-white border-transparent'
                  statusLabel = 'Approved'
                } else if (review.reviewType === 'Checkpoint 2') {
                  if (isActive) {
                    color = 'bg-blue-500 text-white border-transparent animate-pulse'
                    statusLabel = 'Pending Review'
                  } else if (isRejected) {
                    color = 'bg-red-500 text-white border-transparent'
                    statusLabel = 'Rejected'
                  }
                }
              }
            } else {
              if (step.key === 'Completed') {
                if (isApproved) {
                  color = 'bg-emerald-500 text-white border-transparent'
                  statusLabel = 'Completed'
                }
              } else {
                if (completedSet.has(step.key)) {
                  color = 'bg-emerald-500 text-white border-transparent'
                  statusLabel = 'Completed'
                } else if (review.status === 'Pending' && review.reviewType === 'Checkpoint 1' && step.key === 'DRC Review') {
                  // Currently waiting for checkpoint 1
                  color = 'bg-blue-500 text-white border-transparent'
                  statusLabel = 'Active'
                } else if (review.status === 'Pending' && review.reviewType === 'Checkpoint 2' && step.key === 'Submit For Review') {
                  // Currently waiting for checkpoint 2
                  color = 'bg-blue-500 text-white border-transparent'
                  statusLabel = 'Active'
                }
              }
            }

            return (
              <div key={step.key} className="flex items-center gap-1">
                <div
                  className={`px-3 py-1.5 rounded-lg border font-bold text-[10px] uppercase shadow-sm ${color}`}
                  title={`${step.label}: ${statusLabel}`}
                >
                  {step.label}
                </div>
                {index < PIPELINE_STEPS.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Queues Navigation Toolbar */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px shrink-0">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveQueue(tab.id as any)}
              className={`flex items-center gap-2.5 px-4 py-3 text-xs font-bold transition-all border-b-2 hover:text-emerald-600 leading-tight whitespace-nowrap ${
                activeQueue === tab.id
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50/10'
                  : 'border-transparent text-slate-500'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
              <span className="bg-slate-100 text-slate-600 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Review Queue Items */}
      {reviewList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-bold text-xs">
          No reviews in this queue.
        </div>
      ) : (
        <div className="space-y-4">
          {reviewList.map(review => (
            <div key={review.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between gap-5 hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 h-fit">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800 text-sm">{review.cellName}</h4>
                      <Badge variant="neutral">{review.viewType}</Badge>
                      <Badge variant={
                        review.reviewType === 'Checkpoint 2' ? 'success' : 
                        review.reviewType === 'Checkpoint 1' ? 'warning' : 'neutral'
                      }>
                        {review.reviewType}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Project: <span className="text-slate-600">{review.projectName}</span> • Library: <span className="text-slate-600">{review.libraryName}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Submitted by: <span className="text-slate-600 font-bold">{review.submittedBy}</span> • Date: {new Date(review.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 text-right shrink-0">
                  <Badge variant={
                    review.status === 'Approved' ? 'success' : 
                    review.status === 'Rejected' ? 'danger' : 'warning'
                  }>
                    {review.status}
                  </Badge>
                  {review.reviewedBy && (
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Reviewed by: {review.reviewedBy} on {review.reviewedAt ? new Date(review.reviewedAt).toLocaleDateString() : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Render visual progress pipeline for Layout views */}
              {renderPipeline(review)}

              {/* Comments / Rejection Details */}
              {(review.comments || review.correctiveAction) && (
                <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4 space-y-2 text-xs">
                  {review.comments && (
                    <p className="text-slate-700 leading-normal font-semibold">
                      <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] mb-0.5">Remarks / Comments</span>
                      {review.comments}
                    </p>
                  )}
                  {review.correctiveAction && (
                    <p className="text-slate-700 leading-normal font-semibold">
                      <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] mb-0.5">Required Corrective Action</span>
                      {review.correctiveAction}
                    </p>
                  )}
                  {review.returnStage && (
                    <p className="text-slate-700 font-bold">
                      <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] mb-0.5">Returned To Stage</span>
                      <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded text-[10px]">{review.returnStage}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-3 gap-2">
                <Button
                  onClick={() => openChecklistModal(review)}
                  className="h-8 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center rounded-lg gap-1.5"
                >
                  <ClipboardList className="h-4 w-4" />
                  View Checklist Responses
                </Button>

                {review.status === 'Pending' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => openActionModal(review, 'Reject')}
                      className="h-8 px-3.5 border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center justify-center rounded-lg"
                    >
                      Reject / Rework
                    </Button>
                    <Button
                      onClick={() => openActionModal(review, 'Approve')}
                      className="h-8 px-4 bg-[var(--emerald-dark)] hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center rounded-lg"
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW CHECKLIST RESPONSES MODAL */}
      <Modal isOpen={checklistOpen} onClose={() => setChecklistOpen(false)} title="Checklist Responses Detail">
        <div className="p-4 text-xs font-semibold max-h-[600px] overflow-y-auto">
          {loadingChecklist ? (
            <div className="flex justify-center py-6">
              <Spinner className="h-6 w-6 text-emerald-600" />
            </div>
          ) : checklistData ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Total Answers:</span>
                <span className="font-bold text-slate-800">{checklistData.completedCount} / {checklistData.totalCount} completed</span>
              </div>
              <div className="space-y-3">
                {checklistData.answers.map((answer) => (
                  <div key={answer.itemId} className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[9px] uppercase">
                        {answer.category}
                      </span>
                      <div className="flex gap-2">
                        {answer.isMandatory && (
                          <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[9px] uppercase">
                            Mandatory
                          </span>
                        )}
                        <Badge variant={answer.response === 'Pass' ? 'success' : answer.response === 'Fail' ? 'danger' : 'neutral'}>
                          {answer.response}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-slate-800 leading-relaxed font-semibold">{answer.text}</p>
                    {answer.notes && (
                      <p className="text-slate-500 font-medium bg-slate-50 p-2 rounded text-[11px] leading-relaxed">
                        <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider block mb-0.5">Notes</span>
                        {answer.notes}
                      </p>
                    )}
                    {answer.remarks && (
                      <p className="text-slate-500 font-medium bg-slate-50 p-2 rounded text-[11px] leading-relaxed">
                        <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider block mb-0.5">Remarks</span>
                        {answer.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-4">No checklist responses logged for this submission.</p>
          )}
          <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
            <Button variant="secondary" onClick={() => setChecklistOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* APPROVAL / REJECTION DIALOG */}
      <Modal isOpen={actionOpen} onClose={() => setActionOpen(false)} title={`${actionType} Review Submission`}>
        <div className="space-y-4 p-4 text-xs font-semibold">
          {actionType === 'Approve' ? (
            <div className="space-y-3">
              <p className="text-slate-600 font-medium leading-relaxed">
                Are you sure you want to approve this workspace submission? This will advance the layout workflow or complete the view.
              </p>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-500 uppercase">Approval Remarks (Optional)</label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="e.g. Layout complies with Floorplan rules, proceed to routing."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:bg-white focus:outline-none min-h-[80px]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-500 uppercase">Rejection Reason (Comments)</label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Describe the failure, e.g. Antenna DRC violations found in DRC Review."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:bg-white focus:outline-none min-h-[80px]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-500 uppercase">Corrective Action Required</label>
                <textarea
                  value={correctiveAction}
                  onChange={e => setCorrectiveAction(e.target.value)}
                  placeholder="Detail the steps for the employee, e.g. Reroute M3 power rail and fix width."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:bg-white focus:outline-none min-h-[80px]"
                />
              </div>

              {selectedReview?.viewType === 'Layout' && (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500 uppercase">Return to Stage</label>
                  <select
                    value={returnStage}
                    onChange={e => setReturnStage(e.target.value)}
                    className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
                  >
                    {selectedReview && getLayoutReturnStages(selectedReview).map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-rose-500 font-bold leading-normal mt-0.5">
                    Checkpoint workflow rule: Rejection redirects employee progress back to this stage.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAction}
              className={actionType === 'Approve' ? 'bg-[var(--emerald-dark)] text-white hover:bg-emerald-800' : 'bg-rose-600 text-white hover:bg-rose-700'}
            >
              Confirm {actionType}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
export default ReviewsTab
