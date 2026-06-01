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
  Sparkles,
} from 'lucide-react'
import { cn } from '@/utils/cn'
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

function batchMatchesPeriod(batch: PayrollBatch, year: number, month: number): boolean {
  const period = parseBatchPayPeriod(batch)
  return period?.year === year && period?.month === month
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PayslipManagement({ embedded: _embedded = false }: { embedded?: boolean }) {
  const isAdminPayslips = !_embedded
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
  const [payslipDeleteTarget, setPayslipDeleteTarget] = useState<{
    fileName: string
    name: string
  } | null>(null)
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
      ...[...years]
        .sort((a, b) => b - a)
        .map((y) => ({
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

  const handleDownloadPayslip = async (batchId: string, fileName: string, downloadName: string) => {
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
    options?: { replaceBatchId?: string; resendPayslips?: boolean },
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
      const dup = (
        error as Error & { duplicatePayPeriod?: { payMonth?: string; existingBatch: PayrollBatch } }
      ).duplicatePayPeriod
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
        toast.warning(
          `${result.failed.length} failed: ${result.failed.map((f) => f.empId).join(', ')}`,
        )
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

  const handleSend = async (
    empId: string,
    fileName: string,
    _name: string,
    employeeDbId?: string,
  ) => {
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
            <span className="block font-medium text-ink">{r.name}</span>
            <span className="text-xs text-muted">{r.empId}</span>
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
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--emerald-dark)]">
              <CheckCircle2 className="h-4 w-4" /> Sent to dashboard
            </span>
          )
        }
        if (r.status === 'success') {
          return (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#2f7d24]">
              <CheckCircle2 className="h-4 w-4" /> Generated
            </span>
          )
        }
        if (r.status === 'error') {
          return (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-danger" title={r.error}>
              <AlertCircle className="h-4 w-4" /> Failed
            </span>
          )
        }
        return <span className="text-sm text-muted">Awaiting upload</span>
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
              className="admin-payslip-secondary-btn"
              disabled={downloadingAll}
              onClick={() => void handleDownloadAll(batch)}
              title="Download all payslips as one PDF"
            >
              {downloadingAll ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Download All
            </Button>
          )}
        </div>
      ),
      className: 'min-w-[420px]',
      render: (r) => {
        if (!batch || r.status !== 'success' || !r.fileName) {
          return <span className="text-sm text-muted">—</span>
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              className="admin-payslip-secondary-btn"
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
              className="admin-payslip-secondary-btn"
              onClick={() =>
                void handleDownloadPayslip(batch.id, r.fileName!, `Payslip_${r.name}.pdf`)
              }
              title="Download PDF"
            >
              <FileText className="h-3.5 w-3.5" />
              Download PDF
            </Button>
            <Button
              size="sm"
              className="admin-dash-action-btn border-0"
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

  const tabItems = [
    { id: 'upload' as TabId, label: 'Upload & Generate', icon: Upload },
    { id: 'history' as TabId, label: 'History', icon: History },
  ]

  const batchSummary = batch ? (
    <div className="admin-payslip-batch-summary rounded-xl p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-semibold text-ink">{batch.originalFileName}</p>
          {batch.payMonth && <p className="text-sm text-muted">{batch.payMonth}</p>}
          <p className="text-xs text-muted">{new Date(batch.uploadedAt).toLocaleString()}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
            <span className="flex items-center gap-1 text-[var(--emerald-dark)]">
              <CheckCircle2 className="h-4 w-4" />
              {batch.totalGenerated} Generated
            </span>
            <span className="flex items-center gap-1 text-[#2f7d24]">
              <Send className="h-4 w-4" />
              {batch.totalSent ?? 0} Sent
            </span>
            {batch.totalFailed > 0 && (
              <span className="flex items-center gap-1 text-danger">
                <AlertCircle className="h-4 w-4" />
                {batch.totalFailed} Failed
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="admin-dash-action-btn border-0"
            disabled={sendingAll || unsentCount === 0}
            onClick={handleSendAll}
          >
            {sendingAll ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send All
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="admin-payslip-secondary-btn"
            onClick={() => downloadUploadedExcel(batch.id, batch.originalFileName)}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download Excel
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={deletingBatch}
            onClick={() => setBatchDeleteOpen(true)}
          >
            {deletingBatch ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  ) : null

  const payslipTable = (
    <div className={cn(isAdminPayslips ? 'admin-payslip-table-wrap overflow-hidden' : 'admin-table overflow-hidden rounded-2xl border border-border bg-white shadow-sm')}>
      <DataTable
        columns={columns}
        data={payrollRows}
        loading={employeesLoading || loadingBatch}
        empty={
          <div className={cn('py-10 text-center', isAdminPayslips && 'admin-payslip-empty')}>
            <FileText className={cn('mx-auto mb-2 h-8 w-8', isAdminPayslips ? 'text-[var(--emerald-dark)]/40' : 'text-muted')} />
            <p className={isAdminPayslips ? 'text-sm font-semibold text-[var(--emerald-dark)]' : 'text-muted'}>
              No payslips generated yet.
            </p>
            <p className="mt-1 text-xs text-muted">Upload an Excel payroll file to generate payslips.</p>
          </div>
        }
      />
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageWrapper className={cn(isAdminPayslips ? 'relative z-10 py-3 font-body' : 'admin-page')}>
      <div className={cn('crewiq-dashboard', isAdminPayslips && 'admin-payslips-view')}>
        {isAdminPayslips ? (
          <div className="admin-payslips-shell animate-fadeIn">
            <div className="admin-payslips-hero">
              <div className="admin-payslips-hero-top">
                <div className="min-w-0">
                  <h1 className="admin-payslips-hero-title font-display">Payslip Management</h1>
                  <p className="admin-payslips-hero-sub">Upload payroll, generate PDFs, and publish to employee dashboards</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="admin-payslips-tab-rail">
                    {tabItems.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveTab(id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[11px] font-bold transition-all duration-200',
                          activeTab === id ? 'admin-dash-action-btn-sm text-white' : 'admin-payslips-tab-inactive',
                        )}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        {label}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className="admin-payslips-template-btn h-8 gap-1.5 rounded-md px-3 text-[11px] font-bold"
                    onClick={() => void handleDownloadTemplate()}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Download Template
                  </Button>
                </div>
              </div>
              {activeTab === 'upload' && batch && (
                <div className="admin-payslips-metrics-band">
                  <div className="admin-payslips-metric-glass">
                    <p className="admin-payslips-metric-label">Generated</p>
                    <p className="admin-payslips-metric-value font-display">{batch.totalGenerated}</p>
                  </div>
                  <div className="admin-payslips-metric-glass">
                    <p className="admin-payslips-metric-label">Sent</p>
                    <p className="admin-payslips-metric-value font-display">{batch.totalSent ?? 0}</p>
                  </div>
                  <div className="admin-payslips-metric-glass">
                    <p className="admin-payslips-metric-label">Pending Send</p>
                    <p className="admin-payslips-metric-value font-display">{unsentCount}</p>
                  </div>
                </div>
              )}
            </div>

            {activeTab === 'upload' && (
              <div className="admin-payslips-body-grid">
                <aside className="admin-payslips-sidebar space-y-4">
                  <p className="admin-payslips-sidebar-title">Upload Payroll</p>
                  <p className="text-xs font-medium leading-relaxed text-[var(--emerald-dark)]/80">
                    Choose an Excel file from the template, then generate payslip PDFs for all employees.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                  <Button
                    variant="secondary"
                    className="admin-payslip-secondary-btn w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Choose Excel File
                  </Button>
                  {selectedFile && (
                    <span className="admin-payslip-file-chip inline-flex w-full items-center rounded-lg px-3 py-2 text-xs font-semibold">
                      <strong className="truncate">{selectedFile.name}</strong>
                    </span>
                  )}
                  <Button
                    className="admin-dash-action-btn w-full border-0"
                    onClick={handleUploadAndProcess}
                    disabled={uploading || !selectedFile}
                  >
                    {uploading ? <Loader className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Upload & Generate
                  </Button>
                  <div className="admin-payslips-tip-box rounded-lg p-3 text-xs font-medium leading-relaxed">
                    <Sparkles className="mb-1.5 h-3.5 w-3.5 text-[var(--emerald-dark)]" />
                    Upload the fulfillment file, review generated PDFs, then Send All to publish to employee dashboards.
                  </div>
                </aside>

                <div className="admin-payslips-main-panel space-y-4">
                  <div className="admin-payslips-panel-header">
                    <div>
                      <h2 className="font-display text-sm font-bold text-[var(--emerald-dark)]">Current Batch</h2>
                      <p className="text-xs font-medium text-slate-600">
                        {batch ? batch.payMonth || 'Active upload session' : 'No payroll file processed yet'}
                      </p>
                    </div>
                  </div>
                  {batchSummary}
                  {payslipTable}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="admin-payslips-body-grid">
                <aside className="admin-payslips-sidebar space-y-4">
                  <p className="admin-payslips-sidebar-title">Filter History</p>
                  <p className="text-xs font-medium leading-relaxed text-[var(--emerald-dark)]/80">
                    Select a year and month to browse past payroll uploads.
                  </p>
                  <SelectField
                    label="Year"
                    value={historyYear}
                    onChange={(e) => {
                      setHistoryYear(e.target.value)
                      setHistoryMonth('')
                    }}
                    options={historyYearOptions}
                  />
                  <SelectField
                    label="Month"
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                    disabled={!historyYear}
                    options={historyMonthOptions}
                  />
                  {historyPeriodSelected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-[var(--emerald-dark)]"
                      onClick={() => {
                        setHistoryYear('')
                        setHistoryMonth('')
                      }}
                    >
                      <X className="h-4 w-4 mr-1" /> Clear filters
                    </Button>
                  )}
                </aside>

                <div className="admin-payslips-main-panel">
                  <div className="admin-payslips-panel-header">
                    <div>
                      <h2 className="font-display text-sm font-bold text-[var(--emerald-dark)]">Payroll History</h2>
                      <p className="text-xs font-medium text-slate-600">
                        {historyPeriodSelected
                          ? `${filteredBatches.length} batch${filteredBatches.length === 1 ? '' : 'es'} for ${CALENDAR_MONTHS[parseInt(historyMonth, 10) - 1] ?? historyMonth} ${historyYear}`
                          : 'Select a period to view uploads'}
                      </p>
                    </div>
                  </div>

                  {loadingHistory ? (
                    <div className="admin-payslip-empty flex min-h-[240px] items-center justify-center rounded-xl">
                      <Loader className="h-5 w-5 animate-spin text-[var(--emerald-dark)]" />
                    </div>
                  ) : !historyPeriodSelected ? (
                    <div className="admin-payslip-empty flex min-h-[240px] flex-col items-center justify-center rounded-xl px-6 text-center">
                      <History className="mb-2 h-8 w-8 text-[var(--emerald-dark)]/40" />
                      <p className="text-sm font-semibold text-[var(--emerald-dark)]">Select year and month</p>
                      <p className="mt-1 text-xs text-muted">Use the sidebar filters to browse payroll history.</p>
                    </div>
                  ) : filteredBatches.length === 0 ? (
                    <div className="admin-payslip-empty flex min-h-[240px] flex-col items-center justify-center rounded-xl px-6 text-center">
                      <p className="text-sm font-semibold text-[var(--emerald-dark)]">No payroll for this period</p>
                      <p className="mt-1 text-xs text-muted">
                        No upload for {CALENDAR_MONTHS[parseInt(historyMonth, 10) - 1] ?? historyMonth} {historyYear}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredBatches.map((b) => {
                        const isExpanded = expandedBatchId === b.id
                        const sentCount = b.totalSent ?? 0
                        return (
                          <div key={b.id} className="admin-payslip-history-card overflow-hidden rounded-xl">
                            <button
                              type="button"
                              className="admin-payslip-history-head flex w-full items-center justify-between p-4 text-left transition-colors"
                              onClick={() => setExpandedBatchId(isExpanded ? null : b.id)}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(38,107,28,0.12)]">
                                  <FileText className="h-5 w-5 text-[var(--emerald-dark)]" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-ink">{b.payMonth || 'Unknown Month'}</p>
                                  <p className="truncate text-xs text-muted">{b.originalFileName}</p>
                                  <p className="text-xs text-muted">
                                    {new Date(b.uploadedAt).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-6">
                                <div className="hidden gap-5 text-sm sm:flex">
                                  <span className="text-center">
                                    <p className="font-bold text-ink">{b.employeeCount}</p>
                                    <p className="text-xs text-muted">employees</p>
                                  </span>
                                  <span className="text-center">
                                    <p className="font-bold text-[var(--emerald-dark)]">{b.totalGenerated}</p>
                                    <p className="text-xs text-muted">generated</p>
                                  </span>
                                  <span className="text-center">
                                    <p className="font-bold text-[#2f7d24]">{sentCount}</p>
                                    <p className="text-xs text-muted">sent</p>
                                  </span>
                                  {b.totalFailed > 0 && (
                                    <span className="text-center">
                                      <p className="font-bold text-danger">{b.totalFailed}</p>
                                      <p className="text-xs text-muted">failed</p>
                                    </span>
                                  )}
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted" />
                                )}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t border-[rgba(38,107,28,0.1)]">
                                <div className="flex justify-end gap-2 bg-[rgba(240,253,244,0.5)] p-3">
                                  {(b.totalGenerated ?? 0) > 0 && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="admin-payslip-secondary-btn"
                                      disabled={downloadingAll}
                                      onClick={() => void handleDownloadAll(b)}
                                    >
                                      {downloadingAll ? (
                                        <Loader className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <FileText className="h-3.5 w-3.5" />
                                      )}
                                      Download All PDFs
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="admin-payslip-secondary-btn"
                                    onClick={() => downloadUploadedExcel(b.id, b.originalFileName)}
                                  >
                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                    Download Excel
                                  </Button>
                                </div>
                                <div className="divide-y divide-[rgba(38,107,28,0.08)]">
                                  {b.results
                                    .filter((r) => r.status === 'success' && r.fileName)
                                    .map((r) => (
                                      <div
                                        key={r.fileName}
                                        className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-emerald-50/50"
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <Avatar name={r.name} size="sm" color={stringToHueColor(r.empId)} />
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                                            <p className="text-xs text-muted">{r.empId}</p>
                                          </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                          {r.sent && (
                                            <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--emerald-dark)]">
                                              <CheckCircle2 className="h-3 w-3" /> Sent
                                            </span>
                                          )}
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            className="admin-payslip-secondary-btn"
                                            onClick={() => void handlePreview(b.id, r.fileName!, r.name)}
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                            Preview
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            className="admin-payslip-secondary-btn"
                                            onClick={() =>
                                              void handleDownloadPayslip(
                                                b.id,
                                                r.fileName!,
                                                `Payslip_${r.name}_${b.payMonth || b.id}.pdf`,
                                              )
                                            }
                                          >
                                            <FileText className="h-3.5 w-3.5" />
                                            Download PDF
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  {b.results
                                    .filter((r) => r.status === 'error')
                                    .map((r) => (
                                      <div
                                        key={r.empId + '-err'}
                                        className="flex items-center gap-3 bg-red-50/60 px-4 py-2.5"
                                      >
                                        <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                                        <span className="text-sm text-danger">
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
          </div>
        ) : (
          <>
            <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-fit gap-1 rounded-xl border border-border bg-surface/60 p-1">
                {tabItems.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                      activeTab === id ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-ink',
                    )}
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
            {activeTab === 'upload' && (
              <div className="space-y-5">
                <section className="admin-card rounded-2xl p-5 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />
                      <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4" />
                        Choose Excel File
                      </Button>
                      {selectedFile && (
                        <span className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-sm">
                          <strong className="max-w-[240px] truncate">{selectedFile.name}</strong>
                        </span>
                      )}
                      <Button className="sm:ml-auto" onClick={handleUploadAndProcess} disabled={uploading || !selectedFile}>
                        {uploading ? <Loader className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        Upload & Generate Payslips
                      </Button>
                    </div>
                    {batchSummary}
                  </div>
                </section>
                {payslipTable}
              </div>
            )}
          </>
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
