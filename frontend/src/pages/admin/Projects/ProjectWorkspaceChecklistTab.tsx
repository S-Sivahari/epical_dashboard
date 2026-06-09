import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import {
  fetchCellChecklist,
  fetchCellTypeChecklistDefinition,
  fetchProjectChecklistExportRows,
  importProjectChecklistRows,
} from '@/services/checklistService'
import { exportToExcel } from '@/utils/exportExcel'
import { parseProjectChecklistExcel } from '@/utils/parseProjectChecklistExcel'
import type {
  CellChecklistDetail,
  CellTypeChecklistDefinition,
  ProjectCell,
  ProjectChecklistImportResult,
} from '@/types/projectWorkspace'
import { cn } from '@/utils/cn'
import { CELL_TYPE_LABELS } from './projectWorkspaceUi'
import { CellChecklistResponses } from './CellChecklistResponses'

const EXPORT_HEADERS = [
  { key: 'cellName', label: 'Cell Name' },
  { key: 'library', label: 'Library' },
  { key: 'cellType', label: 'Cell Type' },
  { key: 'checklistName', label: 'Checklist Name' },
  { key: 'itemName', label: 'Item Name' },
  { key: 'itemOrder', label: 'Item Order' },
  { key: 'response', label: 'Response' },
  { key: 'comment', label: 'Comment' },
]

