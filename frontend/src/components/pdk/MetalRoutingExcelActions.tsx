import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import {
  downloadMetalRoutingTemplate,
  downloadProjectRoutesExcel,
  importProjectRoutesExcel,
  type MetalRoutingImportResult,
} from '@services/pdkMetalRoutingService'

export function MetalRoutingExcelActions({
  projectId,
  routeId,
  exportFilename,
  pdkAssigned = true,
  onImported,
}: {
  projectId: string
  routeId?: string
  exportFilename?: string
  /** When false, import shows a clear error instead of silently disabling the button. */
  pdkAssigned?: boolean
  onImported?: (result: MetalRoutingImportResult) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [importStatus, setImportStatus] = useState<{
    kind: 'idle' | 'success' | 'error'
    title: string
    details: string[]
  }>({ kind: 'idle', title: '', details: [] })

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadProjectRoutesExcel(projectId, {
        routeId,
        filename: exportFilename,
      })
      toast.success(routeId ? 'Route exported to Excel' : 'Project routes exported to Excel')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to export Excel')
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    if (!pdkAssigned) {
      const message = 'Assign a PDK module to this project from the Dashboard before downloading a template.'
      setImportStatus({ kind: 'error', title: 'Template blocked', details: [message] })
      toast.error(message)
      return
    }

    setDownloadingTemplate(true)
    try {
      await downloadMetalRoutingTemplate(projectId)
      setImportStatus({
        kind: 'success',
        title: 'Template downloaded',
        details: [
          'Template metal types match the PDK assigned to this project.',
          'Edit route names/signals/widths/lengths, then import the same file.',
        ],
      })
      toast.success('Template downloaded for this project PDK')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download template'
      setImportStatus({ kind: 'error', title: 'Template download failed', details: [message] })
      toast.error(message)
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const openImportPicker = () => {
    if (!pdkAssigned) {
      const message = 'Assign a PDK module to this project from the Dashboard before importing.'
      setImportStatus({ kind: 'error', title: 'Import blocked', details: [message] })
      toast.error(message)
      return
    }
    setImportStatus({ kind: 'idle', title: '', details: [] })
    fileInputRef.current?.click()
  }

  const handleImportFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      const message = 'Please upload an Excel file (.xlsx)'
      setImportStatus({ kind: 'error', title: 'Invalid file', details: [message] })
      toast.error(message)
      return
    }

    setImporting(true)
    setImportStatus({
      kind: 'idle',
      title: 'Importing…',
      details: [`Uploading ${file.name} to project ${projectId}`],
    })

    try {
      const result = await importProjectRoutesExcel(projectId, file)
      console.log('[metal-routing-import] frontend result', result)

      if (!result.success || result.savedRoutes.length === 0) {
        throw new Error(
          result.failures[0]?.reason
            ?? 'Import completed but no routes are visible in Saved routes for this project.',
        )
      }

      const details = [
        `Parsed ${result.routesParsed} route block(s) from worksheet "${result.parseDiagnostics.worksheetName}"`,
        `Imported ${result.routesImported} route(s) and ${result.metalsImported} metal row(s)`,
        `${result.savedRoutes.length} route(s) now visible in Saved routes`,
        `Merged cell ranges detected: ${result.parseDiagnostics.mergeRangeCount}`,
      ]
      if (result.routesFailed > 0) {
        details.push(`${result.routesFailed} route(s) failed — see details below`)
        result.failures.forEach((failure) => {
          details.push(`${failure.routeLabel}: ${failure.reason}`)
        })
      }

      setImportStatus({
        kind: 'success',
        title: 'Import successful',
        details,
      })

      const failureNote =
        result.routesFailed > 0
          ? ` ${result.routesFailed} route(s) failed — see details below.`
          : ''

      toast.success(
        `Imported ${result.routesImported} route(s), ${result.metalsImported} metal row(s). ${result.savedRoutes.length} visible in Saved routes.${failureNote}`,
        { duration: 6000 },
      )

      if (result.routesFailed > 0) {
        console.warn('[metal-routing-import] failures', result.failures)
      }

      onImported?.(result)
    } catch (err: unknown) {
      console.error('[metal-routing-import] frontend error', err)
      const message = err instanceof Error ? err.message : 'Failed to import Excel'
      setImportStatus({
        kind: 'error',
        title: 'Import failed',
        details: [
          message,
          'Metal types in Excel must match the assigned PDK. Download Template again from this project page to get the correct metal names.',
          'Open browser DevTools (F12) → Console and Network tabs for [metal-routing-import] logs.',
        ],
      })
      toast.error(message, { duration: 8000 })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImportFile(file)
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        loading={downloadingTemplate}
        disabled={importing || exporting}
        icon={<FileSpreadsheet className="h-4 w-4" />}
        onClick={() => void handleDownloadTemplate()}
      >
        Download Template
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        loading={importing}
        disabled={exporting || downloadingTemplate}
        icon={<Upload className="h-4 w-4" />}
        onClick={openImportPicker}
      >
        Import Excel
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        loading={exporting}
        disabled={!pdkAssigned || importing || downloadingTemplate}
        icon={<Download className="h-4 w-4" />}
        onClick={() => void handleExport()}
      >
        Export Excel
      </Button>
    </div>

    {importStatus.kind !== 'idle' || importing ? (
      <div
        className={cn(
          'rounded-lg border px-3 py-2 text-xs',
          importing && 'border-blue-200 bg-blue-50 text-blue-900',
          importStatus.kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
          importStatus.kind === 'error' && 'border-red-200 bg-red-50 text-red-900',
        )}
      >
        <div className="flex items-start gap-2">
          {importing ? null : importStatus.kind === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : importStatus.kind === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : null}
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">{importing ? 'Importing…' : importStatus.title}</p>
            {(importing ? ['Uploading and validating Excel file…'] : importStatus.details).map((line) => (
              <p key={line} className="break-words">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    ) : null}
    </div>
  )
}
