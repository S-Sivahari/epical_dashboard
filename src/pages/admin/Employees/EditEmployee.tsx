import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import * as employeeService from '@services/employeeService'
import { useEmployeeStore } from '@store/employeeStore'
import type { Employee } from '@/types'

type FormValues = Pick<
  Employee,
  | 'firstName'
  | 'lastName'
  | 'department'
  | 'designation'
  | 'role'
  | 'employmentType'
  | 'joinedAt'
  | 'status'
  | 'email'
>

export function EditEmployee() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee)
  const [loading, setLoading] = useState(true)
  const form = useForm<FormValues>()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const e = await employeeService.getEmployee(id)
        if (cancelled) return
        form.reset({
          firstName: e.firstName,
          lastName: e.lastName,
          department: e.department,
          designation: e.designation,
          role: e.role,
          employmentType: e.employmentType,
          joinedAt: e.joinedAt,
          status: e.status,
          email: e.email,
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
        <Input label="First name" required {...form.register('firstName')} />
        <Input label="Last name" required {...form.register('lastName')} />
        <Input label="Company email" type="email" required {...form.register('email')} />
        <Input label="Department" required {...form.register('department')} />

        <Input label="Designation" required {...form.register('designation')} />
        <Input label="Role" required {...form.register('role')} />
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
        <SelectField
          label="Status"
          required
          options={[
            { value: 'Active', label: 'Active' },
            { value: 'On Leave', label: 'On Leave' },
            { value: 'Probation', label: 'Probation' },
            { value: 'Inactive', label: 'Inactive' },
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
