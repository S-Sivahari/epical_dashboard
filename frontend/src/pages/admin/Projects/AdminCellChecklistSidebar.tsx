import { useCallback, useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { fetchCellChecklist } from '@/services/checklistService'
import type { CellChecklistDetail } from '@/types/projectWorkspace'
import { CellChecklistResponses } from './CellChecklistResponses'

export function AdminCellChecklistSidebar({
  projectId,
  cellId,
}: {
  projectId: string
  cellId: string
}) {
  const [checklist, setChecklist] = useState<CellChecklistDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const loadChecklist = useCallback(async () => {
    if (!projectId || !cellId) return
    setLoading(true)
    try {
      const data = await fetchCellChecklist(projectId, cellId)
      setChecklist(data)
    } catch {
      setChecklist(null)
    } finally {
      setLoading(false)
    }
  }, [projectId, cellId])

  useEffect(() => {
    void loadChecklist()
  }, [loadChecklist])

  const answeredCount = checklist?.items.filter((item) => item.response).length ?? 0
  const totalCount = checklist?.items.length ?? 0

  return (
    <aside className="emp-wf-checklist-sidebar admin-projects-cell-checklist-sidebar" aria-label="Cell checklist">
      <div className="emp-wf-checklist-sidebar-head">
        <div className="emp-wf-checklist-sidebar-title-row">
          <ClipboardList className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          <h2 className="emp-wf-checklist-sidebar-title">Checklist</h2>
        </div>
        {checklist?.checklistName ? (
          <p className="emp-wf-checklist-sidebar-subtitle">{checklist.checklistName}</p>
        ) : null}
        {totalCount > 0 ? (
          <p className="emp-wf-checklist-sidebar-progress">
            {answeredCount} of {totalCount} answered
          </p>
        ) : null}
      </div>
      <div className="emp-wf-checklist-sidebar-body">
        {loading ? (
          <p className="emp-wf-checklist-sidebar-empty">Loading checklist…</p>
        ) : !checklist?.items.length ? (
          <p className="emp-wf-checklist-sidebar-empty">
            {checklist?.checklistName
              ? 'No checklist questions for this cell yet.'
              : 'No checklist is configured for this cell type.'}
          </p>
        ) : (
          <CellChecklistResponses
            projectId={projectId}
            cellId={cellId}
            checklist={checklist}
            compact
            onUpdated={setChecklist}
          />
        )}
      </div>
    </aside>
  )
}
