import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import * as employeeService from '@services/employeeService'
import { openEmployeeDocument } from '@/services/uploadService'
import type { Employee } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { stringToHue } from '@/utils/stringColor'
import { getEmployeeAvatarUrl } from '@/utils/getAvatarUrl'

import {
  FileText,
  FileSpreadsheet,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Landmark,
  User,
  CheckCircle,
  CreditCard,
  Hash,
} from 'lucide-react'
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
import { useEmployeeStore } from '@store/employeeStore'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'

type ProfileTab = 'details' | 'documents'

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'documents', label: 'Documents' },
]

const STATUS_OPTIONS: { value: Employee['status']; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Notice Period', label: 'Notice Period' },
  { value: 'Deactivated', label: 'Deactivated' },
]



const exportHeaders = FULL_EMPLOYEE_EXPORT_HEADERS

const maskValue = (value?: string, prefixLength = 8, suffixLength = 4) => {
  if (!value) return 'Not provided'
  const clean = value.replace(/\s/g, '')
  if (clean.length <= suffixLength) return '•••• •••• ' + clean
  const dots = '•'.repeat(prefixLength)
  return `${dots} ${clean.slice(-suffixLength)}`
}

function ProfileCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-[rgba(38,107,28,0.14)] bg-white shadow-[0_4px_18px_rgba(38,107,28,0.06)] overflow-hidden flex flex-col", className)}>
      <div className="ep-profile-card-header px-5 py-3.5">
        <h4 className="ep-profile-card-title">{title}</h4>
      </div>
      <div className="p-5 space-y-4 flex-1">
        {children}
      </div>
    </div>
  )
}

const ADDRESS_PREVIEW_LENGTH = 48

function ProfileAddressItem({ label, value }: { label: string; value?: string }) {
  const [expanded, setExpanded] = useState(false)
  const text = value?.trim() || ''
  const isLong = text.length > ADDRESS_PREVIEW_LENGTH
  const display =
    !text ? '—' : expanded || !isLong ? text : `${text.slice(0, ADDRESS_PREVIEW_LENGTH)}…`

  return (
    <div className="min-w-0 rounded-xl border border-[rgba(38,107,28,0.08)] bg-[#f8faf8] px-3.5 py-3">
      <span className="ep-profile-label block">{label}</span>
      {text && isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="ep-profile-address-btn ep-profile-value mt-1 block w-full"
          title={expanded ? 'Click to collapse' : 'Click to view full address'}
        >
          {display}
        </button>
      ) : (
        <span className="ep-profile-value mt-1 block">{display}</span>
      )}
    </div>
  )
}

