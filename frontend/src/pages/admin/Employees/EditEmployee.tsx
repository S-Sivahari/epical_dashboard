import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { FileUpload } from '@components/forms/FileUpload'
import * as employeeService from '@services/employeeService'
import { useEmployeeStore } from '@store/employeeStore'
import { deleteDocument, uploadDocuments, uploadPhoto } from '@services/uploadService'
import { ExternalLink, FileText, Trash2 } from 'lucide-react'

// ── Validation ────────────────────────────────────────────────────────────────

const employeeIdPattern = /^(EPL|INT)\d{8}$/
const isValidDate = (v: string) => !Number.isNaN(Date.parse(v))

const editSchema = z.object({
  // Personal
  employeeId: z
    .string()
    .optional()
    .refine(
      (v) => !v || employeeIdPattern.test(v.trim().toUpperCase()),
      'Use EPL or INT plus 8 digits',
    ),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  dob: z.string().optional().refine((v) => !v || isValidDate(v), 'Enter a valid date'),
  gender: z.string().optional(),
  phone: z.string().optional(),
  personalEmail: z
    .string()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Enter a valid personal email'),
  companyEmail: z.string().min(1, 'Company email is required').email('Enter a valid company email'),
  // Account
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  uan: z.string().optional(),
  pfEsi: z.enum(['on', 'off']).optional(),
  // Joining
  joinedAt: z
    .string()
    .min(1, 'Joining date is required')
    .refine(isValidDate, 'Enter a valid joining date'),
  employmentType: z.enum(['Full-time', 'Contract', 'Intern', 'Notice Period']),
  department: z.string().min(2, 'Department is required'),
  reportingManager: z.string().optional(),
  role: z.string().min(1, 'Role is required'),
  designation: z.string().optional(),
  ctc: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive('CTC must be positive').optional(),
  ),
  status: z.enum(['Active', 'Inactive', 'Notice Period', 'Deactivated', 'Archived']),
  // ID proof
  aadhaar: z.string().optional(),
  pan: z.string().optional(),
  passport: z.string().optional(),
})

type FormValues = z.infer<typeof editSchema>

// ── Document types ────────────────────────────────────────────────────────────

type DocKey =
  | 'aadhaar'
  | 'pan'
  | 'offerLetter'
  | 'certificate10th'
  | 'certificate12th'
  | 'certificateDiploma'
  | 'certificateDegree'
  | 'agreement'
type StandardDocKey = 'aadhaar' | 'pan' | 'offerLetter' | 'agreement'
type CertificateDocKey =
  | 'certificate10th'
  | 'certificate12th'
  | 'certificateDiploma'
  | 'certificateDegree'
type ExistingDocument = { key: string; name: string; url: string; uploadedAt?: string }
type EmployeeDocuments = Partial<Record<DocKey, { filename?: string; uploadedAt?: string }>>

const DOCUMENT_TYPES: Record<StandardDocKey, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  offerLetter: 'Offer Letter',
  agreement: 'Agreement',
}

const CERTIFICATE_TYPES: Record<CertificateDocKey, string> = {
  certificate10th: '10th Certificate',
  certificate12th: '12th Certificate',
  certificateDiploma: 'Diploma Certificate',
  certificateDegree: 'Degree Certificate',
}

const CERTIFICATE_OPTIONS: { key: CertificateDocKey; label: string }[] = [
  { key: 'certificateDegree', label: 'Degree' },
  { key: 'certificateDiploma', label: 'Diploma' },
  { key: 'certificate10th', label: '10th' },
  { key: 'certificate12th', label: '12th' },
]

const ALL_DOCUMENT_KEYS: DocKey[] = [
  'aadhaar',
  'pan',
  'offerLetter',
  'agreement',
  'certificate10th',
  'certificate12th',
  'certificateDiploma',
  'certificateDegree',
]

const EMPTY_DOCUMENTS: Record<DocKey, null> = {
  aadhaar: null,
  pan: null,
  offerLetter: null,
  agreement: null,
  certificate10th: null,
  certificate12th: null,
  certificateDiploma: null,
  certificateDegree: null,
}

