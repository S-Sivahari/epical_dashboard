import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Phone, BookOpen, ChevronDown } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { DataTable } from '@components/employee/shared/DataTable'
import { supportTickets as initialTickets, faqs } from '@pages/employee/data/mockData'
import { useToast } from '@components/employee/shared/ToastProvider'

const ticketSchema = z.object({
  title: z.string().min(3, 'Title required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.string().min(1, 'Select priority'),
})

const columns = [
  { key: 'id', label: 'Ticket ID' },
  { key: 'title', label: 'Title' },
  { key: 'priority', label: 'Priority' },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Date' },
]

export default function HelpSupport() {
  const [tickets, setTickets] = useState(initialTickets)
  const [openFaq, setOpenFaq] = useState(null)
  const { toast } = useToast()

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(ticketSchema),
  })

  const onSubmit = (data) => {
    setTickets((prev) => [
      {
        id: `TKT-${Date.now().toString().slice(-4)}`,
        title: data.title,
        priority: data.priority,
        reason: data.description,
        status: 'Open',
        date: new Date().toISOString().split('T')[0],
      },
      ...prev,
    ])
    toast({ title: 'Ticket created', description: 'Support team will respond within 24 hours.' })
    reset()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h3 className="font-heading text-lg font-semibold">Raise a Ticket</h3>
          <div>
            <Label>Issue Title *</Label>
            <Input className="mt-1" {...register('title')} />
            {errors.title && <p className="mt-1 text-xs text-danger">{errors.title.message}</p>}
          </div>
          <div>
            <Label>Description *</Label>
            <Textarea className="mt-1" {...register('description')} />
            {errors.description && <p className="mt-1 text-xs text-danger">{errors.description.message}</p>}
          </div>
          <div>
            <Label>Priority *</Label>
            <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select priority" /></SelectTrigger>
              <SelectContent>
                {['Low', 'Medium', 'High'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.priority && <p className="mt-1 text-xs text-danger">{errors.priority.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting}>Submit Ticket</Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-heading font-semibold">Contact Support</h3>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex items-center gap-2 text-muted"><Mail className="h-4 w-4 text-primary" /> support@epical.com</p>
              <p className="flex items-center gap-2 text-muted"><Phone className="h-4 w-4 text-primary" /> +1 (800) 555-0199</p>
            </div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <BookOpen className="h-8 w-8 text-primary" />
            <h4 className="mt-3 font-heading font-semibold">User Guide</h4>
            <p className="mt-1 text-sm text-muted">Browse documentation for all portal features.</p>
            <Button variant="outline" size="sm" className="mt-3">View Guide</Button>
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={tickets} statusKey="status" />

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-heading text-lg font-semibold">FAQ</h3>
        <div className="mt-4 space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between p-4 text-left font-medium"
              >
                {faq.q}
                <ChevronDown className={`h-4 w-4 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && <p className="border-t border-border px-4 pb-4 text-sm text-muted">{faq.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
