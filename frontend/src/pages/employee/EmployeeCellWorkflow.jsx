import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@components/employee/ui/badge'
import { portalCardClass } from '@components/employee/shared/interactiveCard'
import { ProjectWorkflowBoard } from '@components/employee/projects/ProjectWorkflowBoard'
import {
  fetchMyCell,
  requestCellReview,
  updateCellWorkflow,
} from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import { useAuthStore } from '@store/authStore'
import { cn } from '@pages/employee/lib/utils'
import { VIEW_TABS } from '@/utils/cellWorkflowUi'
import '@components/employee/projects/employeeProjectWorkflow.css'

export default function EmployeeCellWorkflow() {
  const { projectId = '', cellId = '' } = useParams()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [viewTab, setViewTab] = useState('layout')
  const [activeFilter, setActiveFilter] = useState(null)
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

  const { cell, library, project } = detail

  return (
    <div className="emp-wf-page">
      <div className="emp-wf-surface">
        <Link
          to={`/employee/projects/${projectId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {project.name}
        </Link>

        <div className={portalCardClass({ interactive: false, className: 'mb-4 !p-0 overflow-hidden' })}>
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="text-base font-semibold text-foreground">{cell.name}</h1>
                <p className="text-xs text-muted">
                  {library?.name || 'Library'} · {cell.cellType} · {cell.complexity}
                </p>
              </div>
              <Badge variant="secondary">{cell.status}</Badge>
            </div>
            {cell.description ? <p className="mt-2 text-xs text-muted">{cell.description}</p> : null}
          </div>
        </div>

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

        <ProjectWorkflowBoard
          cells={[cell]}
          user={user}
          viewTab={viewTab}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          savingId={savingId}
          onAdvance={handleAdvance}
          onRequestReview={handleRequestReview}
        />
      </div>
    </div>
  )
}
