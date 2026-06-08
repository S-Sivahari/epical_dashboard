import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { exportToExcel } from '@/utils/exportExcel'
import {
  assignChecklistToProject,
  fetchChecklistExportRows,
  fetchChecklists,
  fetchProjectChecklist,
  importChecklistFile,
} from '@/services/checklistService'
import type { Checklist, ChecklistImportResult } from '@/types/projectWorkspace'
import { cn } from '@/utils/cn'

const EXPORT_HEADERS = [
  { key: 'projectName', label: 'Project Name' },
  { key: 'client', label: 'Client' },
  { key: 'projectType', label: 'Project Type' },
  { key: 'teamLead', label: 'Team Lead' },
  { key: 'checklistName', label: 'Checklist Name' },
  { key: 'checklistStatus', label: 'Checklist Status' },
  { key: 'completionPercentage', label: 'Completion Percentage' },
  { key: 'totalCells', label: 'Total Cells' },
  { key: 'appliedCells', label: 'Applied Cells' },
  { key: 'lastUpdated', label: 'Last Updated' },
]

export function ProjectChecklistImportExport({ onImported }: { onImported?: () => void }) {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ChecklistImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setDownloadOpen(false)
    try {
      const rows = await fetchChecklistExportRows()
      if (!rows.length) {
        toast.error('No project data to export')
        return
      }
      const exportRows = rows.map((r) => ({
        ...r,
        lastUpdated: r.lastUpdated ? new Date(r.lastUpdated).toLocaleString() : '',
      }))
      await exportToExcel(exportRows, 'project-checklist-report', EXPORT_HEADERS, {
        reportTitle: 'Project Checklist Report',
        panelTitle: 'Projects Dashboard',
        compactHeader: true,
      })
      toast.success('Checklist report exported')
    } catch {
      toast.error('Export failed')
    }
  }

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Please upload an .xlsx file')
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const result = await importChecklistFile(file)
      setImportResult(result)
      if (result.failed === 0) {
        toast.success(`Imported ${result.imported} rows successfully`)
      } else {
        toast.warning(`Imported: ${result.imported}, Updated: ${result.updated}, Failed: ${result.failed}`)
      }
      onImported?.()
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  const downloadErrorReport = async () => {
    if (!importResult?.errors.length) return
    await exportToExcel(
      importResult.errors.map((e) => ({
        row: e.row,
        projectName: e.projectName,
        message: e.message,
      })),
      'checklist-import-errors',
      [
        { key: 'row', label: 'Row' },
        { key: 'projectName', label: 'Project Name' },
        { key: 'message', label: 'Error' },
      ],
      { reportTitle: 'Checklist Import Errors', compactHeader: true },
    )
  }

  return (
    <>
      <div className="admin-projects-toolbar-actions">
        <div className="relative">
          <button
            type="button"
            className="admin-projects-toolbar-btn"
            onClick={() => setDownloadOpen((o) => !o)}
          >
            <Download className="h-4 w-4" />
            Download
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </button>
          {downloadOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setDownloadOpen(false)}
              />
              <div className="admin-projects-dropdown">
                <button type="button" onClick={() => void handleExport()}>
                  Export Project Checklist Report (.xlsx)
                </button>
              </div>
            </>
          ) : null}
        </div>

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

      <Modal
        isOpen={importOpen}
        title="Import checklist data"
        onClose={() => setImportOpen(false)}
        size="md"
      >
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
            if (file) void processFile(file)
          }}
        >
          <Upload className="mx-auto h-8 w-8 text-emerald-700" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Drag and drop your .xlsx file here</p>
          <p className="mt-1 text-xs text-slate-500">Or choose a file from your computer</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void processFile(file)
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
              <strong>Imported:</strong> {importResult.imported} · <strong>Updated:</strong>{' '}
              {importResult.updated} · <strong>Failed:</strong> {importResult.failed}
            </p>
            {importResult.errors.length > 0 ? (
              <div className="mt-3">
                <p className="mb-2 font-semibold text-red-700">Invalid rows</p>
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-slate-600">
                  {importResult.errors.map((err) => (
                    <li key={`${err.row}-${err.message}`} className="text-red-700">
                      Row {err.row} ({err.projectName}): {err.message}
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
  onAssigned: () => void
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
      await assignChecklistToProject(projectId, selectedId, {
        applyToAll,
        selectedItemIds,
      })
      toast.success(
        applyToAll
          ? `Checklist assigned and applied to all cells in ${projectName}`
          : `Checklist assigned to ${projectName}`,
      )
      onAssigned()
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
