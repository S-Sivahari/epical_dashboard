import { useMemo, useState } from 'react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { TicketCard } from '@components/cards/TicketCard'
import type { Ticket, TicketStatus } from '@/types'

const seed: Ticket[] = [
  {
    id: 'TK-1',
    employeeId: 'E-1002',
    employeeName: 'Rahul Verma',
    title: 'VPN access issue',
    priority: 'High',
    status: 'Pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TK-2',
    employeeId: 'E-1001',
    employeeName: 'Asha Menon',
    title: 'Laptop replacement',
    priority: 'Medium',
    status: 'In Progress',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TK-3',
    employeeId: 'E-1003',
    employeeName: 'Meera Iyer',
    title: 'Payslip clarification',
    priority: 'Low',
    status: 'Completed',
    createdAt: new Date().toISOString(),
  },
]

export function TicketManagement() {
  const [tickets, setTickets] = useState(seed)
  const [q, setQ] = useState('')
  const [priority, setPriority] = useState('all')

  const columns = useMemo(() => {
    const byStatus = (s: TicketStatus) =>
      tickets.filter((t) => t.status === s && (priority === 'all' || t.priority === priority) && `${t.title} ${t.employeeName}`.toLowerCase().includes(q.toLowerCase()))
    return {
      Pending: byStatus('Pending'),
      'In Progress': byStatus('In Progress'),
      Completed: byStatus('Completed'),
    }
  }, [tickets, q, priority])

  const move = (id: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const order: TicketStatus[] = ['Pending', 'In Progress', 'Completed']
        const idx = order.indexOf(t.status)
        const next = order[Math.min(idx + 1, order.length - 1)]
        return { ...t, status: next }
      }),
    )
  }

  return (
    <PageWrapper>
      <PageHeader title="Tickets" breadcrumb={<Breadcrumb items={[{ label: 'Tickets' }]} />} />
      <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-border bg-surface/60 p-4">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField
          label="Priority"
          id="ticket-priority"
          options={[
            { value: 'all', label: 'All' },
            { value: 'Low', label: 'Low' },
            { value: 'Medium', label: 'Medium' },
            { value: 'High', label: 'High' },
            { value: 'Critical', label: 'Critical' },
          ]}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {(['Pending', 'In Progress', 'Completed'] as const).map((col) => (
          <section key={col} className="rounded-xl border border-border bg-surface/50 p-3">
            <header className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-ink">{col}</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted shadow-sm">
                {columns[col].length}
              </span>
            </header>
            <div className="space-y-3">
              {columns[col].map((t) => (
                <TicketCard key={t.id} ticket={t} onMove={move} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageWrapper>
  )
}
