import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { EmployeeCellChecklistSidebar } from '@components/employee/projects/EmployeeCellChecklistSidebar'
import { EmployeeCellWorkflowPanel } from '@components/employee/projects/EmployeeCellWorkflowPanel'
import {
  EmployeeCellViewStatusButtons,
  getEmployeeViewStatus,
} from '@components/employee/projects/EmployeeCellViewStatusButtons'
import { CellDetailsSummary } from '@pages/admin/Projects/CellDetailsSummary'
import {
  fetchMyCell,
  requestCellReview,
  resolveMyCellReview,
  updateCellWorkflow,
} from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import { cn } from '@pages/employee/lib/utils'
import { VIEW_TABS, getAdvancePayload, isFinalLayoutStage } from '@/utils/cellWorkflowUi'
import { cellDisplayStatus } from '@pages/admin/Projects/projectWorkspaceUi'
import '@pages/admin/Projects/adminProjects.css'
import '@components/employee/projects/employeeProjectWorkflow.css'
import '@components/employee/projects/employeeProjectsAdminTheme.css'

export default function EmployeeCellWorkflow() {
  const { projectId = '', cellId = '' } = useParams()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewTab, setViewTab] = useState('layout')
  const [checklistReady, setChecklistReady] = useState(true)
  const { toast } = useToast()

  const reload = useCallback(async () => {
    if (!projectId || !cellId) return
    setLoading(true)
    try {
      const data = await fetchMyCell(projectId, cellId)
      setDetail(data)
    } catch {
      toast({ title: 'Error', description: 'Failed to load cell workflow' })
    } finally {
      setLoading(false)
    }
  }, [projectId, cellId, toast])

  useEffect(() => {
    void reload()
  }, [reload])

  const updateCellInState = (updatedCell) => {
    setDetail((prev) => (prev ? { ...prev, cell: { ...prev.cell, ...updatedCell } } : prev))
  }

  const handleWorkflowUpdate = async (payload) => {
    if (!projectId || !cellId || !detail?.cell?.isAssignedToMe) return
    setSaving(true)
    try {
      const updated = await updateCellWorkflow(projectId, cellId, payload)
      updateCellInState(updated)

      if (payload.view === 'layout' && payload.action === 'set_status' && payload.status === 'completed') {
        const advancePayload = getAdvancePayload(updated, 'layout')
        if (advancePayload?.view && advancePayload.action === 'advance_stage') {
          const advanced = await updateCellWorkflow(projectId, cellId, advancePayload)
          updateCellInState(advanced)
        }
      }

      toast({ title: 'Stage updated', description: 'Workflow status saved' })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to update workflow' })
    } finally {
      setSaving(false)
    }
  }

  const handleViewStatusChange = async (viewKey, status) => {
    await handleWorkflowUpdate({ view: viewKey, action: 'set_status', status })
  }

  const handleRequestReview = async () => {
    if (!projectId || !cellId || !detail?.cell?.isAssignedToMe) return
    setSaving(true)
    try {
      const result = await requestCellReview(projectId, cellId)
      setDetail((prev) => (prev ? { ...prev, cell: { ...prev.cell, ...result.cell }, reviews: [result.review, ...(prev.reviews || [])] } : prev))
      await reload()
      toast({ title: 'Review requested', description: 'Team lead will review your submission.' })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to request review' })
    } finally {
      setSaving(false)
    }
  }

  const handleResolveReview = async (reviewId, outcome, returnToStage = undefined) => {
    if (!projectId || !cellId || !detail?.isTeamLead) return
    setSaving(true)
    try {
      const result = await resolveMyCellReview(projectId, cellId, reviewId, { outcome, returnToStage })
      setDetail((prev) => (prev ? { ...prev, cell: { ...prev.cell, ...result.cell }, reviews: (prev.reviews || []).map((r) => (r.id === reviewId ? result.review : r)) } : prev))
      await reload()
      toast({ title: 'Review updated', description: `Review ${outcome}.` })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to resolve review' })
    } finally {
      setSaving(false)
    }
  }

  if (loading && !detail) {
    return (
      <div className="admin-projects-employee-workspace" data-employee-project-cell>
        <p className="px-4 py-8 text-center text-sm text-slate-500">Loading cell workflow…</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="admin-projects-employee-workspace" data-employee-project-cell>
        <p className="px-4 py-8 text-center text-sm text-slate-500">Cell not found.</p>
      </div>
    )
  }

  const { cell, library, project, reviews, isTeamLead } = detail
  const openReview = (reviews || []).find((review) => review.status === 'open') || null

  return (
    <div className="admin-projects-employee-workspace admin-projects-employee-cell-shell" data-employee-project-cell>
      <div className="admin-projects-workspace-shell admin-projects-workspace-chrome">
        <header className="admin-projects-workspace-head admin-projects-workspace-head--cell admin-projects-cell-page-head">
          <div className="admin-projects-cell-head-top">
            <Link
              to={`/employee/projects/${projectId}`}
              className="admin-projects-back-btn admin-projects-back-btn--icon-only"
              aria-label={`Back to ${project.name}`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
            <div className="admin-projects-cell-head-identity">
              <h1 className="admin-projects-head-title">{cell.name}</h1>
              <p className="admin-projects-workspace-meta">
                {library?.name || 'Library'} · Cell workflow · {cellDisplayStatus(cell)}
              </p>
            </div>
            <div className="admin-projects-workspace-head-actions">
              <span
                className={cn(
                  'admin-projects-status-chip admin-projects-status-chip--lg',
                  cell.isBlocked && 'is-blocked',
                  cell.isReady && 'is-ready',
                  cell.status === 'completed' && 'is-completed',
                  cell.status === 'in_progress' && !cell.isBlocked && 'is-progress',
                )}
              >
                {cellDisplayStatus(cell)}
              </span>
              {cell.isAssignedToMe ? (
                <span className="admin-projects-employee-assigned-badge">Yours</span>
              ) : null}
              {isTeamLead ? (
                <span className="admin-projects-employee-assigned-badge">Team Lead</span>
              ) : null}
            </div>
          </div>
        </header>

        <div className="admin-projects-cell-page-body admin-projects-cell-page-body--employee">
          <div className="admin-projects-employee-cell-toolbar">
            <CellDetailsSummary cell={cell} libraryName={library?.name} variant="employee" />
          </div>

          <div className="admin-projects-employee-cell-main">
            <section className="admin-projects-cell-details-views-panel" aria-label="Cell views">
              <div className="admin-projects-cell-details-views-panel-head">
                <p className="admin-projects-cell-details-main-label">Views</p>
                <div className="admin-projects-pill-rail">
                  {VIEW_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setViewTab(tab.id)}
                      className={cn('admin-projects-pill-btn', viewTab === tab.id && 'is-active')}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-projects-cell-details-views-panel-body">
                <div className="admin-projects-cell-details-view-box">
                  {viewTab === 'layout' ? (
                    <EmployeeCellWorkflowPanel
                      cell={cell}
                      saving={saving}
                      checklistReady={checklistReady}
                      isTeamLead={isTeamLead}
                      openReview={openReview}
                      onStatusChange={handleWorkflowUpdate}
                      onRequestReview={handleRequestReview}
                      onResolveReview={handleResolveReview}
                    />
                  ) : (
                    <EmployeeCellViewStatusButtons
                      status={getEmployeeViewStatus(cell, viewTab)}
                      disabled={saving || !cell.isAssignedToMe}
                      onChange={(status) => void handleViewStatusChange(viewTab, status)}
                    />
                  )}
                </div>
              </div>
            </section>

            <EmployeeCellChecklistSidebar
              projectId={projectId}
              cellId={cellId}
              readOnly={!cell.isAssignedToMe}
              showCompletionRequirement={isFinalLayoutStage(cell)}
              onChange={(checklistDetail) => {
                const total = checklistDetail?.items?.length ?? 0
                const ready =
                  total === 0 || (Boolean(checklistDetail?.isFilled) && Boolean(checklistDetail?.isExtensionFilled))
                setChecklistReady(ready)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
