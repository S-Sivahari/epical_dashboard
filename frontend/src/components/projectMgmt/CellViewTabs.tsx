import { useRef, useState } from 'react'
import {
  Download,
  FileCode2,
  FileImage,
  LayoutGrid,
  Loader2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CellViews } from '@/services/projectMgmtService'
import {
  downloadCellView,
  uploadCellView,
  type ViewType,
} from '@/services/projectMgmtService'
import { StagePipeline } from './StagePipeline'
import type { CellStage, CellStageStatus } from '@/services/projectMgmtService'
import { cn } from '@/utils/cn'

const VIEW_META: Record<ViewType, { label: string; icon: typeof FileCode2; description: string }> = {
  schematic: {
    label: 'Schematic',
    icon: FileCode2,
    description: 'Circuit schematic diagram',
  },
  symbol: {
    label: 'Symbol',
    icon: LayoutGrid,
    description: 'Cell symbol representation',
  },
  layout: {
    label: 'Layout',
    icon: FileImage,
    description: 'Physical layout with stage pipeline',
  },
}

interface CellViewTabsProps {
  cellId: string
  views: CellViews
  currentStage: CellStage
  stageStatus: CellStageStatus
  canUpload?: boolean
  onRefresh: () => void
}

export function CellViewTabs({
  cellId,
  views,
  currentStage,
  stageStatus,
  canUpload = true,
  onRefresh,
}: CellViewTabsProps) {
  const [activeView, setActiveView] = useState<ViewType>('layout')
  const [uploading, setUploading] = useState<ViewType | null>(null)
  const [downloading, setDownloading] = useState<ViewType | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (viewType: ViewType, file: File) => {
    try {
      setUploading(viewType)
      await uploadCellView(cellId, viewType, file)
      toast.success(`${VIEW_META[viewType].label} uploaded`)
      onRefresh()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  const handleDownload = async (viewType: ViewType) => {
    const view = views[viewType]
    if (!view?.hasFile) {
      toast.error('No file uploaded yet')
      return
    }
    try {
      setDownloading(viewType)
      await downloadCellView(cellId, viewType, view.fileName)
    } catch {
      toast.error('Download failed')
    } finally {
      setDownloading(null)
    }
  }

  const triggerUpload = (viewType: ViewType) => {
    setActiveView(viewType)
    fileInputRef.current?.click()
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex border-b border-border bg-slate-50/50">
        {(Object.keys(VIEW_META) as ViewType[]).map((view) => {
          const meta = VIEW_META[view]
          const Icon = meta.icon
          const hasFile = views[view]?.hasFile
          return (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              className={cn(
                'relative flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors',
                activeView === view
                  ? 'bg-white text-primary'
                  : 'text-muted hover:bg-white/60 hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" />
              {meta.label}
              {hasFile && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500" />
              )}
              {activeView === view && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
              )}
            </button>
          )
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.gds,.gds2,.oas,.png,.jpg,.jpeg,.svg,.cdl,.sp,.txt,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleUpload(activeView, file)
          e.target.value = ''
        }}
      />

      <div className="p-5">
        {activeView === 'layout' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-gradient-to-br from-slate-50 to-white p-5">
              <StagePipeline currentStage={currentStage} stageStatus={stageStatus} />
            </div>
            {views.layout?.hasFile && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-emerald-800">Layout file attached</p>
                  <p className="text-[11px] text-emerald-600">{views.layout.fileName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownload('layout')}
                  disabled={downloading === 'layout'}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
                >
                  {downloading === 'layout' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Download
                </button>
              </div>
            )}
          </div>
        ) : (
          <ViewFilePanel
            viewType={activeView}
            view={views[activeView]}
            canUpload={canUpload}
            uploading={uploading === activeView}
            downloading={downloading === activeView}
            onUpload={() => triggerUpload(activeView)}
            onDownload={() => void handleDownload(activeView)}
          />
        )}

        {canUpload && activeView !== 'layout' && (
          <div className="mt-4 flex justify-end border-t border-border pt-4">
            <button
              type="button"
              onClick={() => triggerUpload(activeView)}
              disabled={uploading === activeView}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading === activeView ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload {VIEW_META[activeView].label}
            </button>
          </div>
        )}

        {canUpload && activeView === 'layout' && !views.layout?.hasFile && (
          <div className="mt-4 flex justify-end border-t border-border pt-4">
            <button
              type="button"
              onClick={() => triggerUpload('layout')}
              disabled={uploading === 'layout'}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {uploading === 'layout' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Attach Layout File
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ViewFilePanel({
  viewType,
  view,
  canUpload,
  uploading,
  downloading,
  onUpload,
  onDownload,
}: {
  viewType: ViewType
  view?: CellViews[ViewType]
  canUpload: boolean
  uploading: boolean
  downloading: boolean
  onUpload: () => void
  onDownload: () => void
}) {
  const meta = VIEW_META[viewType]
  const Icon = meta.icon

  if (!view?.hasFile) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50/50 py-14 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Icon className="h-7 w-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-600">{meta.label} View</p>
        <p className="mt-1 max-w-xs text-xs text-muted">{meta.description}</p>
        {canUpload && (
          <button
            type="button"
            onClick={onUpload}
            disabled={uploading}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload File
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-slate-50 to-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{view.fileName}</p>
          <p className="mt-0.5 text-xs text-muted">
            Uploaded {view.uploadedAt ? new Date(view.uploadedAt).toLocaleDateString() : ''}
            {view.uploadedByName ? ` by ${view.uploadedByName}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-xs font-semibold text-ink shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download
        </button>
      </div>
    </div>
  )
}
