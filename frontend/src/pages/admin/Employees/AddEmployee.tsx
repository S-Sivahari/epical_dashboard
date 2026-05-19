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

const employeeIdPattern = /^(EPL|INT)\d{8}$/

const step1 = z.object({
  employeeId: z
    .string()
    .optional()
    .refine(
      (value) => !value || employeeIdPattern.test(value.trim().toUpperCase()),
      'Use EPL or INT plus 8 digits',
    ),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  dob: z.string().min(1, 'Required'),
  gender: z.string().min(1, 'Required'),
  phone: z.string().min(10, 'Invalid phone'),
  personalEmail: z.string().email(),
  companyEmail: z.string().email().optional().or(z.literal('')),
})

const step2 = z.object({
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  uan: z.string().optional(),
  pfEsi: z.enum(['on', 'off']),
})

const step3 = z.object({
  joinedAt: z.string().min(1, 'Required'),
  employmentType: z.enum(['Full-time', 'Contract', 'Intern']),

  department: z.string().min(2, 'Required'),
  reportingManager: z.string().min(1, 'Required'),
  role: z.string().min(2, 'Required'),
  ctc: z.coerce.number().positive(),
})

const step4 = z.object({
  aadhaar: z.string().length(12, '12 digits'),
  pan: z.string().length(10, '10 characters'),
  passport: z.string().optional(),
})

const fullSchema = step1.merge(step2).merge(step3).merge(step4)
type FullValues = z.infer<typeof fullSchema>

const defaultValues: Partial<FullValues> = {
  employeeId: '',
  gender: 'Female',
  employmentType: 'Full-time',
  pfEsi: 'on',
  passport: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  uan: '',
  ctc: 1200000,
}

type DocKey = 'aadhaarPan' | 'offerLetter' | 'certificates' | 'agreement'

const DOCUMENT_TYPES = {
  aadhaarPan: 'Aadhaar/PAN',
  offerLetter: 'Offer Letter',
  certificates: 'Certificates',
  agreement: 'Agreement',
} as const

const CERTIFICATE_CATEGORIES = [
  'Degree Certificate',
  'Diploma Certificate',
  'School (10th)',
  'School (12th)',
  'PAN Certificate',
  'Other Certificates',
] as const

const CERTIFICATE_UPLOAD_CATEGORIES = [
  'Degree Certificate',
  'Diploma Certificate',
  'School (10th)',
  'School (12th)',
  'PAN Certificate',
  'Other Certificates',
] as const

type CertificateCategory = (typeof CERTIFICATE_CATEGORIES)[number]

