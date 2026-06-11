import { useCallback, useEffect, useState } from 'react'
import { Download, FileCheck, ListChecks, Loader2 } from 'lucide-react'
import {
  fetchTypeChecklistItems,
  downloadChecklist,
  type CellChecklistItem,
  type CellType,
  type TypeChecklistItem,
} from '@/services/projectMgmtService'
import { CellChecklistPanel } from './CellChecklistPanel'
import { cn } from '@/utils/cn'

interface CombinedChecklistSectionProps {
  cellId: string
  cellType: CellType
  customItems: CellChecklistItem[]
  customEditable?: boolean
  customToggleable?: boolean
  onRefresh: () => void
}

function TypeChecklistList({
  items,
  cellType,
  hasFile,
}: {
  items: TypeChecklistItem[]
  cellType: CellType
  hasFile?: boolean
}) {
  if (items.length === 0 && !hasFile) {
    return (
      <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted">
        No {cellType} checklist items defined yet
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-xl border border-border bg-white px-4 py-3"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {idx + 1}
          </span>
          <p className="flex-1 text-sm text-ink">{item.label}</p>
        </div>
      ))}
      {hasFile && (
        <button
          type="button"
          onClick={() => void downloadChecklist(cellType)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-slate-50 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-slate-100"
        >
          <Download className="h-3.5 w-3.5" />
          Download attachment
        </button>
      )}
    </div>
  )
}

export function CombinedChecklistSection({
  cellId,
  cellType,
  customItems,
  customEditable = false,
  customToggleable = false,
  onRefresh,
}: CombinedChecklistSectionProps) {
  const [typeItems, setTypeItems] = useState<TypeChecklistItem[]>([])
  const [hasFile, setHasFile] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadTypeItems = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchTypeChecklistItems(cellType)
      setTypeItems(data.items)
      setHasFile(data.hasFile ?? false)
    } catch {
      setTypeItems([])
      setHasFile(false)
    } finally {
      setLoading(false)
    }
  }, [cellType])

  useEffect(() => {
    void loadTypeItems()
  }, [loadTypeItems])

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-ink">{cellType} Type Checklist</h3>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              typeItems.length > 0 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-muted'
            )}
          >
            {typeItems.length} items
          </span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <TypeChecklistList items={typeItems} cellType={cellType} hasFile={hasFile} />
        )}
      </div>

      <div className="border-t border-border pt-6">
        <CellChecklistPanel
          cellId={cellId}
          items={customItems}
          editable={customEditable}
          toggleable={customToggleable}
          onRefresh={onRefresh}
          title="Custom Cell Checklist"
        />
      </div>
    </div>
  )
}

export function TypeChecklistEditor({
  cellType,
  items,
  hasFile,
  onSave,
  onUploadFile,
  saving,
}: {
  cellType: CellType
  items: TypeChecklistItem[]
  hasFile?: boolean
  onSave: (labels: string[]) => Promise<void>
  onUploadFile: (file: File) => Promise<void>
  saving?: boolean
}) {
  const [draft, setDraft] = useState<string[]>(items.map((i) => i.label))
  const [newItem, setNewItem] = useState('')

  useEffect(() => {
    setDraft(items.map((i) => i.label))
  }, [items])

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-ink">{cellType}</span>
        {hasFile && <span className="text-[10px] text-emerald-600">File attached</span>}
      </div>
      <div className="mb-3 space-y-2">
        {draft.map((label, idx) => (
          <div key={idx} className="flex gap-2">
            <span className="flex h-9 w-6 items-center justify-center text-xs font-bold text-muted">
              {idx + 1}
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) =>
                setDraft((prev) => prev.map((l, i) => (i === idx ? e.target.value : l)))
              }
              className="h-9 flex-1 rounded-lg border border-border px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
              className="text-xs text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add checklist item..."
          className="h-9 flex-1 rounded-lg border border-border px-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newItem.trim()) {
              setDraft((prev) => [...prev, newItem.trim()])
              setNewItem('')
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (!newItem.trim()) return
            setDraft((prev) => [...prev, newItem.trim()])
            setNewItem('')
          }}
          className="rounded-lg border border-border px-3 text-xs font-semibold hover:bg-slate-50"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave(draft.filter((l) => l.trim()))}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Items'}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-slate-50">
          <ListChecks className="h-3.5 w-3.5" />
          Attach file
          <input
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls,.doc,.docx,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onUploadFile(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}
