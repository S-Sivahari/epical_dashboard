import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import * as employeeService from '@services/employeeService'
import { useEmployeeStore } from '@store/employeeStore'
import type { Employee } from '@/types'
import { z } from 'zod'

const employeeIdPattern = /^(EPL|INT)\d{8}$/
const isValidDate = (value: string) => !Number.isNaN(Date.parse(value))

const editSchema = z.object({
  employeeId: z
    .string()
    .min(1, 'Employee ID is required')
    .refine(
      (value) => employeeIdPattern.test(value.trim().toUpperCase()),
      'Use EPL or INT plus 8 digits',
    ),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  department: z.string().min(2, 'Department is required'),
  designation: z.string().min(2, 'Designation is required'),
  role: z.string().min(2, 'Role is required'),
  employmentType: z.enum(['Active', 'Contract', 'Intern', 'Notice Period']),
  joinedAt: z
    .string()
    .min(1, 'Joining date is required')
    .refine(isValidDate, 'Enter a valid joining date'),
  status: z.enum(['Active', 'Inactive', 'Resigned']),
  email: z.string().email('Enter a valid company email'),
  personalEmail: z.string().email('Enter a valid personal email'),
})

type FormValues = Pick<
  Employee,
  | 'employeeId'
  | 'firstName'
  | 'lastName'
  | 'department'
  | 'designation'
  | 'role'
  | 'employmentType'
  | 'joinedAt'
  | 'status'
  | 'email'
  | 'personalEmail'
>

export function EditEmployee() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee)
  const [loading, setLoading] = useState(true)
  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    mode: 'onTouched',
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const e = await employeeService.getEmployee(id)
        if (cancelled) return
        form.reset({
          employeeId: e.employeeId,
          firstName: e.firstName,
          lastName: e.lastName,
          department: e.department,
          designation: e.designation,
          role: e.role,
          employmentType: e.employmentType,
          joinedAt: e.joinedAt,
          status: e.status,
          email: e.email,
          personalEmail: e.personalEmail ?? '',
        })
      } catch {
        toast.error('Employee not found')
        navigate('/admin/employees')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form, id, navigate])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateEmployee(id, values)
      toast.success('Employee updated')
      navigate(`/admin/employees/${id}`)
    } catch {
      toast.error('Update failed')
    }
  })

  if (loading) {
    return (
      <PageWrapper>
        <p className="text-sm text-muted">Loading…</p>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Edit employee"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Employees', to: '/admin/employees' },
              { label: id, to: `/admin/employees/${id}` },
              { label: 'Edit' },
            ]}
          />
        }
      />
      <form className="grid max-w-3xl gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <Input
          label="Employee ID"
          placeholder=""
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
          label="Company email"
          type="email"
          required
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Input
          label="Personal email"
          type="email"
          required
          error={form.formState.errors.personalEmail?.message}
          {...form.register('personalEmail')}
        />
        <Input
          label="Department"
          required
          error={form.formState.errors.department?.message}
          {...form.register('department')}
        />

        <Input
          label="Designation"
          required
          error={form.formState.errors.designation?.message}
          {...form.register('designation')}
        />
        <Input
          label="Role"
          required
          error={form.formState.errors.role?.message}
          {...form.register('role')}
        />
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
            { value: 'Active', label: 'Active' },
            { value: 'Contract', label: 'Contract' },
            { value: 'Intern', label: 'Intern' },
            { value: 'Notice Period', label: 'Notice Period' },
          ]}
          {...form.register('employmentType')}
        />
        <SelectField
          label="Status"
          required
          error={form.formState.errors.status?.message}
          options={[
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
            { value: 'Resigned', label: 'Resigned' },
          ]}
          {...form.register('status')}
        />
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" loading={form.formState.isSubmitting}>
            Save changes
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </PageWrapper>
  )
}
