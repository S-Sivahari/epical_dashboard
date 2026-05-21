import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { ExternalLink, FileText, X, HelpCircle } from 'lucide-react'
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

const isValidDate = (value: string) => !Number.isNaN(Date.parse(value))

const step1 = z.object({
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
  companyEmail: z.string().min(1, 'Company email is required').email('Enter a valid company email'),
})

const step2 = z.object({
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  uan: z.string().optional(),
  pfEsi: z.enum(['on', 'off']).optional(),
})

const step3 = z.object({
  joinedAt: z
    .string()
    .min(1, 'Joining date is required')
    .refine(isValidDate, 'Enter a valid joining date'),
  employmentType: z.enum(['Full-time', 'Contract', 'Intern']),
  department: z.string().optional(),
  role: z.enum(['Employee', 'Admin'], { required_error: 'Role is required' }),
  managerId: z.string().optional(),
  ctc: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().positive('CTC must be a positive number').optional(),
  ),
})

const step4 = z.object({
  aadhaar: z.string().optional(),
  pan: z.string().min(1, 'PAN is required'),
  passport: z.string().optional(),
  emergencyContactName: z.string().min(1, 'Emergency contact name is required'),
  emergencyContactPhone: z.string().min(1, 'Emergency contact phone is required'),
  emergencyContactEmail: z.string().email('Valid email required'),
  emergencyContactRelation: z.string().min(1, 'Emergency contact relation is required'),
  emergencyContactAddress: z.string().min(1, 'Emergency contact address is required'),
})

const fullSchema = step1.merge(step2).merge(step3).merge(step4)
type FullValues = z.infer<typeof fullSchema>

const defaultValues: Partial<FullValues> = {
  employeeId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  permanentAddress: '',
  communicationAddress: '',
  gender: '',
  employmentType: 'Full-time',
  pfEsi: 'on',
  passport: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  uan: '',
  pan: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactEmail: '',
  emergencyContactRelation: '',
  emergencyContactAddress: '',
}

type DocKey = 'aadhaar' | 'pan' | 'offerLetter' | 'agreement'

