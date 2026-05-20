import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { FileUpload } from '@components/forms/FileUpload'
import { useEmployeeStore } from '@store/employeeStore'
import type { Employee } from '@/types'
import { uploadDocuments, uploadPhoto } from '@services/uploadService'

const employeeIdPattern = /^(EPL|INT)\d{8}$/
const isValidDate = (value: string) => !Number.isNaN(Date.parse(value))

const step1 = z.object({
  employeeId: z
    .string()
    .min(1, 'Employee ID is required')
    .refine(
      (value) => employeeIdPattern.test(value.trim().toUpperCase()),
      'Use EPL or INT plus 8 digits',
    ),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  dob: z
    .string()
    .min(1, 'Date of birth is required')
    .refine(isValidDate, 'Enter a valid date of birth'),
  gender: z.string().min(1, 'Gender is required'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  personalEmail: z.string().email('Enter a valid personal email'),
  companyEmail: z.string().min(1, 'Company email is required').email('Enter a valid company email'),
})

const step2 = z.object({
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  uan: z.string().optional(),
  pfEsi: z.enum(['on', 'off']),
})

const step3 = z.object({
  joinedAt: z
    .string()
    .min(1, 'Joining date is required')
    .refine(isValidDate, 'Enter a valid joining date'),
  employmentType: z.enum(['Full-time', 'Contract', 'Intern', 'Notice Period']),

  department: z.string().min(2, 'Department is required'),
  reportingManager: z.string().min(1, 'Reporting manager is required'),
  role: z.enum(['Employee', 'Admin'], { required_error: 'Role is required' }),
  ctc: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().positive('CTC must be a positive number').optional(),
  ),
})

const step4 = z.object({
  aadhaar: z.string().length(12, 'Aadhaar must be 12 digits'),
  pan: z.string().length(10, 'PAN must be 10 characters'),
  passport: z.string().optional(),
})

const fullSchema = step1.merge(step2).merge(step3).merge(step4)
type FullValues = z.infer<typeof fullSchema>

const defaultValues: Partial<FullValues> = {
  employeeId: '',
  address: '',
  gender: '',
  employmentType: 'Full-time',
  pfEsi: 'on',
  passport: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  uan: '',
}

type DocKey = 'aadhaar' | 'pan' | 'offerLetter' | 'agreement'

const DOCUMENT_TYPES = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  offerLetter: 'Offer Letter',
  agreement: 'Agreement',
} as const

const CERTIFICATE_CATEGORIES = [
  'Degree',
  'Diploma',
  '10th',
  '12th',
  'Other Options',
] as const

type CertificateCategory = (typeof CERTIFICATE_CATEGORIES)[number]

const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
const MAX_DOC_SIZE = 5 * 1024 * 1024
const MAX_PHOTO_SIZE = 2 * 1024 * 1024

function validateFile(file: File, allowedTypes: string[], maxSize: number) {
  if (!allowedTypes.includes(file.type)) {
    return 'Invalid file type. Allowed: .pdf, .jpg, .jpeg, .png'
  }
  if (file.size > maxSize) {
    return `File is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`
  }
  return null
}