export function ProjectWorkspaceChecklistTab({
  projectId,
  projectName,
  cells,
  libraryNameById,
}: {
  projectId: string
  projectName: string
  cells: ProjectCell[]
  libraryNameById: Map<string, string>
}) {
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<CellChecklistDetail | null>(null)
  const [typeDefinition, setTypeDefinition] = useState<CellTypeChecklistDefinition | null>(null)
  const [loadingChecklist, setLoadingChecklist] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importResult, setImportResult] = useState<ProjectChecklistImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedCell = cells.find((cell) => cell.id === selectedCellId) ?? null

  const loadCellChecklist = useCallback(
    async (cellId: string, cellType: ProjectCell['cellType']) => {
      setLoadingChecklist(true)
      try {
        const [detail, definition] = await Promise.all([
          fetchCellChecklist(projectId, cellId),
          fetchCellTypeChecklistDefinition(cellType),
        ])
        setChecklist(detail)
        setTypeDefinition(definition)
      } catch {
        toast.error('Failed to load checklist for this cell')
        setChecklist(null)
        setTypeDefinition(null)
      } finally {
        setLoadingChecklist(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    if (!selectedCellId || !selectedCell) {
      setChecklist(null)
      setTypeDefinition(null)
      return
    }
    void loadCellChecklist(selectedCellId, selectedCell.cellType)
  }, [selectedCellId, selectedCell, loadCellChecklist, refreshToken])

  useEffect(() => {
    if (cells.length === 0) {
      setSelectedCellId(null)
      return
    }
    if (!selectedCellId || !cells.some((cell) => cell.id === selectedCellId)) {
      setSelectedCellId(cells[0].id)
    }
  }, [cells, selectedCellId])

  const bumpRefresh = () => setRefreshToken((value) => value + 1)

  const handleDownload = async () => {
    try {
      const rows = await fetchProjectChecklistExportRows(projectId)
      if (!rows.length) {
        toast.error('No checklist data to export for this project')
        return
      }
      const slug = projectName.trim().replace(/\s+/g, '-').toLowerCase() || 'project'
      await exportToExcel(rows, `${slug}-checklist`, EXPORT_HEADERS, {
        reportTitle: `${projectName} — Cell Checklist Report`,
        panelTitle: 'Project Workspace',
        compactHeader: true,
      })
      toast.success('Checklist downloaded')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Download failed')
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
      const rows = await parseProjectChecklistExcel(file)
      const result = await importProjectChecklistRows(projectId, rows)
      setImportResult(result)
      if (result.failed === 0 && result.updated > 0) {
        toast.success(`Updated ${result.updated} checklist response(s)`)
        setImportOpen(false)
        bumpRefresh()
      } else if (result.updated > 0) {
        toast.warning(`Updated: ${result.updated}, Failed: ${result.failed}`)
        bumpRefresh()
      } else {
        toast.error('No checklist responses were updated')
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <div className="admin-projects-checklist-tab">
        <div className="admin-projects-checklist-tab-head">
          <div>
            <h2 className="admin-projects-graph-title">Checklist</h2>
            <p className="admin-projects-workflow-section-intro">
              Select a cell to view its checklist from the Excel template stored by cell type
              (BLOCK, IO, ESD, TOP). Download or upload responses for the whole project below.
            </p>
          </div>
          <div className="admin-projects-checklist-tab-actions">
            <button
              type="button"
              className="admin-projects-toolbar-btn admin-projects-checklist-tab-btn"
              onClick={() => void handleDownload()}
            >
              <Download className="h-4 w-4" />
              Download checklist
            </button>
            <button
              type="button"
              className="admin-projects-toolbar-btn admin-projects-checklist-tab-btn"
              onClick={() => {
                setImportOpen(true)
                setImportResult(null)
              }}
            >
              <Upload className="h-4 w-4" />
              Upload checklist
            </button>
          </div>
        </div>

        <div className="admin-projects-checklist-tab-layout">
          <div className="admin-projects-checklist-tab-cells">
            <p className="admin-projects-checklist-tab-panel-label">Cells</p>
            <div className="admin-projects-checklist-tab-cell-list">
              {cells.length === 0 ? (
                <p className="admin-projects-checklist-tab-empty">No cells in this project yet.</p>
              ) : (
                cells.map((cell) => {
                  const isActive = cell.id === selectedCellId
                  return (
                    <button
                      key={cell.id}
                      type="button"
                      className={cn(
                        'admin-projects-checklist-tab-cell',
                        isActive && 'admin-projects-checklist-tab-cell--active',
                      )}
                      onClick={() => setSelectedCellId(cell.id)}
                    >
                      <span className="admin-projects-checklist-tab-cell-name">{cell.name}</span>
                      <span className="admin-projects-checklist-tab-cell-meta">
                        {libraryNameById.get(cell.libraryId) || 'Library'} ·{' '}
                        {CELL_TYPE_LABELS[cell.cellType]}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="admin-projects-checklist-tab-detail">
            {!selectedCell ? (
              <p className="admin-projects-checklist-tab-empty">Select a cell to view its checklist.</p>
            ) : loadingChecklist ? (
              <p className="admin-projects-checklist-tab-empty">Loading checklist…</p>
            ) : !checklist?.checklistId && !typeDefinition ? (
              <div className="admin-projects-checklist-tab-empty-block">
                <p className="font-semibold text-slate-700">No checklist for this cell type</p>
                <p className="mt-1 text-sm text-slate-500">
                  Upload a checklist template in Manage Checklists with Cell Type{' '}
                  <strong>{CELL_TYPE_LABELS[selectedCell.cellType]}</strong>.
                </p>
              </div>
            ) : (
              <>
                <div className="admin-projects-checklist-tab-detail-head">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    {CELL_TYPE_LABELS[selectedCell.cellType]} checklist
                  </p>
                  <h3 className="text-lg font-bold text-slate-900">
                    {checklist?.checklistName || typeDefinition?.checklistName || 'Checklist'}
                  </h3>
                  {(typeDefinition?.description || checklist?.checklistId) && (
                    <p className="mt-1 text-sm text-slate-600">
                      {typeDefinition?.description ||
                        'Loaded from the cell-type checklist stored in MongoDB (Excel import).'}
                    </p>
                  )}
                  {typeDefinition?.importedFromExcel ? (
                    <p className="mt-1 text-xs text-slate-500">
                      From Excel template · {typeDefinition.items.length} item
                      {typeDefinition.items.length === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </div>

                {checklist?.items.length ? (
                  <CellChecklistResponses
                    projectId={projectId}
                    cellId={selectedCell.id}
                    checklist={checklist}
                    onUpdated={setChecklist}
                  />
                ) : typeDefinition?.items.length ? (
                  <ul className="admin-projects-checklist-tab-definition-list">
                    {typeDefinition.items.map((item, index) => (
                      <li key={item.id} className="admin-projects-checklist-tab-definition-item">
                        <span className="admin-projects-checklist-tab-definition-order">{index + 1}</span>
                        <span>{item.itemName}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">This checklist has no items yet.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={importOpen}
        title="Upload checklist"
        onClose={() => setImportOpen(false)}
        size="md"
      >
        <p className="mb-3 text-sm text-slate-600">
          Upload the checklist Excel for <strong>{projectName}</strong>. Use Response values{' '}
          <strong>Yes</strong>, <strong>No</strong>, or <strong>N/A</strong>. Comments are required
          for No and N/A.
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
            if (file) void processFile(file)
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
              <strong>Rows:</strong> {importResult.imported} · <strong>Updated:</strong>{' '}
              {importResult.updated} · <strong>Failed:</strong> {importResult.failed}
            </p>
            {importResult.errors.length > 0 ? (
              <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto text-xs text-red-700">
                {importResult.errors.map((err) => (
                  <li key={`${err.row}-${err.message}`}>
                    {err.row > 0 ? `Row ${err.row}: ` : ''}
                    {err.cellName} — {err.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  )
}
