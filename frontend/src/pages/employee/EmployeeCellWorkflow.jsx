import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EmployeeProjectBreadcrumb } from '@components/employee/projects/EmployeeProjectBreadcrumb'
import { EmployeeCellChecklistSidebar } from '@components/employee/projects/EmployeeCellChecklistSidebar'
import { ProjectWorkflowBoard } from '@components/employee/projects/ProjectWorkflowBoard'
import { CellDetailsSummary } from '@pages/admin/Projects/CellDetailsSummary'
import { EmployeeCellReviewSection } from '@components/employee/projects/EmployeeCellReviewSection'
import {
  fetchMyCell,
  requestCellReview,
  updateCellWorkflow,
} from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import { useAuthStore } from '@store/authStore'
import { cn } from '@pages/employee/lib/utils'
import { VIEW_TABS } from '@/utils/cellWorkflowUi'
import { CELL_TYPE_LABELS, cellDisplayStatus } from '@pages/admin/Projects/projectWorkspaceUi'
import '@components/employee/projects/employeeProjectWorkflow.css'

export default function EmployeeCellWorkflow() {
  const { projectId = '', cellId = '' } = useParams()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [viewTab, setViewTab] = useState('layout')
  const [activeFilter, setActiveFilter] = useState(null)
  const [checklistFilled, setChecklistFilled] = useState(true)
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)

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

  const handleAdvance = async (cell, payload) => {
    if (!projectId || !cellId || !cell.isAssignedToMe) return
    setSavingId(cell.id)
    try {
      const updated = await updateCellWorkflow(projectId, cellId, payload)
      updateCellInState(updated)
      toast({ title: 'Stage updated', description: `${cell.name} advanced` })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to advance stage' })
    } finally {
      setSavingId(null)
    }
  }

  const handleRequestReview = async (cell) => {
    if (!projectId || !cellId || !cell.isAssignedToMe) return
    setSavingId(cell.id)
    try {
      const result = await requestCellReview(projectId, cellId)
      updateCellInState(result.cell)
      await reload()
      toast({ title: 'Review requested', description: 'Admin will review your submission.' })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to request review' })
    } finally {
      setSavingId(null)
    }
  }

  if (loading && !detail) {
    return <p className="py-8 text-center text-sm text-muted">Loading cell workflow…</p>
  }

  if (!detail) {
    return <p className="py-8 text-center text-sm text-muted">Cell not found.</p>
  }

  const { cell, library, project, reviews = [] } = detail
  const cellTypeLabel = CELL_TYPE_LABELS[cell.cellType] ?? String(cell.cellType || 'block').toUpperCase()

  return (
    <div className="emp-wf-projects-content" data-employee-project-cell>
      <div className="emp-wf-surface emp-wf-cell-page">
        <EmployeeProjectBreadcrumb
          items={[
            { label: 'Projects', to: '/employee/projects' },
            { label: project.name, to: `/employee/projects/${projectId}` },
            { label: cell.name },
          ]}
          className="emp-wf-breadcrumb--cell"
        />

        <header className="emp-wf-workspace-head emp-wf-workspace-head--cell">
          <div className="min-w-0">
            <p className="emp-wf-cell-eyebrow">Cell workflow</p>
            <h1 className="emp-wf-workspace-title">{cell.name}</h1>
            <p className="emp-wf-workspace-meta">
              {library?.name || 'Library'} · {cellTypeLabel} ·{' '}
              {cell.assignedEmployeeName?.trim() || 'Unassigned'} · {cellDisplayStatus(cell)}
            </p>
          </div>
          <div className="emp-wf-workspace-head-actions">
            <span
              className={cn(
                'emp-wf-status-chip',
                cell.isBlocked && 'is-blocked',
                cell.isReady && 'is-ready',
                cell.status === 'completed' && 'is-completed',
                cell.status === 'in_progress' && !cell.isBlocked && 'is-progress',
              )}
            >
              {cellDisplayStatus(cell)}
            </span>
            {cell.isAssignedToMe ? (
              <span className="emp-wf-assigned-badge">Yours</span>
            ) : null}
          </div>
        </header>

        <div className="emp-wf-cell-page-body">
          <CellDetailsSummary cell={cell} libraryName={library?.name} variant="employee" />

          <div className="emp-wf-view-tabs">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn('emp-wf-view-tab', viewTab === tab.id && 'is-active')}
                onClick={() => {
                  setViewTab(tab.id)
                  setActiveFilter(null)
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="emp-wf-cell-main-row">
            <div className="emp-wf-cell-workflow-col">
              <div className="emp-wf-cell-workflow-panel emp-wf-cell-workflow-panel--compact">
                <ProjectWorkflowBoard
                  cells={[cell]}
                  user={user}
                  viewTab={viewTab}
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  savingId={savingId}
                  onAdvance={handleAdvance}
                  onRequestReview={handleRequestReview}
                  checklistFilled={checklistFilled}
                  compact
                />
              </div>
              <EmployeeCellReviewSection reviews={reviews} />
            </div>
            <EmployeeCellChecklistSidebar
              projectId={projectId}
              cellId={cellId}
              readOnly={!cell.isAssignedToMe}
              onChange={(detail) => setChecklistFilled(detail?.isFilled ?? true)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