export function AddEmployee() {
  const navigate = useNavigate()
  const addEmployee = useEmployeeStore((s) => s.addEmployee)
  const form = useForm<FullValues>({
    resolver: zodResolver(fullSchema),
    defaultValues: defaultValues as FullValues,
    mode: 'onTouched',
  })

  const [documentFiles, setDocumentFiles] = useState<Record<DocKey, File | null>>({
    aadhaar: null,
    pan: null,
    offerLetter: null,
    agreement: null,
  })
  const [documentErrors, setDocumentErrors] = useState<Record<DocKey, string | null>>({
    aadhaar: null,
    pan: null,
    offerLetter: null,
    agreement: null,
  })
  const [certificateFiles, setCertificateFiles] = useState<Record<CertificateCategory, File[]>>({
    'Degree': [],
    'Diploma': [],
    '10th': [],
    '12th': [],
    'Other Options': [],
  })
  const [certificateErrors, setCertificateErrors] = useState<
    Record<CertificateCategory, string | null>
  >({
    'Degree': null,
    'Diploma': null,
    '10th': null,
    '12th': null,
    'Other Options': null,
  })
  const [selectedCertificateCategory, setSelectedCertificateCategory] =
    useState<CertificateCategory>('Degree')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  const handleDocumentUpload = (key: DocKey, files: FileList | null) => {
    const file = files?.[0] ?? null
    if (!file) {
      setDocumentFiles((prev) => ({ ...prev, [key]: null }))
      setDocumentErrors((prev) => ({ ...prev, [key]: null }))
      return
    }

    const error = validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE)
    setDocumentErrors((prev) => ({ ...prev, [key]: error }))
    if (error) {
      setDocumentFiles((prev) => ({ ...prev, [key]: null }))
      return
    }

    setDocumentFiles((prev) => ({ ...prev, [key]: file }))
  }

  const handleCertificateUpload = (category: CertificateCategory, files: FileList | null) => {
    const fileList = files ? Array.from(files) : []

    if (category !== 'Other Options') {
      const file = fileList[0] ?? null
      if (!file) {
        return
      }

      const error = validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE)
      setCertificateErrors((prev) => ({ ...prev, [category]: error }))
      if (error) {
        return
      }

      setCertificateFiles((prev) => ({ ...prev, [category]: [...prev[category], file] }))
      return
    }

    const errors = fileList
      .map((file) => validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE))
      .filter(Boolean)
    const error = errors.length > 0 ? (errors[0] as string) : null

    setCertificateErrors((prev) => ({ ...prev, [category]: error }))
    if (error) return

    setCertificateFiles((prev) => ({ ...prev, [category]: [...prev[category], ...fileList] }))
  }

  const removeCertificateFile = (category: CertificateCategory, fileName: string) => {
    setCertificateFiles((prev) => ({
      ...prev,
      [category]: prev[category].filter((file) => file.name !== fileName),
    }))
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
    const payload: Omit<Employee, 'id'> = {
      employeeId: values.employeeId.trim(),
      firstName: values.firstName,
      lastName: values.lastName ?? '',
      address: values.address ?? '',
      department: values.department,
      designation: values.role,
      role: values.role,
      employmentType: values.employmentType,
      joinedAt: values.joinedAt,
      status: 'Active',
      email: values.companyEmail || '',
      personalEmail: values.personalEmail,
      phone: values.phone,
      ctc: values.ctc,
    }

    try {
      const createdEmployee = await addEmployee(payload)

      const certificateDocuments = {
        certificateDegree: certificateFiles.Degree[0] ?? null,
        certificateDiploma: certificateFiles.Diploma[0] ?? null,
        certificate10th: certificateFiles['10th'][0] ?? null,
        certificate12th: certificateFiles['12th'][0] ?? null,
      }
      
      // Upload documents if any
      const uploadableDocuments = { ...documentFiles, ...certificateDocuments }
      const hasDocuments = Object.values(uploadableDocuments).some((f) => f !== null)
      if (hasDocuments) {
        try {
          await uploadDocuments(createdEmployee.id, uploadableDocuments)
        } catch (err) {
          console.error('Failed to upload documents:', err)
          toast.warning('Employee created but some documents failed to upload')
        }
      }

      // Upload photo if provided
      if (photoFile) {
        try {
          await uploadPhoto(createdEmployee.id, photoFile)
        } catch (err) {
          console.error('Failed to upload photo:', err)
          toast.warning('Employee created but photo failed to upload')
        }
      }

      toast.success('Employee created successfully')
      navigate('/admin/employees')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create employee'
      toast.error(msg)
    }
  })

  return (
    <PageWrapper>
      <PageHeader
        title="Add Employee"
        breadcrumb={
          <Breadcrumb items={[{ label: 'Employees', to: '/admin/employees' }, { label: 'Add' }]} />
        }
      />

      <form className="mx-auto max-w-6xl space-y-8 pb-12" onSubmit={onSubmit}>
        {/* 2-column grid for sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Section 1: Personal Details */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-6">
              <h3 className="font-display text-lg font-semibold text-ink">Personal Details</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Employee ID"
                required
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
          </div>

          {/* Section 2: Account Details */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="font-display text-lg font-semibold text-ink">Account Details</h3>
            </div>
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
                label="IFSC Code"
                error={form.formState.errors.ifsc?.message}
                {...form.register('ifsc')}
              />
              <Input
                label="UAN Number"
                error={form.formState.errors.uan?.message}
                {...form.register('uan')}
              />
              <SelectField
                label="PF/ESI Status"
                required
                error={form.formState.errors.pfEsi?.message}
                options={[
                  { value: 'on', label: 'Enabled' },
                  { value: 'off', label: 'Disabled' },
                ]}
                {...form.register('pfEsi')}
              />
            </div>
          </div>

          {/* Section 3: Joining Details */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="font-display text-lg font-semibold text-ink">Joining Details</h3>
            </div>
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
                required
                error={form.formState.errors.reportingManager?.message}
                {...form.register('reportingManager')}
              />
              <SelectField
                label="Role"
                required
                error={form.formState.errors.role?.message}
                options={[
                  { value: 'Employee', label: 'Employee' },
                  { value: 'Admin', label: 'Admin' },
                ]}
                {...form.register('role')}
              />
              <Input
                label="CTC (annual)"
                type="number"
                error={form.formState.errors.ctc?.message}
                {...form.register('ctc', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
            </div>
          </div>

          {/* Section 4: ID Proof */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-6">
              <h3 className="font-display text-lg font-semibold text-ink">ID Proof</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Aadhaar number"
                required
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
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-display text-lg font-semibold text-ink">Employee Documents</h3>
          </div>
          
          {/* Row 1: Aadhaar, PAN, Offer Letter */}
          <div className="grid gap-4 md:grid-cols-3 items-start">
            {['aadhaar', 'pan', 'offerLetter'].map((key) => {
              const docKey = key as DocKey
              const label = DOCUMENT_TYPES[docKey]
              return (
                <div key={key} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-medium text-ink">{label}</p>
                    <p className="text-xs text-muted">5MB</p>
                  </div>
                  <FileUpload
                    accept=".pdf,.jpg,.jpeg,.png"
                    onUpload={(files) => handleDocumentUpload(docKey, files)}
                  />
                  
                  {documentFiles[docKey] ? (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-medium text-muted mb-2 uppercase">Uploaded</p>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2">
                        <span className="truncate text-xs text-ink">{documentFiles[docKey]?.name}</span>
                        <button
                          type="button"
                          className="text-xs font-medium text-danger hover:underline shrink-0"
                          onClick={() => handleDocumentUpload(docKey, null)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {documentErrors[docKey] ? (
                    <p className="text-xs text-danger mt-2">{documentErrors[docKey]}</p>
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* Row 2: Agreement, Certificates, Profile Photo */}
          <div className="mt-6 grid gap-4 md:grid-cols-3 items-start">
            {/* Agreement */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="font-medium text-ink">{DOCUMENT_TYPES.agreement}</p>
                <p className="text-xs text-muted">5MB</p>
              </div>
              <FileUpload
                accept=".pdf,.jpg,.jpeg,.png"
                onUpload={(files) => handleDocumentUpload('agreement', files)}
              />
              
              {documentFiles.agreement ? (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted mb-2 uppercase">Uploaded</p>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2">
                    <span className="truncate text-xs text-ink">{documentFiles.agreement?.name}</span>
                    <button
                      type="button"
                      className="text-xs font-medium text-danger hover:underline shrink-0"
                      onClick={() => handleDocumentUpload('agreement', null)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : null}
              {documentErrors.agreement ? (
                <p className="text-xs text-danger mt-2">{documentErrors.agreement}</p>
              ) : null}
            </div>

            {/* Certificates */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="font-medium text-ink">Certificates</p>
                <p className="text-xs text-muted">5MB</p>
              </div>
              <SelectField
                value={selectedCertificateCategory}
                onChange={(event) =>
                  setSelectedCertificateCategory(event.target.value as CertificateCategory)
                }
                options={CERTIFICATE_CATEGORIES.map((category) => ({
                  value: category,
                  label: category,
                }))}
              />
              <div className="mt-3">
                <FileUpload
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple={selectedCertificateCategory === 'Other Options'}
                  onUpload={(files) => handleCertificateUpload(selectedCertificateCategory, files)}
                />
                {certificateErrors[selectedCertificateCategory] ? (
                  <p className="text-xs text-danger mt-2">
                    {certificateErrors[selectedCertificateCategory]}
                  </p>
                ) : null}
              </div>
              
              {Object.entries(certificateFiles).some(([_, files]) => files.length > 0) ? (
                <div className="mt-4 pt-4 border-t border-border max-h-64 overflow-y-auto">
                  <p className="text-xs font-medium text-muted mb-3 uppercase">Uploaded Certificates</p>
                  <div className="space-y-2">
                    {Object.entries(certificateFiles).map(([category, files]) =>
                      files.map((file) => (
                        <div
                          key={`${category}-${file.name}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="truncate text-xs text-ink">{file.name}</span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                              {category}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-medium text-danger hover:underline shrink-0"
                            onClick={() =>
                              removeCertificateFile(category as CertificateCategory, file.name)
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Profile Photo */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="font-medium text-ink">Profile Photo</p>
                <p className="text-xs text-muted">5MB</p>
              </div>
              <FileUpload accept=".jpg,.jpeg,.png" onUpload={handlePhotoUpload} />
              {photoFile ? (
                <div className="mt-4 pt-4 border-t border-border text-center">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile preview"
                      className="mx-auto h-20 w-20 rounded-full object-cover border border-border"
                    />
                  ) : null}
                  <p className="mt-2 text-xs text-ink truncate">Selected: {photoFile.name}</p>
                  <button
                    type="button"
                    className="text-xs font-medium text-danger hover:underline mt-2"
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview(null)
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              {photoError ? <p className="text-xs text-danger mt-2">{photoError}</p> : null}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <Button type="button" variant="ghost" onClick={() => navigate('/admin/employees')}>
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Create Employee
          </Button>
        </div>
      </form>
    </PageWrapper>
  )
}
