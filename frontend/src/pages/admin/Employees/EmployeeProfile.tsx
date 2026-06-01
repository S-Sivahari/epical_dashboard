import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { EmployeeAvatar } from '@components/ui/EmployeeAvatar'
import * as employeeService from '@services/employeeService'
import { openEmployeeDocument } from '@/services/uploadService'
import type { Employee, EmployeeActivityEntry } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { stringToHueColor } from '@/utils/stringColor'
import { Pencil, FileText, FileSpreadsheet, ExternalLink, History } from 'lucide-react'
import { toast } from 'sonner'
import { exportToExcel } from '@/utils/exportExcel'
import { exportToPDF } from '@/utils/exportPDF'
import {
  FULL_EMPLOYEE_EXPORT_HEADERS,
  INDIVIDUAL_EMPLOYEE_REPORT_OPTIONS,
  employeeToExportRow,
  individualExportFilename,
} from '@/constants/employeeExport'
import { documentListFromEmployee } from '@/utils/employeeDocuments'
import { useAuthStore } from '@store/authStore'

const statusVariant = (s: string) => {
  switch (s) {
    case 'Active': return 'success' as const
    case 'Notice Period': return 'warning' as const
    case 'Inactive': return 'neutral' as const
    case 'Deactivated': return 'danger' as const
    default: return 'neutral' as const
  }
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted uppercase tracking-wider">{label}</span>
      <span className="text-sm text-ink">{value || '—'}</span>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-4 mt-6 border-b border-border pb-2 font-display text-lg font-semibold text-ink first:mt-0">
      {title}
    </h3>
  )
}

const exportHeaders = FULL_EMPLOYEE_EXPORT_HEADERS