const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
const MAX_DOC_SIZE = 5 * 1024 * 1024
const MAX_PHOTO_SIZE = 2 * 1024 * 1024

function validateFile(file: File, allowedTypes: string[], maxSize: number): string | null {
  if (!allowedTypes.includes(file.type)) return 'Invalid file type. Allowed: .pdf, .jpg, .jpeg, .png'
  if (file.size > maxSize) return `File too large. Max ${maxSize / 1024 / 1024}MB.`
  return null
}

function buildExistingDocuments(employee: any, fallbackDocs: ExistingDocument[]) {
  const directDocuments = employee?.documents as EmployeeDocuments | undefined
  const fallbackMap = fallbackDocs.reduce<Record<string, ExistingDocument>>((acc, doc) => {
    acc[doc.key] = doc
    return acc
  }, {})

  return ALL_DOCUMENT_KEYS.reduce<Record<DocKey, ExistingDocument | null>>(
    (acc, key) => {
      const directDoc = directDocuments?.[key]
      const fallbackDoc = fallbackMap[key]
      const legacyAadhaarPan =
        key === 'aadhaar'
          ? ((employee?.documents as any)?.aadhaarPan as { filename?: string; uploadedAt?: string } | undefined)
          : undefined
      const legacyAadhaarFallback = key === 'aadhaar' ? fallbackMap.aadhaarPan : undefined
      const legacyCertificate =
        key === 'certificateDegree'
          ? ((employee?.documents as any)?.certificates as { filename?: string; uploadedAt?: string } | undefined)
          : undefined
      const legacyFallback = key === 'certificateDegree' ? fallbackMap.certificates : undefined
      const filename =
        directDoc?.filename ??
        fallbackDoc?.name ??
        legacyAadhaarPan?.filename ??
        legacyAadhaarFallback?.name ??
        legacyCertificate?.filename ??
        legacyFallback?.name

      acc[key] = filename
        ? {
            key:
              fallbackDoc?.key ??
              legacyAadhaarFallback?.key ??
              legacyFallback?.key ??
              key,
            name: filename,
            uploadedAt:
              directDoc?.uploadedAt ??
              fallbackDoc?.uploadedAt ??
              legacyAadhaarPan?.uploadedAt ??
              legacyAadhaarFallback?.uploadedAt ??
              legacyCertificate?.uploadedAt ??
              legacyFallback?.uploadedAt,
            url:
              fallbackDoc?.url ??
              legacyAadhaarFallback?.url ??
              legacyFallback?.url ??
              `/api/employees/${employee?.id}/documents/${key}`,
          }
        : null

      return acc
    },
    { ...EMPTY_DOCUMENTS },
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditEmployee() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee)

  const [pageLoading, setPageLoading] = useState(true)
  const [employeeName, setEmployeeName] = useState('')
  const [existingDocuments, setExistingDocuments] =
    useState<Record<DocKey, ExistingDocument | null>>({ ...EMPTY_DOCUMENTS })

  const [documentFiles, setDocumentFiles] = useState<Record<DocKey, File | null>>({
    ...EMPTY_DOCUMENTS,
  })
  const [documentErrors, setDocumentErrors] =
    useState<Record<DocKey, string | null>>({ ...EMPTY_DOCUMENTS })
  const [documentPreviews, setDocumentPreviews] =
    useState<Record<DocKey, string | null>>({ ...EMPTY_DOCUMENTS })
  const documentPreviewsRef = useRef<Record<DocKey, string | null>>({ ...EMPTY_DOCUMENTS })
  const [selectedCertificateKey, setSelectedCertificateKey] =
    useState<CertificateDocKey>('certificateDegree')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    mode: 'onTouched',
  })

  // Load existing employee data
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const e = await employeeService.getEmployee(id)
        const docs = await employeeService.getEmployeeDocuments(id)
        if (cancelled) return
        setEmployeeName(`${e.firstName} ${e.lastName ?? ''}`.trim())
        setExistingDocuments(buildExistingDocuments(e, docs))
        form.reset({
          employeeId: e.employeeId ?? '',
          firstName: e.firstName,
          lastName: e.lastName ?? '',
          address: e.address ?? '',
          dob: e.dob ?? '',
          gender: e.gender ?? 'Female',
          phone: e.phone ?? '',
          personalEmail: e.personalEmail ?? '',
          companyEmail: e.email,
          bankName: e.bankName ?? '',
          accountNumber: e.accountNumber ?? '',
          ifsc: e.ifsc ?? '',
          uan: e.uan ?? '',
          pfEsi: e.pfEsi ?? 'on',
          joinedAt: e.joinedAt ?? '',
          employmentType: e.employmentType ?? 'Full-time',
          department: e.department,
          reportingManager: e.reportingManager ?? '',
          role: e.role,
          designation: e.designation ?? '',
          ctc: e.ctc,
          status: e.status ?? 'Active',
          aadhaar: e.aadhaar ?? '',
          pan: e.pan ?? '',
          passport: e.passport ?? '',
        })
      } catch {
        if (!cancelled) {
          toast.error('Employee not found')
          navigate('/admin/employees')
        }
      } finally {
        if (!cancelled) setPageLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form, id, navigate])

  // Cleanup photo preview URL
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  useEffect(() => {
    documentPreviewsRef.current = documentPreviews
  }, [documentPreviews])

  useEffect(() => {
    return () => {
      Object.values(documentPreviewsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [])

  const handleDocumentUpload = (key: DocKey, files: FileList | null) => {
    const file = files?.[0] ?? null
    if (!file) {
      setDocumentFiles((p) => ({ ...p, [key]: null }))
      setDocumentErrors((p) => ({ ...p, [key]: null }))
      setDocumentPreviews((p) => {
        if (p[key]) URL.revokeObjectURL(p[key])
        return { ...p, [key]: null }
      })
      return
    }
    const error = validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE)
    setDocumentErrors((p) => ({ ...p, [key]: error }))
    setDocumentFiles((p) => ({ ...p, [key]: error ? null : file }))
    setDocumentPreviews((p) => {
      if (p[key]) URL.revokeObjectURL(p[key])
      return { ...p, [key]: error ? null : URL.createObjectURL(file) }
    })
  }

  const removeSelectedDocument = (key: DocKey) => {
    handleDocumentUpload(key, null)
  }

  const deleteExistingDocument = async (key: DocKey) => {
    const doc = existingDocuments[key]
    if (!doc) return

    try {
      await deleteDocument(id, doc.key)
      setExistingDocuments((prev) => ({ ...prev, [key]: null }))
      toast.success('Document deleted')
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ?? (err instanceof Error ? err.message : 'Could not delete document')
      toast.error(msg)
    }
  }

  const handlePhotoUpload = (files: FileList | null) => {
    const file = files?.[0] ?? null
    if (!file) {
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoError(null)
      return
    }
    const error = validateFile(file, ALLOWED_PHOTO_TYPES, MAX_PHOTO_SIZE)
    setPhotoError(error)
    if (error) {
      setPhotoFile(null)
      setPhotoPreview(null)
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateEmployee(id, {
        employeeId: values.employeeId?.trim().toUpperCase() ?? '',
        firstName: values.firstName,
        lastName: values.lastName ?? '',
        address: values.address ?? '',
        dob: values.dob ?? '',
        gender: values.gender ?? '',
        phone: values.phone ?? '',
        personalEmail: values.personalEmail ?? '',
        email: values.companyEmail,
        bankName: values.bankName ?? '',
        accountNumber: values.accountNumber ?? '',
        ifsc: values.ifsc ?? '',
        uan: values.uan ?? '',
        pfEsi: values.pfEsi,
        joinedAt: values.joinedAt,
        employmentType: values.employmentType,
        department: values.department,
        reportingManager: values.reportingManager ?? '',
        role: values.role,
        designation: values.designation ?? values.role,
        ctc: values.ctc,
        status: values.status,
        aadhaar: values.aadhaar ?? '',
        pan: values.pan ?? '',
        passport: values.passport ?? '',
      })

      // Upload documents if any
      const hasDocuments = Object.values(documentFiles).some((f) => f !== null)
      if (hasDocuments) {
        try {
          await uploadDocuments(id, documentFiles)
        } catch (err) {
          console.error('Failed to upload documents:', err)
          toast.warning('Employee updated but some documents failed to upload')
        }
      }

      // Upload photo if provided
      if (photoFile) {
        try {
          await uploadPhoto(id, photoFile)
        } catch (err) {
          console.error('Failed to upload photo:', err)
          toast.warning('Employee updated but photo failed to upload')
        }
      }

      toast.success('Employee updated successfully')
      navigate('/admin/employees')
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ?? (err instanceof Error ? err.message : 'Update failed')
      toast.error(msg)
    }
  })

  if (pageLoading) {
    return (
      <PageWrapper>
        <p className="text-sm text-muted">Loading…</p>
      </PageWrapper>
    )
  }

  const selectedCertificate = existingDocuments[selectedCertificateKey]
  const selectedCertificateFile = documentFiles[selectedCertificateKey]
  const selectedCertificatePreview = documentPreviews[selectedCertificateKey]

  return (
    <PageWrapper>
      <PageHeader
        title={`Edit — ${employeeName}`}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Employees', to: '/admin/employees' },
              { label: employeeName },
              { label: 'Edit' },
            ]}
          />
        }
      />

      <form className="mx-auto max-w-6xl space-y-8 pb-12" onSubmit={onSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Section 1: Personal Details ─────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="mb-6 font-display text-lg font-semibold text-ink">Personal Details</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Employee ID"
                placeholder="e.g. EPL12345678"
                error={form.formState.errors.employeeId?.message}
                {...form.register('employeeId')}
              />
              <Input
                label="First name"
                required
                error={form.formState.errors.firstName?.message}
                {...form.register('firstName')}
              />
              <Input
                label="Last name"
                error={form.formState.errors.lastName?.message}
                {...form.register('lastName')}
              />
              <Input
                label="Address"
                error={form.formState.errors.address?.message}
                {...form.register('address')}
              />
              <Input
                label="Date of birth"
                type="date"
                error={form.formState.errors.dob?.message}
                {...form.register('dob')}
              />
              <SelectField
                label="Gender"
                error={form.formState.errors.gender?.message}
                options={[
                  { value: 'Female', label: 'Female' },
                  { value: 'Male', label: 'Male' },
                  { value: 'Non-binary', label: 'Non-binary' },
                ]}
                {...form.register('gender')}
              />
              <Input
                label="Phone"
                error={form.formState.errors.phone?.message}
                {...form.register('phone')}
              />
              <Input
                label="Personal email"
                type="email"
                error={form.formState.errors.personalEmail?.message}
                {...form.register('personalEmail')}
              />
              <Input
                label="Company email"
                type="email"
                required
                error={form.formState.errors.companyEmail?.message}
                {...form.register('companyEmail')}
              />
            </div>
          </div>

          {/* ── Section 2: Account Details ──────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h3 className="mb-6 font-display text-lg font-semibold text-ink">Account Details</h3>
            <div className="grid gap-4">
              <Input
                label="Bank name"
                error={form.formState.errors.bankName?.message}
                {...form.register('bankName')}
              />
              <Input
                label="Account number"
                error={form.formState.errors.accountNumber?.message}
                {...form.register('accountNumber')}
              />
              <Input
                label="IFSC code"
                error={form.formState.errors.ifsc?.message}
                {...form.register('ifsc')}
              />
              <Input
                label="UAN number"
                error={form.formState.errors.uan?.message}
                {...form.register('uan')}
              />
              <SelectField
                label="PF / ESI status"
                error={form.formState.errors.pfEsi?.message}
                options={[
                  { value: 'on', label: 'Enabled' },
                  { value: 'off', label: 'Disabled' },
                ]}
                {...form.register('pfEsi')}
              />
            </div>
          </div>

          {/* ── Section 3: Joining Details ──────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h3 className="mb-6 font-display text-lg font-semibold text-ink">Joining Details</h3>
            <div className="grid gap-4">
              <Input
                label="Joining date"
                type="date"
                required
                error={form.formState.errors.joinedAt?.message}
                {...form.register('joinedAt')}
              />
              <SelectField
                label="Employment type"
                required
                error={form.formState.errors.employmentType?.message}
                options={[
                  { value: 'Full-time', label: 'Full-time' },
                  { value: 'Contract', label: 'Contract' },
                  { value: 'Intern', label: 'Intern' },
                  { value: 'Notice Period', label: 'Notice Period' },
                ]}
                {...form.register('employmentType')}
              />
              <Input
                label="Department"
                required
                error={form.formState.errors.department?.message}
                {...form.register('department')}
              />
              <Input
                label="Reporting manager"
                error={form.formState.errors.reportingManager?.message}
                {...form.register('reportingManager')}
              />
              <Input
                label="Role"
                required
                error={form.formState.errors.role?.message}
                {...form.register('role')}
              />
              <Input
                label="Designation"
                error={form.formState.errors.designation?.message}
                {...form.register('designation')}
              />
              <Input
                label="CTC (annual)"
                type="number"
                error={form.formState.errors.ctc?.message}
                {...form.register('ctc', {
                  setValueAs: (v) => (v === '' ? undefined : Number(v)),
                })}
              />
              <SelectField
                label="Status"
                required
                error={form.formState.errors.status?.message}
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Notice Period', label: 'Notice Period' },
                  { value: 'Inactive', label: 'Inactive' },
                  { value: 'Deactivated', label: 'Deactivated' },
                ]}
                {...form.register('status')}
              />
            </div>
          </div>

          {/* ── Section 4: ID Proof ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="mb-6 font-display text-lg font-semibold text-ink">ID Proof</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Aadhaar number"
                error={form.formState.errors.aadhaar?.message}
                {...form.register('aadhaar')}
              />
              <Input
                label="PAN"
                error={form.formState.errors.pan?.message}
                {...form.register('pan')}
              />
              <Input
                label="Passport number"
                error={form.formState.errors.passport?.message}
                {...form.register('passport')}
              />
            </div>
          </div>
        </div>

        {/* ── Section 5: Documents ────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-8 font-display text-lg font-semibold text-ink">Employee Documents</h3>
          <p className="mb-6 text-sm text-muted">
            Upload or replace documents. Allowed: .pdf, .jpg, .jpeg, .png · Max 5 MB each.
          </p>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(Object.entries(DOCUMENT_TYPES) as [StandardDocKey, string][]).map(([key, label]) => (
              <div key={key} className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-1 font-medium text-ink">{label}</p>
                {existingDocuments[key] ? (
                  <div className="mb-3 rounded-lg border border-border bg-white px-3 py-2">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {existingDocuments[key]?.name}
                        </p>
                        <p className="text-xs text-muted">
                          Already uploaded
                          {existingDocuments[key]?.uploadedAt ? ` · ${existingDocuments[key]?.uploadedAt}` : ''}
                        </p>
                      </div>
                      {existingDocuments[key]?.url ? (
                        <a
                          href={existingDocuments[key]?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-md p-1.5 text-primary transition-ui hover:bg-primary/10"
                          title="View document"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="shrink-0 rounded-md p-1.5 text-danger transition-ui hover:bg-danger/10"
                        title="Delete document"
                        onClick={() => void deleteExistingDocument(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 rounded-lg border border-dashed border-border bg-white/70 px-3 py-2">
                    <p className="text-xs text-muted">No file uploaded yet.</p>
                  </div>
                )}
                <FileUpload
                  accept=".pdf,.jpg,.jpeg,.png"
                  onUpload={(files) => handleDocumentUpload(key, files)}
                />
                {documentFiles[key] ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="truncate text-sm text-ink">Selected: {documentFiles[key]?.name}</p>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-danger hover:underline"
                      onClick={() => removeSelectedDocument(key)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                {documentErrors[key] ? (
                  <p className="mt-1 text-xs text-danger">{documentErrors[key]}</p>
                ) : null}
              </div>
            ))}

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <p className="font-medium text-ink">Certificates</p>
                <p className="text-xs text-muted">5MB</p>
              </div>
              <SelectField
                value={selectedCertificateKey}
                onChange={(event) =>
                  setSelectedCertificateKey(event.target.value as CertificateDocKey)
                }
                options={CERTIFICATE_OPTIONS.map((option) => ({
                  value: option.key,
                  label: option.label,
                }))}
              />
              <div className="mt-4">
                <FileUpload
                  accept=".pdf,.jpg,.jpeg,.png"
                  onUpload={(files) => handleDocumentUpload(selectedCertificateKey, files)}
                />
              </div>
              {selectedCertificateFile || selectedCertificate ? (
                <div className="mt-4 rounded-lg border border-border bg-white px-3 py-2">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {selectedCertificateFile?.name ?? selectedCertificate?.name}
                      </p>
                      <p className="text-xs text-muted">
                        {selectedCertificateFile
                          ? `${CERTIFICATE_TYPES[selectedCertificateKey]} selected`
                          : `${CERTIFICATE_TYPES[selectedCertificateKey]} uploaded`}
                      </p>
                    </div>
                    {selectedCertificatePreview || selectedCertificate?.url ? (
                      <a
                        href={selectedCertificatePreview ?? selectedCertificate?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md p-1.5 text-primary transition-ui hover:bg-primary/10"
                        title="Preview certificate"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    {selectedCertificateFile ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-md p-1.5 text-danger transition-ui hover:bg-danger/10"
                        title="Remove selected certificate"
                        onClick={() => removeSelectedDocument(selectedCertificateKey)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : selectedCertificate ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-md p-1.5 text-danger transition-ui hover:bg-danger/10"
                        title="Delete certificate"
                        onClick={() => void deleteExistingDocument(selectedCertificateKey)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {documentErrors[selectedCertificateKey] ? (
                <p className="mt-1 text-xs text-danger">{documentErrors[selectedCertificateKey]}</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-5 flex items-start justify-between gap-3">
                <p className="font-medium text-ink">Profile Photo</p>
                <p className="text-xs text-muted">2MB</p>
              </div>
              <FileUpload accept=".jpg,.jpeg,.png" onUpload={handlePhotoUpload} />
              {photoPreview ? (
                <div className="mt-4 rounded-lg border border-border bg-white p-3 text-center">
                  <img
                    src={photoPreview}
                    alt="Profile preview"
                    className="mx-auto h-20 w-20 rounded-full border border-border object-cover"
                  />
                  <p className="mt-2 truncate text-xs text-ink">{photoFile?.name}</p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-danger hover:underline"
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview(null)
                      setPhotoError(null)
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              {photoError ? <p className="mt-2 text-xs text-danger">{photoError}</p> : null}
            </div>
          </div>
        </div>

        {/* ── Section 6: Profile Photo ─────────────────────────────────── */}
        <div className="hidden">
          <h3 className="mb-1 font-display text-lg font-semibold text-ink">Profile Photo</h3>
          <p className="mb-6 text-sm text-muted">
            Upload a new photo to replace the current one. Allowed: .jpg, .jpeg, .png · Max 2 MB.
          </p>
          <div className="grid gap-4 md:grid-cols-2 items-start">
            <div>
              <FileUpload accept=".jpg,.jpeg,.png" onUpload={handlePhotoUpload} />
              {photoFile ? (
                <p className="mt-2 text-sm text-ink">Selected: {photoFile.name}</p>
              ) : null}
              {photoError ? <p className="mt-1 text-xs text-danger">{photoError}</p> : null}
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile preview"
                  className="mx-auto h-40 w-40 rounded-xl object-cover"
                />
              ) : (
                <p className="text-sm text-muted">
                  Preview will appear here after selecting a photo.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <Button type="button" variant="ghost" onClick={() => navigate('/admin/employees')}>
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Save changes
          </Button>
        </div>
      </form>
    </PageWrapper>
  )
}
