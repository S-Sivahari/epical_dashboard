import { useEffect, useRef } from 'react'
import { BookOpen, Download, MoreVertical, Pencil, Trash2, Upload } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ProjectLibrary } from '@/types/projectWorkspace'

type WorkspaceLibraryCardProps = {
  library: ProjectLibrary
  cellCount: number
  isActive: boolean
  menuOpen: boolean
  manageable?: boolean
  onSelect: () => void
  onToggleMenu: () => void
  onCloseMenu: () => void
  onImport: () => void
  onEdit: () => void
  onDelete: () => void
}

export function WorkspaceLibraryCard({
  library,
  cellCount,
  isActive,
  menuOpen,
  manageable = true,
  onSelect,
  onToggleMenu,
  onCloseMenu,
  onImport,
  onEdit,
  onDelete,
}: WorkspaceLibraryCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) {
        onCloseMenu()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [menuOpen, onCloseMenu])

  const cellLabel = `${cellCount} Cell${cellCount === 1 ? '' : 's'}`

  return (
    <div
      ref={cardRef}
      className={cn('admin-projects-library-card', isActive && 'is-active', menuOpen && 'is-menu-open')}
    >
      <div className="admin-projects-library-card-main">
        <button
          type="button"
          className="admin-projects-library-card-select"
          onClick={onSelect}
          aria-current={isActive ? 'true' : undefined}
        >
          <span className="admin-projects-library-card-icon" aria-hidden>
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="admin-projects-library-card-copy">
            <span className="admin-projects-library-card-title-row">
              <span className="admin-projects-library-card-name">{library.name}</span>
              <span className="admin-projects-library-card-count">{cellLabel}</span>
            </span>
          </span>
        </button>
        {manageable ? (
          <button
            type="button"
            className="admin-projects-library-card-menu-btn"
            aria-label={`Library actions for ${library.name}`}
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation()
              onToggleMenu()
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {menuOpen ? (
        <div className="admin-projects-library-card-actions" role="menu">
          <button type="button" className="admin-projects-library-card-action" onClick={onImport}>
            <Upload className="h-4 w-4" aria-hidden />
            Import Cells
          </button>
          <button type="button" className="admin-projects-library-card-action" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            className="admin-projects-library-card-action admin-projects-library-card-action--danger"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}

type WorkspaceLibraryToolbarProps = {
  onAddLibrary: () => void
  onDownloadTemplate?: () => void
  downloading?: boolean
  showTemplateDownload?: boolean
}

export function WorkspaceLibraryToolbar({
  onAddLibrary,
  onDownloadTemplate,
  downloading = false,
  showTemplateDownload = true,
}: WorkspaceLibraryToolbarProps) {
  return (
    <div className="admin-projects-libraries-toolbar">
      <button type="button" className="admin-projects-libraries-create" onClick={onAddLibrary}>
        <span aria-hidden>+</span> Add library
      </button>
      {showTemplateDownload && onDownloadTemplate ? (
        <button
          type="button"
          className="admin-projects-libraries-template"
          onClick={onDownloadTemplate}
          disabled={downloading}
        >
          <Download className="h-4 w-4" aria-hidden />
          {downloading ? 'Downloading…' : 'Download cell template'}
        </button>
      ) : null}
    </div>
  )
}
