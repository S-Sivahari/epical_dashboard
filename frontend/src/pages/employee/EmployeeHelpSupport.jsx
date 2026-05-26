import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Phone,
  Clock,
  ChevronDown,
  BookOpen,
  Ticket,
  ListChecks,
  CalendarOff,
  Gift,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { faqs, userGuideSections } from '@pages/employee/data/mockData'
import { useToast } from '@components/employee/shared/ToastProvider'
import { useAuthStore } from '@store/authStore'
import { useTicketStore } from '@store/ticketStore'
import { cn } from '@pages/employee/lib/utils'

const querySchema = z.object({
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

const guideIcons = {
  'raise-ticket': Ticket,
  'track-ticket': ListChecks,
  'apply-leave': CalendarOff,
  'view-compensation': Gift,
  'company-calendar': Calendar,
  'employee-profile': User,
}

function UserGuideAccordion() {
  const [activeKey, setActiveKey] = useState(null)

  const toggleGuide = (key) => {
    setActiveKey((prev) => (prev === key ? null : key))
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-semibold">User Guide</h3>
          <p className="mt-1 text-sm text-muted">
            Select a feature below to view step-by-step instructions.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {userGuideSections.map((section) => {
          const Icon = guideIcons[section.key] ?? BookOpen
          const isActive = activeKey === section.key
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => toggleGuide(section.key)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all',
                isActive
                  ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-slate-50/50 text-foreground hover:border-primary/20 hover:bg-slate-50',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  isActive ? 'bg-primary text-white' : 'bg-white text-primary ring-1 ring-border',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{section.title}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform duration-200',
                  isActive && 'rotate-180',
                )}
              />
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeKey && (
          <motion.div
            key={activeKey}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {(() => {
              const section = userGuideSections.find((s) => s.key === activeKey)
              if (!section) return null
              const Icon = guideIcons[section.key] ?? BookOpen
              return (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-heading text-sm font-semibold text-foreground">
                        {section.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-muted">{section.summary}</p>
                      <ol className="mt-3 space-y-2">
                        {section.steps.map((step, idx) => (
                          <li key={idx} className="flex gap-2.5 text-sm text-muted">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                      {section.linkTo && (
                        <Link
                          to={section.linkTo}
                          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Go to {section.linkLabel}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {!activeKey && (
        <p className="mt-3 text-center text-xs text-muted">
          Choose a feature above to load its guide.
        </p>
      )}
    </section>
  )
}

export default function EmployeeHelpSupport() {
  const [openFaq, setOpenFaq] = useState(null)
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const createTicket = useTicketStore((s) => s.createTicket)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(querySchema),
  })

  const onSubmitQuery = async (data) => {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please log in to send a query.', variant: 'destructive' })
      return
    }

    try {
      await createTicket({
        employeeId: user.id,
        employeeName: user.name,
        title: `Support Query: ${data.subject}`,
        description: data.message,
        priority: 'Low',
      })
      toast({
        title: 'Query submitted',
        description: 'Your message was sent to the support team. Track it under Raise Tickets.',
      })
      reset()
    } catch (error) {
      const message = error?.response?.data?.error || 'Could not send your query. Please try again.'
      toast({ title: 'Failed to submit', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-foreground">Help & Support</h2>
        <p className="mt-1 text-sm text-muted">
          FAQs, contact details, and guides for using the employee portal.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* FAQ */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-heading text-lg font-semibold">FAQ</h3>
          <p className="mt-1 mb-4 text-sm text-muted">Common questions about the portal and HR processes.</p>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-3 p-3.5 text-left text-sm font-medium"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <p className="border-t border-border px-3.5 pb-3.5 text-sm leading-relaxed text-muted">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact Support */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-heading text-lg font-semibold">Contact Support</h3>
          <p className="mt-1 mb-4 text-sm text-muted">Reach the HR & IT support team directly.</p>

          <div className="mb-5 space-y-2.5 rounded-lg bg-slate-50/80 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 text-muted">
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              support@epical.com
            </p>
            <p className="flex items-center gap-2 text-muted">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              +1 (800) 555-0199
            </p>
            <p className="flex items-center gap-2 text-muted">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              Mon–Fri, 9:00 AM – 6:00 PM IST
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmitQuery)} className="space-y-3 border-t border-border pt-4">
            <p className="text-xs font-medium text-foreground">Send a general support query</p>
            <div>
              <Label>Subject *</Label>
              <Input className="mt-1" placeholder="Brief summary of your question" {...register('subject')} />
              {errors.subject && <p className="mt-1 text-xs text-danger">{errors.subject.message}</p>}
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea className="mt-1" rows={3} placeholder="Describe your question or issue…" {...register('message')} />
              {errors.message && <p className="mt-1 text-xs text-danger">{errors.message.message}</p>}
            </div>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send Query'}
            </Button>
          </form>
        </section>
      </div>

      <UserGuideAccordion />
    </div>
  )
}
