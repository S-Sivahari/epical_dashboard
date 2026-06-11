import { useCallback, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
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
  showImport = true,
  showTemplate = true,
  showExport = true,
  onImported,
}: {
  projectId: string
  routeId?: string
  exportFilename?: string
  pdkAssigned?: boolean
  showImport?: boolean
  showTemplate?: boolean
  showExport?: boolean
  onImported?: (result: MetalRoutingImportResult) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [notice, setNotice] = useState<TopNotice | null>(null)

  const dismissNotice = useCallback(() => setNotice(null), [])

  const handleExport = async () => {
    setExporting(true)
    setNotice({
      kind: 'loading',
      title: 'Exporting…',
      details: ['Building .xlsx file from saved routes…'],
    })
    try {
      const filename = exportFilename?.toLowerCase().endsWith('.xlsx')
        ? exportFilename
        : `${exportFilename ?? 'metal-routing'}.xlsx`
      await downloadProjectRoutesExcel(projectId, {
        routeId,
        filename,
      })
      setNotice({
        kind: 'success',
        title: 'Export successful',
        details: [
          routeId
            ? 'This route was exported as a formatted Excel workbook (.xlsx).'
            : 'All project routes were exported as a formatted Excel workbook (.xlsx).',
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
      details: ['Preparing project PDK template (.xlsx)…'],
    })
    try {
      await downloadMetalRoutingTemplate(projectId)
      setNotice({
        kind: 'success',
        title: 'Template downloaded',
        details: [
          'Downloaded Metal Routing import template (.xlsx).',
          'Metal types match the PDK assigned to this project.',
          'Enter one Given Current Capability value per route (merged column).',
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
      details: [`Uploading ${file.name}…`],
    })

    try {
      const result = await importProjectRoutesExcel(projectId, file)

      if (!result.success) {
        throw new Error(
          result.failures[0]?.reason
            ?? 'Import did not create any signal routes for this project.',
        )
      }

      const details = [
        `Parsed ${result.routesParsed} route block(s) from worksheet "${result.parseDiagnostics.worksheetName}"`,
        `Imported ${result.routesImported} route(s) and ${result.metalsImported} metal row(s)`,
        `${result.routesImported} route(s) saved to this project`,
      ]
      if (result.routesFailed > 0) {
        details.push(`${result.routesFailed} route(s) failed`)
        result.failures.forEach((failure) => {
          details.push(`${failure.routeLabel}: ${failure.reason}`)
        })
      }

      setNotice({
        kind: 'success',
        title: 'Import successful',
        details,
      })

      onImported?.(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import Excel'
      setNotice({
        kind: 'error',
        title: 'Import failed',
        details: [
          message,
          'Metal types in Excel must match the assigned PDK. Download Template again from this project page.',
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
        {showTemplate ? (
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
        ) : null}
        {showImport ? (
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
        ) : null}
        {showExport ? (
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
        ) : null}
      </div>
    </>
  )
}
