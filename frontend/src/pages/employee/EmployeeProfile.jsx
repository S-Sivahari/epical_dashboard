import { useEffect, useState } from 'react'
import {
  FileText,
  ExternalLink,
  History,
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
  Camera,
} from 'lucide-react'
import { useAuthStore } from '@store/authStore'
import * as employeeService from '@services/employeeService'
import { openEmployeeDocument } from '@services/uploadService'
import { uploadPhoto } from '@services/uploadService'
import { useToast } from '@components/employee/shared/ToastProvider'
import { formatDate } from '@pages/employee/lib/utils'
import { documentListFromEmployee } from '@/utils/employeeDocuments'
import { stringToHue } from '@/utils/stringColor'
import { getEmployeeAvatarUrl } from '@/utils/getAvatarUrl'
import { cn } from '@/utils/cn'

const PROFILE_TABS = [
  { id: 'details', label: 'Details' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity History' },
]

const maskValue = (value, prefixLength = 8, suffixLength = 4) => {
  if (!value) return 'Not provided'
  const clean = value.replace(/\s/g, '')
  if (clean.length <= suffixLength) return '•••• •••• ' + clean
  const dots = '•'.repeat(prefixLength)
  return `${dots} ${clean.slice(-suffixLength)}`
}

function ProfileCard({ title, children, className }) {
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

function ProfileCardItem({ label, value, icon, action }) {
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

function SummaryItem({ label, value, icon }) {
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

export default function EmployeeProfile() {
  const user = useAuthStore((s) => s.user)
  const patchUser = useAuthStore((s) => s.patchUser)
  const { toast } = useToast()
  const [employee, setEmployee] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [openingDocKey, setOpeningDocKey] = useState(null)
  const [activeTab, setActiveTab] = useState('details')
  const [showAadhaar, setShowAadhaar] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoVersion, setPhotoVersion] = useState(0)

  useEffect(() => {
    if (!user?.id) {
      setLoadError('Not signed in.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    void (async () => {
      try {
        const profile = await employeeService.getMyEmployee()
        if (!cancelled) {
          setEmployee(profile)
          setDocuments(documentListFromEmployee(profile))
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            (err?.response?.data?.error) ??
            (err instanceof Error ? err.message : 'Could not load your profile.')
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
  }, [user?.id])

  if (loading) {
    return (
      <div className="crewiq-dashboard employee-pages employee-directory-view">
        <div className="employee-directory-bg" aria-hidden>
          <div className="employee-directory-bg-gradient" />
          <div className="employee-directory-bg-leaves" />
        </div>
        <div className="employee-directory-shell">
          <header className="employee-directory-header">
            <h1 className="employee-directory-title">My Profile</h1>
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
            <h1 className="employee-directory-title">My Profile</h1>
          </header>
          <div className="employee-profile-content">
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm font-medium text-red-700">{loadError ?? 'Profile not found.'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const name = `${employee.firstName} ${employee.lastName ?? ''}`.trim()
  const activityHistory = (employee.activityHistory ?? [])
    .slice()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const handleOpenDocument = async (docKey, docName) => {
    setOpeningDocKey(docKey)
    try {
      await openEmployeeDocument(user.id, docKey, docName)
    } catch {
      toast({ title: 'Error', description: 'Could not open document.' })
    } finally {
      setOpeningDocKey(null)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file is image
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please upload an image file.' })
      return
    }

    setUploadingPhoto(true)
    try {
      await uploadPhoto(employee.id, file)
      const updatedEmployee = await employeeService.getMyEmployee()
      setEmployee(updatedEmployee)
      const bust = Date.now()
      setPhotoVersion(bust)
      const newAvatarUrl = getEmployeeAvatarUrl(updatedEmployee, bust)
      if (newAvatarUrl) {
        patchUser({ avatarUrl: newAvatarUrl })
      }
      toast({ title: 'Success', description: 'Profile picture updated successfully.' })
    } catch (err) {
      toast({ title: 'Error', description: `Failed to upload profile picture: ${err?.message || 'Unknown error'}` })
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
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

  const avatarUrl = getEmployeeAvatarUrl(employee, photoVersion || undefined)

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
              <div className="relative flex items-center justify-center h-28 w-28 rounded-full border-2 overflow-hidden group cursor-pointer" style={avatarRingStyle}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold" style={initialsStyle}>
                    {`${employee.firstName?.[0] ?? ''}${employee.lastName?.[0] ?? ''}`.toUpperCase()}
                  </span>
                )}
                {/* Upload overlay */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <Camera className="h-6 w-6 text-white" />
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="hidden"
                    />
                  </label>
                </div>
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
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
            </div>
          </div>

          {/* Right Columns: Segmented Toolbar + Tabs Content */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* Toolbar: Segmented Tabs */}
            <div className="flex justify-start bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
              {/* Segmented Control */}
              <div className="flex rounded-xl bg-slate-100/80 p-1">
                {PROFILE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "rounded-lg px-4 py-1.5 text-xs font-bold transition-all text-center whitespace-nowrap",
                      activeTab === tab.id
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
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
                          <ProfileCardItem label="DEPARTMENT" value={employee.department} />
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
                        <ProfileCardItem label="ADDRESS" value={employee.emergencyContact?.address} />
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
    </div>
  )
}

function DocumentPreviewCard({ doc, onPreview, loading }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition-all hover:bg-slate-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
    >
      <FileText className="h-5 w-5 shrink-0 text-emerald-600" />
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-bold text-slate-700">{doc.name}</p>
        <p className="text-[10px] text-slate-400 capitalize mt-0.5">{doc.key.replace(/([A-Z])/g, ' $1').trim()}</p>
      </div>
      <button
        type="button"
        onClick={onPreview}
        disabled={loading}
        className="shrink-0 rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
        title="View document"
      >
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        ) : (
          <ExternalLink className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}
