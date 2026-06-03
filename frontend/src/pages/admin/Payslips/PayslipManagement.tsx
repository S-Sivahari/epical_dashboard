import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  openMergedBatchPayslipPdf,
  sendPayslipToDashboard,
  sendAllPayslipsToDashboard,
  deletePayrollBatch,
  deletePayslip,
  getTemplateMeta,
  type PayrollBatch,
  type PayslipResult,
  type TemplateMeta,
} from '@services/payslipService'
import { formatPayslipDownloadFileName } from '@/utils/payslipDownloadName'
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

/** Normalized YYYY-MM key — matches backend batchPayPeriodKey. */
function batchPeriodKey(batch: PayrollBatch): string | null {
  const key = batch.payPeriodKey?.trim()
  if (key && /^\d{4}-\d{2}$/.test(key)) return key
  if (batch.payYear != null && batch.payMonthNum != null) {
    return `${batch.payYear}-${String(batch.payMonthNum).padStart(2, '0')}`
  }
  const period = parseBatchPayPeriod(batch)
  if (!period) return null
  return `${period.year}-${String(period.month).padStart(2, '0')}`
}

function formatBatchPeriodLabel(batch: PayrollBatch | null | undefined): string {
  if (!batch) return ''
  if (
    batch.payYear != null &&
    batch.payMonthNum != null &&
    batch.payMonthNum >= 1 &&
    batch.payMonthNum <= 12
  ) {
    return `${CALENDAR_MONTHS[batch.payMonthNum - 1]} ${batch.payYear}`
  }
  const keyMatch = batch.payPeriodKey?.match(/^(\d{4})-(\d{2})$/)
  if (keyMatch) {
    const year = parseInt(keyMatch[1], 10)
    const month = parseInt(keyMatch[2], 10)
    if (month >= 1 && month <= 12) {
      return `${CALENDAR_MONTHS[month - 1]} ${year}`
    }
  }
  const period = parseBatchPayPeriod(batch)
  if (period && period.month >= 1 && period.month <= 12) {
    return `${CALENDAR_MONTHS[period.month - 1]} ${period.year}`
  }
  return (batch.payMonth ?? '').trim() || 'Unknown period'
}

function formatBatchTitleLabel(batch: PayrollBatch | null | undefined): string {
  const period = formatBatchPeriodLabel(batch)
  return period ? `${period} Payroll Batch` : 'Payroll Batch'
}

function currentCalendarPeriod(): { year: string; month: string } {
  const now = new Date()
  return { year: String(now.getFullYear()), month: String(now.getMonth() + 1) }
}

function countUnsentInBatch(b: PayrollBatch): number {
  return b.results.filter((r) => r.status === 'success' && r.fileName && !r.sent).length
}

function countGeneratedInBatch(b: PayrollBatch): number {
  return b.results.filter((r) => r.status === 'success' && r.fileName).length
}

