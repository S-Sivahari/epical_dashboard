import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { FileUpload } from '@components/forms/FileUpload'
import * as employeeService from '@services/employeeService'
import { documentListFromEmployee } from '@/utils/employeeDocuments'
import { useEmployeeStore } from '@store/employeeStore'
import { useAuthStore } from '@store/authStore'
import { useUnsavedChangesGuard } from '@hooks/useUnsavedChangesGuard'
import { deleteDocument, openEmployeeDocument, uploadDocuments, uploadPhoto } from '@services/uploadService'
import { ExternalLink, FileText, Trash2, HelpCircle, X } from 'lucide-react'

// ── Validation ────────────────────────────────────────────────────────────────

const isValidDate = (v: string) => !Number.isNaN(Date.parse(v))

const editSchema = z.object({
  // Personal
  employeeId: z.string().min(1, 'Employee ID is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional().or(z.literal('')),
  lastName: z.string().min(1, 'Last name is required'),
  permanentAddress: z.string().min(1, 'Permanent address is required'),
  communicationAddress: z.string().min(1, 'Communication address is required'),
  dob: z
    .string()
    .min(1, 'Date of birth is required')
    .refine(isValidDate, 'Enter a valid date of birth'),
  gender: z.string().min(1, 'Gender is required'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  personalEmail: z.string().email('Enter a valid personal email'),
  companyEmail: z.union([z.string().email('Enter a valid company email'), z.literal('')]).optional(),
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
  employmentType: z.enum(['Full-time', 'Contract', 'Intern']),
  role: z.string().min(1, 'Role is required'),
  ctc: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive('CTC must be a positive number').optional(),
  ),
  // ID proof
  aadhaar: z.string().optional(),
  pan: z.string().min(1, 'PAN is required'),
  passport: z.string().optional(),
  // Emergency Contact
  emergencyContactName: z.string().min(1, 'Emergency contact name is required'),
  emergencyContactPhone: z.string().min(1, 'Emergency contact phone is required'),
  emergencyContactEmail: z.string().email('Valid email required'),
  emergencyContactRelation: z.string().min(1, 'Emergency contact relation is required'),
  emergencyContactAddress: z.string().min(1, 'Emergency contact address is required'),
})

type FormValues = z.infer<typeof editSchema>

const emptyFormValues: FormValues = {
  employeeId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  permanentAddress: '',
  communicationAddress: '',
  dob: '',
  gender: '',
  phone: '',
  personalEmail: '',
  companyEmail: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  uan: '',
  pfEsi: 'on',
  joinedAt: '',
  employmentType: 'Full-time',
  role: '',
  aadhaar: '',
  pan: '',
  passport: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactEmail: '',
  emergencyContactRelation: '',
  emergencyContactAddress: '',
}

function normalizePfEsi(value: unknown): 'on' | 'off' {
  return value === 'off' ? 'off' : 'on'
}

function normalizeEmploymentType(value: unknown): FormValues['employmentType'] {
  if (value === 'Full-time' || value === 'Contract' || value === 'Intern') return value
  return 'Full-time'
}

function employeeToFormValues(e: Awaited<ReturnType<typeof employeeService.getEmployee>>): FormValues {
  return {
    employeeId: e.employeeId ?? '',
    firstName: e.firstName ?? '',
    middleName: e.middleName ?? '',
    lastName: e.lastName ?? '',
    permanentAddress: e.permanentAddress ?? e.address ?? '',
    communicationAddress: e.communicationAddress ?? e.address ?? '',
    dob: e.dob ?? '',
    gender: e.gender ?? 'Male',
    phone: e.phone ?? '',
    personalEmail: e.personalEmail ?? '',
    companyEmail: e.email ?? '',
    bankName: e.bankName ?? '',
    accountNumber: e.accountNumber ?? '',
    ifsc: e.ifsc ?? '',
    uan: e.uan ?? '',
    pfEsi: normalizePfEsi(e.pfEsi),
    joinedAt: e.joinedAt ?? '',
    employmentType: normalizeEmploymentType(e.employmentType),
    role: e.role ?? 'Employee',
    ctc: e.ctc,
    aadhaar: e.aadhaar ?? '',
    pan: e.pan ?? '',
    passport: e.passport ?? '',
    emergencyContactName: e.emergencyContact?.name ?? '',
    emergencyContactPhone: e.emergencyContact?.phone ?? '',
    emergencyContactEmail: e.emergencyContact?.email ?? '',
    emergencyContactRelation: e.emergencyContact?.relation ?? '',
    emergencyContactAddress: e.emergencyContact?.address ?? '',
  }
}

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
  agreement: 'Agreement Document',
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

const EMPTY_DOCUMENT_FILES: Record<DocKey, File[]> = {
  aadhaar: [],
  pan: [],
  offerLetter: [],
  agreement: [],
  certificate10th: [],
  certificate12th: [],
  certificateDiploma: [],
  certificateDegree: [],
}

const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
const MAX_DOC_SIZE = 2 * 1024 * 1024
const MAX_PHOTO_SIZE = 1 * 1024 * 1024

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
  const formRef = useRef<HTMLFormElement>(null)
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee)
  const user = useAuthStore((s) => s.user)

  const [pageLoading, setPageLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [employeeName, setEmployeeName] = useState('')
  const [existingDocuments, setExistingDocuments] =
    useState<Record<DocKey, ExistingDocument | null>>({ ...EMPTY_DOCUMENTS })

  const [documentFiles, setDocumentFiles] = useState<Record<DocKey, File[]>>({
    ...EMPTY_DOCUMENT_FILES,
  })
  const [documentErrors, setDocumentErrors] =
    useState<Record<DocKey, string | null>>({ ...EMPTY_DOCUMENTS })
  const [documentPreviews, setDocumentPreviews] =
    useState<Record<DocKey, Record<string, string>>>({
      aadhaar: {},
      pan: {},
      offerLetter: {},
      agreement: {},
      certificate10th: {},
      certificate12th: {},
      certificateDiploma: {},
      certificateDegree: {},
    })
  const documentPreviewsRef = useRef<Record<DocKey, Record<string, string>>>({
    aadhaar: {},
    pan: {},
    offerLetter: {},
    agreement: {},
    certificate10th: {},
    certificate12th: {},
    certificateDiploma: {},
    certificateDegree: {},
  })
  const [selectedCertificateKey, setSelectedCertificateKey] =
    useState<CertificateDocKey>('certificateDegree')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [showFileHelp, setShowFileHelp] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [copyAddressChecked, setCopyAddressChecked] = useState(false)
  const [openingExistingDocKey, setOpeningExistingDocKey] = useState<DocKey | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: emptyFormValues,
    mode: 'onTouched',
  })
  const { reset, formState } = form

  const hasPendingFiles =
    Object.values(documentFiles).some((files) => files.length > 0) || !!photoFile
  const isDirty = formState.isDirty || hasPendingFiles
  const { guardedNavigate, allowNavigation } = useUnsavedChangesGuard(isDirty)

  // Load existing employee data
  useEffect(() => {
    if (!id) {
      setLoadError('Employee not found.')
      setPageLoading(false)
      return
    }

    let cancelled = false
    setPageLoading(true)
    setLoadError(null)

    void (async () => {
      try {
        const e = await employeeService.getEmployee(id)
        if (cancelled) return

        setEmployeeName(`${e.firstName} ${e.lastName ?? ''}`.trim())
        const formValues = employeeToFormValues(e)
        reset(formValues)
        setCopyAddressChecked(
          formValues.permanentAddress.trim() !== '' &&
            formValues.permanentAddress.trim() === formValues.communicationAddress.trim(),
        )

        if (!cancelled) {
          setExistingDocuments(buildExistingDocuments(e, documentListFromEmployee(e as Record<string, unknown>)))
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err instanceof Error ? err.message : 'Could not load employee details.')
          setLoadError(msg)
        }
      } finally {
        if (!cancelled) setPageLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, reset])

  // Live-sync communication address when copy checkbox is checked
  const permanentAddressValue = form.watch('permanentAddress')
  useEffect(() => {
    if (copyAddressChecked) {
      form.setValue('communicationAddress', permanentAddressValue || '', { shouldValidate: true })
    }
  }, [permanentAddressValue, copyAddressChecked, form])

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
      Object.values(documentPreviewsRef.current).forEach((categoryPreviews) => {
        Object.values(categoryPreviews).forEach((url) => {
          if (url) URL.revokeObjectURL(url)
        })
      })
    }
  }, [])

  const handleDocumentUpload = (key: DocKey, files: FileList | null) => {
    const fileList = files ? Array.from(files) : []
    
    if (fileList.length === 0) {
      return
    }

    const newFiles: File[] = []
    let hasError = false
    
    fileList.forEach((file) => {
      const error = validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE)
      if (error) {
        setDocumentErrors((p) => ({ ...p, [key]: error }))
        hasError = true
      } else {
        newFiles.push(file)
      }
    })

    if (hasError && newFiles.length === 0) return

    // Add new files to existing list
    setDocumentFiles((p) => ({ ...p, [key]: [...p[key], ...newFiles] }))
    
    // Create preview URLs for new files
    setDocumentPreviews((p) => {
      const newPreviews = { ...p[key] }
      newFiles.forEach((file) => {
        newPreviews[file.name] = URL.createObjectURL(file)
      })
      return { ...p, [key]: newPreviews }
    })

    if (newFiles.length > 0) {
      setDocumentErrors((p) => ({ ...p, [key]: null }))
    }
  }

  const removeUploadedDocument = (key: DocKey, fileName: string) => {
    setDocumentFiles((p) => ({
      ...p,
      [key]: p[key].filter((f) => f.name !== fileName),
    }))
    setDocumentPreviews((p) => {
      const newPreviews = { ...p[key] }
      if (newPreviews[fileName]) {
        URL.revokeObjectURL(newPreviews[fileName])
        delete newPreviews[fileName]
      }
      return { ...p, [key]: newPreviews }
    })
  }

  const deleteExistingDocument = async (key: DocKey) => {
    const doc = existingDocuments[key]
    if (!doc) return

      try {
        await deleteDocument(id, doc.key)
        setExistingDocuments((prev) => ({ ...prev, [key]: null }))
      } catch (err: any) {
        console.error('Could not delete document:', err)
      }
  }

  const handleOpenExistingDocument = async (key: DocKey) => {
    const doc = existingDocuments[key]
    if (!doc) return
    setOpeningExistingDocKey(key)
    try {
      await openEmployeeDocument(id, doc.key, doc.name)
    } catch (err) {
      console.error('Could not open document:', err)
    } finally {
      setOpeningExistingDocKey(null)
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
      await updateEmployee(
        id,
        {
        employeeId: values.employeeId?.trim().toUpperCase() ?? '',
        firstName: values.firstName,
        middleName: values.middleName ? values.middleName.trim() : undefined,
        lastName: values.lastName ?? '',
        permanentAddress: values.permanentAddress ?? '',
        communicationAddress: values.communicationAddress ?? '',
        dob: values.dob ?? '',
        gender: values.gender ?? '',
        phone: values.phone ?? '',
        personalEmail: values.personalEmail ?? '',
        email: values.companyEmail ?? '',
        bankName: values.bankName?.trim() || undefined,
        accountNumber: values.accountNumber?.trim() || undefined,
        ifsc: values.ifsc?.trim() || undefined,
        uan: values.uan?.trim() || undefined,
        pfEsi: values.pfEsi,
        employmentType: values.employmentType,
        role: values.role,
        joinedAt: values.joinedAt ?? '',
        ctc: values.ctc,
        aadhaar: values.aadhaar?.trim() || undefined,
        pan: values.pan?.trim() || undefined,
        passport: values.passport?.trim() || undefined,
        emergencyContact: {
          name: values.emergencyContactName || '',
          phone: values.emergencyContactPhone || '',
          email: values.emergencyContactEmail || '',
          relation: values.emergencyContactRelation || '',
          address: values.emergencyContactAddress || '',
        },
      },
        user?.email || user?.name,
      )
      console.info(
        '[Manage Employees] Saved employee changes:',
        values.employeeId?.trim().toUpperCase(),
        `${values.firstName} ${values.lastName ?? ''}`.trim(),
      )

      // Upload documents if any
      const hasDocuments = Object.values(documentFiles).some((files) => files.length > 0)
      let uploadIssues = false
      if (hasDocuments) {
        try {
          // Convert File[] to File | null for each document type (take first file)
          const docsToUpload: Record<DocKey, File | null> = {
            aadhaar: documentFiles.aadhaar[0] ?? null,
            pan: documentFiles.pan[0] ?? null,
            offerLetter: documentFiles.offerLetter[0] ?? null,
            agreement: documentFiles.agreement[0] ?? null,
            certificate10th: documentFiles.certificate10th[0] ?? null,
            certificate12th: documentFiles.certificate12th[0] ?? null,
            certificateDiploma: documentFiles.certificateDiploma[0] ?? null,
            certificateDegree: documentFiles.certificateDegree[0] ?? null,
          }
          await uploadDocuments(id, docsToUpload)
        } catch (err) {
          console.error('Failed to upload documents:', err)
          uploadIssues = true
        }
      }

      // Upload photo if provided
      if (photoFile) {
        try {
          await uploadPhoto(id, photoFile)
        } catch (err) {
          console.error('Failed to upload photo:', err)
          uploadIssues = true
        }
      }

      if (uploadIssues) {
        toast.warning('Changes saved, but some files failed to upload. Please try again.')
      } else {
}

      allowNavigation()
      navigate('/admin/employees')
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ?? (err instanceof Error ? err.message : 'Update failed')
      setSubmitError(msg)
    }
  })

  if (pageLoading) {
    return (
      <PageWrapper>
        <p className="text-sm text-muted">Loading employee details…</p>
      </PageWrapper>
    )
  }

  if (loadError) {
    return (
      <PageWrapper>
        <PageHeader title="Edit Employee" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => guardedNavigate('/admin/employees')}>
              Back to Employees
            </Button>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </PageWrapper>
    )
  }

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

      <form ref={formRef} id="edit-employee-form" className="mx-auto max-w-6xl space-y-8 pb-32" onSubmit={onSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Section 1: Personal Details ─────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="mb-6 font-display text-lg font-semibold text-ink">Personal Details</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Employee ID"
                required
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
                label="Middle name"
                error={form.formState.errors.middleName?.message}
                {...form.register('middleName')}
              />
              <Input
                label="Last name"
                required
                error={form.formState.errors.lastName?.message}
                {...form.register('lastName')}
              />
              <Input
                label="Date of birth"
                type="date"
                required
                error={form.formState.errors.dob?.message}
                {...form.register('dob')}
              />
              <SelectField
                label="Gender"
                required
                error={form.formState.errors.gender?.message}
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Not prefer to say', label: 'Not prefer to say' },
                ]}
                {...form.register('gender')}
              />
              <Input
                label="Phone"
                required
                error={form.formState.errors.phone?.message}
                {...form.register('phone')}
              />
              <Input
                label="Personal email"
                type="email"
                required
                error={form.formState.errors.personalEmail?.message}
                {...form.register('personalEmail')}
              />
              <Input
                label="Company email"
                type="email"
                error={form.formState.errors.companyEmail?.message}
                {...form.register('companyEmail')}
              />
            </div>

            {/* Address Section */}
            <div className="mt-8 border-t border-border pt-6">
              <h3 className="font-display text-lg font-semibold text-ink mb-4">Address Details</h3>
              <div className="space-y-4">
                <Input
                  label="Permanent Address"
                  required
                  error={form.formState.errors.permanentAddress?.message}
                  {...form.register('permanentAddress')}
                />
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label="Communication Address"
                      required
                      error={form.formState.errors.communicationAddress?.message}
                      {...form.register('communicationAddress')}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      id="copyAddressEdit"
                      checked={copyAddressChecked}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setCopyAddressChecked(checked)
                        if (checked) {
                          form.setValue(
                            'communicationAddress',
                            form.getValues('permanentAddress') || '',
                            { shouldValidate: true },
                          )
                        }
                      }}
                      className="h-4 w-4 rounded border-border cursor-pointer"
                    />
                    <label htmlFor="copyAddressEdit" className="text-sm text-muted cursor-pointer whitespace-nowrap">
                      Copy permanent
                    </label>
                  </div>
                </div>
              </div>
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
                readOnly
                tabIndex={-1}
                className="cursor-not-allowed bg-surface/60 text-muted"
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
                ]}
                {...form.register('employmentType')}
              />
              <Input
                label="Role"
                required
                error={form.formState.errors.role?.message}
                {...form.register('role')}
              />
              <Input
                label="CTC (annual)"
                type="number"
                error={form.formState.errors.ctc?.message}
                {...form.register('ctc', {
                  setValueAs: (v) => (v === '' ? undefined : Number(v)),
                })}
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
                required
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

          {/* ── Section 5: Emergency Contact ────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="mb-6 font-display text-lg font-semibold text-ink">Emergency Contact Details</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Name"
                required
                error={form.formState.errors.emergencyContactName?.message}
                {...form.register('emergencyContactName')}
              />
              <Input
                label="Phone"
                required
                error={form.formState.errors.emergencyContactPhone?.message}
                {...form.register('emergencyContactPhone')}
              />
              <Input
                label="Email"
                type="email"
                required
                error={form.formState.errors.emergencyContactEmail?.message}
                {...form.register('emergencyContactEmail')}
              />
              <Input
                label="Relation"
                required
                error={form.formState.errors.emergencyContactRelation?.message}
                {...form.register('emergencyContactRelation')}
              />
              <Input
                label="Address"
                className="lg:col-span-2"
                required
                error={form.formState.errors.emergencyContactAddress?.message}
                {...form.register('emergencyContactAddress')}
              />
            </div>
          </div>
        </div>

        {/* ── Section 5: Documents ────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">Employee Documents</h3>
            <button
              type="button"
              onClick={() => setShowFileHelp(true)}
              className="rounded p-1.5 text-muted hover:bg-surface hover:text-ink transition-ui"
              title="Help - File size limits and configuration"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(Object.entries(DOCUMENT_TYPES) as [StandardDocKey, string][])
              .filter(([key]) => key !== 'agreement')
              .map(([key, label]) => (
              <div key={key} className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-3 font-medium text-ink">{label}</p>
                <p className="text-xs text-muted mb-3">2MB</p>
                
                <FileUpload
                  accept=".pdf,.jpg,.jpeg,.png"
                  onUpload={(files) => handleDocumentUpload(key, files)}
                />

                {documentErrors[key] ? (
                  <p className="mt-2 text-xs text-danger">{documentErrors[key]}</p>
                ) : null}
                
                {/* Display existing documents */}
                {existingDocuments[key] ? (
                  <div className="mt-3 rounded-lg border border-border bg-white px-3 py-2">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {existingDocuments[key]?.name}
                        </p>
                        <p className="text-xs text-muted">Uploaded</p>
                      </div>
                      {existingDocuments[key]?.url ? (
                        <button
                          type="button"
                          disabled={openingExistingDocKey === key}
                          onClick={() => void handleOpenExistingDocument(key)}
                          className="shrink-0 rounded p-1 text-primary hover:bg-primary/10 transition-ui disabled:opacity-50"
                          title="View document"
                        >
                          {openingExistingDocKey === key ? (
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-danger hover:bg-danger/10 transition-ui"
                        title="Delete document"
                        onClick={() => void deleteExistingDocument(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Display newly uploaded documents */}
                {documentFiles[key].length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {documentFiles[key].map((file) => (
                      <div key={file.name} className="rounded-lg border border-border bg-white px-3 py-2">
                        <div className="flex items-start gap-3">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                            <p className="text-xs text-muted">New</p>
                          </div>
                          {documentPreviews[key]?.[file.name] ? (
                            <a
                              href={documentPreviews[key][file.name]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded p-1 text-primary hover:bg-primary/10 transition-ui"
                              title="Preview document"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-danger hover:bg-danger/10 transition-ui"
                            title="Remove document"
                            onClick={() => removeUploadedDocument(key, file.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            <div className="rounded-xl border border-border bg-surface p-4 h-full flex flex-col">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="font-medium text-ink">Certificates</p>
                <p className="text-xs text-muted">2MB</p>
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
              
              <div className="mt-3">
                <FileUpload
                  accept=".pdf,.jpg,.jpeg,.png"
                  onUpload={(files) => handleDocumentUpload(selectedCertificateKey, files)}
                />
                {documentErrors[selectedCertificateKey] ? (
                  <p className="mt-2 text-xs text-danger">{documentErrors[selectedCertificateKey]}</p>
                ) : null}
              </div>
              
              {(existingDocuments[selectedCertificateKey] || documentFiles[selectedCertificateKey].length > 0) ? (
                <div className="mt-3 pt-3 border-t border-border flex-1 overflow-hidden flex flex-col">
                  <p className="text-xs font-medium text-muted mb-2 uppercase">Uploaded</p>
                  <div className="space-y-2 overflow-y-auto flex-1">
                    {/* Display existing certificate for selected category */}
                    {existingDocuments[selectedCertificateKey] ? (
                      <div className="rounded-lg border border-border bg-white px-3 py-2">
                        <div className="flex items-start gap-3">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">
                              {existingDocuments[selectedCertificateKey]?.name}
                            </p>
                            <p className="text-xs text-muted">Uploaded</p>
                          </div>
                          {existingDocuments[selectedCertificateKey]?.url ? (
                            <button
                              type="button"
                              disabled={openingExistingDocKey === selectedCertificateKey}
                              onClick={() => void handleOpenExistingDocument(selectedCertificateKey)}
                              className="shrink-0 rounded p-1 text-primary hover:bg-primary/10 transition-ui disabled:opacity-50"
                              title="View certificate"
                            >
                              {openingExistingDocKey === selectedCertificateKey ? (
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              ) : (
                                <ExternalLink className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-danger hover:bg-danger/10 transition-ui"
                            title="Delete certificate"
                            onClick={() => void deleteExistingDocument(selectedCertificateKey)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                    
                    {/* Display newly uploaded certificates for selected category */}
                    {documentFiles[selectedCertificateKey].map((file) => (
                      <div key={file.name} className="rounded-lg border border-border bg-white px-3 py-2">
                        <div className="flex items-start gap-3">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                            <p className="text-xs text-muted">New</p>
                          </div>
                          {documentPreviews[selectedCertificateKey]?.[file.name] ? (
                            <a
                              href={documentPreviews[selectedCertificateKey][file.name]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded p-1 text-primary hover:bg-primary/10 transition-ui"
                              title="Preview certificate"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-danger hover:bg-danger/10 transition-ui"
                            title="Remove certificate"
                            onClick={() => removeUploadedDocument(selectedCertificateKey, file.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Agreement Document */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-3 font-medium text-ink">{DOCUMENT_TYPES.agreement}</p>
              <p className="text-xs text-muted mb-3">2MB</p>
              
              <FileUpload
                accept=".pdf,.jpg,.jpeg,.png"
                onUpload={(files) => handleDocumentUpload('agreement', files)}
              />

              {documentErrors.agreement ? (
                <p className="mt-2 text-xs text-danger">{documentErrors.agreement}</p>
              ) : null}
              
              {/* Display existing document */}
              {existingDocuments.agreement ? (
                <div className="mt-3 rounded-lg border border-border bg-white px-3 py-2">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {existingDocuments.agreement?.name}
                      </p>
                      <p className="text-xs text-muted">Uploaded</p>
                    </div>
                    {existingDocuments.agreement?.url ? (
                      <button
                        type="button"
                        disabled={openingExistingDocKey === 'agreement'}
                        onClick={() => void handleOpenExistingDocument('agreement')}
                        className="shrink-0 rounded p-1 text-primary hover:bg-primary/10 transition-ui disabled:opacity-50"
                        title="View document"
                      >
                        {openingExistingDocKey === 'agreement' ? (
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-danger hover:bg-danger/10 transition-ui"
                      title="Delete document"
                      onClick={() => void deleteExistingDocument('agreement')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Display newly uploaded documents */}
              {documentFiles.agreement.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {documentFiles.agreement.map((file) => (
                    <div key={file.name} className="rounded-lg border border-border bg-white px-3 py-2">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                          <p className="text-xs text-muted">New</p>
                        </div>
                        {documentPreviews.agreement?.[file.name] ? (
                          <a
                            href={documentPreviews.agreement[file.name]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 rounded p-1 text-primary hover:bg-primary/10 transition-ui"
                            title="Preview document"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="shrink-0 rounded p-1 text-danger hover:bg-danger/10 transition-ui"
                          title="Remove document"
                          onClick={() => removeUploadedDocument('agreement', file.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-5 flex items-start justify-between gap-3">
                <p className="font-medium text-ink">Profile Photo</p>
                <p className="text-xs text-muted">1MB</p>
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
      </form>

      {/* ── Fixed Bottom Action Bar ────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white p-4 shadow-lg">
        <div className="mx-auto max-w-6xl flex items-center justify-end gap-2">
          {submitError && (
            <p className="flex-1 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 mr-2">
              {submitError}
            </p>
          )}
          <Button type="button" variant="ghost" onClick={() => guardedNavigate('/admin/employees')}>
            Cancel
          </Button>
          <Button type="submit" form="edit-employee-form" loading={form.formState.isSubmitting} onClick={() => setSubmitError(null)}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* ── File Size Help Modal ────────────────────────────────────────────────── */}
      {showFileHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-lg">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-md p-1 hover:bg-surface"
              onClick={() => setShowFileHelp(false)}
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="mb-4 font-display text-2xl font-semibold text-ink">File Size Limits</h2>

            <div className="space-y-6">
              <div>
                <h3 className="mb-2 font-semibold text-ink">Current Limits</h3>
                <div className="bg-surface p-4 rounded-lg space-y-2 text-sm">
                  <p><span className="font-medium text-ink">Documents (PDF, JPG, PNG):</span> <span className="text-primary font-semibold">2 MB</span></p>
                  <p><span className="font-medium text-ink">Profile Photo (JPG, PNG):</span> <span className="text-primary font-semibold">1 MB</span></p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-ink">To Change File Size Limits</h3>
                <p className="text-sm text-muted mb-3">Edit the following file in your backend:</p>
                <div className="bg-surface p-3 rounded-lg mb-3 font-mono text-xs border border-border">
                  <p className="text-ink">backend/src/pages/admin/Employees/AddEmployee.tsx</p>
                </div>
                <p className="text-sm text-muted mb-3">Find the constants:</p>
                <div className="bg-surface p-4 rounded-lg font-mono text-xs space-y-2 border border-border overflow-x-auto">
                  <p><span className="text-primary">const</span> <span className="text-ink">MAX_DOC_SIZE</span> = <span className="text-primary">2</span> * <span className="text-primary">1024</span> * <span className="text-primary">1024</span> <span className="text-muted">// 2 MB</span></p>
                  <p><span className="text-primary">const</span> <span className="text-ink">MAX_PHOTO_SIZE</span> = <span className="text-primary">1</span> * <span className="text-primary">1024</span> * <span className="text-primary">1024</span> <span className="text-muted">// 1 MB</span></p>
                </div>
                <p className="text-sm text-muted mt-3">Update the numbers to your desired size in bytes. Example: For 5MB documents, use: <span className="font-mono font-semibold">5 * 1024 * 1024</span></p>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Note:</span> After editing the backend constants, restart your backend server for changes to take effect.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                type="button"
                onClick={() => setShowFileHelp(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