export function EmployeeProfile() {
  const { id = '' } = useParams()
  const user = useAuthStore((s) => s.user)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<{ key: string; name: string }[]>([])
  const [openingDocKey, setOpeningDocKey] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoadError('Employee not found.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const e = await employeeService.getEmployee(id)
        if (!cancelled) {
          setEmployee(e)
          setDocuments(documentListFromEmployee(e as Record<string, unknown>))
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err instanceof Error ? err.message : 'Could not load employee profile.')
          setLoadError(msg)
          setEmployee(null)
          setDocuments([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <PageWrapper>
        <div className="crewiq-dashboard">
        <PageHeader title="" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-3 text-sm text-muted">Loading profile…</span>
        </div>
        </div>
      </PageWrapper>
    )
  }

  if (loadError || !employee) {
    return (
      <PageWrapper>
        <div className="crewiq-dashboard">
        <PageHeader title="Employee Profile" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">{loadError ?? 'Employee not found.'}</p>
          <div className="mt-4">
            <Button asChild variant="secondary">
              <Link to="/admin/employees">Back to Employees</Link>
            </Button>
          </div>
        </div>
        </div>
      </PageWrapper>
    )
  }

  const name = `${employee.firstName} ${employee.lastName ?? ''}`.trim()
  const fileName = individualExportFilename(employee.firstName, employee.lastName)
  const exportRow = employeeToExportRow(employee)
  const exportOptions = {
    generatedBy: user?.name || 'Admin',
    employeeDetailMode: true,
    ...INDIVIDUAL_EMPLOYEE_REPORT_OPTIONS,
  }

  const activityHistory = (employee.activityHistory ?? [])
    .slice()
    .sort(
      (a: EmployeeActivityEntry, b: EmployeeActivityEntry) =>
        new Date(b.at).getTime() - new Date(a.at).getTime(),
    )

  const handleOpenDocument = async (docKey: string, docName: string) => {
    setOpeningDocKey(docKey)
    try {
      await openEmployeeDocument(id, docKey, docName)
    } catch {
      toast.error('Could not open document')
    } finally {
      setOpeningDocKey(null)
    }
  }

  const handleExportPdf = async () => {
    try {
      console.info('[Manage Employees] Exported employee PDF:', fileName)
      await exportToPDF([exportRow], fileName, exportHeaders, exportOptions)
} catch {
      toast.error('PDF export failed')
    }
  }

  const handleExportExcel = async () => {
    try {
      console.info('[Manage Employees] Exported employee Excel:', fileName)
      await exportToExcel([exportRow], fileName, exportHeaders, exportOptions)
} catch {
      toast.error('Excel export failed')
    }
  }

  return (
    <PageWrapper>
      <div className="crewiq-dashboard">
      <PageHeader
        title={name}
        subtitle={employee.employeeId}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => void handleExportPdf()}
            >
              <FileText className="h-4 w-4 text-red-600" />
              Export PDF
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleExportExcel()}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Export Excel
            </Button>
            <Button asChild>
              <Link to={`/admin/employees/${employee.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 pb-12">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="rounded-xl border border-border bg-surface/70 p-5 shadow-sm h-max">
          <div className="flex flex-col items-center text-center">
            <EmployeeAvatar employeeId={employee.id} name={name} size="lg" color={stringToHueColor(employee.id)} />
            <p className="mt-3 font-display text-lg font-semibold text-ink">{name}</p>
            <p className="font-mono text-xs text-muted">{employee.employeeId}</p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${employee.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-400'}`}
              />
              <Badge variant={statusVariant(employee.status)}>
                {employee.status}
              </Badge>
            </div>
            <div className="mt-4 w-full space-y-2 text-sm text-muted text-left">
              <p>
                <span className="font-medium text-ink">Email:</span> {employee.email}
              </p>
              {employee.personalEmail ? (
                <p>
                  <span className="font-medium text-ink">Personal:</span> {employee.personalEmail}
                </p>
              ) : null}
              {employee.phone ? (
                <p>
                  <span className="font-medium text-ink">Phone:</span> {employee.phone}
                </p>
              ) : null}
              <p>
                <span className="font-medium text-ink">Type:</span> {employee.employmentType}
              </p>
              <p>
                <span className="font-medium text-ink">Joined:</span> {formatDate(employee.joinedAt)}
              </p>
            </div>
          </div>
        </aside>

        {/* ── Main Content ────────────────────────────────────────────── */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-border p-6 shadow-sm" style={{backgroundColor:'var(--bg-card)',borderColor:'var(--border-subtle)'}}>
            
            {/* ── Personal ──────────────────────────────────────── */}
            <SectionHeader title="Personal Details" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="First Name" value={employee.firstName} />
              <InfoRow label="Last Name" value={employee.lastName} />
              <InfoRow label="Date of Birth" value={employee.dob ? formatDate(employee.dob) : undefined} />
              <InfoRow label="Gender" value={employee.gender} />
              <InfoRow label="Phone" value={employee.phone} />
              <InfoRow label="Personal Email" value={employee.personalEmail} />
              <InfoRow label="Company Email" value={employee.email} />
              <InfoRow label="Permanent Address" value={employee.permanentAddress ?? employee.address} />
              <InfoRow label="Communication Address" value={employee.communicationAddress} />
            </div>

            {/* ── Emergency Contact ─────────────────────────────── */}
            <SectionHeader title="Emergency Contact" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Name" value={employee.emergencyContact?.name} />
              <InfoRow label="Phone" value={employee.emergencyContact?.phone} />
              <InfoRow label="Email" value={employee.emergencyContact?.email} />
              <InfoRow label="Relation" value={employee.emergencyContact?.relation} />
              <InfoRow label="Address" value={employee.emergencyContact?.address} />
            </div>

            {/* ── Job ───────────────────────────────────────────── */}
            <SectionHeader title="Job Details" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Employee ID" value={employee.employeeId} />
              <InfoRow label="Role" value={employee.role} />
              <InfoRow label="Employment Type" value={employee.employmentType} />
              <InfoRow label="Joining Date" value={formatDate(employee.joinedAt)} />
              <InfoRow label="Status" value={employee.status} />
            </div>

            {/* ── Payment ───────────────────────────────────────── */}
            <SectionHeader title="Payment Details" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow
                label="CTC (Annual)"
                value={employee.ctc ? `₹${employee.ctc.toLocaleString('en-IN')}` : undefined}
              />
              <InfoRow label="Bank Name" value={employee.bankName} />
              <InfoRow label="Account Number" value={employee.accountNumber} />
              <InfoRow label="IFSC Code" value={employee.ifsc} />
              <InfoRow label="UAN Number" value={employee.uan} />
              <InfoRow label="PF / ESI" value={employee.pfEsi === 'on' ? 'Enabled' : employee.pfEsi === 'off' ? 'Disabled' : undefined} />
            </div>

            {/* ── ID Proof ──────────────────────────────────────── */}
            <SectionHeader title="ID Proof" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Aadhaar Number" value={employee.aadhaar} />
              <InfoRow label="PAN" value={employee.pan} />
              <InfoRow label="Passport Number" value={employee.passport} />
            </div>

            {/* ── Documents ─────────────────────────────────────── */}
            <SectionHeader title="Documents" />
            <div>
              {documents.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.key}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface/50 px-4 py-3 transition-ui hover:shadow-sm"
                    >
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{doc.name}</p>
                        <p className="text-xs text-muted capitalize">{doc.key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      </div>
                      <button
                        type="button"
                        disabled={openingDocKey === doc.key}
                        onClick={() => void handleOpenDocument(doc.key, doc.name)}
                        className="shrink-0 rounded-md p-1.5 text-primary hover:bg-primary/10 transition-ui disabled:opacity-50"
                        title="View document"
                      >
                        {openingDocKey === doc.key ? (
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed border-border bg-surface/30">
                  <FileText className="h-10 w-10 text-muted/40" />
                  <p className="mt-3 text-sm text-muted">No documents uploaded yet.</p>
                </div>
              )}
            </div>

            {/* ── Activity History ──────────────────────────────── */}
            <SectionHeader title="Activity History" />
            <div>
              {activityHistory.length > 0 ? (
                <div className="space-y-3">
                  {activityHistory.map((entry, index) => (
                    <div
                      key={`${entry.at}-${entry.type}-${index}`}
                      className="rounded-lg border border-border bg-surface/50 px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-ink">{entry.summary}</p>
                            <Badge variant={entry.type === 'status_change' ? 'warning' : 'neutral'}>
                              {entry.type === 'status_change' ? 'Status change' : 'Profile edit'}
                            </Badge>
                          </div>
                          {entry.reason ? (
                            <p className="mt-1 text-sm text-muted">Reason: {entry.reason}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted">
                            {entry.by} · {formatDate(entry.at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed border-border bg-surface/30">
                  <History className="h-10 w-10 text-muted/40" />
                  <p className="mt-3 text-sm text-muted">No activity recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      </div>
    </PageWrapper>
  )
}
