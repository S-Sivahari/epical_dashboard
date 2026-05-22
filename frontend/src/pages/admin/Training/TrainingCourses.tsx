import { useState } from 'react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Badge } from '@components/ui/Badge'
import { DataTable, type Column } from '@components/tables/DataTable'
import { formatDate } from '@/utils/formatDate'

interface Row {
  id: string
  employeeId: string
  name: string
  course: string
  topic: string
  date: string
  status: 'Active' | 'Completed'
}

const courses = [
  { id: 'CR-1', title: 'Inclusive Hiring', topic: 'DEI', platform: 'Coursera', link: 'https://example.com' },
]

export function TrainingCourses() {
  const [tab, setTab] = useState<'courses' | 'enrollment' | 'completion'>('courses')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('')
  const [link, setLink] = useState('')

  const enrollRows: Row[] = [
    {
      id: '1',
      employeeId: 'E-1001',
      name: 'Asha Menon',
      course: 'Inclusive Hiring',
      topic: 'DEI',
      date: '2026-04-02',
      status: 'Active',
    },
  ]

  const doneRows: Row[] = [
    {
      id: '2',
      employeeId: 'E-1002',
      name: 'Rahul Verma',
      course: 'Payroll 201',
      topic: 'Finance',
      date: '2026-03-18',
      status: 'Completed',
    },
  ]

  const columns: Column<Row>[] = [
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'name', header: 'Name' },
    { key: 'course', header: 'Course' },
    { key: 'topic', header: 'Topic' },
    {
      key: 'date',
      header: tab === 'completion' ? 'Completion date' : 'Enrolled date',
      render: (r) => formatDate(r.date),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge variant={r.status === 'Completed' ? 'success' : 'info'}>{r.status}</Badge>,
    },
  ]

  return (
    <PageWrapper>
      <PageHeader title="" breadcrumb={<Breadcrumb items={[{ label: 'Training' }]} />} />
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
        {(
          [
            ['courses', 'Courses'],
            ['enrollment', 'Enrollment'],
            ['completion', 'Completion'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === key ? 'bg-emerald-50 text-emerald-900 ring-1 ring-primary/30' : 'text-muted hover:bg-surface'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'courses' ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {courses.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <p className="font-semibold text-ink">{c.title}</p>
                <p className="text-sm text-muted">{c.topic}</p>
                <Badge className="mt-2" variant="neutral">
                  {c.platform}
                </Badge>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" asChild>
                    <a href={c.link} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost">
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <p className="mb-3 font-medium text-ink">Add course</p>
            <div className="grid gap-3 md:grid-cols-4 md:items-end">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <Input label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} />
              <Input label="Link" value={link} onChange={(e) => setLink(e.target.value)} />
              <Button
                className="md:col-span-4"
                onClick={() => {
                  /* demo */
                }}
              >
                Save course
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'enrollment' ? <DataTable columns={columns} data={enrollRows} /> : null}
      {tab === 'completion' ? <DataTable columns={columns} data={doneRows} /> : null}
    </PageWrapper>
  )
}
