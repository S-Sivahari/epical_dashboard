import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import {
  createChecklist,
  deleteChecklist,
  fetchChecklists,
  fetchChecklistTemplateRows,
  importChecklistTemplateFile,
  updateChecklist,
} from '@/services/checklistService'
import { exportToExcel } from '@/utils/exportExcel'
import type { Checklist, ChecklistTemplateImportResult } from '@/types/projectWorkspace'
import { cn } from '@/utils/cn'

type ItemDraft = { id?: string; itemName: string }

const TEMPLATE_HEADERS = [
  { key: 'checklistName', label: 'Checklist Name' },
  { key: 'description', label: 'Description' },
  { key: 'itemName', label: 'Item Name' },
  { key: 'itemOrder', label: 'Item Order' },
]

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
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importResult, setImportResult] = useState<ChecklistTemplateImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const downloadTemplate = async () => {
    try {
      const rows = await fetchChecklistTemplateRows()
      await exportToExcel(rows, 'checklist-template', TEMPLATE_HEADERS, {
        reportTitle: 'Checklist Management Template',
        panelTitle: 'Manage Checklists',
        compactHeader: true,
      })
      toast.success(
        checklists.length
          ? 'Checklist template downloaded with current checklists'
          : 'Blank checklist template downloaded',
      )
    } catch {
      toast.error('Failed to download template')
    }
  }

  const processImportFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Please upload an .xlsx file')
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const result = await importChecklistTemplateFile(file)
      setImportResult(result)
      const saved = result.created + result.updated
      if (result.failed === 0 && saved > 0) {
        toast.success(`Imported ${result.created} new, updated ${result.updated} checklist(s)`)
      } else if (saved > 0) {
        toast.warning(
          `Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`,
        )
      } else {
        toast.error('No checklists were imported. Check the error details below.')
      }
      resetForm()
      const next = await fetchChecklists()
      setChecklists(next)
      onChanged?.()
      if (saved > 0 && result.failed === 0) {
        setImportOpen(false)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const downloadErrorReport = async () => {
    if (!importResult?.errors.length) return
    await exportToExcel(
      importResult.errors.map((e) => ({
        row: e.row,
        checklistName: e.checklistName,
        message: e.message,
      })),
      'checklist-import-errors',
      [
        { key: 'row', label: 'Row' },
        { key: 'checklistName', label: 'Checklist Name' },
        { key: 'message', label: 'Error' },
      ],
      { reportTitle: 'Checklist Import Errors', compactHeader: true },
    )
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
        toast.success('Checklist updated — download template again to sync Excel')
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
    <>
      <Modal isOpen={isOpen} title="Checklist management" onClose={onClose} size="lg">
        <div className="admin-projects-checklist-manage-toolbar">
          <p className="admin-projects-checklist-manage-hint">
            Download the Excel template, edit checklists offline, then upload. Changes sync both ways
            with this panel.
          </p>
          <div className="admin-projects-checklist-manage-actions">
            <button type="button" className="admin-projects-toolbar-btn" onClick={() => void downloadTemplate()}>
              <Download className="h-4 w-4" />
              Download template
            </button>
            <button
              type="button"
              className="admin-projects-toolbar-btn"
              onClick={() => {
                setImportOpen(true)
                setImportResult(null)
              }}
            >
              <Upload className="h-4 w-4" />
              Upload Excel
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Existing checklists</p>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2">
              {loading ? (
                <p className="p-3 text-sm text-slate-500">Loading…</p>
              ) : checklists.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">No checklists yet. Download the template to get started.</p>
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

      <Modal
        isOpen={importOpen}
        title="Import checklist template"
        onClose={() => setImportOpen(false)}
        size="md"
      >
        <p className="mb-3 text-sm text-slate-600">
          Upload the checklist Excel template. Existing checklists with the same name will be updated;
          new names will be created.
        </p>
        <div
          className={cn(
            'admin-projects-import-dropzone',
            dragOver && 'admin-projects-import-dropzone--active',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) void processImportFile(file)
          }}
        >
          <Upload className="mx-auto h-8 w-8 text-emerald-700" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Drag and drop your .xlsx file here</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void processImportFile(file)
              e.target.value = ''
            }}
          />
          <Button
            variant="secondary"
            className="mt-4"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? 'Importing…' : 'Choose file'}
          </Button>
        </div>

        {importResult ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p>
              <strong>Imported rows:</strong> {importResult.imported} · <strong>Created:</strong>{' '}
              {importResult.created} · <strong>Updated:</strong> {importResult.updated} ·{' '}
              <strong>Failed:</strong> {importResult.failed}
            </p>
            {importResult.errors.length > 0 ? (
              <div className="mt-3">
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-red-700">
                  {importResult.errors.map((err) => (
                    <li key={`${err.row}-${err.message}`}>
                      {err.row > 0 ? `Row ${err.row}: ` : ''}
                      {err.checklistName} — {err.message}
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" className="mt-3" onClick={() => void downloadErrorReport()}>
                  Download error report
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  )
}
