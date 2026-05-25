import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Download,
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
import { stringToHueColor } from '@/utils/stringColor'
import { toast } from 'sonner'
import {
  downloadPayrollTemplate,
  uploadPayroll,
  getLatestPayrollBatch,
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
  uploadCustomTemplate,
  previewTemplate,
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


// ─── Main component ──────────────────────────────────────────────────────────

export function PayslipManagement() {
  const { employees, loading: employeesLoading } = useEmployees()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Tabs
  const [activeTab, setActiveTab] = useState<TabId>('upload')

  // Upload tab state
  const [batch, setBatch] = useState<PayrollBatch | null>(null)
  const [loadingBatch, setLoadingBatch] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [deletingBatch, setDeletingBatch] = useState(false)
  const [deletingPayslip, setDeletingPayslip] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [payslipDeleteTarget, setPayslipDeleteTarget] = useState<{ fileName: string; name: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Template header actions
  const templateFileRef = useRef<HTMLInputElement>(null)
  const [templateMeta, setTemplateMeta] = useState<TemplateMeta | null>(null)
  const [uploadingTemplate, setUploadingTemplate] = useState(false)

  // PDF Preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // History tab state
  const [allBatches, setAllBatches] = useState<PayrollBatch[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState('')


  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadLatestBatch = useCallback(async () => {
    setLoadingBatch(true)
    try {
      const latest = await getLatestPayrollBatch()
      setBatch(latest)
    } catch {
      toast.error('Failed to load payroll history')
    } finally {
      setLoadingBatch(false)
    }
  }, [])

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
    void loadLatestBatch()
    void loadTemplateMeta()
  }, [loadLatestBatch])

  useEffect(() => {
    if (activeTab === 'history') {
      void loadAllBatches()
    }
  }, [activeTab, loadAllBatches])

  const loadTemplateMeta = async () => {
    try {
      const meta = await getTemplateMeta()
      setTemplateMeta(meta)
    } catch {
      toast.error('Failed to load template info')
    }
  }

  const handleTemplateFileSelect = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)')
      return
    }
    setUploadingTemplate(true)
    try {
      const meta = await uploadCustomTemplate(file)
      setTemplateMeta(meta)
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to upload template'
      toast.error(message)
    } finally {
      setUploadingTemplate(false)
      if (templateFileRef.current) templateFileRef.current.value = ''
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

  const handlePreview = async (batchId: string, fileName: string, name: string) => {
    setPreviewLoading(true)
    setPreviewName(name)
    try {
      const url = await openPayslipPdf(batchId, fileName)
      setPreviewUrl(url)
    } catch {
      toast.error('Failed to load PDF preview')
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

  const handlePreviewTemplate = async () => {
    try {
      await previewTemplate(templateMeta?.name)
    } catch {
      toast.error('Failed to preview template')
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

  const handleUploadAndProcess = async () => {
    if (!selectedFile) {
      toast.error('Choose an Excel file to upload')
      return
    }
    setUploading(true)
    try {
      const newBatch = await uploadPayroll(selectedFile)
      setBatch(newBatch)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success(
        `${newBatch.totalGenerated} payslip PDF(s) generated from ${newBatch.employeeCount} employee(s)`
      )
      if (newBatch.totalFailed > 0) {
        toast.warning(`${newBatch.totalFailed} payslip(s) failed to generate`)
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to process payroll file'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteBatch = async () => {
    if (!batch) return
    setDeletingBatch(true)
    try {
      await deletePayrollBatch(batch.id)
      setBatch(null)
      setBatchDeleteOpen(false)
      toast.success('Uploaded Excel and all payslips deleted')
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
      setBatch(updated)
      setPayslipDeleteTarget(null)
      toast.success(`Payslip deleted for ${payslipDeleteTarget.name}`)
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
      toast.info('All payslips are already sent')
      return
    }
    setSendingAll(true)
    try {
      const result = await sendAllPayslipsToDashboard(batch.id, buildEmployeeDbIdMap())
      setBatch(result.batch)
      if (result.sent > 0) toast.success(`Sent ${result.sent} payslip(s) to employee dashboards`)
      if (result.skipped > 0) toast.info(`${result.skipped} already sent — skipped`)
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
      toast.info('No payslips to download')
      return
    }
    setDownloadingAll(true)
    try {
      await downloadAllPayslipPdfs(targetBatch.id, targetBatch.payMonth)
      toast.success('Merged payslip PDF downloaded')
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to download merged payslips'
      toast.error(message)
    } finally {
      setDownloadingAll(false)
    }
  }

  const handleSend = async (empId: string, fileName: string, name: string, employeeDbId?: string) => {
    if (!batch) return
    setSendingId(empId)
    try {
      const updated = await sendPayslipToDashboard(batch.id, empId, fileName, employeeDbId)
      setBatch(updated)
      toast.success(`Payslip sent to ${name}'s dashboard`)
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
            <span className="block font-medium">{r.name}</span>
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
            <span className="inline-flex items-center gap-1 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Sent to dashboard
            </span>
          )
        }
        if (r.status === 'success') {
          return (
            <span className="inline-flex items-center gap-1 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" /> Generated
            </span>
          )
        }
        if (r.status === 'error') {
          return (
            <span className="inline-flex items-center gap-1 text-sm text-danger" title={r.error}>
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
              disabled={downloadingAll}
              onClick={() => void handleDownloadAll(batch)}
              title="Download all payslips as one PDF"
            >
              {downloadingAll ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
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
              onClick={() => void downloadPayslipPdf(batch.id, r.fileName!, `Payslip_${r.name}.pdf`)}
              title="Download PDF"
            >
              <Download className="h-3.5 w-3.5" />
              Download
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

  const filteredBatches = monthFilter
    ? allBatches.filter((b) =>
        (b.payMonth || '').toLowerCase().includes(monthFilter.toLowerCase()) ||
        new Date(b.uploadedAt).toLocaleString('default', { month: 'long', year: 'numeric' })
          .toLowerCase().includes(monthFilter.toLowerCase())
      )
    : allBatches

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      {/* Top Actions */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Tabs */}
        <div
          className="inline-flex w-fit rounded-xl border border-border bg-white p-1 shadow-sm"
          role="tablist"
        >
          {(
            [
              { id: 'upload' as TabId, label: 'Upload & Generate', icon: Upload },
              { id: 'history' as TabId, label: 'History', icon: History },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-primary text-white'
                  : 'text-muted hover:bg-surface'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
  
        {/* Template Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={templateFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => void handleTemplateFileSelect(e.target.files)}
          />
  
          <Button
            variant="secondary"
            disabled={uploadingTemplate}
            onClick={() => templateFileRef.current?.click()}
          >
            {uploadingTemplate ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload Template
          </Button>
  
          <Button
            variant="secondary"
            onClick={() => void handlePreviewTemplate()}
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
  
          <Button
            variant="secondary"
            onClick={() => void handleDownloadTemplate()}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download Template
          </Button>
        </div>
      </div>
  
      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-5">
          {/* Upload Section */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
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
                  <span className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink">
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
                <div className="rounded-xl border border-border bg-surface/40 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left */}
                    <div>
                      <p className="font-semibold text-ink">
                        {batch.originalFileName}
                      </p>
  
                      {batch.payMonth && (
                        <p className="text-sm text-muted">
                          {batch.payMonth}
                        </p>
                      )}
  
                      <p className="text-xs text-muted">
                        {new Date(batch.uploadedAt).toLocaleString()}
                      </p>
  
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1 text-primary">
                          <CheckCircle2 className="h-4 w-4" />
                          {batch.totalGenerated} Generated
                        </span>
  
                        <span className="flex items-center gap-1 text-green-600">
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
                        <Download className="h-4 w-4" />
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
          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <DataTable
              columns={columns}
              data={payrollRows}
              loading={employeesLoading || loadingBatch}
              empty={
                <div className="py-10 text-center">
                  <p className="text-muted">No payslips generated yet.</p>
                </div>
              }
            />
          </section>
        </div>
      )}
  
      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filter */}
          <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="text"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                placeholder="Filter by month"
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-72"
              />
  
              {monthFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMonthFilter('')}
                >
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </section>
  
          {/* History List */}
          {loadingHistory ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-white">
              <Loader className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-white">
              <p className="text-sm text-muted">No payroll batches found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBatches.map((b) => {
                const isExpanded = expandedBatchId === b.id
                const sentCount = b.totalSent ?? 0
  
                return (
                  <div
                    key={b.id}
                    className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
                  >
                    {/* Header */}
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-surface/40"
                      onClick={() =>
                        setExpandedBatchId(isExpanded ? null : b.id)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
  
                        <div>
                          <p className="font-semibold text-ink">
                            {b.payMonth || 'Unknown Month'}
                          </p>
  
                          <p className="text-xs text-muted">
                            {b.originalFileName}
                          </p>
  
                          <p className="text-xs text-muted">
                            {new Date(b.uploadedAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </div>
  
                      <div className="flex items-center gap-5">
                        <div className="hidden sm:flex gap-5 text-sm">
                          <span className="text-center">
                            <p className="font-semibold">{b.employeeCount}</p>
                            <p className="text-xs text-muted">Employees</p>
                          </span>
  
                          <span className="text-center">
                            <p className="font-semibold text-primary">
                              {b.totalGenerated}
                            </p>
                            <p className="text-xs text-muted">Generated</p>
                          </span>
  
                          <span className="text-center">
                            <p className="font-semibold text-green-600">
                              {sentCount}
                            </p>
                            <p className="text-xs text-muted">Sent</p>
                          </span>
                        </div>
  
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted" />
                        )}
                      </div>
                    </button>
  
                    {/* Expanded */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        <div className="flex justify-end gap-2 border-b border-border bg-surface/20 p-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              downloadUploadedExcel(
                                b.id,
                                b.originalFileName
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                            Download Excel
                          </Button>
  
                          {(b.totalGenerated ?? 0) > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void handleDownloadAll(b)}
                            >
                              <Download className="h-4 w-4" />
                              Download PDFs
                            </Button>
                          )}
                        </div>
  
                        <div className="divide-y divide-border">
                          {b.results
                            .filter(
                              (r) => r.status === 'success' && r.fileName
                            )
                            .map((r) => (
                              <div
                                key={r.fileName}
                                className="flex items-center justify-between px-4 py-3 hover:bg-surface/20"
                              >
                                <div className="flex items-center gap-3">
                                  <Avatar
                                    name={r.name}
                                    size="sm"
                                    color={stringToHueColor(r.empId)}
                                  />
  
                                  <div>
                                    <p className="text-sm font-medium text-ink">
                                      {r.name}
                                    </p>
  
                                    <p className="text-xs text-muted">
                                      {r.empId}
                                    </p>
                                  </div>
                                </div>
  
                                <div className="flex items-center gap-2">
                                  {r.sent && (
                                    <span className="text-xs text-green-600">
                                      Sent
                                    </span>
                                  )}
  
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      void handlePreview(
                                        b.id,
                                        r.fileName!,
                                        r.name
                                      )
                                    }
                                  >
                                    <Eye className="h-4 w-4" />
                                    Preview
                                  </Button>
  
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      void downloadPayslipPdf(
                                        b.id,
                                        r.fileName!,
                                        `Payslip_${r.name}.pdf`
                                      )
                                    }
                                  >
                                    <Download className="h-4 w-4" />
                                    PDF
                                  </Button>
                                </div>
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
              className="w-full rounded-lg border border-border"
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
    </PageWrapper>
  )
}