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
} from 'lucide-react'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useEmployees } from '@hooks/useEmployees'
import { Avatar } from '@components/ui/Avatar'
import { stringToHueColor } from '@/utils/stringColor'
import { toast } from 'sonner'
import {
  downloadPayrollTemplate,
  uploadPayroll,
  getLatestPayrollBatch,
  openPayslipPdf,
  downloadUploadedExcel,
  sendPayslipToDashboard,
  sendAllPayslipsToDashboard,
  deletePayrollBatch,
  deletePayslip,
  type PayrollBatch,
  type PayslipResult,
} from '@services/payslipService'

interface PayslipRow {
  id?: string
  empId: string
  name: string
  status: 'success' | 'error' | 'pending'
  fileName?: string
  error?: string
  sent?: boolean
  employeeDbId?: string
}

export function PayslipManagement() {
  const { employees, loading: employeesLoading } = useEmployees()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [batch, setBatch] = useState<PayrollBatch | null>(null)
  const [loadingBatch, setLoadingBatch] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [deletingBatch, setDeletingBatch] = useState(false)
  const [deletingPayslip, setDeletingPayslip] = useState<string | null>(null)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [payslipDeleteTarget, setPayslipDeleteTarget] = useState<{
    fileName: string
    name: string
  } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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

  useEffect(() => {
    loadLatestBatch()
  }, [loadLatestBatch])

  const handleDownloadTemplate = async () => {
    try {
      await downloadPayrollTemplate()
      toast.success('Demo template downloaded')
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
        `${newBatch.totalGenerated} payslip PDF(s) generated from ${newBatch.employeeCount} employee(s)`,
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

  const buildEmployeeDbIdMap = (): Record<string, string> => {
    const map: Record<string, string> = {}
    if (!batch) return map
    for (const r of batch.results) {
      const dbEmp = employees.find((e) => String(e.employeeId) === String(r.empId))
      if (dbEmp?.id) map[r.empId] = dbEmp.id
    }
    return map
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
      if (result.sent > 0) {
        toast.success(`Sent ${result.sent} payslip(s) to employee dashboards`)
      }
      if (result.skipped > 0) {
        toast.info(`${result.skipped} already sent — skipped`)
      }
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

  const handleSend = async (
    empId: string,
    fileName: string,
    name: string,
    employeeDbId?: string
  ) => {
    if (!batch) return
    setSendingId(empId)
    try {
      const updated = await sendPayslipToDashboard(
        batch.id,
        empId,
        fileName,
        employeeDbId
      )
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

  const payrollRows: PayslipRow[] = batch
    ? batch.results.map((r: PayslipResult) => {
        const dbEmp = employees.find((e) => String(e.employeeId) === String(r.empId))
        return {
          empId: r.empId,
          name:
            r.name ||
            (dbEmp ? `${dbEmp.firstName} ${dbEmp.lastName}`.trim() : r.empId),
          status: r.status,
          fileName: r.fileName,
          error: r.error,
          sent: r.sent,
          employeeDbId: dbEmp?.id,
        }
      })
    : employees.map((emp) => ({
        empId: emp.employeeId,
        name: `${emp.firstName} ${emp.lastName}`,
        status: 'pending' as const,
        employeeDbId: emp.id,
      }))

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
              <CheckCircle2 className="h-4 w-4" />
              Sent to dashboard
            </span>
          )
        }
        if (r.status === 'success') {
          return (
            <span className="inline-flex items-center gap-1 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Generated
            </span>
          )
        }
        if (r.status === 'error') {
          return (
            <span className="inline-flex items-center gap-1 text-sm text-danger" title={r.error}>
              <AlertCircle className="h-4 w-4" />
              Failed
            </span>
          )
        }
        return <span className="text-sm text-muted">Awaiting upload</span>
      },
    },
    {
      key: 'empId',
      header: 'Actions',
      render: (r) => {
        if (!batch || r.status !== 'success' || !r.fileName) {
          return <span className="text-sm text-muted">—</span>
        }
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openPayslipPdf(batch.id, r.fileName!)}
            >
              <ExternalLink className="h-4 w-4" />
              View PDF
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={r.sent || sendingId === r.empId}
              onClick={() => handleSend(r.empId, r.fileName!, r.name, r.employeeDbId)}
            >
              {sendingId === r.empId ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {r.sent ? 'Sent' : 'Send'}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={deletingPayslip === r.fileName}
              onClick={() =>
                setPayslipDeleteTarget({ fileName: r.fileName!, name: r.name })
              }
            >
              {deletingPayslip === r.fileName ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <PageWrapper>
      <PageHeader
        title="Payslip Management"
        breadcrumb={<Breadcrumb items={[{ label: 'Payslips' }]} />}
        actions={
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="h-4 w-4" />
            Download Template
          </Button>
        }
      />

      {/* Upload */}
      <div className="mb-6 space-y-4 rounded-lg border border-border bg-surface/50 p-4">
        <h3 className="font-semibold text-ink">Upload Payroll</h3>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
          {selectedFile ? (
            <span className="text-sm text-ink">
              Selected: <strong>{selectedFile.name}</strong>
            </span>
          ) : null}
          <Button
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

        {batch ? (
          <div className="mt-4 space-y-3 rounded-md border border-border bg-white p-4 text-sm">
            <div>
              <p className="text-muted">Last upload</p>
              <p className="font-semibold text-ink">{batch.originalFileName}</p>
              {batch.payMonth ? (
                <p className="mt-1 text-muted">Pay period: {batch.payMonth}</p>
              ) : null}
              <p className="text-muted">
                {new Date(batch.uploadedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
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
                Send All{unsentCount > 0 ? ` (${unsentCount})` : ''}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => downloadUploadedExcel(batch.id, batch.originalFileName)}
              >
                <Download className="h-4 w-4" />
                Download Uploaded Excel
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
                Delete Upload & Payslips
              </Button>
            </div>
          </div>
        ) : null}
      </div>

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

      <div className="rounded-lg border border-border bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={payrollRows}
          loading={employeesLoading || loadingBatch}
        />
      </div>
    </PageWrapper>
  )
}
