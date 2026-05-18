import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { StepIndicator } from '@components/forms/StepIndicator'
import { useEmployeeStore } from '@store/employeeStore'
import type { Employee } from '@/types'

const step1 = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  dob: z.string().min(1, 'Required'),
  gender: z.string().min(1, 'Required'),
  phone: z.string().min(10, 'Invalid phone'),
  personalEmail: z.string().email(),
  companyEmail: z.string().email(),
})

const step2 = z.object({
  bankName: z.string().min(2, 'Required'),
  accountNumber: z.string().min(6, 'Required'),
  ifsc: z.string().min(4, 'Required'),
  salaryGrade: z.string().min(1, 'Required'),
  uan: z.string().min(4, 'Required'),
  pfEsi: z.enum(['on', 'off']),
})

const step3 = z.object({
  joinedAt: z.string().min(1, 'Required'),
  employmentType: z.enum(['Full-time', 'Contract', 'Intern']),
  designation: z.string().min(2, 'Required'),
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

const steps = ['Personal', 'Payment', 'Joining', 'ID Proof']

const defaultValues: Partial<FullValues> = {
  gender: 'Female',
  employmentType: 'Full-time',
  pfEsi: 'on',
  passport: '',
  ctc: 1200000,
}

export function AddEmployee() {
  const navigate = useNavigate()
  const addEmployee = useEmployeeStore((s) => s.addEmployee)
  const [step, setStep] = useState(0)
  const form = useForm<FullValues>({ defaultValues: defaultValues as FullValues, mode: 'onSubmit' })

  const pick = (keys: (keyof FullValues)[]) => {
    const v = form.getValues()
    return Object.fromEntries(keys.map((k) => [k, v[k]])) as Record<string, unknown>
  }

  const next = () => {
    const schemas = [step1, step2, step3, step4]
    const keys: (keyof FullValues)[][] = [
      ['firstName', 'lastName', 'dob', 'gender', 'phone', 'personalEmail', 'companyEmail'],
      ['bankName', 'accountNumber', 'ifsc', 'salaryGrade', 'uan', 'pfEsi'],
      ['joinedAt', 'employmentType', 'designation', 'department', 'reportingManager', 'role', 'ctc'],
      ['aadhaar', 'pan', 'passport'],
    ]
    const parsed = schemas[step].safeParse(pick(keys[step]))
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const msg = Object.values(first).flat()[0] ?? 'Please fix the highlighted fields'
      toast.error(msg)
      return
    }
    setStep((s) => Math.min(s + 1, 3))
  }

  const onSubmit = form.handleSubmit((values) => {
    const parsed = fullSchema.safeParse(values)
    if (!parsed.success) {
      toast.error('Please review the form')
      return
    }
    const v = parsed.data
    const payload: Omit<Employee, 'id'> = {
      firstName: v.firstName,
      lastName: v.lastName,
      department: v.department,
      designation: v.designation,
      employmentType: v.employmentType,
      joinedAt: v.joinedAt,
      status: 'Active',
      email: v.companyEmail,
      phone: v.phone,
      salaryGrade: v.salaryGrade,
      ctc: v.ctc,
    }
    void (async () => {
      try {
        await addEmployee(payload)
        toast.success('Employee created')
        navigate('/dashboard/employees')
      } catch {
        toast.error('Could not create employee')
      }
    })()
  })

  return (
    <PageWrapper>
      <PageHeader
        title="Add Employee"
        subtitle="Four-step onboarding with validation at each step."
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Employees', to: '/dashboard/employees' },
              { label: 'Add' },
            ]}
          />
        }
      />

      <div className="space-y-6">
        <StepIndicator steps={steps} currentStep={step} />

        <form className="space-y-6" onSubmit={step === 3 ? onSubmit : (e) => e.preventDefault()}>
          {step === 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="First name" required {...form.register('firstName')} />
              <Input label="Last name" required {...form.register('lastName')} />
              <Input label="Date of birth" type="date" required {...form.register('dob')} />
              <SelectField
                label="Gender"
                required
                options={[
                  { value: 'Female', label: 'Female' },
                  { value: 'Male', label: 'Male' },
                  { value: 'Non-binary', label: 'Non-binary' },
                ]}
                {...form.register('gender')}
              />
              <Input label="Phone" required {...form.register('phone')} />
              <Input label="Personal email" type="email" required {...form.register('personalEmail')} />
              <Input label="Company email" type="email" required {...form.register('companyEmail')} />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Bank name" required {...form.register('bankName')} />
              <Input label="Account number" required {...form.register('accountNumber')} />
              <Input label="IFSC" required {...form.register('ifsc')} />
              <Input label="Salary grade" required {...form.register('salaryGrade')} />
              <Input label="UAN" required {...form.register('uan')} />
              <SelectField
                label="PF / ESI"
                required
                options={[
                  { value: 'on', label: 'Enabled' },
                  { value: 'off', label: 'Disabled' },
                ]}
                {...form.register('pfEsi')}
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Joining date" type="date" required {...form.register('joinedAt')} />
              <SelectField
                label="Employment type"
                required
                options={[
                  { value: 'Full-time', label: 'Full-time' },
                  { value: 'Contract', label: 'Contract' },
                  { value: 'Intern', label: 'Intern' },
                ]}
                {...form.register('employmentType')}
              />
              <Input label="Designation" required {...form.register('designation')} />
              <Input label="Department" required {...form.register('department')} />
              <Input label="Reporting manager" required {...form.register('reportingManager')} />
              <Input label="Role" required {...form.register('role')} />
              <Input label="CTC (annual)" type="number" required {...form.register('ctc', { valueAsNumber: true })} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Aadhaar number" required {...form.register('aadhaar')} />
              <Input label="PAN" required {...form.register('pan')} />
              <Input label="Passport number" {...form.register('passport')} />
              <div className="md:col-span-2 rounded-xl border border-border bg-surface/60 p-4 text-sm text-muted">
                Review details before submitting. All required fields must be valid.
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate('/dashboard/employees')}>
                Cancel
              </Button>
              {step < 3 ? (
                <Button type="button" onClick={next}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" loading={form.formState.isSubmitting}>
                  Submit
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </PageWrapper>
  )
}
