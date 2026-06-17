import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { cn } from '@/utils/cn'
import { CELL_TYPES, type CellType, type ProjectTypeChecklistMeta } from '@/types/projectWorkspace'
import { CELL_TYPE_LABELS } from '@/pages/admin/Projects/projectWorkspaceUi'
import {
  deleteTypeChecklist,
  downloadChecklistTemplate,
  downloadTypeChecklistFile,
  fetchProjectTypeChecklists,
  uploadTypeChecklist,
} from '@/services/projectTypeChecklistService'

type ProjectTypeChecklistPanelProps = {
  projectId: string
}

export function ProjectTypeChecklistPanel({ projectId }: ProjectTypeChecklistPanelProps) {
  const [items, setItems] = useState<ProjectTypeChecklistMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<CellType>('block')
  const [uploading, setUploading] = useState(false)
  const [deleteType, setDeleteType] = useState<CellType | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTypeRef = useRef<CellType>('block')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchProjectTypeChecklists(projectId)
      setItems(data)
    } catch {
      toast.error('Failed to load checklists')
      setItems(CELL_TYPES.map((cellType) => ({
        cellType,
        fileName: '',
        contentType: '',
        uploadedAt: null,
        uploadedByName: '',
        hasFile: false,
      })))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const byType = new Map(items.map((item) => [item.cellType, item]))

  const handleUploadClick = (type?: CellType) => {
    uploadTypeRef.current = type ?? selectedType
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const uploadType = uploadTypeRef.current
    setUploading(true)
    try {
      const updated = await uploadTypeChecklist(projectId, uploadType, file)
      setItems((prev) => prev.map((item) => (item.cellType === updated.cellType ? updated : item)))
      toast.success(`${CELL_TYPE_LABELS[uploadType]} checklist uploaded`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await downloadChecklistTemplate(projectId)
      toast.success('Template downloaded')
    } catch {
      toast.error('Failed to download template')
    }
  }

  const handleDownload = async (item: ProjectTypeChecklistMeta) => {
    try {
      await downloadTypeChecklistFile(projectId, item.cellType, item.fileName)
    } catch {
      toast.error('Failed to download file')
    }
  }

  const handleDelete = async () => {
    if (!deleteType) return
    try {
      await deleteTypeChecklist(projectId, deleteType)
      setItems((prev) =>
        prev.map((item) =>
          item.cellType === deleteType
            ? { ...item, fileName: '', hasFile: false, uploadedAt: null, uploadedByName: '' }
            : item,
        ),
      )
      toast.success(`${CELL_TYPE_LABELS[deleteType]} checklist removed`)
    } catch {
      toast.error('Failed to delete checklist')
    } finally {
      setDeleteType(null)
    }
  }

  return (
    <div className="admin-projects-type-checklist-shell">
      <div className="admin-projects-type-checklist-head">
        <h2 className="admin-projects-type-checklist-head-title">Project checklists</h2>
        <div className="admin-projects-type-checklist-head-actions">
          <Button variant="secondary" size="sm" onClick={() => void handleDownloadTemplate()}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download template
          </Button>
        </div>
      </div>

      <div className="admin-projects-type-checklist-body">
        <div className="admin-projects-type-checklist-upload-bar">
          <label className="admin-projects-type-checklist-upload-label">
            Cell type
            <select
              className="admin-projects-type-checklist-upload-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as CellType)}
            >
              {CELL_TYPES.map((type) => (
                <option key={type} value={type}>{CELL_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
          <Button size="sm" disabled={uploading} onClick={() => handleUploadClick()}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {uploading ? 'Uploading…' : 'Upload checklist'}
          </Button>
        </div>

        <div className="admin-projects-type-checklist-grid">
        {CELL_TYPES.map((cellType) => {
          const item = byType.get(cellType) ?? {
            cellType,
            fileName: '',
            contentType: '',
            uploadedAt: null,
            uploadedByName: '',
            hasFile: false,
          }

          return (
            <div
              key={cellType}
              className={cn(
                'admin-projects-type-checklist-card',
                item.hasFile && 'has-file',
              )}
            >
              <div className="admin-projects-type-checklist-card-head">
                <span className="admin-projects-type-checklist-type">{CELL_TYPE_LABELS[cellType]}</span>
                {item.hasFile ? (
                  <span className="admin-projects-type-checklist-badge">Uploaded</span>
                ) : (
                  <span className="admin-projects-type-checklist-badge is-empty">No file</span>
                )}
              </div>

              {item.hasFile ? (
                <div className="admin-projects-type-checklist-file">
                  <FileSpreadsheet className="admin-projects-type-checklist-file-icon" aria-hidden />
                  <div className="admin-projects-type-checklist-file-meta">
                    <p className="admin-projects-type-checklist-file-name" title={item.fileName}>
                      {item.fileName}
                    </p>
                    {item.uploadedAt ? (
                      <p className="admin-projects-type-checklist-file-detail">
                        {new Date(item.uploadedAt).toLocaleString()}
                        {item.uploadedByName ? ` · ${item.uploadedByName}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="admin-projects-type-checklist-empty">No checklist uploaded for this type yet.</p>
              )}

              <div className="admin-projects-type-checklist-card-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!item.hasFile || loading}
                  onClick={() => void handleDownload(item)}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={uploading}
                  onClick={() => handleUploadClick(cellType)}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Replace
                </Button>
                {item.hasFile ? (
                  <button
                    type="button"
                    className="admin-projects-icon-btn admin-projects-icon-btn--danger"
                    title={`Delete ${CELL_TYPE_LABELS[cellType]} checklist`}
                    onClick={() => setDeleteType(cellType)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteType)}
        title="Delete checklist"
        description={deleteType ? `Remove the uploaded checklist for type "${CELL_TYPE_LABELS[deleteType]}"?` : ''}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteType(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
