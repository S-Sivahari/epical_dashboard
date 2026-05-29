import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileSpreadsheet,
  FileText,
  Loader,
  Upload,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Send,
  History,
  Eye,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { DataTable, type Column } from '@components/tables/DataTable'
import { Modal } from '@components/ui/Modal'
import { useEmployees } from '@hooks/useEmployees'
import { Avatar } from '@components/ui/Avatar'
import { SelectField } from '@components/forms/SelectField'
import { stringToHueColor } from '@/utils/stringColor'
import { toast } from 'sonner'
import { useAuthStore } from '@store/authStore'
import {
  clearPayslipUploadSession,
  readPayslipUploadSession,
  savePayslipUploadSession,
} from '@/utils/payslipUploadSession'
import {
  downloadPayrollTemplate,
  uploadPayroll,
  getPayrollBatch,
  listBatches,
  openPayslipPdf,
  downloadPayslipPdf,
  downloadAllPayslipPdfs,
  downloadUploadedExcel,
  sendPayslipToDashboard,
  sendAllPayslipsToDashboard,
  deletePayrollBatch,
  deletePayslip,
  getTemplateMeta,
  type PayrollBatch,
  type PayslipResult,
  type TemplateMeta,
} from '@services/payslipService'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PayslipRow {
  id: string
  empId: string
  name: string
  status: 'success' | 'error' | 'pending'
  fileName?: string
  error?: string
  sent?: boolean
  employeeDbId?: string
}

type TabId = 'upload' | 'history'

const CALENDAR_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const MONTH_NAME_TO_NUM: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

function parseBatchPayPeriod(batch: PayrollBatch): { year: number; month: number } | null {
  if (batch.payYear != null && batch.payMonthNum != null) {
    return { year: batch.payYear, month: batch.payMonthNum }
  }
  const key = batch.payPeriodKey?.match(/^(\d{4})-(\d{2})$/)
  if (key) {
    return { year: parseInt(key[1], 10), month: parseInt(key[2], 10) }
  }
  const label = (batch.payMonth ?? '').trim().toLowerCase()
  if (!label) return null
  const yearMatch = label.match(/\b(20\d{2})\b/)
  if (!yearMatch) return null
  const year = parseInt(yearMatch[1], 10)
  const monthEntries = Object.entries(MONTH_NAME_TO_NUM).sort((a, b) => b[0].length - a[0].length)
  for (const [name, num] of monthEntries) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(label)) {
      return { year, month: num }
    }
  }
  const numeric = label.match(/\b(0?[1-9]|1[0-2])\D{0,4}(20\d{2})\b/)
  if (numeric) {
    return { year: parseInt(numeric[2], 10), month: parseInt(numeric[1], 10) }
  }
  return null
}