const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
const MAX_DOC_SIZE = 5 * 1024 * 1024
const MAX_PHOTO_SIZE = 1 * 1024 * 1024

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
    mode: 'onTouched' 
  })

  const [documentFiles, setDocumentFiles] = useState<Record<DocKey, File | null>>({
    aadhaarPan: null,
    offerLetter: null,
    certificates: null,
    agreement: null,
  })
  const [documentErrors, setDocumentErrors] = useState<Record<DocKey, string | null>>({
    aadhaarPan: null,
    offerLetter: null,
    certificates: null,
    agreement: null,
  })
  const [certificateFiles, setCertificateFiles] = useState<Record<CertificateCategory, File[]>>({
    'Degree Certificate': [],
    'Diploma Certificate': [],
    'School (10th)': [],
    'School (12th)': [],
    'PAN Certificate': [],
    'Other Certificates': [],
  })
  const [certificateErrors, setCertificateErrors] = useState<Record<CertificateCategory, string | null>>({
    'Degree Certificate': null,
    'Diploma Certificate': null,
    'School (10th)': null,
    'School (12th)': null,
    'PAN Certificate': null,
    'Other Certificates': null,
  })
  const [selectedCertificateCategory, setSelectedCertificateCategory] = useState<CertificateCategory>('Degree Certificate')
  const [panCertificateFile, setPanCertificateFile] = useState<File | null>(null)
  const [panCertificateError, setPanCertificateError] = useState<string | null>(null)
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

    if (category !== 'Other Certificates') {
      const file = fileList[0] ?? null
      if (!file) {
        setCertificateFiles((prev) => ({ ...prev, [category]: [] }))
        setCertificateErrors((prev) => ({ ...prev, [category]: null }))
        return
      }

      const error = validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE)
      setCertificateErrors((prev) => ({ ...prev, [category]: error }))
      if (error) {
        setCertificateFiles((prev) => ({ ...prev, [category]: [] }))
        return
      }

      setCertificateFiles((prev) => ({ ...prev, [category]: [file] }))
      setDocumentErrors((prev) => ({ ...prev, certificates: null }))
      return
    }

    const errors = fileList
      .map((file) => validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE))
      .filter(Boolean)
    const error = errors.length > 0 ? (errors[0] as string) : null

    setCertificateErrors((prev) => ({ ...prev, [category]: error }))
    if (error) {
      return
    }

    setCertificateFiles((prev) => ({ ...prev, [category]: [...prev[category], ...fileList] }))
    setDocumentErrors((prev) => ({ ...prev, certificates: null }))
  }

  const removeCertificateFile = (category: CertificateCategory, fileName: string) => {
    setCertificateFiles((prev) => ({
      ...prev,
      [category]: prev[category].filter((file) => file.name !== fileName),
    }))
  }

  const handlePanCertificateUpload = (files: FileList | null) => {
    const file = files?.[0] ?? null
    if (!file) {
      setPanCertificateFile(null)
      setPanCertificateError(null)
      return
    }

    const error = validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE)
    setPanCertificateError(error)
    if (error) {
      setPanCertificateFile(null)
      return
    }

    setPanCertificateFile(file)
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
      employeeId: values.employeeId?.trim() ?? '',
      firstName: values.firstName,
      lastName: values.lastName,
      department: values.department,
      designation: values.role,
      role: values.role,
      employmentType: values.employmentType,
      joinedAt: values.joinedAt,
      status: 'Active',
      email: values.companyEmail || '',
      phone: values.phone,
      ctc: values.ctc,
    }
    
    try {
      await addEmployee(payload)
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
        subtitle="Complete the form below to register a new employee in the system."
        breadcrumb={
          <Breadcrumb items={[{ label: 'Employees', to: '/admin/employees' }, { label: 'Add' }]} />
        }
      />

      <form className="mx-auto max-w-4xl space-y-8 pb-12" onSubmit={onSubmit}>
        {/* Section 1: Personal Details */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-display text-lg font-semibold text-ink">Personal Details</h3>
            <p className="text-sm text-muted">Basic identity and contact information.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Employee ID" placeholder="e.g. EPL12345678" error={form.formState.errors.employeeId?.message} {...form.register('employeeId')} />
            <Input label="First name" required error={form.formState.errors.firstName?.message} {...form.register('firstName')} />
            <Input label="Last name" required error={form.formState.errors.lastName?.message} {...form.register('lastName')} />
            <Input label="Date of birth" type="date" required error={form.formState.errors.dob?.message} {...form.register('dob')} />
            <SelectField
              label="Gender"
              required
              error={form.formState.errors.gender?.message}
              options={[
                { value: 'Female', label: 'Female' },
                { value: 'Male', label: 'Male' },
                { value: 'Non-binary', label: 'Non-binary' },
              ]}
              {...form.register('gender')}
            />
            <Input label="Phone" required error={form.formState.errors.phone?.message} {...form.register('phone')} />
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
            <p className="text-sm text-muted">Banking and financial information.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Bank name" error={form.formState.errors.bankName?.message} {...form.register('bankName')} />
            <Input label="Account number" error={form.formState.errors.accountNumber?.message} {...form.register('accountNumber')} />
            <Input label="IFSC" error={form.formState.errors.ifsc?.message} {...form.register('ifsc')} />
            
            <Input label="UAN" error={form.formState.errors.uan?.message} {...form.register('uan')} />
            <SelectField
              label="PF / ESI"
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

        {/* Section 3: Boarding Details */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-display text-lg font-semibold text-ink">Boarding Details</h3>
            <p className="text-sm text-muted">Employment terms and organizational role.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Joining date" type="date" required error={form.formState.errors.joinedAt?.message} {...form.register('joinedAt')} />
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

            <Input label="Department" required error={form.formState.errors.department?.message} {...form.register('department')} />
            <Input label="Reporting manager" required error={form.formState.errors.reportingManager?.message} {...form.register('reportingManager')} />
            <Input label="Role" required error={form.formState.errors.role?.message} {...form.register('role')} />
            <Input
              label="CTC (annual)"
              type="number"
              required
              error={form.formState.errors.ctc?.message}
              {...form.register('ctc', { valueAsNumber: true })}
            />
          </div>
        </div>

        {/* Section 4: ID Proof */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-display text-lg font-semibold text-ink">ID Proof</h3>
            <p className="text-sm text-muted">Government identification documents.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Aadhaar number" required error={form.formState.errors.aadhaar?.message} {...form.register('aadhaar')} />
            <Input label="PAN" required error={form.formState.errors.pan?.message} {...form.register('pan')} />
            <Input label="Passport number" error={form.formState.errors.passport?.message} {...form.register('passport')} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
          <div className="mb-3">
            <h3 className="font-display text-base font-semibold text-ink">Employee Documents</h3>
            <p className="text-sm text-muted">Upload required employee documents.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(['aadhaarPan', 'offerLetter', 'agreement'] as DocKey[]).map((key) => (
              <div key={key} className="rounded-lg border border-border bg-surface p-3">
                <p className="font-medium text-ink text-sm">{DOCUMENT_TYPES[key]}</p>
                <p className="text-[11px] text-muted mb-2">Allowed: .pdf, .jpg, .jpeg, .png. Max 5MB.</p>
                <FileUpload
                  accept=".pdf,.jpg,.jpeg,.png"
                  onUpload={(files) => handleDocumentUpload(key, files)}
                />
                {documentFiles[key] ? (
                  <p className="mt-2 text-sm text-ink">Selected: {documentFiles[key]?.name}</p>
                ) : null}
                {documentErrors[key] ? (
                  <p className="text-[11px] text-danger mt-1">{documentErrors[key]}</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-white p-3">
              <p className="font-medium text-ink text-sm mb-2">Certificates</p>
              <p className="text-[11px] text-muted mb-3">Select a category and upload one file per category. Other Certificates can be uploaded directly from the dropdown.</p>
              <SelectField
                label="Certificate category"
                value={selectedCertificateCategory}
                onChange={(event) => setSelectedCertificateCategory(event.target.value as CertificateCategory)}
                options={CERTIFICATE_UPLOAD_CATEGORIES.map((category) => ({ value: category, label: category }))}
              />
              <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                <p className="text-sm font-medium text-ink">{selectedCertificateCategory}</p>
                <FileUpload
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple={selectedCertificateCategory === 'Other Certificates'}
                  onUpload={(files) => handleCertificateUpload(selectedCertificateCategory, files)}
                  className="mt-2"
                />
                {certificateFiles[selectedCertificateCategory].length > 0 ? (
                  <div className="mt-2 space-y-2 text-sm text-ink">
                    {certificateFiles[selectedCertificateCategory].map((file) => (
                      <div key={file.name} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          className="text-xs font-medium text-danger hover:underline"
                          onClick={() => removeCertificateFile(selectedCertificateCategory, file.name)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {certificateErrors[selectedCertificateCategory] ? (
                  <p className="text-xs text-danger mt-2">{certificateErrors[selectedCertificateCategory]}</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <h4 className="font-medium text-ink text-sm mb-2">PAN Certificate</h4>
              <p className="text-[11px] text-muted mb-3">Upload PAN certificate. Allowed: .pdf, .jpg, .jpeg, .png. Max 5MB.</p>
              <FileUpload
                accept=".pdf,.jpg,.jpeg,.png"
                onUpload={handlePanCertificateUpload}
              />
              {panCertificateFile ? (
                <p className="mt-2 text-sm text-ink">Selected: {panCertificateFile.name}</p>
              ) : null}
              {panCertificateError ? (
                <p className="text-xs text-danger mt-2">{panCertificateError}</p>
              ) : null}
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <h4 className="font-medium text-ink text-sm mb-2">Profile Photo</h4>
              <p className="text-[11px] text-muted mb-3">Upload a profile photo for the employee. Allowed: .jpg, .jpeg, .png. Max 1MB.</p>
              <FileUpload accept=".jpg,.jpeg,.png" onUpload={handlePhotoUpload} />
              {photoFile ? (
                <p className="mt-2 text-sm text-ink">Selected: {photoFile.name}</p>
              ) : null}
              {photoError ? (
                <p className="text-xs text-danger mt-2">{photoError}</p>
              ) : null}
              <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-center">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Profile preview"
                    className="mx-auto h-32 w-32 rounded-xl object-cover"
                  />
                ) : (
                  <p className="text-sm text-muted">Preview appears here after selecting a file.</p>
                )}
              </div>
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
