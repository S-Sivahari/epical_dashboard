import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@components/employee/ui/badge'
import { portalCardClass } from '@components/employee/shared/interactiveCard'
import { CellWorkflowPanel } from '@components/employee/projects/CellWorkflowPanel'
import {
  fetchMyCell,
  requestCellReview,
  updateCellWorkflow,
} from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'

export default function EmployeeCellWorkflow() {
  const { projectId = '', cellId = '' } = useParams()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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

  const runWorkflowUpdate = async (payload, successMessage) => {
    if (!projectId || !cellId) return
    setSaving(true)
    try {
      const cell = await updateCellWorkflow(projectId, cellId, payload)
      setDetail((prev) => (prev ? { ...prev, cell } : prev))
      toast({ title: 'Updated', description: successMessage })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to update workflow' })
    } finally {
      setSaving(false)
    }
  }

  const handleSimpleView = (view, status) =>
    runWorkflowUpdate({ view, action: 'set_status', status }, `${view} set to ${status.replace('_', ' ')}`)

  const handleLayoutStatus = (status) =>
    runWorkflowUpdate({ view: 'layout', action: 'set_status', status }, `Layout stage set to ${status.replace('_', ' ')}`)

  const handleAdvanceLayout = () =>
    runWorkflowUpdate({ view: 'layout', action: 'advance_stage' }, 'Advanced to next layout stage')

  const handleRequestReview = async (comment) => {
    if (!projectId || !cellId) return
    setSaving(true)
    try {
      const result = await requestCellReview(projectId, cellId, comment)
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              cell: result.cell,
              reviews: [result.review, ...prev.reviews],
            }
          : prev,
      )
      toast({ title: 'Review requested', description: 'Admin will review your submission.' })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to request review' })
    } finally {
      setSaving(false)
    }
  }

  if (loading && !detail) {
    return <p className="py-8 text-center text-sm text-muted">Loading cell workflow…</p>
  }

  if (!detail) {
    return <p className="py-8 text-center text-sm text-muted">Cell not found.</p>
  }

  const { cell, library, project } = detail
  const safeReviews = Array.isArray(detail.reviews) ? detail.reviews : []

  return (
    <div className="space-y-4">
      <Link
        to={`/employee/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {project.name}
      </Link>

      <div className={portalCardClass({ interactive: false })}>
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

        <div className="p-4">
          <CellWorkflowPanel
            workflow={cell?.viewWorkflow}
            reviews={safeReviews}
            saving={saving}
            onUpdateSimpleView={handleSimpleView}
            onUpdateLayoutStatus={handleLayoutStatus}
            onAdvanceLayout={handleAdvanceLayout}
            onRequestReview={handleRequestReview}
          />
        </div>
      </div>
    </div>
  )
}
