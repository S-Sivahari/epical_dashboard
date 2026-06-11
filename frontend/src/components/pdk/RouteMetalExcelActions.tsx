import { useCallback, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import {
  downloadRouteExcel,
  downloadRouteMetalTemplate,
  importRouteMetalsExcel,
  type RouteMetalImportResult,
} from '@services/pdkMetalRoutingService'
import type { MetalRoutingRoute } from '@/types/pdkMetalRouting'

export function RouteMetalExcelActions({
  routeId,
  route,
  exportFilename,
  pdkAssigned = true,
  onImported,
}: {
  routeId: string
  route: Pick<MetalRoutingRoute, 'signal' | 'fromCell' | 'toCell'>
  exportFilename?: string
  pdkAssigned?: boolean
  onImported?: (result: RouteMetalImportResult) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [notice, setNotice] = useState<TopNotice | null>(null)

  const dismissNotice = useCallback(() => setNotice(null), [])
  const signalLabel = `${route.signal} (${route.fromCell} → ${route.toCell})`

  const handleExport = async () => {
    setExporting(true)
    setNotice({
      kind: 'loading',
      title: 'Exporting…',
      details: ['Building .xlsx for this signal…'],
    })
    try {
      const filename = exportFilename?.toLowerCase().endsWith('.xlsx')
        ? exportFilename
        : `${exportFilename ?? 'signal-metals'}.xlsx`
      await downloadRouteExcel(routeId, filename)
      setNotice({
        kind: 'success',
        title: 'Export successful',
        details: [
          `Exported metal rows for ${signalLabel} as .xlsx.`,
          `Downloaded as ${filename}`,
        ],
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to export Excel'
      setNotice({ kind: 'error', title: 'Export failed', details: [message] })
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    if (!pdkAssigned) {
      const message = 'Assign a PDK module to this project from the Dashboard before downloading a template.'
      setNotice({ kind: 'error', title: 'Template blocked', details: [message] })
      return
    }

    setDownloadingTemplate(true)
    setNotice({
      kind: 'loading',
      title: 'Downloading template…',
      details: [`Preparing template for ${signalLabel}…`],
    })
    try {
      await downloadRouteMetalTemplate(routeId)
      setNotice({
        kind: 'success',
        title: 'Template downloaded',
        details: [
          `Template is pre-filled for ${signalLabel}.`,
          'Edit metal rows only — Given Current Capability must stay the same when re-importing.',
        ],
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download template'
      setNotice({ kind: 'error', title: 'Template download failed', details: [message] })
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const openImportPicker = () => {
    if (!pdkAssigned) {
      const message = 'Assign a PDK module to this project from the Dashboard before importing.'
      setNotice({ kind: 'error', title: 'Import blocked', details: [message] })
      return
    }
    dismissNotice()
    fileInputRef.current?.click()
  }

  const handleImportFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      const message = 'Please upload an Excel file (.xlsx)'
      setNotice({ kind: 'error', title: 'Invalid file', details: [message] })
      return
    }

    setImporting(true)
    setNotice({
      kind: 'loading',
      title: 'Importing…',
      details: [`Uploading ${file.name} for ${signalLabel}…`],
    })

    try {
      const result = await importRouteMetalsExcel(routeId, file)

      setNotice({
        kind: 'success',
        title: 'Import successful',
        details: [
          `Added ${result.metalsImported} metal row(s) to ${signalLabel}.`,
          `This signal now has ${result.totalMetals} metal row(s) total.`,
          `Worksheet "${result.parseDiagnostics.worksheetName}" parsed successfully.`,
          'Import the same file again anytime to append more rows below.',
        ],
      })
      onImported?.(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import Excel'
      setNotice({
        kind: 'error',
        title: 'Import failed',
        details: [
          message,
          'Use the template from this signal page — Signal, From, To, and Given Current Capability must all match.',
        ],
      })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
      <div className="flex flex-wrap items-center justify-end gap-2">
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
          disabled={importing || downloadingTemplate}
          icon={<Download className="h-4 w-4" />}
          onClick={() => void handleExport()}
        >
          Export Excel
        </Button>
      </div>
    </>
  )
}