function sendingKeyFor(batchId: string, empId: string): string {
  return `${batchId}:${empId}`
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PayslipManagement({ embedded: _embedded = false }: { embedded?: boolean }) {
  const isAdminPayslips = !_embedded
  const { employees, loading: employeesLoading } = useEmployees()
  const userId = useAuthStore((s) => s.user?.id)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Tabs
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tab = searchParams.get('tab')
    return tab === 'history' ? 'history' : 'upload'
  })

  // Upload tab state — empty on open; only restored from current login session (refresh-safe)
  const [batch, setBatch] = useState<PayrollBatch | null>(null)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sendingKey, setSendingKey] = useState<string | null>(null)
  const [sendingAllBatchId, setSendingAllBatchId] = useState<string | null>(null)
  const [deletingBatch, setDeletingBatch] = useState(false)
  const [deletingPayslip, setDeletingPayslip] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<PayrollBatch | null>(null)
  const [payslipDeleteTarget, setPayslipDeleteTarget] = useState<{
    fileName: string
    name: string
  } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadPayYear, setUploadPayYear] = useState(() => currentCalendarPeriod().year)
  const [uploadPayMonth, setUploadPayMonth] = useState(() => currentCalendarPeriod().month)
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

  const syncPayslipUrl = useCallback(
    (tab: TabId, batchId?: string | null) => {
      const params = new URLSearchParams()
      params.set('tab', tab)
      if (tab === 'upload' && batchId) params.set('batchId', batchId)
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  const restoreSessionBatch = useCallback(async () => {
    if (!userId) {
      setBatch(null)
      return
    }

    setLoadingBatch(true)
    try {
      let restored: PayrollBatch | null = null
      const savedBatchId = readPayslipUploadSession(userId)

      if (savedBatchId) {
        try {
          restored = await getPayrollBatch(savedBatchId)
        } catch {
          clearPayslipUploadSession()
        }
      }

      setBatch(restored)
    } catch {
      setBatch(null)
    } finally {
      setLoadingBatch(false)
    }
  }, [userId])

  const loadAllBatches = useCallback(async (): Promise<PayrollBatch[]> => {
    setLoadingHistory(true)
    try {
      const batches = await listBatches()
      setAllBatches(batches)
      return batches
    } catch {
      toast.error('Failed to load batch history')
      return []
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    void restoreSessionBatch()
    void loadTemplateMeta()
    void loadAllBatches()
  }, [restoreSessionBatch, loadAllBatches])

  useEffect(() => {
    if (!userId) {
      setBatch(null)
    }
  }, [userId])

  useEffect(() => {
    if (allBatches.length === 0 || historyYear) return
    const period = parseBatchPayPeriod(allBatches[0])
    if (!period) return
    setHistoryYear(String(period.year))
    setHistoryMonth(String(period.month))
  }, [allBatches, historyYear])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'history' || tabParam === 'upload') {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  useEffect(() => {
    const batchIdParam = searchParams.get('batchId')
    if (!batchIdParam || batch?.id === batchIdParam) return

    let cancelled = false
    void (async () => {
      setLoadingBatch(true)
      try {
        const loaded = await getPayrollBatch(batchIdParam)
        if (!cancelled) {
          setUploadBatch(loaded)
          setActiveTab('upload')
        }
      } catch {
        if (!cancelled) toast.error('Could not load payslip batch')
      } finally {
        if (!cancelled) setLoadingBatch(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams, batch?.id, setUploadBatch])

  const uploadYearOptions = useMemo(() => {
    const years = new Set<number>()
    const currentYear = new Date().getFullYear()
    years.add(currentYear)
    years.add(currentYear - 1)
    years.add(currentYear + 1)
    for (const b of allBatches) {
      const period = parseBatchPayPeriod(b)
      if (period) years.add(period.year)
    }
    return [...years]
      .sort((a, b) => b - a)
      .map((y) => ({ value: String(y), label: String(y) }))
  }, [allBatches])

  const uploadMonthOptions = useMemo(
    () =>
      CALENDAR_MONTHS.map((name, index) => ({
        value: String(index + 1),
        label: name,
      })),
    [],
  )

  const uploadBatchesFlat = useMemo(() => {
    return [...allBatches].sort((a, b) => {
      const pa = parseBatchPayPeriod(a)
      const pb = parseBatchPayPeriod(b)
      const ka = pa ? pa.year * 100 + pa.month : 0
      const kb = pb ? pb.year * 100 + pb.month : 0
      if (kb !== ka) return kb - ka
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    })
  }, [allBatches])

  const handleSwitchBatch = async (batchId: string) => {
    if (batch?.id === batchId) return
    setLoadingBatch(true)
    try {
      const loaded = await getPayrollBatch(batchId)
      setUploadBatch(loaded)
      syncPayslipUrl('upload', batchId)
    } catch {
      toast.error('Failed to load batch')
    } finally {
      setLoadingBatch(false)
    }
  }

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    syncPayslipUrl(tab, tab === 'upload' ? batch?.id : null)
  }

  useEffect(() => {
    if (activeTab === 'history') {
      void loadAllBatches()
    }
  }, [activeTab, loadAllBatches])

  useEffect(() => {
    setExpandedBatchId(null)
  }, [historyYear, historyMonth])

  useEffect(() => {
    if (!batch) return
    const period = parseBatchPayPeriod(batch)
    if (!period) return
    setUploadPayYear(String(period.year))
    setUploadPayMonth(String(period.month))
  }, [batch?.id])

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
    closePreview()
    setPreviewLoading(true)
    setPreviewName(name)
    try {
      const url = await openPayslipPdf(batchId, fileName)
      setPreviewUrl(url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load PDF preview'
      toast.error(message)
      setPreviewName('')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handlePreviewMergedPdf = async (targetBatch: PayrollBatch) => {
    if ((targetBatch.totalGenerated ?? 0) === 0) {
      toast.error('No payslips generated to preview')
      return
    }
    closePreview()
    setPreviewLoading(true)
    const periodLabel = formatBatchPeriodLabel(targetBatch) || targetBatch.payMonth || 'batch'
    setPreviewName(`All payslips — ${periodLabel}`)
    try {
      const url = await openMergedBatchPayslipPdf(targetBatch.id)
      setPreviewUrl(url)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'Failed to load merged payslip preview'
      toast.error(message)
      setPreviewName('')
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

  const uploadPeriodFields = () => {
    const payYear = parseInt(uploadPayYear, 10)
    const payMonthNum = parseInt(uploadPayMonth, 10)
    if (Number.isNaN(payYear) || Number.isNaN(payMonthNum) || payMonthNum < 1 || payMonthNum > 12) {
      return null
    }
    return { payYear, payMonthNum }
  }

  const runPayrollUpload = async (
    file: File,
    options?: {
      replaceBatchId?: string
      resendPayslips?: boolean
      allowDuplicatePayPeriod?: boolean
    },
  ) => {
    const period = uploadPeriodFields()
    if (!period) {
      toast.error('Select a valid payroll month and year')
      return
    }

    setUploading(true)
    try {
      const result = await uploadPayroll(file, {
        replaceBatchId: options?.replaceBatchId,
        resendPayslips: options?.resendPayslips,
        allowDuplicatePayPeriod: options?.allowDuplicatePayPeriod,
        employeeDbIdByEmpId: options?.resendPayslips ? buildEmployeeDbIdMap() : undefined,
        payYear: period.payYear,
        payMonthNum: period.payMonthNum,
      })
      const newBatch = result.batch
      setUploadBatch(newBatch)
      setSelectedFile(null)
      setReplaceConfirm(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      if (newBatch.totalFailed > 0) {
        toast.warning(`${newBatch.totalFailed} payslip(s) failed to generate`)
      } else if (options?.allowDuplicatePayPeriod) {
        toast.success(`New payslip batch saved for ${formatBatchPeriodLabel(newBatch) || 'this period'}`)
      }
      void loadAllBatches()
      syncPayslipUrl('upload', newBatch.id)
    } catch (error: unknown) {
      const dup = (
        error as Error & { duplicatePayPeriod?: { payMonth?: string; existingBatch: PayrollBatch } }
      ).duplicatePayPeriod
      if (dup?.existingBatch) {
        setReplaceConfirm({
          payMonth: formatBatchPeriodLabel(dup.existingBatch) || dup.payMonth || 'this period',
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

  const handleGenerateNew = async () => {
    if (!selectedFile || !replaceConfirm) return
    await runPayrollUpload(selectedFile, { allowDuplicatePayPeriod: true })
  }

  const handleDeleteBatch = async () => {
    const target = batchDeleteTarget
    if (!target) return
    setDeletingBatch(true)
    try {
      await deletePayrollBatch(target.id)
      const wasCurrent = batch?.id === target.id
      const remaining = await loadAllBatches()
      if (wasCurrent) {
        if (remaining.length > 0) {
          const loaded = await getPayrollBatch(remaining[0].id)
          setUploadBatch(loaded)
          syncPayslipUrl('upload', remaining[0].id)
        } else {
          setUploadBatch(null)
          syncPayslipUrl('upload', null)
        }
      }
      setBatchDeleteTarget(null)
      toast.success('Payroll upload deleted')
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

  const unsentCount = batch ? countUnsentInBatch(batch) : 0
  const generatedCount = batch ? countGeneratedInBatch(batch) : 0

  const applyBatchUpdate = useCallback(
    (updated: PayrollBatch) => {
      setAllBatches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      if (batch?.id === updated.id) {
        setUploadBatch(updated)
      }
    },
    [batch?.id, setUploadBatch],
  )

  const handleSendAll = async (targetBatch: PayrollBatch, resend = false) => {
    const unsent = countUnsentInBatch(targetBatch)
    const generated = countGeneratedInBatch(targetBatch)
    if (generated === 0) return
    if (!resend && unsent === 0) return

    setSendingAllBatchId(targetBatch.id)
    try {
      const result = await sendAllPayslipsToDashboard(
        targetBatch.id,
        buildEmployeeDbIdMap(),
        { resend },
      )
      applyBatchUpdate(result.batch)
      if (result.failed.length > 0) {
        toast.warning(
          `${result.failed.length} failed: ${result.failed.map((f) => f.empId).join(', ')}`,
        )
      } else {
        toast.success(
          resend
            ? `Resent ${result.sent} payslip(s) to employee dashboards`
            : `Sent ${result.sent} payslip(s) to employee dashboards`,
        )
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to send payslips'
      toast.error(message)
    } finally {
      setSendingAllBatchId(null)
    }
  }

  const openBatchForSending = async (target: PayrollBatch) => {
    setActiveTab('upload')
    await handleSwitchBatch(target.id)
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
    targetBatchId: string,
    empId: string,
    fileName: string,
    employeeDbId?: string,
    resend = false,
  ) => {
    const key = sendingKeyFor(targetBatchId, empId)
    setSendingKey(key)
    try {
      const updated = await sendPayslipToDashboard(targetBatchId, empId, fileName, employeeDbId)
      applyBatchUpdate(updated)
      toast.success(resend ? 'Payslip resent to employee dashboard' : 'Payslip sent to employee dashboard')
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to send payslip'
      toast.error(message)
    } finally {
      setSendingKey(null)
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
            <span className="inline-flex items-center gap-1 text-sm font-semibold admin-payslips-text-brand">
              <CheckCircle2 className="h-4 w-4" /> Sent to dashboard
            </span>
          )
        }
        if (r.status === 'success') {
          return (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#2f6b4f]">
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
                void handleDownloadPayslip(
                  batch.id,
                  r.fileName!,
                  formatPayslipDownloadFileName(r.name, batch.payMonth, batch.payPeriodKey),
                )
              }
              title="Download PDF"
            >
              <FileText className="h-3.5 w-3.5" />
              Download PDF
            </Button>
            <Button
              size="sm"
              className="admin-payslips-primary-btn border-0"
              disabled={
                !batch ||
                sendingKey === sendingKeyFor(batch.id, r.empId)
              }
              onClick={() =>
                void handleSend(
                  batch!.id,
                  r.empId,
                  r.fileName!,
                  r.employeeDbId,
                  !!r.sent,
                )
              }
            >
              {batch && sendingKey === sendingKeyFor(batch.id, r.empId) ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {r.sent ? 'Resend' : 'Send'}
            </Button>
            <Button
              size="sm"
              variant="danger"
              className="admin-payslip-danger-btn"
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
    <div className="admin-payslip-batch-summary rounded-xl p-3">
      <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            className="admin-payslips-primary-btn border-0"
            disabled={sendingAllBatchId === batch.id || unsentCount === 0}
            onClick={() => batch && void handleSendAll(batch, false)}
          >
            {sendingAllBatchId === batch.id ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send All
          </Button>
          {generatedCount > 0 && unsentCount < generatedCount && (
            <Button
              size="sm"
              variant="secondary"
              className="admin-payslip-secondary-btn"
              disabled={sendingAllBatchId === batch.id}
              onClick={() => void handleSendAll(batch, true)}
            >
              {sendingAllBatchId === batch.id ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Resend All
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="admin-payslip-secondary-btn"
            disabled={previewLoading || generatedCount === 0}
            onClick={() => void handlePreviewMergedPdf(batch)}
            title="Preview all employee payslips merged into one PDF"
          >
            {previewLoading && previewName.startsWith('All payslips') ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Preview PDF
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
            className="admin-payslip-danger-btn"
            disabled={deletingBatch}
            onClick={() => setBatchDeleteTarget(batch)}
          >
            {deletingBatch ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
      </div>
    </div>
  ) : null

  const payslipTable = (
    <div className={cn(isAdminPayslips ? 'admin-payslip-table-wrap' : 'admin-table overflow-hidden rounded-2xl border border-border bg-white shadow-sm')}>
      <DataTable
        columns={columns}
        data={payrollRows}
        loading={employeesLoading || loadingBatch}
        brandHeader={isAdminPayslips}
        tableTheme={isAdminPayslips ? 'payslip-hub' : 'directory'}
        striped={isAdminPayslips}
        empty={
          <div className={cn('py-10 text-center', isAdminPayslips && 'admin-payslip-empty')}>
            <FileText className={cn('mx-auto mb-2 h-8 w-8', isAdminPayslips ? 'admin-payslips-text-brand-muted' : 'text-muted')} />
            <p className={isAdminPayslips ? 'text-sm font-semibold admin-payslips-text-brand' : 'text-muted'}>
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
    <PageWrapper
      className={cn(
        isAdminPayslips
          ? 'admin-hub-page-wrap admin-payslips-page relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-3 font-body max-w-none'
          : 'admin-page',
      )}
    >
      <div
        className={cn(
          'crewiq-dashboard',
          isAdminPayslips && 'admin-payslips-view relative flex min-h-0 flex-1 flex-col',
        )}
        {...(isAdminPayslips ? { 'data-admin-payslips': '' } : {})}
      >
        {isAdminPayslips ? (
          <>
            <div className="dashboard-page-bg" aria-hidden>
              <div className="dashboard-page-bg-gradient" />
              <div className="dashboard-page-bg-pattern" />
            </div>
            <div className="admin-payslips-shell relative z-10 flex min-h-0 flex-1 animate-fadeIn flex-col">
              <header className="admin-payslips-hub-header shrink-0">
                <div className="admin-payslips-hero-top">
                  <div className="min-w-0">
                    <h1 className="admin-payslips-hero-title font-display">Payslip Management Hub</h1>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <nav className="admin-payslips-tab-rail" aria-label="Payslip views">
                      {tabItems.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleTabChange(id)}
                          className={
                            activeTab === id
                              ? 'admin-payslips-tab-btn admin-payslips-tab-btn--active'
                              : 'admin-payslips-tab-btn admin-payslips-tab-btn--inactive'
                          }
                        >
                          <Icon className="admin-payslips-tab-icon shrink-0" aria-hidden />
                          <span className="admin-payslips-tab-label">{label}</span>
                        </button>
                      ))}
                    </nav>
                    <button
                      type="button"
                      className="admin-payslips-template-btn"
                      onClick={() => void handleDownloadTemplate()}
                    >
                      <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
                      Download Template
                    </button>
                  </div>
                </div>
                <div className="admin-payslips-metrics-band" role="group" aria-label="Payslip metrics">
                  <div className="admin-payslips-metric-tile">
                    <p className="admin-payslips-metric-label">History Batches</p>
                    <p className="admin-payslips-metric-value font-display">{allBatches.length}</p>
                  </div>
                  <div className="admin-payslips-metric-tile">
                    <p className="admin-payslips-metric-label">Generated</p>
                    <p className="admin-payslips-metric-value font-display">
                      {batch?.totalGenerated ?? '—'}
                    </p>
                  </div>
                  <div className="admin-payslips-metric-tile">
                    <p className="admin-payslips-metric-label">Pending Send</p>
                    <p className="admin-payslips-metric-value font-display">{batch ? unsentCount : '—'}</p>
                  </div>
                </div>
              </header>

            {activeTab === 'upload' && (
              <div className="admin-payslips-body-grid admin-payslips-body-grid--fill">
                <aside className="admin-payslips-sidebar">
                  <div className="admin-payslips-upload-block">
                    <p className="admin-payslips-sidebar-title">Upload Payroll</p>
                    <div className="admin-payslips-upload-fields">
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
                        <div className="admin-payslip-file-chip flex w-full items-center gap-2 rounded-lg px-3 py-2.5">
                          <FileSpreadsheet className="h-5 w-5 shrink-0 admin-payslips-text-brand" aria-hidden />
                          <strong className="min-w-0 flex-1 truncate">{selectedFile.name}</strong>
                        </div>
                      )}
                      <SelectField
                        label="Payroll month"
                        value={uploadPayMonth}
                        onChange={(e) => setUploadPayMonth(e.target.value)}
                        options={uploadMonthOptions}
                      />
                      <SelectField
                        label="Payroll year"
                        value={uploadPayYear}
                        onChange={(e) => setUploadPayYear(e.target.value)}
                        options={uploadYearOptions}
                      />
                      <Button
                        className="admin-payslips-primary-btn w-full border-0"
                        onClick={handleUploadAndProcess}
                        disabled={uploading || !selectedFile}
                      >
                        {uploading ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        Upload & Generate
                      </Button>
                    </div>
                  </div>
                </aside>

                <div className="admin-payslips-main-panel">
                  <div className="admin-payslips-main-fixed space-y-3">
                    {uploadBatchesFlat.length > 0 && (
                      <div className="admin-payslip-batch-switcher">
                        <div className="admin-payslip-batch-switcher-row flex">
                          {uploadBatchesFlat.map((b) => {
                            const isActive = batch?.id === b.id
                            return (
                              <button
                                key={b.id}
                                type="button"
                                disabled={loadingBatch}
                                onClick={() => void handleSwitchBatch(b.id)}
                                title={b.originalFileName}
                                className={cn(
                                  'admin-payslip-batch-chip shrink-0',
                                  isActive && 'admin-payslip-batch-chip--active',
                                )}
                              >
                                <span className="admin-payslip-batch-chip-period block whitespace-nowrap">
                                  {formatBatchPeriodLabel(b)}
                                </span>
                                <span className="admin-payslip-batch-chip-meta block whitespace-nowrap">
                                  {new Date(b.uploadedAt).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                  })}
                                  {' · '}
                                  {b.totalSent ?? 0}/{b.totalGenerated} sent
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {batchSummary}
                  </div>
                  <div className="admin-payslips-list-scroll admin-payslips-list-scroll--upload">
                    {payslipTable}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="admin-payslips-body-grid">
                <aside className="admin-payslips-sidebar space-y-4">
                  <p className="admin-payslips-sidebar-title">Filter History</p>
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
                      className="w-full admin-payslips-text-brand"
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
                  <div className="admin-payslips-main-fixed">
                    <div className="admin-payslips-panel-header">
                      <div>
                        <h2 className="font-display text-sm font-extrabold admin-payslips-text-brand">Payroll History</h2>
                        <p className="text-xs font-medium text-slate-600">
                          {historyPeriodSelected
                            ? `${filteredBatches.length} batch${filteredBatches.length === 1 ? '' : 'es'} for ${CALENDAR_MONTHS[parseInt(historyMonth, 10) - 1] ?? historyMonth} ${historyYear}`
                            : 'Select a period to view uploads'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="admin-payslips-list-scroll admin-payslips-list-scroll--scrollable">
                  {loadingHistory ? (
                    <div className="admin-payslip-empty flex min-h-[240px] items-center justify-center rounded-xl">
                      <Loader className="h-5 w-5 animate-spin admin-payslips-text-brand" />
                    </div>
                  ) : !historyPeriodSelected ? (
                    <div className="admin-payslip-empty flex min-h-[240px] flex-col items-center justify-center rounded-xl px-6 text-center">
                      <History className="mb-2 h-8 w-8 admin-payslips-text-brand-muted" />
                      <p className="text-sm font-semibold admin-payslips-text-brand">Select year and month</p>
                      <p className="mt-1 text-xs text-muted">Use the sidebar filters to browse payroll history.</p>
                    </div>
                  ) : filteredBatches.length === 0 ? (
                    <div className="admin-payslip-empty flex min-h-[240px] flex-col items-center justify-center rounded-xl px-6 text-center">
                      <p className="text-sm font-semibold admin-payslips-text-brand">No payroll for this period</p>
                      <p className="mt-1 text-xs text-muted">
                        No upload for {CALENDAR_MONTHS[parseInt(historyMonth, 10) - 1] ?? historyMonth} {historyYear}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredBatches.map((b, index) => {
                        const isExpanded = expandedBatchId === b.id
                        const sentCount = b.totalSent ?? 0
                        const uploadLabel =
                          filteredBatches.length > 1
                            ? index === 0
                              ? 'Latest upload'
                              : `Earlier upload ${filteredBatches.length - index}`
                            : null
                        return (
                          <div key={b.id} className="admin-payslip-history-card overflow-hidden rounded-xl">
                            <button
                              type="button"
                              className="admin-payslip-history-head flex w-full items-center justify-between p-4 text-left transition-colors"
                              onClick={() => setExpandedBatchId(isExpanded ? null : b.id)}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(47,107,79,0.12)]">
                                  <FileText className="h-5 w-5 admin-payslips-text-brand" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-ink">
                                    {formatBatchTitleLabel(b)}
                                  </p>
                                  <p className="truncate text-xs text-muted">{b.originalFileName}</p>
                                  {uploadLabel ? (
                                    <p className="text-xs font-medium admin-payslips-text-brand">{uploadLabel}</p>
                                  ) : null}
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
                                    <p className="font-bold admin-payslips-text-brand">{b.totalGenerated}</p>
                                    <p className="text-xs text-muted">generated</p>
                                  </span>
                                  <span className="text-center">
                                    <p className="font-bold text-[#2f6b4f]">{sentCount}</p>
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
                              <div className="border-t border-[rgba(47,107,79,0.1)]">
                                <div className="flex flex-wrap justify-end gap-2 bg-[rgba(47,107,79,0.06)] p-3">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="admin-payslip-secondary-btn"
                                    onClick={() => void openBatchForSending(b)}
                                  >
                                    <Upload className="h-3.5 w-3.5" />
                                    Open in Upload
                                  </Button>
                                  {countUnsentInBatch(b) > 0 && (
                                    <Button
                                      size="sm"
                                      className="admin-payslips-primary-btn border-0"
                                      disabled={sendingAllBatchId === b.id}
                                      onClick={() => void handleSendAll(b, false)}
                                    >
                                      {sendingAllBatchId === b.id ? (
                                        <Loader className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Send className="h-3.5 w-3.5" />
                                      )}
                                      Send All
                                    </Button>
                                  )}
                                  {countGeneratedInBatch(b) > 0 && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="admin-payslip-secondary-btn"
                                      disabled={sendingAllBatchId === b.id}
                                      onClick={() => void handleSendAll(b, true)}
                                    >
                                      Resend All
                                    </Button>
                                  )}
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
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    className="admin-payslip-danger-btn"
                                    onClick={() => setBatchDeleteTarget(b)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </Button>
                                </div>
                                <div className="divide-y divide-[rgba(47,107,79,0.08)]">
                                  {b.results
                                    .filter((r) => r.status === 'success' && r.fileName)
                                    .map((r) => {
                                      const dbEmp = employees.find(
                                        (e) => String(e.employeeId) === String(r.empId),
                                      )
                                      const rowKey = sendingKeyFor(b.id, r.empId)
                                      return (
                                        <div
                                          key={r.fileName}
                                          className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-emerald-50/50"
                                        >
                                          <div className="flex min-w-0 items-center gap-2">
                                            <Avatar
                                              name={r.name}
                                              size="sm"
                                              color={stringToHueColor(r.empId)}
                                            />
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-medium text-ink">
                                                {r.name}
                                              </p>
                                              <p className="text-xs text-muted">{r.empId}</p>
                                            </div>
                                          </div>
                                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                            {r.sent && (
                                              <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold admin-payslips-text-brand">
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
                                                  formatPayslipDownloadFileName(
                                                    r.name,
                                                    b.payMonth,
                                                    b.payPeriodKey,
                                                  ),
                                                )
                                              }
                                            >
                                              <FileText className="h-3.5 w-3.5" />
                                              Download
                                            </Button>
                                            <Button
                                              size="sm"
                                              className="admin-payslips-primary-btn border-0"
                                              disabled={sendingKey === rowKey}
                                              onClick={() =>
                                                void handleSend(
                                                  b.id,
                                                  r.empId,
                                                  r.fileName!,
                                                  dbEmp?.id,
                                                  !!r.sent,
                                                )
                                              }
                                            >
                                              {sendingKey === rowKey ? (
                                                <Loader className="h-3.5 w-3.5 animate-spin" />
                                              ) : (
                                                <Send className="h-3.5 w-3.5" />
                                              )}
                                              {r.sent ? 'Resend' : 'Send'}
                                            </Button>
                                          </div>
                                        </div>
                                      )
                                    })}
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
              </div>
            )}
            </div>
          </>
        ) : (
          <>
            <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-fit gap-1 rounded-xl border border-border bg-surface/60 p-1">
                {tabItems.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleTabChange(id)}
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
          isOpen={!!previewUrl || (previewLoading && !!previewName)}
          onClose={closePreview}
          title={
            previewName.startsWith('All payslips')
              ? previewName
              : previewName
                ? `Payslip Preview — ${previewName}`
                : 'Payslip Preview'
          }
          size="xl"
        >
          {previewLoading && !previewUrl ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader className="h-6 w-6 animate-spin admin-payslips-text-brand" />
            </div>
          ) : previewUrl ? (
            <div className="space-y-3">
              <iframe
                src={previewUrl}
                title={previewName.startsWith('All payslips') ? 'Merged payslip PDF preview' : 'Payslip PDF Preview'}
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
          ) : null}
        </Modal>

        <ConfirmModal
          isOpen={!!batchDeleteTarget}
          title="Delete payroll upload?"
          description={
            batchDeleteTarget
              ? `This will permanently delete ${formatBatchTitleLabel(batchDeleteTarget)} (${batchDeleteTarget.originalFileName}) and all ${batchDeleteTarget.totalGenerated ?? 0} generated payslip PDF(s). This cannot be undone.`
              : ''
          }
          confirmLabel="Delete all"
          danger
          onClose={() => setBatchDeleteTarget(null)}
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
              ? `Payroll for ${replaceConfirm.payMonth} was already uploaded${replaceConfirm.originalFileName ? ` (${replaceConfirm.originalFileName})` : ''}. Replace overwrites that upload, or add another upload and keep both in History.`
              : ''
          }
          confirmLabel="Replace & regenerate"
          secondaryLabel="Add another upload"
          onClose={() => setReplaceConfirm(null)}
          onConfirm={handleConfirmReplace}
          onSecondary={handleGenerateNew}
        />
      </div>
    </PageWrapper>
  )
}
