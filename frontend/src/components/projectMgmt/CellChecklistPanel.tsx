import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, ListChecks, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  setCellChecklistItems,
  toggleCellChecklistItem,
  type CellChecklistItem,
} from '@/services/projectMgmtService'
import { cn } from '@/utils/cn'

interface CellChecklistPanelProps {
  cellId: string
  items: CellChecklistItem[]
  editable?: boolean
  toggleable?: boolean
  onRefresh: () => void
  title?: string
}

export function CellChecklistPanel({
  cellId,
  items,
  editable = false,
  toggleable = false,
  onRefresh,
  title = 'Cell Checklist',
}: CellChecklistPanelProps) {
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [draftItems, setDraftItems] = useState<{ label: string; required: boolean }[]>(
    items.map((i) => ({ label: i.label, required: i.required }))
  )

  useEffect(() => {
    setDraftItems(items.map((i) => ({ label: i.label, required: i.required })))
  }, [items])

  const requiredTotal = items.filter((i) => i.required).length
  const requiredDone = items.filter((i) => i.required && i.checked).length
  const allRequiredDone = requiredTotal === 0 || requiredDone === requiredTotal

  const handleSaveItems = async () => {
    try {
      setSaving(true)
      await setCellChecklistItems(cellId, draftItems)
      toast.success('Checklist updated')
      onRefresh()
    } catch {
      toast.error('Failed to save checklist')
    } finally {
      setSaving(false)
    }
  }

  const handleAddDraft = () => {
    if (!newLabel.trim()) return
    setDraftItems((prev) => [...prev, { label: newLabel.trim(), required: true }])
    setNewLabel('')
  }

  const handleToggle = async (item: CellChecklistItem) => {
    try {
      setTogglingId(item.id)
      await toggleCellChecklistItem(cellId, item.id, !item.checked)
      onRefresh()
    } catch {
      toast.error('Failed to update item')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
        </div>
        {items.length > 0 && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              allRequiredDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            )}
          >
            {requiredDone}/{requiredTotal} required
          </span>
        )}
      </div>

      {editable ? (
        <div className="space-y-3 rounded-xl border border-border bg-slate-50/50 p-4">
          <p className="text-xs text-muted">Add custom checklist items for this cell. Required items must be checked before LVS completion.</p>
          <div className="space-y-2">
            {draftItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) =>
                    setDraftItems((prev) =>
                      prev.map((d, i) => (i === idx ? { ...d, label: e.target.value } : d))
                    )
                  }
                  className="h-9 flex-1 rounded-lg border border-border bg-white px-3 text-sm"
                />
                <label className="flex items-center gap-1 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) =>
                      setDraftItems((prev) =>
                        prev.map((d, i) => (i === idx ? { ...d, required: e.target.checked } : d))
                      )
                    }
                  />
                  Req
                </label>
                <button
                  type="button"
                  onClick={() => setDraftItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="New checklist item..."
              className="h-9 flex-1 rounded-lg border border-border bg-white px-3 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddDraft()}
            />
            <button
              type="button"
              onClick={handleAddDraft}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 text-xs font-semibold hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveItems}
            disabled={saving}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Checklist'}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted">
          No custom checklist items for this cell
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3',
                item.checked ? 'border-emerald-200 bg-emerald-50/50' : 'border-border bg-white'
              )}
            >
              {toggleable ? (
                <button
                  type="button"
                  onClick={() => void handleToggle(item)}
                  disabled={togglingId === item.id}
                  className="shrink-0 text-primary"
                >
                  {togglingId === item.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : item.checked ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
              ) : item.checked ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-slate-300" />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', item.checked && 'text-emerald-800')}>{item.label}</p>
                {item.checked && item.checkedByName && (
                  <p className="text-[10px] text-muted">Checked by {item.checkedByName}</p>
                )}
              </div>
              {item.required && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                  Required
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
