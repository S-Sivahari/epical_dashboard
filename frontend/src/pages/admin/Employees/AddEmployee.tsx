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
import { useEmployeeStore } from '@store/employeeStore'
import type { Employee } from '@/types'

const employeeIdPattern = /^(EPL|INT)\d{8}$/
const isValidDate = (value: string) => !Number.isNaN(Date.parse(value))

const step1 = z.object({
  employeeId: z
    .string()
    .optional()
    .refine(
      (value) => !value || employeeIdPattern.test(value.trim().toUpperCase()),
      'Use EPL or INT plus 8 digits',
    ),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
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
  salaryGrade: z.string().optional(),
  uan: z.string().optional(),
  pfEsi: z.enum(['on', 'off']),
})

const step3 = z.object({
  joinedAt: z
    .string()
    .min(1, 'Joining date is required')
    .refine(isValidDate, 'Enter a valid joining date'),
  employmentType: z.enum(['Full-time', 'Contract', 'Intern']),

  department: z.string().min(2, 'Department is required'),
  reportingManager: z.string().min(1, 'Reporting manager is required'),
  role: z.string().min(2, 'Role is required'),
  ctc: z.coerce.number().positive('CTC must be a positive number'),
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
  gender: 'Female',
  employmentType: 'Full-time',
  pfEsi: 'on',
  passport: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  salaryGrade: '',
  uan: '',
  ctc: 1200000,
}

export function AddEmployee() {
  const navigate = useNavigate()
  const addEmployee = useEmployeeStore((s) => s.addEmployee)
  const form = useForm<FullValues>({
    resolver: zodResolver(fullSchema),
    defaultValues: defaultValues as FullValues,
    mode: 'onTouched',
  })

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
      personalEmail: values.personalEmail,
      phone: values.phone,
      salaryGrade: values.salaryGrade,
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
                { value: 'Female', label: 'Female' },
                { value: 'Male', label: 'Male' },
                { value: 'Non-binary', label: 'Non-binary' },
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
            <p className="text-sm text-muted">Banking and financial information.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
              label="IFSC"
              error={form.formState.errors.ifsc?.message}
              {...form.register('ifsc')}
            />
            <Input
              label="Salary grade"
              error={form.formState.errors.salaryGrade?.message}
              {...form.register('salaryGrade')}
            />
            <Input
              label="UAN"
              error={form.formState.errors.uan?.message}
              {...form.register('uan')}
            />
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
            <Input
              label="Role"
              required
              error={form.formState.errors.role?.message}
              {...form.register('role')}
            />
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
