import { useState } from 'react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { HoursBarChart } from '@components/charts/BarChart'
import { DepartmentPieChart } from '@components/charts/PieChart'
import { KPICard } from '@components/charts/KPICard'
import { exportAnalyticsPdf } from '@/utils/exportPDF'
import { BarChart3, BookOpen, Clock, FileText } from 'lucide-react'

export function Analytics() {
  const [month, setMonth] = useState('5')
  const [year, setYear] = useState('2026')

  const weekly = [
    { name: 'Mon', hours: 7 },
    { name: 'Tue', hours: 8 },
    { name: 'Wed', hours: 6 },
    { name: 'Thu', hours: 7 },
    { name: 'Fri', hours: 5 },
  ]

  const courses = [
    { name: 'Done', value: 68 },
    { name: 'In progress', value: 22 },
    { name: 'Not started', value: 10 },
  ]

  return (
    <PageWrapper className="admin-page">
      <div className="crewiq-dashboard">
      <PageHeader
        title=""
        breadcrumb={<Breadcrumb items={[{ label: 'Analytics' }]} />}
        actions={
          <Button variant="secondary" onClick={() => void exportAnalyticsPdf(`analytics-${year}-${month}.pdf`)}>
            <FileText className="h-4 w-4 text-red-600" />
            Export PDF
          </Button>
        }
      />
      <div className="admin-toolbar mb-4">
        <SelectField
          label="Employee"
          id="analytics-employee"
          options={[
            { value: 'all', label: 'All employees' },
            { value: 'E-1001', label: 'Asha Menon' },
            { value: 'E-1002', label: 'Rahul Verma' },
          ]}
          defaultValue="all"
        />
        <Input label="Month" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
        <Input label="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard title="Total hours" value={182} icon={Clock} />
        <KPICard title="Completed courses" value={24} icon={BookOpen} color="#3b82f6" />
        <KPICard title="Avg hours / week" value={36} icon={BarChart3} color="#f59e0b" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="admin-card flex h-[22rem] min-h-[22rem] flex-col">
          <p className="mb-3 shrink-0 font-display text-sm font-semibold text-white">Weekly performance</p>
          <div className="min-h-0 flex-1 overflow-hidden">
            <HoursBarChart data={weekly} height={280} animate={false} />
          </div>
        </div>
        <div className="admin-card flex h-[22rem] min-h-[22rem] flex-col">
          <p className="mb-3 shrink-0 font-display text-sm font-semibold text-white">Course completion</p>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <DepartmentPieChart data={courses} height={280} />
          </div>
        </div>
      </div>
      </div>
    </PageWrapper>
  )
}
