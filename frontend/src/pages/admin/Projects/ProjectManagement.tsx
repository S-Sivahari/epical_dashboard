import { useMemo, useState } from 'react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { FilterBar } from '@components/tables/FilterBar'
import { SelectField } from '@components/forms/SelectField'
import { DataTable, type Column } from '@components/tables/DataTable'
import { HoursBarChart } from '@components/charts/BarChart'
import { DepartmentPieChart } from '@components/charts/PieChart'
import { KPICard } from '@components/charts/KPICard'
import type { ProjectTimesheetRow } from '@/types'
import { stringToHueColor } from '@/utils/stringColor'
import { Avatar } from '@components/ui/Avatar'
import { formatDate } from '@/utils/formatDate'
import { Briefcase, Clock, Users } from 'lucide-react'

const rows: ProjectTimesheetRow[] = [
  {
    id: 'T-1',
    employeeId: 'E-1001',
    employeeName: 'Asha Menon',
    project: 'Atlas',
    client: 'Acme',
    date: '2026-05-12',
    hours: 8,
    task: 'Sprint planning',
  },
  {
    id: 'T-2',
    employeeId: 'E-1002',
    employeeName: 'Rahul Verma',
    project: 'Beacon',
    client: 'Globex',
    date: '2026-05-12',
    hours: 7,
    task: 'Payroll review',
  },
]

export function ProjectManagement() {
  const [client, setClient] = useState('all')
  const filtered = useMemo(() => {
    if (client === 'all') return rows
    return rows.filter((r) => r.client === client)
  }, [client])

  const columns: Column<ProjectTimesheetRow>[] = [
    {
      key: 'employeeName',
      header: 'Employee',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar name={r.employeeName} size="sm" color={stringToHueColor(r.employeeId)} />
          <span>{r.employeeName}</span>
        </div>
      ),
    },
    { key: 'project', header: 'Project' },
    { key: 'client', header: 'Client' },
    {
      key: 'date',
      header: 'Date',
      render: (r) => formatDate(r.date),
    },
    { key: 'hours', header: 'Hours' },
    { key: 'task', header: 'Task' },
  ]

  const pie = [
    { name: 'Atlas', value: 54 },
    { name: 'Beacon', value: 32 },
    { name: 'Internal', value: 14 },
  ]

  const weekly = [
    { name: 'Asha', hours: 38 },
    { name: 'Rahul', hours: 36 },
    { name: 'Meera', hours: 32 },
  ]

  return (
    <PageWrapper>
      <PageHeader
        title="Projects / Timesheet"
        subtitle="Hours, clients, and utilization."
        breadcrumb={<Breadcrumb items={[{ label: 'Projects' }]} />}
      />
      <FilterBar>
        <div className="grid w-full gap-3 md:grid-cols-4">
          <SelectField
            label="Client"
            id="client-filter"
            options={[
              { value: 'all', label: 'All clients' },
              { value: 'Acme', label: 'Acme' },
              { value: 'Globex', label: 'Globex' },
            ]}
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
          <SelectField
            label="Project"
            id="project-filter"
            options={[
              { value: 'all', label: 'All projects' },
              { value: 'Atlas', label: 'Atlas' },
              { value: 'Beacon', label: 'Beacon' },
            ]}
            defaultValue="all"
          />
          <SelectField
            label="Date range"
            id="range-filter"
            options={[
              { value: 'week', label: 'This week' },
              { value: 'last', label: 'Last week' },
              { value: 'month', label: 'This month' },
            ]}
            defaultValue="week"
          />
        </div>
      </FilterBar>
      <DataTable columns={columns} data={filtered} />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total hours" value={168} icon={Clock} />
        <KPICard title="Billable hours" value={142} icon={Briefcase} color="#3b82f6" />
        <KPICard title="Active projects" value={6} icon={Briefcase} color="#f59e0b" />
        <KPICard title="Team members" value={18} icon={Users} color="#64748b" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="mb-2 font-display text-sm font-semibold text-ink">Hours by project</p>
          <DepartmentPieChart data={pie} />
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="mb-2 font-display text-sm font-semibold text-ink">Employee-wise hours</p>
          <HoursBarChart data={weekly} />
        </div>
      </div>
    </PageWrapper>
  )
}
