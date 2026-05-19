import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import * as employeeService from '@services/employeeService'
import type { Employee } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { stringToHueColor } from '@/utils/stringColor'
import { Pencil, FileText, ExternalLink, Download } from 'lucide-react'
import { exportToExcel } from '@/utils/exportExcel'
import { exportToPDF } from '@/utils/exportPDF'

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

const exportHeaders: { key: keyof Employee; label: string }[] = [
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'department', label: 'Department' },
  { key: 'role', label: 'Role' },
  { key: 'employmentType', label: 'Type' },
  { key: 'joinedAt', label: 'Joined' },
  { key: 'status', label: 'Status' },
]

export function EmployeeProfile() {
  const { id = '' } = useParams()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [documents, setDocuments] = useState<{ key: string; name: string; url: string }[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const e = await employeeService.getEmployee(id)
        if (!cancelled) setEmployee(e)
      } catch {
        if (!cancelled) setEmployee(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setDocsLoading(true)
      try {
        const docs = await employeeService.getEmployeeDocuments(id)
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
  }, [id])

  if (!employee) {
    return (
      <PageWrapper>
        <PageHeader title="Employee" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-3 text-sm text-muted">Loading profile…</span>
        </div>
      </PageWrapper>
    )
  }

  const name = `${employee.firstName} ${employee.lastName ?? ''}`.trim()
  const fileName = `Employee_${employee.employeeId}_${employee.firstName}`

  return (
    <PageWrapper>
      <PageHeader
        title={name}
        subtitle={`${employee.department} · ${employee.employeeId}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => exportToPDF([employee], fileName, exportHeaders)}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="secondary" onClick={() => exportToExcel([employee], fileName, exportHeaders)}>
              <Download className="h-4 w-4" />
              Excel
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
            <Avatar src={employee.avatarUrl} name={name} size="lg" color={stringToHueColor(employee.id)} />
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
                <span className="font-medium text-ink">Department:</span> {employee.department}
              </p>
              <p>
                <span className="font-medium text-ink">Joined:</span> {formatDate(employee.joinedAt)}
              </p>
            </div>
          </div>
        </aside>

        {/* ── Main Content ────────────────────────────────────────────── */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            
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
              <InfoRow label="Address" value={employee.address} />
            </div>

            {/* ── Job ───────────────────────────────────────────── */}
            <SectionHeader title="Job Details" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Employee ID" value={employee.employeeId} />
              <InfoRow label="Department" value={employee.department} />
              <InfoRow label="Role" value={employee.role} />
              <InfoRow label="Employment Type" value={employee.employmentType} />
              <InfoRow label="Joining Date" value={formatDate(employee.joinedAt)} />
              <InfoRow label="Reporting Manager" value={employee.reportingManager} />
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
              {docsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="ml-3 text-sm text-muted">Loading documents…</span>
                </div>
              ) : documents.length > 0 ? (
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
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md p-1.5 text-primary hover:bg-primary/10 transition-ui"
                        title="View document"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed border-border bg-surface/30">
                  <FileText className="h-10 w-10 text-muted/40" />
                  <p className="mt-3 text-sm text-muted">No documents uploaded yet.</p>
                  <Button variant="secondary" size="sm" className="mt-4" asChild>
                    <Link to={`/admin/employees/${employee.id}/edit`}>Upload Documents</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </PageWrapper>
  )
}
