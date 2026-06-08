import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import {
  assignChecklistToProject,
  fetchChecklists,
  fetchProjectChecklist,
} from '@/services/checklistService'
import type { Checklist, ProjectChecklistSummary } from '@/types/projectWorkspace'

export function AssignChecklistModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  onAssigned,
}: {
  isOpen: boolean
  projectId: string
  projectName: string
  onClose: () => void
  onAssigned: (summary: ProjectChecklistSummary) => void
}) {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [applyToAll, setApplyToAll] = useState(false)
  const [loading, setLoading] = useState(false)

  const activeChecklist = useMemo(
    () => checklists.find((c) => c.id === selectedId) ?? null,
    [checklists, selectedId],
  )

  useEffect(() => {
    if (!isOpen) return
    setApplyToAll(false)
    void (async () => {
      const [list, existing] = await Promise.all([
        fetchChecklists(),
        fetchProjectChecklist(projectId).catch(() => null),
      ])
      setChecklists(list)

      if (existing?.checklistId && list.some((c) => c.id === existing.checklistId)) {
        setSelectedId(existing.checklistId)
        const cl = list.find((c) => c.id === existing.checklistId)
        setSelectedItemIds(
          existing.selectedItemIds?.length
            ? existing.selectedItemIds
            : cl?.items.map((i) => i.id) ?? [],
        )
      } else {
        const first = list[0]
        setSelectedId(first?.id ?? '')
        setSelectedItemIds(first?.items.map((i) => i.id) ?? [])
      }
    })()
  }, [isOpen, projectId])

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    )
  }

  const selectAllItems = () => {
    setSelectedItemIds(activeChecklist?.items.map((i) => i.id) ?? [])
  }

  const clearAllItems = () => {
    setSelectedItemIds([])
  }

  const assign = async () => {
    if (!selectedId) {
      toast.error('Select a checklist')
      return
    }
    if (!selectedItemIds.length) {
      toast.error('Select at least one question for this project')
      return
    }
    setLoading(true)
    try {
      const summary = await assignChecklistToProject(projectId, selectedId, {
        applyToAll,
        selectedItemIds,
      })
      toast.success(
        applyToAll
          ? `Checklist assigned and applied to all cells in ${projectName}`
          : `Checklist assigned to ${projectName}`,
      )
      onAssigned(summary)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to assign checklist')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} title="Assign checklist" onClose={onClose} size="md">
      <p className="text-sm text-slate-600">
        Assign a checklist to <strong>{projectName}</strong> and choose which questions apply.
      </p>
      <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Checklist
      </label>
      <select
        className="admin-projects-filter-select mt-1 w-full"
        value={selectedId}
        onChange={(e) => {
          const id = e.target.value
          setSelectedId(id)
          const cl = checklists.find((c) => c.id === id)
          setSelectedItemIds(cl?.items.map((i) => i.id) ?? [])
        }}
      >
        {checklists.length === 0 ? (
          <option value="">No checklists available</option>
        ) : (
          checklists.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))
        )}
      </select>

      {activeChecklist ? (
        <div className="admin-projects-assign-questions mt-4">
          <div className="admin-projects-assign-questions-head">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Select questions for this project
            </p>
            <div className="flex gap-2">
              <button type="button" className="admin-projects-assign-questions-link" onClick={selectAllItems}>
                Select all
              </button>
              <button type="button" className="admin-projects-assign-questions-link" onClick={clearAllItems}>
                Clear
              </button>
            </div>
          </div>
          <ul className="admin-projects-assign-questions-list">
            {activeChecklist.items.map((item) => (
              <li key={item.id}>
                <label className="admin-projects-assign-question-row">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleItem(item.id)}
                  />
                  <span className="text-sm text-slate-800">{item.itemName}</span>
                </label>
              </li>
            ))}
          </ul>
          {activeChecklist.items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">This checklist has no questions yet.</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            {selectedItemIds.length} of {activeChecklist.items.length} selected
          </p>
        </div>
      ) : null}

      <label className="admin-projects-assign-apply-all mt-4 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
          checked={applyToAll}
          onChange={(e) => setApplyToAll(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold text-slate-800">Apply to all cells</span>
          <span className="block text-xs text-slate-500">
            Mark the selected questions as Applied on every cell in this project immediately.
          </span>
        </span>
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => void assign()}
          disabled={loading || !selectedId || !selectedItemIds.length}
        >
          {applyToAll ? 'Assign & apply' : 'Assign'}
        </Button>
      </div>
    </Modal>
  )
}
