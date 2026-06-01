import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { EmployeeAvatar } from '@components/ui/EmployeeAvatar'
import * as employeeService from '@services/employeeService'
import { openEmployeeDocument } from '@/services/uploadService'
import type { Employee, EmployeeActivityEntry } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { stringToHueColor } from '@/utils/stringColor'
import { Pencil, FileText, FileSpreadsheet, ExternalLink, History, ChevronDown } from 'lucide-react'
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
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'

type ProfileTab = 'details' | 'documents' | 'activity'

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity History' },
]

const STATUS_OPTIONS: { value: Employee['status']; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Notice Period', label: 'Notice Period' },
  { value: 'Deactivated', label: 'Deactivated' },
]

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
  const [activeTab, setActiveTab] = useState<ProfileTab>('details')
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<Employee['status'] | null>(null)
  const [statusChangeReason, setStatusChangeReason] = useState('')
  const [statusReasonError, setStatusReasonError] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)
  const reasonInputRef = useRef<HTMLTextAreaElement>(null)

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
      <div className="crewiq-dashboard employee-pages employee-directory-view">
        <div className="employee-directory-bg" aria-hidden>
          <div className="employee-directory-bg-gradient" />
          <div className="employee-directory-bg-leaves" />
        </div>
        <div className="employee-directory-shell">
          <header className="employee-directory-header">
            <h1 className="employee-directory-title">Employee Active Directory</h1>
          </header>
          <div className="employee-profile-content flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-3 text-sm text-muted">Loading profile…</span>
          </div>
        </div>
      </div>
    )
  }

  if (loadError || !employee) {
    return (
      <div className="crewiq-dashboard employee-pages employee-directory-view">
        <div className="employee-directory-bg" aria-hidden>
          <div className="employee-directory-bg-gradient" />
          <div className="employee-directory-bg-leaves" />
        </div>
        <div className="employee-directory-shell">
          <header className="employee-directory-header">
            <h1 className="employee-directory-title">Employee Active Directory</h1>
          </header>
          <div className="employee-profile-content">
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm font-medium text-red-700">{loadError ?? 'Employee not found.'}</p>
              <div className="mt-4">
                <Button asChild variant="secondary">
                  <Link to={ROUTES.EMPLOYEES}>Back to Active Directory</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
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

  const requestStatusChange = (status: Employee['status']) => {
    if (!employee || employee.status === status) return
    setPendingStatus(status)
    setStatusChangeReason('')
    setStatusReasonError('')
    setStatusModalOpen(true)
    setTimeout(() => reasonInputRef.current?.focus(), 50)
  }

  const confirmStatusChange = async () => {
    if (!employee || !pendingStatus) return
    const reason = statusChangeReason.trim()
    if (!reason) {
      setStatusReasonError('Please provide a reason for the status change.')
      return
    }

    setStatusModalOpen(false)
    setSavingStatus(true)
    try {
      const updated = await employeeService.updateEmployeeStatus(
        employee.id!,
        pendingStatus,
        reason,
        user?.email || user?.name,
      )
      setEmployee(updated)
      toast.success('Employee status updated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update status'
      setStatusReasonError(message)
      toast.error(message)
      setStatusModalOpen(true)
    } finally {
      setSavingStatus(false)
      setPendingStatus(null)
      setStatusChangeReason('')
    }
  }

  return (
    <div className="crewiq-dashboard employee-pages employee-directory-view">
      <div className="employee-directory-bg" aria-hidden>
        <div className="employee-directory-bg-gradient" />
        <div className="employee-directory-bg-leaves" />
      </div>

      <div className="employee-directory-shell">
        <header className="employee-directory-header">
          <h1 className="employee-directory-title">{name}</h1>
          <p className="employee-directory-subtitle">{employee.employeeId}</p>
        </header>

        <div className="employee-profile-toolbar">
          <button
            type="button"
            className="employee-directory-export-btn"
            onClick={() => void handleExportPdf()}
          >
            <FileText className="h-4 w-4 text-red-600" strokeWidth={2} />
            Export PDF
          </button>
          <button
            type="button"
            className="employee-directory-export-btn"
            onClick={() => void handleExportExcel()}
          >
            <FileSpreadsheet className="h-4 w-4 text-[#266b1c]" strokeWidth={2} />
            Export Excel
          </button>
        </div>

        <div className="employee-profile-content">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="h-max rounded-xl border border-border bg-surface/70 p-5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <EmployeeAvatar employeeId={employee.id} name={name} size="lg" color={stringToHueColor(employee.id)} />
            <p className="mt-3 font-display text-lg font-semibold text-ink">{name}</p>
            <p className="font-mono text-xs text-muted">{employee.employeeId}</p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  employee.status === 'Active'
                    ? 'bg-[#266b1c]'
                    : employee.status === 'Notice Period'
                      ? 'bg-[#fbbf24]'
                      : employee.status === 'Deactivated'
                        ? 'bg-[#f87171]'
                        : 'bg-gray-400'
                }`}
              />
              <Badge variant={statusVariant(employee.status)}>
                {employee.status}
              </Badge>
            </div>
            <div className="mt-4 w-full space-y-2 text-left text-sm text-muted">
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
            <div className="mt-5 flex w-full gap-2 border-t border-border pt-4">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="secondary" className="min-w-0 flex-1" disabled={savingStatus}>
                    Change status
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="admin-navbar-menu z-50 min-w-[180px] p-1"
                    sideOffset={4}
                    align="center"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <DropdownMenu.Item
                        key={option.value}
                        className="cursor-pointer rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-surface/80 data-[disabled]:opacity-50"
                        disabled={employee.status === option.value || savingStatus}
                        onSelect={() => requestStatusChange(option.value)}
                      >
                        {option.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <Button asChild className="min-w-0 flex-1">
                <Link to={ROUTES.EMPLOYEE_EDIT(employee.id!)}>
                  <Pencil className="h-4 w-4 shrink-0" />
                  Edit
                </Link>
              </Button>
            </div>
          </div>
        </aside>

        {/* ── Main Content ────────────────────────────────────────────── */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-border p-6 shadow-sm" style={{backgroundColor:'var(--bg-card)',borderColor:'var(--border-subtle)'}}>
            <div className="mb-6 flex flex-wrap gap-1 border-b border-border" role="tablist">
              {PROFILE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-ui',
                    activeTab === tab.id
                      ? 'border-[#266b1c] text-ink'
                      : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'details' ? (
              <div role="tabpanel">
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

                <SectionHeader title="Emergency Contact" />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoRow label="Name" value={employee.emergencyContact?.name} />
                  <InfoRow label="Phone" value={employee.emergencyContact?.phone} />
                  <InfoRow label="Email" value={employee.emergencyContact?.email} />
                  <InfoRow label="Relation" value={employee.emergencyContact?.relation} />
                  <InfoRow label="Address" value={employee.emergencyContact?.address} />
                </div>

                <SectionHeader title="Job Details" />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoRow label="Employee ID" value={employee.employeeId} />
                  <InfoRow label="Role" value={employee.role} />
                  <InfoRow label="Employment Type" value={employee.employmentType} />
                  <InfoRow label="Joining Date" value={formatDate(employee.joinedAt)} />
                  <InfoRow label="Status" value={employee.status} />
                </div>

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

                <SectionHeader title="ID Proof" />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoRow label="Aadhaar Number" value={employee.aadhaar} />
                  <InfoRow label="PAN" value={employee.pan} />
                  <InfoRow label="Passport Number" value={employee.passport} />
                </div>
              </div>
            ) : null}

            {activeTab === 'documents' ? (
              <div role="tabpanel">
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
            ) : null}

            {activeTab === 'activity' ? (
              <div role="tabpanel">
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
            ) : null}
          </div>
        </section>
      </div>
        </div>
      </div>

      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Confirm Status Change"
        size="sm"
        className="admin-modal"
      >
        {employee && pendingStatus ? (
          <div className="space-y-4">
            <p className="text-sm text-[#a1a1aa]">
              You are about to change{' '}
              <span className="font-semibold text-white">{name}</span>
              's status from{' '}
              <span className="font-semibold text-white">{employee.status}</span>
              {' '}to{' '}
              <span className="font-semibold text-white">{pendingStatus}</span>.
            </p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white">
                Reason <span className="text-[#f87171]">*</span>
              </label>
              <textarea
                ref={reasonInputRef}
                value={statusChangeReason}
                onChange={(e) => {
                  setStatusChangeReason(e.target.value)
                  if (statusReasonError) setStatusReasonError('')
                }}
                placeholder="Provide a reason for this status change..."
                className={`admin-field w-full resize-none px-3 py-2 text-sm transition-shadow ${
                  statusReasonError ? 'border-[#f87171] focus:ring-[#f87171]/20' : 'focus:ring-[#266b1c]/30'
                }`}
                rows={3}
              />
              {statusReasonError ? (
                <p className="text-xs font-medium text-[#f87171]">{statusReasonError}</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-[rgba(161,161,170,0.18)] pt-2">
              <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void confirmStatusChange()} loading={savingStatus}>
                Confirm Change
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