const DOCUMENT_TYPES = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  offerLetter: 'Offer Letter',
  agreement: 'Agreement Document',
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
const MAX_DOC_SIZE = 2 * 1024 * 1024
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
  const formRef = useRef<HTMLFormElement>(null)
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
  const [documentPreviews, setDocumentPreviews] = useState<Record<DocKey, string | null>>({
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
  const [certificatePreviews, setCertificatePreviews] = useState<Record<CertificateCategory, Record<string, string>>>({  
    'Degree': {},
    'Diploma': {},
    '10th': {},
    '12th': {},
    'Other Options': {},
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<FullValues | null>(null)
  const [showFileHelp, setShowFileHelp] = useState(false)
  const [copyAddressChecked, setCopyAddressChecked] = useState(false)

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      Object.values(documentPreviews).forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
      Object.values(certificatePreviews).forEach((categoryPreviews) => {
        Object.values(categoryPreviews).forEach((url) => {
          if (url) URL.revokeObjectURL(url)
        })
      })
    }
  }, [photoPreview, documentPreviews, certificatePreviews])

  const handleDocumentUpload = (key: DocKey, files: FileList | null) => {
    const file = files?.[0] ?? null
    if (!file) {
      setDocumentFiles((prev) => ({ ...prev, [key]: null }))
      setDocumentErrors((prev) => ({ ...prev, [key]: null }))
      setDocumentPreviews((prev) => {
        if (prev[key]) URL.revokeObjectURL(prev[key])
        return { ...prev, [key]: null }
      })
      return
    }

    const error = validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE)
    setDocumentErrors((prev) => ({ ...prev, [key]: error }))
    if (error) {
      setDocumentFiles((prev) => ({ ...prev, [key]: null }))
      return
    }

    setDocumentFiles((prev) => ({ ...prev, [key]: file }))
    setDocumentPreviews((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key])
      return { ...prev, [key]: URL.createObjectURL(file) }
    })
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
      setCertificatePreviews((prev) => ({
        ...prev,
        [category]: { ...prev[category], [file.name]: URL.createObjectURL(file) },
      }))
      return
    }

    const errors = fileList
      .map((file) => validateFile(file, ALLOWED_DOC_TYPES, MAX_DOC_SIZE))
      .filter(Boolean)
    const error = errors.length > 0 ? (errors[0] as string) : null

    setCertificateErrors((prev) => ({ ...prev, [category]: error }))
    if (error) return

    setCertificateFiles((prev) => ({ ...prev, [category]: [...prev[category], ...fileList] }))
    setCertificatePreviews((prev) => {
      const newPreviews = { ...prev[category] }
      fileList.forEach((file) => {
        newPreviews[file.name] = URL.createObjectURL(file)
      })
      return { ...prev, [category]: newPreviews }
    })
  }

  const removeCertificateFile = (category: CertificateCategory, fileName: string) => {
    setCertificateFiles((prev) => ({
      ...prev,
      [category]: prev[category].filter((file) => file.name !== fileName),
    }))
    setCertificatePreviews((prev) => {
      const categoryPreviews = { ...prev[category] }
      if (categoryPreviews[fileName]) {
        URL.revokeObjectURL(categoryPreviews[fileName])
        delete categoryPreviews[fileName]
      }
      return { ...prev, [category]: categoryPreviews }
    })
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
    setPreviewData(values)
    setShowPreview(true)
  })

  const handleConfirmCreate = async (values: FullValues) => {
    const payload: Omit<Employee, 'id'> = {
      employeeId: values.employeeId.trim(),
      firstName: values.firstName,
      middleName: values.middleName ? values.middleName.trim() : undefined,
      lastName: values.lastName.trim(),
      permanentAddress: values.permanentAddress,
      communicationAddress: values.communicationAddress,
      department: values.department,
      designation: values.role,
      role: values.role,      managerId: values.managerId || undefined,      employmentType: values.employmentType,
      joinedAt: values.joinedAt,
      status: 'Active',
      email: values.companyEmail || '',
      personalEmail: values.personalEmail,
      phone: values.phone,
      ctc: values.ctc,
      pan: values.pan,
      aadhaar: values.aadhaar,
      passport: values.passport,
      emergencyContact: {
        name: values.emergencyContactName || '',
        phone: values.emergencyContactPhone || '',
        email: values.emergencyContactEmail || '',
        relation: values.emergencyContactRelation || '',
        address: values.emergencyContactAddress || '',
      },
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
      setShowPreview(false)
    }
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Add Employee"
        breadcrumb={
          <Breadcrumb items={[{ label: 'Employees', to: '/admin/employees' }, { label: 'Add' }]} />
        }
      />

      <form ref={formRef} id="add-employee-form" className="mx-auto max-w-6xl space-y-8 pb-32" onSubmit={onSubmit}>
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
                      id="copyAddress"
                      checked={copyAddressChecked}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setCopyAddressChecked(checked)
                        if (checked) {
                          const permanentAddr = form.getValues('permanentAddress')
                          form.setValue('communicationAddress', permanentAddr)
                        }
                      }}
                      className="h-4 w-4 rounded border-border cursor-pointer"
                    />
                    <label htmlFor="copyAddress" className="text-sm text-muted cursor-pointer whitespace-nowrap">
                      Copy permanent
                    </label>
                  </div>
                </div>
              </div>
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
                ]}
                {...form.register('employmentType')}
              />
              <Input
                label="Department"
                error={form.formState.errors.department?.message}
                {...form.register('department')}
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

          {/* Section 5: Emergency Contact */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-6">
              <h3 className="font-display text-lg font-semibold text-ink">Emergency Contact Details</h3>
            </div>
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
          
          {/* Row 1: Aadhaar, PAN, Offer Letter */}
          <div className="grid gap-4 md:grid-cols-3 items-start">
            {['aadhaar', 'pan', 'offerLetter'].map((key) => {
              const docKey = key as DocKey
              const label = DOCUMENT_TYPES[docKey]
              return (
                <div key={key} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-medium text-ink">{label}</p>
                    <p className="text-xs text-muted">2MB</p>
                  </div>
                  <FileUpload
                    accept=".pdf,.jpg,.jpeg,.png"
                    onUpload={(files) => handleDocumentUpload(docKey, files)}
                  />
                  
                  {documentFiles[docKey] ? (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-medium text-muted mb-2 uppercase">Uploaded</p>
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2">
                        <span className="truncate text-xs text-ink flex-1">{documentFiles[docKey]?.name}</span>
                        {documentPreviews[docKey] ? (
                          <a
                            href={documentPreviews[docKey]}
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
                          className="text-xs font-medium text-danger hover:underline shrink-0"
                          onClick={() => handleDocumentUpload(docKey, null)}
                        >
                          Delete
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

          {/* Row 2: Certificates, Agreement Document, Profile Photo */}
          <div className="mt-6 grid gap-4 md:grid-cols-3 items-start">
            {/* Certificates */}
            <div className="rounded-xl border border-border bg-surface p-4 h-full flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <p className="font-medium text-ink">Certificates</p>
                <p className="text-xs text-muted">2MB</p>
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
                <div className="mt-4 pt-4 border-t border-border flex-1 overflow-hidden flex flex-col">
                  <p className="text-xs font-medium text-muted mb-2 uppercase">Uploaded</p>
                  <div className="space-y-2 overflow-y-auto flex-1">
                    {Object.entries(certificateFiles).map(([category, files]) =>
                      files.map((file) => (
                        <div
                          key={`${category}-${file.name}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="truncate text-ink">{file.name}</span>
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                              {category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {certificatePreviews[category as CertificateCategory]?.[file.name] ? (
                              <a
                                href={certificatePreviews[category as CertificateCategory][file.name]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded p-1 text-primary hover:bg-primary/10 transition-ui"
                                title="Preview certificate"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className="font-medium text-danger hover:underline"
                              onClick={() =>
                                removeCertificateFile(category as CertificateCategory, file.name)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Agreement Document */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="font-medium text-ink">{DOCUMENT_TYPES.agreement}</p>
                <p className="text-xs text-muted">2MB</p>
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
                    <div className="flex items-center gap-2 shrink-0">
                      {documentPreviews.agreement ? (
                        <a
                          href={documentPreviews.agreement}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1 text-primary hover:bg-primary/10 transition-ui"
                          title="Preview document"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs font-medium text-danger hover:underline"
                        onClick={() => handleDocumentUpload('agreement', null)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {documentErrors.agreement ? (
                <p className="text-xs text-danger mt-2">{documentErrors.agreement}</p>
              ) : null}
            </div>

            {/* Profile Photo */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="font-medium text-ink">Profile Photo</p>
                <p className="text-xs text-muted">1MB</p>
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
                      setPhotoError(null)
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
              {photoError ? <p className="text-xs text-danger mt-2">{photoError}</p> : null}
            </div>
          </div>
        </div>
      </form>

      {/* ── Fixed Bottom Action Bar ────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white p-4 shadow-lg">
        <div className="mx-auto max-w-6xl flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/admin/employees')}>
            Cancel
          </Button>
          <Button type="submit" form="add-employee-form" loading={form.formState.isSubmitting}>
            Create Employee
          </Button>
        </div>
      </div>

      {/* ── Preview Modal ────────────────────────────────────────────────── */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-lg">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-md p-1 hover:bg-surface"
              onClick={() => setShowPreview(false)}
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="mb-6 font-display text-2xl font-semibold text-ink">Verify Employee Details</h2>

            <div className="space-y-6">
              {/* Personal Section */}
              <div>
                <h3 className="mb-3 font-semibold text-ink">Personal Information</h3>
                <div className="grid gap-3 sm:grid-cols-2 bg-surface p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-muted">Employee ID</p>
                    <p className="font-medium text-ink">{previewData.employeeId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Full Name</p>
                    <p className="font-medium text-ink">{previewData.firstName} {previewData.middleName ? previewData.middleName + ' ' : ''}{previewData.lastName || ''}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Email</p>
                    <p className="font-medium text-ink text-sm">{previewData.companyEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Phone</p>
                    <p className="font-medium text-ink">{previewData.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Department</p>
                    <p className="font-medium text-ink">{previewData.department}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Role</p>
                    <p className="font-medium text-ink">{previewData.role}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Employment Type</p>
                    <p className="font-medium text-ink">{previewData.employmentType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Joining Date</p>
                    <p className="font-medium text-ink">{previewData.joinedAt}</p>
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div>
                <h3 className="mb-3 font-semibold text-ink">Address Information</h3>
                <div className="grid gap-3 bg-surface p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-muted">Permanent Address</p>
                    <p className="font-medium text-ink text-sm">{previewData.permanentAddress}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Communication Address</p>
                    <p className="font-medium text-ink text-sm">{previewData.communicationAddress}</p>
                  </div>
                </div>
              </div>

              {/* ID Proof Section */}
              <div>
                <h3 className="mb-3 font-semibold text-ink">ID & Document Proof</h3>
                <div className="grid gap-2 bg-surface p-4 rounded-lg text-sm">
                  <p><span className="text-muted">PAN:</span> {previewData.pan || '—'}</p>
                  <p><span className="text-muted">Aadhaar:</span> {previewData.aadhaar || '—'}</p>
                  <p><span className="text-muted">Passport:</span> {previewData.passport || '—'}</p>
                </div>
              </div>

              {/* Emergency Contact Section */}
              {(previewData.emergencyContactName || previewData.emergencyContactPhone || previewData.emergencyContactEmail) && (
                <div>
                  <h3 className="mb-3 font-semibold text-ink">Emergency Contact</h3>
                  <div className="grid gap-2 bg-surface p-4 rounded-lg text-sm">
                    <p><span className="text-muted">Name:</span> {previewData.emergencyContactName || '—'}</p>
                    <p><span className="text-muted">Phone:</span> {previewData.emergencyContactPhone || '—'}</p>
                    <p><span className="text-muted">Email:</span> {previewData.emergencyContactEmail || '—'}</p>
                    <p><span className="text-muted">Relation:</span> {previewData.emergencyContactRelation || '—'}</p>
                    <p><span className="text-muted">Address:</span> {previewData.emergencyContactAddress || '—'}</p>
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div>
                <h3 className="mb-3 font-semibold text-ink">Documents</h3>
                <div className="grid gap-2 bg-surface p-4 rounded-lg text-sm">
                  <p><span className="text-muted">Aadhaar:</span> {documentFiles.aadhaar ? '✓ Uploaded' : '—'}</p>
                  <p><span className="text-muted">PAN:</span> {documentFiles.pan ? '✓ Uploaded' : '—'}</p>
                  <p><span className="text-muted">Offer Letter:</span> {documentFiles.offerLetter ? '✓ Uploaded' : '—'}</p>
                  <p><span className="text-muted">Agreement:</span> {documentFiles.agreement ? '✓ Uploaded' : '—'}</p>
                  <p><span className="text-muted">Profile Photo:</span> {photoFile ? '✓ Uploaded' : '—'}</p>
                </div>
              </div>

              {/* Certificates Section */}
              {Object.entries(certificateFiles).some(([_, files]) => files.length > 0) && (
                <div>
                  <h3 className="mb-3 font-semibold text-ink">Certificates</h3>
                  <div className="grid gap-2 bg-surface p-4 rounded-lg text-sm">
                    {Object.entries(certificateFiles).map(([category, files]) =>
                      files.length > 0 ? (
                        <p key={category}>
                          <span className="text-muted">{category}:</span> {files.length} file(s)
                        </p>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowPreview(false)}
              >
                Back to Edit
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowPreview(false)
                  handleConfirmCreate(previewData)
                }}
              >
                Confirm & Create
              </Button>
            </div>
          </div>
        </div>
      )}

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