function ProfileCardItem({ label, value, icon, action }: { label: string; value?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 min-w-0 rounded-xl border border-[rgba(38,107,28,0.08)] bg-[#f8faf8] px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <span className="ep-profile-label block">{label}</span>
        <span className="ep-profile-value block mt-1" title={typeof value === 'string' ? value : undefined}>
          {value || '—'}
        </span>
      </div>
      {icon && <div className="text-[#266b1c] shrink-0 mt-0.5">{icon}</div>}
      {action && <div className="shrink-0 mt-0.5">{action}</div>}
    </div>
  )
}

export function EmployeeProfile() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const employeesRevision = useEmployeeStore((s) => s.employeesRevision)
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
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [statusMenuRect, setStatusMenuRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [showAadhaar, setShowAadhaar] = useState(false)
  const reasonInputRef = useRef<HTMLTextAreaElement>(null)
  const statusBtnRef = useRef<HTMLButtonElement>(null)

  const updateStatusMenuRect = () => {
    const rect = statusBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setStatusMenuRect({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }

  const toggleStatusMenu = () => {
    if (showStatusMenu) {
      setShowStatusMenu(false)
      return
    }
    updateStatusMenuRect()
    setShowStatusMenu(true)
  }

  useEffect(() => {
    if (!showStatusMenu) return
    const onReposition = () => updateStatusMenuRect()
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [showStatusMenu])

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
  }, [id, employeesRevision])

  if (loading) {
    return (
      <div className="crewiq-dashboard employee-pages employee-directory-view" data-page-scrollable>
        <div className="employee-directory-bg" aria-hidden>
          <div className="employee-directory-bg-gradient" />
          <div className="employee-directory-bg-leaves" />
        </div>
        <div className="employee-directory-shell">
          <header className="employee-directory-header">
            <h1 className="employee-directory-title">Employee Directory</h1>
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
      <div className="crewiq-dashboard employee-pages employee-directory-view" data-page-scrollable>
        <div className="employee-directory-bg" aria-hidden>
          <div className="employee-directory-bg-gradient" />
          <div className="employee-directory-bg-leaves" />
        </div>
        <div className="employee-directory-shell">
          <header className="employee-directory-header">
            <h1 className="employee-directory-title">Employee Directory</h1>
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

  const name = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim()
  const fileName = individualExportFilename(employee.firstName, employee.lastName)
  const exportRow = employeeToExportRow(employee)
  const exportOptions = {
    generatedBy: user?.name || 'Admin',
    employeeDetailMode: true,
    ...INDIVIDUAL_EMPLOYEE_REPORT_OPTIONS,
  }

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
    setShowStatusMenu(false)
    setPendingStatus(status)
    setStatusChangeReason('')
    setStatusReasonError('')
    setStatusModalOpen(true)
    setTimeout(() => reasonInputRef.current?.focus(), 100)
  }

  const confirmStatusChange = async () => {
    if (!employee || !pendingStatus) return
    const reason = statusChangeReason.trim()
    if (!reason) {
      setStatusReasonError('Please provide a reason for the status change.')
      return
    }

    setSavingStatus(true)
    try {
      const refreshed = await employeeService.updateEmployeeStatus(
        employee.id!,
        pendingStatus,
        reason,
        user?.email || user?.name,
      )
      useEmployeeStore.getState().applyEmployeeRecord(refreshed)
      setEmployee(refreshed)
      setStatusModalOpen(false)
      setPendingStatus(null)
      setStatusChangeReason('')
      setStatusReasonError('')
      toast.success('Employee status updated')
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Could not update status')
      setStatusReasonError(message)
      toast.error(message)
    } finally {
      setSavingStatus(false)
    }
  }

  // Status Badge styles
  let statusDot = 'bg-gray-400'
  let statusClass = 'bg-gray-50 text-gray-500 border-gray-200'
  if (employee.status === 'Active') {
    statusDot = 'bg-[#10b981]'
    statusClass = 'bg-emerald-50 text-[#047857] border-emerald-200'
  } else if (employee.status === 'Notice Period') {
    statusDot = 'bg-[#f59e0b]'
    statusClass = 'bg-amber-50 text-[#b45309] border-amber-200'
  } else if (employee.status === 'Deactivated' || employee.status === 'Inactive') {
    statusDot = 'bg-[#ef4444]'
    statusClass = 'bg-red-50 text-[#b91c1c] border-red-200'
  }



  const hue = stringToHue(employee.id || name)
  const tintBgStyle = {
    background: `linear-gradient(165deg, hsl(${hue} 75% 94% / 45%) 0%, rgba(248, 250, 248, 0.92) 42%, hsl(${hue} 75% 94% / 25%) 100%)`
  }
  const avatarRingStyle = {
    borderColor: `hsl(${hue} 60% 52%)`,
    backgroundColor: `hsl(${hue} 75% 95%)`,
    boxShadow: `0 0 0 4px hsl(${hue} 75% 92% / 30%)`
  }
  const initialsStyle = {
    color: `hsl(${hue} 60% 40%)`
  }

  const avatarUrl = getEmployeeAvatarUrl(employee)

  return (
    <div className="crewiq-dashboard employee-pages employee-directory-view" data-page-scrollable>
      <div className="employee-directory-bg" aria-hidden>
        <div className="employee-directory-bg-gradient" style={tintBgStyle} />
        <div className="employee-directory-bg-leaves" />
      </div>

      <div className="employee-directory-shell employee-profile-detail-page bg-slate-50/35">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
          {/* Left Column: Sidebar Card */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="relative rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.01)] flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => navigate(ROUTES.EMPLOYEES)}
                className="ep-profile-back-btn absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                aria-label="Back to employees"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {/* Profile image / large avatar */}
              <div className="relative flex items-center justify-center h-28 w-28 rounded-full border-2 overflow-hidden" style={avatarRingStyle}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold" style={initialsStyle}>
                    {`${employee.firstName?.[0] ?? ''}${employee.lastName?.[0] ?? ''}`.toUpperCase()}
                  </span>
                )}
              </div>
              <h2 className="ep-profile-name mt-4 text-base font-bold text-slate-800 truncate w-full">{name}</h2>
              <p className="ep-profile-meta text-slate-600 font-medium mt-1 truncate w-full">
                {employee.employmentType || '—'}
              </p>
              
              <div className="mt-3.5">
                {/* Status Badge */}
                <div className={`ep-profile-status inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                  {employee.status}
                </div>
              </div>
              
              {/* Buttons */}
              <div className="mt-6 w-full flex flex-row gap-2">
                <Button asChild variant="secondary" className="flex-1 min-w-0 text-sm font-bold h-10 border border-slate-200 bg-white text-black hover:bg-slate-50 px-2">
                  <Link to={ROUTES.EMPLOYEE_EDIT(employee.id!)}>
                    Edit Profile
                  </Link>
                </Button>
                
                <div className="relative flex-1 min-w-0">
                  <button
                    ref={statusBtnRef}
                    type="button"
                    onClick={toggleStatusMenu}
                    disabled={savingStatus}
                    aria-expanded={showStatusMenu}
                    aria-haspopup="menu"
                    className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-black transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    Change Status
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showStatusMenu && 'rotate-180')} />
                  </button>
                  {showStatusMenu && statusMenuRect
                    ? createPortal(
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-[90] cursor-default bg-transparent"
                            aria-label="Close status menu"
                            onClick={() => setShowStatusMenu(false)}
                          />
                          <div
                            role="menu"
                            className="fixed z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                            style={{
                              top: statusMenuRect.top,
                              left: statusMenuRect.left,
                              width: statusMenuRect.width,
                            }}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                role="menuitem"
                                disabled={employee.status === option.value || savingStatus}
                                onClick={() => requestStatusChange(option.value)}
                                className="block w-full px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </>,
                        document.body,
                      )
                    : null}
                </div>
              </div>
            </div>
          </div>

          {/* Right Columns: Segmented Toolbar + Tabs Content */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* Toolbar: Segmented Tabs & Exports */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border border-[rgba(38,107,28,0.12)] rounded-2xl p-4 shadow-[0_4px_18px_rgba(38,107,28,0.06)]">
              {/* Segmented Control */}
              <div className="flex rounded-xl bg-[#e8f2e6] p-1 w-full sm:w-auto">
                {PROFILE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "ep-profile-tab flex-1 sm:flex-initial rounded-lg px-4 py-2 text-sm font-bold transition-all text-center whitespace-nowrap",
                      activeTab === tab.id
                        ? "ep-profile-tab--active bg-[#266b1c] text-white shadow-sm"
                        : "text-[#475569] hover:text-[#0f172a]"
                    )}
                  >
                    {tab.label === 'Details' ? 'Profile' : tab.label}
                  </button>
                ))}
              </div>

              {/* Exports */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  className="flex min-h-[2.75rem] min-w-[5.5rem] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => void handleExportPdf()}
                >
                  <FileText className="h-4 w-4 shrink-0 text-red-600" />
                  PDF
                </button>
                <button
                  type="button"
                  className="flex min-h-[2.75rem] min-w-[5.5rem] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => void handleExportExcel()}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#266b1c]" />
                  Excel
                </button>
              </div>
            </div>

            {/* Dynamic Content Area */}
            <div className="min-h-[400px]">
              {activeTab === 'details' && (
                <div className="flex flex-col gap-6">
                  <ProfileCard title="Personal Details">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-4">
                        <ProfileCardItem label="First name" value={employee.firstName} />
                        <ProfileCardItem label="Personal email" value={employee.personalEmail} />
                        <ProfileCardItem label="Company email" value={employee.email} />
                      </div>
                      <div className="flex flex-col gap-4">
                        <ProfileCardItem label="Middle name" value={employee.middleName} />
                        <ProfileCardItem label="Gender" value={employee.gender} />
                        <ProfileCardItem
                          label="Date of birth"
                          value={employee.dob ? formatDate(employee.dob) : 'Not provided'}
                        />
                      </div>
                      <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
                        <ProfileCardItem label="Last name" value={employee.lastName} />
                        <ProfileAddressItem
                          label="Address"
                          value={employee.permanentAddress || employee.address}
                        />
                        <ProfileAddressItem
                          label="Communication address"
                          value={employee.communicationAddress}
                        />
                      </div>
                    </div>
                  </ProfileCard>

                  {/* Bottom Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
                    {/* Column 1 (Wide, spans 2 columns): Job Details + ID Proof stack */}
                    <div className="lg:col-span-2 flex flex-col gap-6 h-full">
                      <ProfileCard title="Job Details">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <ProfileCardItem label="Employee ID" value={employee.employeeId} />
                          <ProfileCardItem label="PAN" value={employee.pan || 'Not Provided'} />
                          <ProfileCardItem label="Joining date" value={formatDate(employee.joinedAt)} />
                          
                          <ProfileCardItem label="Role" value={employee.role} />
                          <ProfileCardItem label="Employment type" value={employee.employmentType} />
                          <ProfileCardItem label="Status" value={employee.status} />
                        </div>
                      </ProfileCard>

                      <ProfileCard title="ID Proof" className="flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <ProfileCardItem
                            label="Aadhaar"
                            value={showAadhaar ? employee.aadhaar : maskValue(employee.aadhaar, 8, 4)}
                            action={
                              employee.aadhaar ? (
                                <button
                                  type="button"
                                  onClick={() => setShowAadhaar(!showAadhaar)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                  {showAadhaar ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              ) : undefined
                            }
                          />
                          <ProfileCardItem label="PAN" value={employee.pan || 'Not Provided'} />
                          <ProfileCardItem label="Passport" value={employee.passport || 'Not Provided'} />
                        </div>
                      </ProfileCard>
                    </div>

                    {/* Column 2 (Spans 1 column): Emergency Contact card */}
                    <ProfileCard title="Emergency Contact" className="lg:col-span-1 h-full">
                      <div className="space-y-4">
                        <ProfileCardItem label="Name" value={employee.emergencyContact?.name} />
                        <ProfileCardItem label="Phone" value={employee.emergencyContact?.phone} icon={<Phone className="h-3.5 w-3.5" />} />
                        <ProfileCardItem label="Email" value={employee.emergencyContact?.email} icon={<Mail className="h-3.5 w-3.5" />} />
                        <ProfileCardItem label="Relation" value={employee.emergencyContact?.relation} />
                        <ProfileCardItem label="Address" value={employee.emergencyContact?.address || employee.emergencyContact?.relation ? '—' : undefined} />
                      </div>
                    </ProfileCard>

                    {/* Column 3 (Spans 1 column): Bank Details card */}
                    <ProfileCard title="Bank Details" className="lg:col-span-1 h-full">
                       <div className="space-y-4">
                         <ProfileCardItem
                           label="CTC (annual)"
                           value={employee.ctc ? `₹${employee.ctc.toLocaleString('en-IN')}` : 'Not provided'}
                           icon={<Landmark className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="Bank name"
                           value={employee.bankName}
                           icon={<Landmark className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="Account number"
                           value={employee.accountNumber ? maskValue(employee.accountNumber, 8, 4) : 'Not provided'}
                           icon={<CreditCard className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="IFSC code"
                           value={employee.ifsc || 'Not provided'}
                           icon={<Hash className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="UAN"
                           value={maskValue(employee.uan, 8, 4)}
                           icon={<User className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="PF/ESI status"
                           value={employee.pfEsi === 'on' ? 'Enabled' : employee.pfEsi === 'off' ? 'Disabled' : 'Not provided'}
                           icon={<CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                       </div>
                    </ProfileCard>
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <ProfileCard title="Documents">
                  {documents.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.key}
                          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition-all hover:bg-slate-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                        >
                          <FileText className="h-5 w-5 shrink-0 text-emerald-600" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-bold text-slate-700">{doc.name}</p>
                            <p className="ep-profile-doc-meta text-[10px] text-slate-400 capitalize mt-0.5">{doc.key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          </div>
                          <button
                            type="button"
                            disabled={openingDocKey === doc.key}
                            onClick={() => void handleOpenDocument(doc.key, doc.name)}
                            className="shrink-0 rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                            title="View document"
                          >
                            {openingDocKey === doc.key ? (
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                            ) : (
                              <ExternalLink className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
                      <FileText className="h-10 w-10 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-400">No documents uploaded yet.</p>
                    </div>
                  )}
                </ProfileCard>
              )}

            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={statusModalOpen}
        onClose={() => {
          if (savingStatus) return
          setStatusModalOpen(false)
          setPendingStatus(null)
          setStatusChangeReason('')
          setStatusReasonError('')
        }}
        title="Confirm Status Change"
        size="sm"
        theme="light"
        elevated
        className="z-[110]"
      >
        {employee && pendingStatus ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              You are about to change{' '}
              <span className="font-semibold text-slate-900">{name}</span>
              's status from{' '}
              <span className="font-semibold text-slate-900">{employee.status}</span>
              {' '}to{' '}
              <span className="font-semibold text-slate-900">{pendingStatus}</span>.
            </p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-800">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                ref={reasonInputRef}
                value={statusChangeReason}
                onChange={(e) => {
                  setStatusChangeReason(e.target.value)
                  if (statusReasonError) setStatusReasonError('')
                }}
                placeholder="Provide a reason for this status change..."
                className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-slate-800 transition-shadow focus:outline-none focus:ring-2 ${
                  statusReasonError
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-slate-200 focus:ring-emerald-200'
                }`}
                rows={3}
              />
              {statusReasonError ? (
                <p className="text-xs font-medium text-red-600">{statusReasonError}</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-2">
              <Button
                variant="secondary"
                disabled={savingStatus}
                onClick={() => {
                  setStatusModalOpen(false)
                  setPendingStatus(null)
                  setStatusChangeReason('')
                  setStatusReasonError('')
                }}
              >
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
