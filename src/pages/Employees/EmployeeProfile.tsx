import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import * as employeeService from '@services/employeeService'
import type { Employee } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { stringToHueColor } from '@/utils/stringColor'

const tabs = ['Personal', 'Job', 'Payment', 'ID Proof', 'Documents'] as const

export function EmployeeProfile() {
  const { id = '' } = useParams()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [tab, setTab] = useState<(typeof tabs)[number]>('Personal')

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

  if (!employee) {
    return (
      <PageWrapper>
        <PageHeader title="Employee" breadcrumb={<Breadcrumb items={[{ label: 'Employees', to: '/dashboard/employees' }, { label: 'Profile' }]} />} />
        <p className="text-sm text-muted">Loading profile…</p>
      </PageWrapper>
    )
  }

  const name = `${employee.firstName} ${employee.lastName}`

  return (
    <PageWrapper>
      <PageHeader
        title={name}
        subtitle={`${employee.designation} · ${employee.department}`}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Employees', to: '/dashboard/employees' },
              { label: name },
            ]}
          />
        }
        actions={
          <Button asChild>
            <Link to={`/dashboard/employees/${employee.id}/edit`}>Edit</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="rounded-xl border border-border bg-surface/70 p-5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <Avatar name={name} size="lg" color={stringToHueColor(employee.id)} />
            <p className="mt-3 font-display text-lg font-semibold text-ink">{name}</p>
            <p className="font-mono text-xs text-muted">{employee.id}</p>
            <div className="mt-3">
              <Badge variant={employee.status === 'Active' ? 'success' : 'warning'}>{employee.status}</Badge>
            </div>
            <div className="mt-4 w-full space-y-2 text-sm text-muted">
              <p>{employee.email}</p>
              {employee.phone ? <p>{employee.phone}</p> : null}
            </div>
          </div>
        </aside>
        <section className="lg:col-span-2">
          <div className="flex flex-wrap gap-2 border-b border-border pb-3">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-ui ${
                  tab === t ? 'bg-emerald-50 text-emerald-900 ring-1 ring-primary/30' : 'text-muted hover:bg-surface'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-border bg-white p-5 shadow-sm text-sm text-muted">
            {tab === 'Personal' && (
              <div className="grid gap-3 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-ink">Joined:</span> {formatDate(employee.joinedAt)}
                </p>
                <p>
                  <span className="font-semibold text-ink">Employment:</span> {employee.employmentType}
                </p>
              </div>
            )}
            {tab === 'Job' && (
              <p>
                <span className="font-semibold text-ink">Designation:</span> {employee.designation}
              </p>
            )}
            {tab === 'Payment' && (
              <p>
                <span className="font-semibold text-ink">CTC:</span> {employee.ctc ? `₹${employee.ctc.toLocaleString('en-IN')}` : '—'}
              </p>
            )}
            {tab === 'ID Proof' && <p>Government IDs are masked in the admin view.</p>}
            {tab === 'Documents' && <p>No documents uploaded yet.</p>}
          </div>
        </section>
      </div>
    </PageWrapper>
  )
}
