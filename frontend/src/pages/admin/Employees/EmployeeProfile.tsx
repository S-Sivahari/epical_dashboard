import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import * as employeeService from '@services/employeeService'
import { openEmployeeDocument } from '@/services/uploadService'
import type { Employee, EmployeeActivityEntry } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { stringToHue } from '@/utils/stringColor'
import { getEmployeeAvatarUrl } from '@/utils/getAvatarUrl'

import {
  FileText,
  FileSpreadsheet,
  ExternalLink,
  History,
  ChevronDown,
  Calendar,
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
    <div className={cn("rounded-2xl border border-slate-100 bg-white shadow-[0_4px_15px_rgba(0,0,0,0.01)] overflow-hidden flex flex-col", className)}>
      <div className="bg-slate-50/75 border-b border-slate-100 px-4 py-2.5">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h4>
      </div>
      <div className="p-4 space-y-3.5 flex-1">
        {children}
      </div>
    </div>
  )
}

function ProfileCardItem({ label, value, icon, action }: { label: string; value?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center min-w-0 gap-2">
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="block text-xs font-semibold text-slate-700 truncate mt-0.5" title={typeof value === 'string' ? value : undefined}>
          {value || '—'}
        </span>
      </div>
      {icon && <div className="text-slate-400 shrink-0">{icon}</div>}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function SummaryItem({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        {icon}
      </div>
      <div className="min-w-0">
        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="block text-xs font-semibold text-slate-700 mt-0.5">{value}</span>
      </div>
    </div>
  )
}

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
  const [showAadhaar, setShowAadhaar] = useState(false)
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
    <div className="crewiq-dashboard employee-pages employee-directory-view">
      <div className="employee-directory-bg" aria-hidden>
        <div className="employee-directory-bg-gradient" style={tintBgStyle} />
        <div className="employee-directory-bg-leaves" />
      </div>

      <div className="employee-directory-shell bg-slate-50/35">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
          {/* Left Column: Sidebar Card */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.01)] flex flex-col items-center text-center">
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
              <h2 className="mt-4 text-base font-bold text-slate-800 truncate w-full">{name}</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5 truncate w-full">
                {employee.designation || employee.role || 'Designation'}
              </p>
              
              <div className="mt-3.5">
                {/* Status Badge */}
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                  {employee.status}
                </div>
              </div>
              
              {/* Buttons */}
              <div className="mt-6 w-full flex flex-col gap-2.5">
                <Button asChild variant="secondary" className="w-full text-xs font-semibold h-9 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                  <Link to={ROUTES.EMPLOYEE_EDIT(employee.id!)}>
                    Edit Profile
                  </Link>
                </Button>
                
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button variant="secondary" className="w-full text-xs font-semibold h-9 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1" disabled={savingStatus}>
                      Change Status
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="admin-navbar-menu z-50 min-w-[185px] p-1 bg-white border border-slate-100 shadow-md rounded-xl"
                      sideOffset={4}
                      align="center"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <DropdownMenu.Item
                          key={option.value}
                          className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 data-[disabled]:opacity-50"
                          disabled={employee.status === option.value || savingStatus}
                          onSelect={() => requestStatusChange(option.value)}
                        >
                          {option.label}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>
          </div>

          {/* Right Columns: Segmented Toolbar + Tabs Content */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* Toolbar: Segmented Tabs & Exports */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
              {/* Segmented Control */}
              <div className="flex rounded-xl bg-slate-100/80 p-1 w-full sm:w-auto">
                {PROFILE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 sm:flex-initial rounded-lg px-4 py-1.5 text-xs font-bold transition-all text-center whitespace-nowrap",
                      activeTab === tab.id
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {tab.label === 'Details' ? 'Profile' : tab.label}
                  </button>
                ))}
              </div>

              {/* Exports */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50"
                  onClick={() => void handleExportPdf()}
                >
                  <FileText className="h-3.5 w-3.5 text-red-600" />
                  Export As...
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50"
                  onClick={() => void handleExportExcel()}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-[#266b1c]" />
                  Excel
                </button>
              </div>
            </div>

            {/* Dynamic Content Area */}
            <div className="min-h-[400px]">
              {activeTab === 'details' && (
                <div className="flex flex-col gap-6">
                  {/* Row 1: Personal Details & Quick Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
                    {/* Personal Details Card (Wide, spans 3 columns) */}
                    <ProfileCard title="Personal Details" className="lg:col-span-3 h-full">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ProfileCardItem label="FIRST NAME" value={employee.firstName} />
                        <ProfileCardItem label="LAST NAME" value={employee.lastName} />
                        <ProfileCardItem label="DOB OF BIRTH" value={employee.dob ? formatDate(employee.dob) : 'Not provided'} />
                        
                        <ProfileCardItem label="PERSONAL EMAIL" value={employee.personalEmail} icon={<Mail className="h-3.5 w-3.5" />} />
                        <ProfileCardItem label="GENDER" value={employee.gender} />
                        <ProfileCardItem label="COMPANY EMAIL" value={employee.email} icon={<Mail className="h-3.5 w-3.5" />} />
                        
                        <div className="sm:col-span-2">
                          <ProfileCardItem label="ADDRESS" value={employee.permanentAddress || employee.address} />
                        </div>
                        <ProfileCardItem label="COMMUNICATION ADDRESS" value={employee.communicationAddress} />
                      </div>
                    </ProfileCard>

                    {/* Quick Summary Card (Spans 1 column) */}
                    <ProfileCard title="Quick Summary" className="lg:col-span-1 h-full">
                      <SummaryItem
                        label="Joining Date"
                        value={formatDate(employee.joinedAt)}
                        icon={<Calendar className="h-4 w-4" />}
                      />
                    </ProfileCard>
                  </div>

                  {/* Row 2: Bottom Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
                    {/* Column 1 (Wide, spans 2 columns): Job Details + ID Proof stack */}
                    <div className="lg:col-span-2 flex flex-col gap-6 h-full">
                      <ProfileCard title="Job Details">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <ProfileCardItem label="EMPLOYEE ID" value={employee.employeeId} />
                          <ProfileCardItem label="PAN" value={employee.pan || 'Not Provided'} />
                          <ProfileCardItem label="JOINING DATE" value={formatDate(employee.joinedAt)} />
                          
                          <ProfileCardItem label="ROLE" value={employee.role} />
                          <ProfileCardItem label="EMPLOYMENT TYPE" value={employee.employmentType} />
                          <ProfileCardItem label="STATUS" value={employee.status} />
                        </div>
                      </ProfileCard>

                      <ProfileCard title="ID Proof" className="flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <ProfileCardItem
                            label="AADHAAR"
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
                          <ProfileCardItem label="PASSPORT" value={employee.passport || 'Not Provided'} />
                        </div>
                      </ProfileCard>
                    </div>

                    {/* Column 2 (Spans 1 column): Emergency Contact card */}
                    <ProfileCard title="Emergency Contact" className="lg:col-span-1 h-full">
                      <div className="space-y-4">
                        <ProfileCardItem label="NAME" value={employee.emergencyContact?.name} />
                        <ProfileCardItem label="PHONE" value={employee.emergencyContact?.phone} icon={<Phone className="h-3.5 w-3.5" />} />
                        <ProfileCardItem label="EMAIL" value={employee.emergencyContact?.email} icon={<Mail className="h-3.5 w-3.5" />} />
                        <ProfileCardItem label="RELATION" value={employee.emergencyContact?.relation} />
                        <ProfileCardItem label="ADDRESS" value={employee.emergencyContact?.address || employee.emergencyContact?.relation ? '—' : undefined} />
                      </div>
                    </ProfileCard>

                    {/* Column 3 (Spans 1 column): Payment Details card */}
                    <ProfileCard title="Payment Details" className="lg:col-span-1 h-full">
                       <div className="space-y-4">
                         <ProfileCardItem
                           label="CTC (ANNUAL)"
                           value={employee.ctc ? `₹${employee.ctc.toLocaleString('en-IN')}` : 'Not provided'}
                           icon={<Landmark className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="BANK NAME"
                           value={employee.bankName}
                           icon={<Landmark className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="ACCOUNT NUMBER"
                           value={employee.accountNumber ? maskValue(employee.accountNumber, 8, 4) : 'Not provided'}
                           icon={<CreditCard className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="IFSC CODE"
                           value={employee.ifsc || 'Not provided'}
                           icon={<Hash className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="UAN"
                           value={maskValue(employee.uan, 8, 4)}
                           icon={<User className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                         <ProfileCardItem
                           label="PF/ESI STATUS"
                           value={employee.pfEsi === 'on' ? 'Enabled' : employee.pfEsi === 'off' ? 'Disabled' : 'Not provided'}
                           icon={<CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                         />
                       </div>
                    </ProfileCard>
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
                  <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">Documents</h3>
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
                            <p className="text-[10px] text-slate-400 capitalize mt-0.5">{doc.key.replace(/([A-Z])/g, ' $1').trim()}</p>
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
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
                  <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">Activity History</h3>
                  {activityHistory.length > 0 ? (
                    <div className="space-y-4">
                      {activityHistory.map((entry, index) => (
                        <div
                          key={`${entry.at}-${entry.type}-${index}`}
                          className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <History className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-bold text-slate-700">{entry.summary}</p>
                                <span className={cn(
                                  "rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                                  entry.type === 'status_change'
                                    ? "bg-amber-50 text-amber-700 border-amber-100"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                )}>
                                  {entry.type === 'status_change' ? 'Status change' : 'Profile edit'}
                                </span>
                              </div>
                              {entry.reason ? (
                                <p className="mt-1.5 text-xs text-slate-500">Reason: {entry.reason}</p>
                              ) : null}
                              <p className="mt-2 text-[10px] text-slate-400 font-medium">
                                {entry.by} · {formatDate(entry.at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
                      <History className="h-10 w-10 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-400">No activity recorded yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
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
