import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import {
  createChecklist,
  deleteChecklist,
  fetchChecklists,
  updateChecklist,
} from '@/services/checklistService'
import type { Checklist } from '@/types/projectWorkspace'

type ItemDraft = { id?: string; itemName: string }

export function ChecklistManagementModal({
  isOpen,
  onClose,
  onChanged,
}: {
  isOpen: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([{ itemName: '' }])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setChecklists(await fetchChecklists())
    } catch {
      toast.error('Failed to load checklists')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setItems([{ itemName: '' }])
  }

  const startEdit = (cl: Checklist) => {
    setEditingId(cl.id)
    setName(cl.name)
    setDescription(cl.description)
    setItems(cl.items.length ? cl.items.map((i) => ({ id: i.id, itemName: i.itemName })) : [{ itemName: '' }])
  }

  const save = async () => {
    const trimmedRows = items
      .map((i) => ({ id: i.id, itemName: i.itemName.trim() }))
      .filter((i) => i.itemName)
    if (!name.trim()) {
      toast.error('Checklist name is required')
      return
    }
    if (!trimmedRows.length) {
      toast.error('Add at least one checklist item')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        items: trimmedRows.map((row) => ({
          ...(row.id ? { id: row.id } : {}),
          itemName: row.itemName,
        })),
      }
      if (editingId) {
        await updateChecklist(editingId, payload)
        toast.success('Checklist updated')
      } else {
        await createChecklist(payload)
        toast.success('Checklist created')
      }
      resetForm()
      await load()
      onChanged?.()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to save checklist')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteChecklist(id)
      toast.success('Checklist deleted')
      if (editingId === id) resetForm()
      await load()
      onChanged?.()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to delete checklist')
    }
  }

  return (
    <Modal isOpen={isOpen} title="Checklist management" onClose={onClose} size="lg">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Existing checklists</p>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2">
            {loading ? (
              <p className="p-3 text-sm text-slate-500">Loading…</p>
            ) : checklists.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">No checklists yet.</p>
            ) : (
              checklists.map((cl) => (
                <div
                  key={cl.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white p-2.5"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => startEdit(cl)}
                  >
                    <p className="truncate text-sm font-semibold text-slate-800">{cl.name}</p>
                    <p className="text-xs text-slate-500">{cl.items.length} items</p>
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${cl.name}`}
                    onClick={() => void remove(cl.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {editingId ? 'Edit checklist' : 'Create checklist'}
          </p>
          <div className="space-y-3">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Description</span>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Items</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
                  onClick={() => setItems((prev) => [...prev, { itemName: '' }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add item
                </button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={item.itemName}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, itemName: e.target.value } : row)),
                        )
                      }
                      placeholder={`Item ${idx + 1}`}
                    />
                    {items.length > 1 ? (
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-2 text-slate-400 hover:text-red-600"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" onClick={() => void save()} disabled={saving} loading={saving}>
                {editingId ? 'Save changes' : 'Create checklist'}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