function batchMatchesPeriod(
  batch: PayrollBatch,
  year: number,
  month: number
): boolean {
  const period = parseBatchPayPeriod(batch)
  return period?.year === year && period?.month === month
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PayslipManagement({ embedded: _embedded = false }: { embedded?: boolean }) {
  const { employees, loading: employeesLoading } = useEmployees()
  const userId = useAuthStore((s) => s.user?.id)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Tabs
  const [activeTab, setActiveTab] = useState<TabId>('upload')

  // Upload tab state — empty on open; only restored from current login session (refresh-safe)
  const [batch, setBatch] = useState<PayrollBatch | null>(null)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [deletingBatch, setDeletingBatch] = useState(false)
  const [deletingPayslip, setDeletingPayslip] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [payslipDeleteTarget, setPayslipDeleteTarget] = useState<{ fileName: string; name: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [replaceConfirm, setReplaceConfirm] = useState<{
    payMonth: string
    existingBatchId: string
    originalFileName?: string
  } | null>(null)

  const [templateMeta, setTemplateMeta] = useState<TemplateMeta | null>(null)

  // PDF Preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // History tab state
  const [allBatches, setAllBatches] = useState<PayrollBatch[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [historyYear, setHistoryYear] = useState('')
  const [historyMonth, setHistoryMonth] = useState('')


  // ── Loaders ────────────────────────────────────────────────────────────────

  const setUploadBatch = useCallback(
    (next: PayrollBatch | null) => {
      setBatch(next)
      if (!userId) return
      if (next) savePayslipUploadSession(userId, next.id)
      else clearPayslipUploadSession()
    },
    [userId],
  )

  const restoreSessionBatch = useCallback(async () => {
    if (!userId) {
      setBatch(null)
      return
    }

    const batchId = readPayslipUploadSession(userId)
    if (!batchId) {
      setBatch(null)
      return
    }

    setLoadingBatch(true)
    try {
      const restored = await getPayrollBatch(batchId)
      setBatch(restored)
    } catch {
      clearPayslipUploadSession()
      setBatch(null)
    } finally {
      setLoadingBatch(false)
    }
  }, [userId])

  const loadAllBatches = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const batches = await listBatches()
      setAllBatches(batches)
    } catch {
      toast.error('Failed to load batch history')
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    void restoreSessionBatch()
    void loadTemplateMeta()
  }, [restoreSessionBatch])

  useEffect(() => {
    if (!userId) {
      setBatch(null)
      clearPayslipUploadSession()
    }
  }, [userId])

  useEffect(() => {
    if (activeTab === 'history') {
      void loadAllBatches()
    }
  }, [activeTab, loadAllBatches])

  useEffect(() => {
    setExpandedBatchId(null)
  }, [historyYear, historyMonth])

  const historyYearOptions = useMemo(() => {
    const years = new Set<number>()
    for (const b of allBatches) {
      const period = parseBatchPayPeriod(b)
      if (period) years.add(period.year)
    }
    return [
      { value: '', label: 'Select year' },
      ...[...years].sort((a, b) => b - a).map((y) => ({
        value: String(y),
        label: String(y),
      })),
    ]
  }, [allBatches])

  const historyMonthOptions = useMemo(() => {
    const year = parseInt(historyYear, 10)
    if (!historyYear || Number.isNaN(year)) {
      return [{ value: '', label: 'Select month' }]
    }
    const months = new Set<number>()
    for (const b of allBatches) {
      const period = parseBatchPayPeriod(b)
      if (period?.year === year) months.add(period.month)
    }
    return [
      { value: '', label: 'Select month' },
      ...[...months]
        .sort((a, b) => a - b)
        .map((m) => ({
          value: String(m),
          label: CALENDAR_MONTHS[m - 1] ?? String(m),
        })),
    ]
  }, [allBatches, historyYear])

  const historyPeriodSelected = Boolean(historyYear && historyMonth)

  const loadTemplateMeta = async () => {
    try {
      const meta = await getTemplateMeta()
      setTemplateMeta(meta)
    } catch {
      toast.error('Failed to load template info')
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const buildEmployeeDbIdMap = (): Record<string, string> => {
    const map: Record<string, string> = {}
    if (!batch) return map
    for (const r of batch.results) {
      const dbEmp = employees.find((e) => String(e.employeeId) === String(r.empId))
      if (dbEmp?.id) map[r.empId] = dbEmp.id
    }
    return map
  }

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewName('')
  }

  const handleDownloadPayslip = async (
    batchId: string,
    fileName: string,
    downloadName: string
  ) => {
    try {
      await downloadPayslipPdf(batchId, fileName, downloadName)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download payslip PDF'
      toast.error(message)
    }
  }

  const handlePreview = async (batchId: string, fileName: string, name: string) => {
    setPreviewLoading(true)
    setPreviewName(name)
    try {
      const url = await openPayslipPdf(batchId, fileName)
      setPreviewUrl(url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load PDF preview'
      toast.error(message)
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── Upload tab handlers ────────────────────────────────────────────────────

  const handleDownloadTemplate = async () => {
    try {
      await downloadPayrollTemplate(templateMeta?.name)
    } catch {
      toast.error('Failed to download template')
    }
  }

  const handleFileSelect = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)')
      return
    }
    setSelectedFile(file)
  }

  const runPayrollUpload = async (
    file: File,
    options?: { replaceBatchId?: string; resendPayslips?: boolean }
  ) => {
    setUploading(true)
    try {
      const result = await uploadPayroll(file, {
        replaceBatchId: options?.replaceBatchId,
        resendPayslips: options?.resendPayslips,
        employeeDbIdByEmpId: options?.resendPayslips ? buildEmployeeDbIdMap() : undefined,
      })
      const newBatch = result.batch
      setUploadBatch(newBatch)
      setSelectedFile(null)
      setReplaceConfirm(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      if (newBatch.totalFailed > 0) {
        toast.warning(`${newBatch.totalFailed} payslip(s) failed to generate`)
      }
      if (activeTab === 'history') {
        void loadAllBatches()
      }
    } catch (error: unknown) {
      const dup = (error as Error & { duplicatePayPeriod?: { payMonth?: string; existingBatch: PayrollBatch } })
        .duplicatePayPeriod
      if (dup?.existingBatch) {
        setReplaceConfirm({
          payMonth: dup.payMonth || dup.existingBatch.payMonth || 'this period',
          existingBatchId: dup.existingBatch.id,
          originalFileName: dup.existingBatch.originalFileName,
        })
        return
      }
      const message = error instanceof Error ? error.message : 'Failed to process payroll file'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const handleUploadAndProcess = async () => {
    if (!selectedFile) {
      toast.error('Choose an Excel file to upload')
      return
    }
    await runPayrollUpload(selectedFile)
  }

  const handleConfirmReplace = async () => {
    if (!selectedFile || !replaceConfirm) return
    await runPayrollUpload(selectedFile, {
      replaceBatchId: replaceConfirm.existingBatchId,
      resendPayslips: false,
    })
  }

  const handleDeleteBatch = async () => {
    if (!batch) return
    setDeletingBatch(true)
    try {
      await deletePayrollBatch(batch.id)
      setUploadBatch(null)
      setBatchDeleteOpen(false)
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to delete payroll upload'
      toast.error(message)
    } finally {
      setDeletingBatch(false)
    }
  }

  const handleDeletePayslip = async () => {
    if (!batch || !payslipDeleteTarget) return
    setDeletingPayslip(payslipDeleteTarget.fileName)
    try {
      const updated = await deletePayslip(batch.id, payslipDeleteTarget.fileName)
      setUploadBatch(updated)
      setPayslipDeleteTarget(null)
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to delete payslip'
      toast.error(message)
    } finally {
      setDeletingPayslip(null)
    }
  }

  const unsentCount =
    batch?.results.filter((r) => r.status === 'success' && r.fileName && !r.sent).length ?? 0

  const handleSendAll = async () => {
    if (!batch || unsentCount === 0) {
      return
    }
    setSendingAll(true)
    try {
      const result = await sendAllPayslipsToDashboard(batch.id, buildEmployeeDbIdMap())
      setUploadBatch(result.batch)
      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} failed: ${result.failed.map((f) => f.empId).join(', ')}`)
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to send payslips'
      toast.error(message)
    } finally {
      setSendingAll(false)
    }
  }

  const handleDownloadAll = async (targetBatch: PayrollBatch) => {
    if ((targetBatch.totalGenerated ?? 0) === 0) {
      return
    }
    setDownloadingAll(true)
    try {
      await downloadAllPayslipPdfs(targetBatch.id, targetBatch.payMonth)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'Failed to download merged payslips'
      toast.error(message)
    } finally {
      setDownloadingAll(false)
    }
  }

  const handleSend = async (empId: string, fileName: string, _name: string, employeeDbId?: string) => {
    if (!batch) return
    setSendingId(empId)
    try {
      const updated = await sendPayslipToDashboard(batch.id, empId, fileName, employeeDbId)
      setUploadBatch(updated)
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to send payslip'
      toast.error(message)
    } finally {
      setSendingId(null)
    }
  }

  // ── Table data ─────────────────────────────────────────────────────────────

  const payrollRows: PayslipRow[] = batch
    ? batch.results.map((r: PayslipResult) => {
        const dbEmp = employees.find((e) => String(e.employeeId) === String(r.empId))
        return {
          id: r.empId,
          empId: r.empId,
          name: r.name || (dbEmp ? `${dbEmp.firstName} ${dbEmp.lastName}`.trim() : r.empId),
          status: r.status,
          fileName: r.fileName,
          error: r.error,
          sent: r.sent,
          employeeDbId: dbEmp?.id,
        }
      })
    : []

  const columns: Column<PayslipRow>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar name={r.name} size="sm" color={stringToHueColor(r.empId)} />
          <div>
            <span className="block font-medium text-white">{r.name}</span>
            <span className="text-xs text-[#94a3b8]">{r.empId}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Payslip Status',
      render: (r) => {
        if (r.sent) {
          return (
            <span className="inline-flex items-center gap-1 text-sm text-[#34d399]">
              <CheckCircle2 className="h-4 w-4" /> Sent to dashboard
            </span>
          )
        }
        if (r.status === 'success') {
          return (
            <span className="inline-flex items-center gap-1 text-sm text-[#38bdf8]">
              <CheckCircle2 className="h-4 w-4" /> Generated
            </span>
          )
        }
        if (r.status === 'error') {
          return (
            <span className="inline-flex items-center gap-1 text-sm text-[#f87171]" title={r.error}>
              <AlertCircle className="h-4 w-4" /> Failed
            </span>
          )
        }
        return <span className="text-sm text-[#94a3b8]">Awaiting upload</span>
      },
    },
    {
      key: 'empId',
      header: (
        <div className="flex items-center gap-2">
          <span>Actions</span>
          {batch && (batch.totalGenerated ?? 0) > 0 && (
            <Button
              size="sm"
              variant="secondary"
              disabled={downloadingAll}
              onClick={() => void handleDownloadAll(batch)}
              title="Download all payslips as one PDF"
            >
              {downloadingAll ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-[#f87171]" />
              )}
              Download All
            </Button>
          )}
        </div>
      ),
      className: 'min-w-[420px]',
      render: (r) => {
        if (!batch || r.status !== 'success' || !r.fileName) {
          return <span className="text-sm text-[#94a3b8]">—</span>
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={previewLoading}
              onClick={() => void handlePreview(batch.id, r.fileName!, r.name)}
              title="Preview PDF"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleDownloadPayslip(batch.id, r.fileName!, `Payslip_${r.name}.pdf`)}
              title="Download PDF"
            >
              <FileText className="h-3.5 w-3.5 text-[#f87171]" />
              Download PDF
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={r.sent || sendingId === r.empId}
              onClick={() => void handleSend(r.empId, r.fileName!, r.name, r.employeeDbId)}
            >
              {sendingId === r.empId ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {r.sent ? 'Sent' : 'Send'}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={deletingPayslip === r.fileName}
              onClick={() => setPayslipDeleteTarget({ fileName: r.fileName!, name: r.name })}
            >
              {deletingPayslip === r.fileName ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </Button>
          </div>
        )
      },
    },
  ]

  // ── History batch list ─────────────────────────────────────────────────────

  const filteredBatches = useMemo(() => {
    if (!historyPeriodSelected) return []
    const year = parseInt(historyYear, 10)
    const month = parseInt(historyMonth, 10)
    if (Number.isNaN(year) || Number.isNaN(month)) return []
    return allBatches.filter((b) => batchMatchesPeriod(b, year, month))
  }, [allBatches, historyYear, historyMonth, historyPeriodSelected])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageWrapper className="admin-page">
      <div className="crewiq-dashboard">
        <header className="mb-6 flex flex-col gap-3 border-b border-[rgba(161,161,170,0.18)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-[rgba(161,161,170,0.18)] bg-[rgba(39,39,42,0.88)] p-1 w-fit">
          {(
            [
              { id: 'upload' as TabId, label: 'Upload & Generate', icon: Upload },
              { id: 'history' as TabId, label: 'History', icon: History },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-[rgba(39,39,42,0.88)] text-[#38bdf8] shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <Button variant="secondary" onClick={() => void handleDownloadTemplate()}>
          <FileSpreadsheet className="h-4 w-4" />
          Download Template
        </Button>
      </header>
  
      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-5">
          {/* Upload Section */}
          <section className="admin-card rounded-2xl border border-[rgba(161,161,170,0.18)] bg-[rgba(39,39,42,0.88)] p-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
  
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Choose Excel File
                </Button>
  
                {selectedFile && (
                  <span className="inline-flex items-center rounded-lg border border-[rgba(161,161,170,0.18)] bg-[rgba(39,39,42,0.88)] px-3 py-1.5 text-sm text-white">
                    <strong className="truncate max-w-[240px]">
                      {selectedFile.name}
                    </strong>
                  </span>
                )}
  
                <Button
                  className="sm:ml-auto"
                  onClick={handleUploadAndProcess}
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Upload & Generate Payslips
                </Button>
              </div>
  
              {batch && (
                <div className="rounded-xl border border-[rgba(161,161,170,0.18)] bg-[rgba(39,39,42,0.88)]/40 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left */}
                    <div>
                      <p className="font-semibold text-white">
                        {batch.originalFileName}
                      </p>
  
                      {batch.payMonth && (
                        <p className="text-sm text-[#94a3b8]">
                          {batch.payMonth}
                        </p>
                      )}
  
                      <p className="text-xs text-[#94a3b8]">
                        {new Date(batch.uploadedAt).toLocaleString()}
                      </p>
  
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1 text-[#38bdf8]">
                          <CheckCircle2 className="h-4 w-4" />
                          {batch.totalGenerated} Generated
                        </span>
  
                        <span className="flex items-center gap-1 text-[#34d399]">
                          <Send className="h-4 w-4" />
                          {batch.totalSent ?? 0} Sent
                        </span>
  
                        {batch.totalFailed > 0 && (
                          <span className="flex items-center gap-1 text-[#f87171]">
                            <AlertCircle className="h-4 w-4" />
                            {batch.totalFailed} Failed
                          </span>
                        )}
                      </div>
                    </div>
  
                    {/* Right */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={sendingAll || unsentCount === 0}
                        onClick={handleSendAll}
                      >
                        {sendingAll ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Send All
                      </Button>
  
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          downloadUploadedExcel(
                            batch.id,
                            batch.originalFileName
                          )
                        }
                      >
                        <FileSpreadsheet className="h-4 w-4 text-[#34d399]" />
                        Download Excel
                      </Button>
  
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={deletingBatch}
                        onClick={() => setBatchDeleteOpen(true)}
                      >
                        {deletingBatch ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
  
          {/* Payslip Table */}
          <section className="admin-table overflow-hidden rounded-2xl border border-[rgba(161,161,170,0.18)] bg-[rgba(39,39,42,0.88)] shadow-sm">
            <DataTable
              columns={columns}
              data={payrollRows}
              loading={employeesLoading || loadingBatch}
              empty={
                <div className="py-10 text-center">
                  <p className="text-[#94a3b8]">No payslips generated yet.</p>
                </div>
              }
            />
          </section>
        </div>
      )}
  
      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          <div className="space-y-4">
              <div className="flex flex-nowrap items-end gap-3">
                <div className="w-36 shrink-0">
                  <SelectField
                    label="Year"
                    value={historyYear}
                    onChange={(e) => {
                      setHistoryYear(e.target.value)
                      setHistoryMonth('')
                    }}
                    options={historyYearOptions}
                  />
                </div>
                <div className="w-44 shrink-0">
                  <SelectField
                    label="Month"
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                    disabled={!historyYear}
                    options={historyMonthOptions}
                  />
                </div>
                {historyPeriodSelected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-0.5 shrink-0"
                    onClick={() => {
                      setHistoryYear('')
                      setHistoryMonth('')
                    }}
                  >
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
              </div>

              {loadingHistory ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[rgba(161,161,170,0.18)]">
                  <Loader className="h-5 w-5 animate-spin text-[#94a3b8]" />
                </div>
              ) : !historyPeriodSelected ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[rgba(161,161,170,0.18)]">
                  <p className="text-sm text-[#94a3b8]">Select a year and month to view payroll history.</p>
                </div>
              ) : filteredBatches.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[rgba(161,161,170,0.18)]">
                  <p className="text-sm text-[#94a3b8]">
                    No payroll upload for{' '}
                    {CALENDAR_MONTHS[parseInt(historyMonth, 10) - 1] ?? historyMonth} {historyYear}.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBatches.map((b) => {
                    const isExpanded = expandedBatchId === b.id
                    const sentCount = b.totalSent ?? 0
                    return (
                      <div
                        key={b.id}
                        className="rounded-xl border border-[rgba(161,161,170,0.18)] bg-[rgba(39,39,42,0.88)] shadow-sm overflow-hidden"
                      >
                        {/* Batch header */}
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-[rgba(161,161,170,0.08)] transition-colors"
                          onClick={() => setExpandedBatchId(isExpanded ? null : b.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center bg-[#38bdf8]/10">
                              <FileText className="h-5 w-5 text-[#38bdf8]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">
                                {b.payMonth || 'Unknown Month'}
                              </p>
                              <p className="text-xs text-[#94a3b8] truncate">{b.originalFileName}</p>
                              <p className="text-xs text-[#94a3b8]">
                                {new Date(b.uploadedAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 shrink-0">
                            <div className="hidden sm:flex gap-5 text-sm">
                              <span className="text-center">
                                <p className="font-bold text-white">{b.employeeCount}</p>
                                <p className="text-xs text-[#94a3b8]">employees</p>
                              </span>
                              <span className="text-center">
                                <p className="font-bold text-[#38bdf8]">{b.totalGenerated}</p>
                                <p className="text-xs text-[#94a3b8]">generated</p>
                              </span>
                              <span className="text-center">
                                <p className="font-bold text-[#34d399]">{sentCount}</p>
                                <p className="text-xs text-[#94a3b8]">sent</p>
                              </span>
                              {b.totalFailed > 0 && (
                                <span className="text-center">
                                  <p className="font-bold text-[#f87171]">{b.totalFailed}</p>
                                  <p className="text-xs text-[#94a3b8]">failed</p>
                                </span>
                              )}
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-[#94a3b8]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-[#94a3b8]" />
                            )}
                          </div>
                        </button>

                        {/* Expanded payslip list */}
                        {isExpanded && (
                          <div className="border-t border-[rgba(161,161,170,0.18)]">
                            <div className="p-3 flex justify-end gap-2 bg-[rgba(39,39,42,0.88)]/30">
                              {(b.totalGenerated ?? 0) > 0 && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={downloadingAll}
                                  onClick={() => void handleDownloadAll(b)}
                                >
                                  {downloadingAll ? (
                                    <Loader className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5 text-[#f87171]" />
                                  )}
                                  Download All PDFs
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => downloadUploadedExcel(b.id, b.originalFileName)}
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-[#34d399]" />
                                Download Excel
                              </Button>
                            </div>
                            <div className="divide-y divide-[rgba(161,161,170,0.18)]/60">
                              {b.results
                                .filter((r) => r.status === 'success' && r.fileName)
                                .map((r) => (
                                  <div
                                    key={r.fileName}
                                    className="flex items-center justify-between px-4 py-2.5 hover:bg-[rgba(161,161,170,0.08)] transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Avatar
                                        name={r.name}
                                        size="sm"
                                        color={stringToHueColor(r.empId)}
                                      />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{r.name}</p>
                                        <p className="text-xs text-[#94a3b8]">{r.empId}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {r.sent && (
                                        <span className="inline-flex items-center gap-1 text-xs text-[#34d399] mr-1">
                                          <CheckCircle2 className="h-3 w-3" /> Sent
                                        </span>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => void handlePreview(b.id, r.fileName!, r.name)}
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Preview
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() =>
                                          void handleDownloadPayslip(
                                            b.id,
                                            r.fileName!,
                                            `Payslip_${r.name}_${b.payMonth || b.id}.pdf`
                                          )
                                        }
                                      >
                                        <FileText className="h-3.5 w-3.5 text-[#f87171]" />
                                        Download PDF
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              {b.results.filter((r) => r.status === 'error').map((r) => (
                                <div
                                  key={r.empId + '-err'}
                                  className="flex items-center gap-3 px-4 py-2.5 bg-[#f87171]/10"
                                >
                                  <AlertCircle className="h-4 w-4 text-[#f87171] shrink-0" />
                                  <span className="text-sm text-[#f87171]">
                                    {r.name} ({r.empId}) — {r.error || 'Generation failed'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!previewUrl}
        onClose={closePreview}
        title={`Payslip Preview — ${previewName}`}
        size="xl"
      >
        {previewUrl && (
          <div className="space-y-3">
            <iframe
              src={previewUrl}
              title="Payslip PDF Preview"
              className="w-full rounded-lg border border-[rgba(161,161,170,0.18)]"
              style={{ height: '70vh' }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </Button>
              <Button variant="ghost" onClick={closePreview}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={batchDeleteOpen}
        title="Delete payroll upload?"
        description={`This will permanently delete "${batch?.originalFileName}" and all ${batch?.totalGenerated ?? 0} generated payslip PDF(s). This cannot be undone.`}
        confirmLabel="Delete all"
        danger
        onClose={() => setBatchDeleteOpen(false)}
        onConfirm={handleDeleteBatch}
      />

      <ConfirmModal
        isOpen={!!payslipDeleteTarget}
        title="Delete payslip?"
        description={`Remove the generated PDF for ${payslipDeleteTarget?.name ?? 'this employee'}?`}
        confirmLabel="Delete"
        danger
        onClose={() => setPayslipDeleteTarget(null)}
        onConfirm={handleDeletePayslip}
      />

      <ConfirmModal
        isOpen={!!replaceConfirm}
        title="Payslip already exists for this month"
        description={
          replaceConfirm
            ? `Payroll for ${replaceConfirm.payMonth} was already uploaded${replaceConfirm.originalFileName ? ` (${replaceConfirm.originalFileName})` : ''}. Replace it with this file? Payslips will be regenerated and Send will be available again to publish updates to employee dashboards.`
            : ''
        }
        confirmLabel="Replace & regenerate"
        onClose={() => setReplaceConfirm(null)}
        onConfirm={handleConfirmReplace}
      />
      </div>
    </PageWrapper>
  )
}