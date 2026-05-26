import { useEffect, useState } from 'react'
import { FileText, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@store/authStore'
import * as employeeService from '@services/employeeService'
import { openEmployeeDocument } from '@services/uploadService'
import { EmployeePhotoAvatar } from '@components/employee/shared/EmployeePhotoAvatar'
import { Badge } from '@components/employee/ui/badge'
import { useToast } from '@components/employee/shared/ToastProvider'
import { formatDate } from '@pages/employee/lib/utils'

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <span className="text-sm text-foreground">{value || '—'}</span>
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <h3 className="mb-4 mt-6 border-b border-border pb-2 font-heading text-lg font-semibold first:mt-0">
      {title}
    </h3>
  )
}

const statusVariant = (status) => {
  switch (status) {
    case 'Active':
      return 'success'
    case 'Notice Period':
      return 'warning'
    case 'Inactive':
    case 'Deactivated':
      return 'danger'
    default:
      return 'secondary'
  }
}

export default function EmployeeProfile() {
  const user = useAuthStore((s) => s.user)
  const { toast } = useToast()
  const [employee, setEmployee] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [docsLoading, setDocsLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

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
        const profile = await employeeService.getEmployee(user.id)
        if (!cancelled) setEmployee(profile)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err?.response?.data?.error || 'Could not load your profile.')
          setEmployee(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    setDocsLoading(true)

    void (async () => {
      try {
        const docs = await employeeService.getEmployeeDocuments(user.id)
        if (!cancelled) setDocuments(docs)
      } catch {
        if (!cancelled) setDocuments([])
      } finally {
        if (!cancelled) setDocsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="ml-3 text-sm text-muted">Loading profile…</span>
      </div>
    )
  }

  if (loadError || !employee) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">{loadError ?? 'Profile not found.'}</p>
      </div>
    )
  }

  const name = `${employee.firstName} ${employee.lastName ?? ''}`.trim()
  const certificates = documents.filter((doc) =>
    /cert|degree|diploma|10th|12th|offer|agreement/i.test(doc.key),
  )
  const otherDocuments = documents.filter((doc) => !certificates.some((c) => c.key === doc.key))

  const previewDocument = (doc) => {
    void openEmployeeDocument(user.id, doc.key, doc.name).catch(() =>
      toast({ title: 'Error', description: 'Could not open document.' }),
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="h-max rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-col items-center text-center">
            <EmployeePhotoAvatar
              employeeId={employee.id}
              name={name}
              className="h-24 w-24 border-4 border-primary/20"
              fallbackClassName="bg-primary/10 text-primary text-xl"
            />
            <p className="mt-3 font-heading text-lg font-semibold">{name}</p>
            <p className="font-mono text-xs text-muted">{employee.employeeId}</p>
            <div className="mt-3">
              <Badge variant={statusVariant(employee.status)}>{employee.status}</Badge>
            </div>
            <div className="mt-4 w-full space-y-2 text-left text-sm text-muted">
              <p>
                <span className="font-medium text-foreground">Email:</span> {employee.email}
              </p>
              {employee.phone ? (
                <p>
                  <span className="font-medium text-foreground">Phone:</span> {employee.phone}
                </p>
              ) : null}
              <p>
                <span className="font-medium text-foreground">Role:</span> {employee.role}
              </p>
              <p>
                <span className="font-medium text-foreground">Joined:</span> {formatDate(employee.joinedAt)}
              </p>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <SectionHeader title="Personal Details" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="First Name" value={employee.firstName} />
              <InfoRow label="Last Name" value={employee.lastName} />
              <InfoRow label="Date of Birth" value={employee.dob ? formatDate(employee.dob) : undefined} />
              <InfoRow label="Gender" value={employee.gender} />
              <InfoRow label="Phone" value={employee.phone} />
              <InfoRow label="Personal Email" value={employee.personalEmail} />
              <InfoRow label="Company Email" value={employee.email} />
              <InfoRow label="Address" value={employee.address} />
            </div>

            <SectionHeader title="Job Details" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Employee ID" value={employee.employeeId} />
              <InfoRow label="Department" value={employee.department} />
              <InfoRow label="Designation" value={employee.designation} />
              <InfoRow label="Employment Type" value={employee.employmentType} />
              <InfoRow label="Joining Date" value={formatDate(employee.joinedAt)} />
              <InfoRow label="Status" value={employee.status} />
            </div>

            <SectionHeader title="ID Proof" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Aadhaar Number" value={employee.aadhaar} />
              <InfoRow label="PAN" value={employee.pan} />
              <InfoRow label="Passport Number" value={employee.passport} />
            </div>

            <SectionHeader title="Certificates & Documents" />
            {docsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <span className="ml-3 text-sm text-muted">Loading documents…</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-slate-50/50 py-8 text-center">
                <FileText className="h-10 w-10 text-muted/40" />
                <p className="mt-3 text-sm text-muted">No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {certificates.length > 0 ? (
                  <div>
                    <p className="mb-3 text-sm font-medium text-foreground">Certificates</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {certificates.map((doc) => (
                        <DocumentPreviewCard key={doc.key} doc={doc} onPreview={() => previewDocument(doc)} />
                      ))}
                    </div>
                  </div>
                ) : null}
                {otherDocuments.length > 0 ? (
                  <div>
                    <p className="mb-3 text-sm font-medium text-foreground">Other Documents</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {otherDocuments.map((doc) => (
                        <DocumentPreviewCard key={doc.key} doc={doc} onPreview={() => previewDocument(doc)} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function DocumentPreviewCard({ doc, onPreview }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-slate-50/80 px-4 py-3">
      <FileText className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
        <p className="text-xs capitalize text-muted">{doc.key.replace(/([A-Z])/g, ' $1').trim()}</p>
      </div>
      <button
        type="button"
        onClick={onPreview}
        className="shrink-0 rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
        title="Preview document"
      >
        <ExternalLink className="h-4 w-4" />
      </button>
    </div>
  )
}
