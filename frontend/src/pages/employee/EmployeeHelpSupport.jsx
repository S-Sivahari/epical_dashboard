import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  BookOpen,
  LayoutGrid,
  Clock,
  CalendarOff,
  CalendarDays,
  FileText,
  BookMarked,
  Trophy,
  Ticket,
  User,
  LogIn,
  ArrowRight,
  Info,
} from 'lucide-react'
import {
  employeePortalGuideIntro,
  employeePortalGuideSections,
} from '@pages/employee/data/employeePortalGuide'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

const guideIcons = {
  dashboard: LayoutGrid,
  timesheet: Clock,
  'apply-leave': CalendarOff,
  'leave-balances': CalendarOff,
  'company-calendar': CalendarDays,
  documents: FileText,
  training: BookMarked,
  achievements: Trophy,
  'raise-ticket': Ticket,
  profile: User,
  'sign-in': LogIn,
}

export default function EmployeeHelpSupport() {
  const [activeKey, setActiveKey] = useState('apply-leave')

  const toggleGuide = (key) => {
    setActiveKey((prev) => (prev === key ? null : key))
  }

  const activeSection = employeePortalGuideSections.find((s) => s.key === activeKey)

  return (
    <div
      className="emp-help-page w-full space-y-6 pb-8"
      data-page-scrollable
    >
      <header className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          Employee Portal Guide
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
          {employeePortalGuideIntro}
        </p>
      </header>

      <InteractiveCard className={portalCardClass({ className: 'p-4 sm:p-5' })}>
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-foreground">Leave tip:</span> If your balance is
            exhausted, new requests are blocked at submit time. Pending requests await admin
            approval and only deduct balance once approved. Casual and Sick balances reset each
            calendar month; Earned leave accrues through the calendar year. Compensation leave starts at zero and increases only when admin credits it.
          </p>
        </div>
      </InteractiveCard>

      <InteractiveCard className={portalCardClass({ className: 'p-5 sm:p-6 lg:p-8' })}>
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold sm:text-xl">All portal activities</h3>
            <p className="mt-1 text-sm text-muted">
              Select a topic to view step-by-step instructions.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employeePortalGuideSections.map((section) => {
            const Icon = guideIcons[section.key] ?? BookOpen
            const isActive = activeKey === section.key
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => toggleGuide(section.key)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-all',
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                    : 'border-border bg-slate-50/50 text-foreground hover:border-primary/20 hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    isActive ? 'bg-primary text-white' : 'bg-white text-primary ring-1 ring-border',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 leading-snug">{section.title}</span>
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
          {activeKey && activeSection && (
            <motion.div
              key={activeKey}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              {(() => {
                const Icon = guideIcons[activeSection.key] ?? BookOpen
                return (
                  <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-heading text-lg font-semibold text-foreground">
                          {activeSection.title}
                        </h4>
                        <p className="mt-1 text-sm text-muted">{activeSection.summary}</p>

                        <ol className="mt-4 space-y-3">
                          {activeSection.steps.map((step, idx) => (
                            <li key={idx} className="flex gap-3 text-sm text-foreground">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                                {idx + 1}
                              </span>
                              <span className="leading-relaxed">{step}</span>
                            </li>
                          ))}
                        </ol>

                        {activeSection.notes?.length > 0 && (
                          <ul className="mt-5 space-y-2 rounded-lg border border-border/80 bg-white/60 px-4 py-3">
                            {activeSection.notes.map((note, idx) => (
                              <li
                                key={idx}
                                className="flex gap-2 text-sm leading-relaxed text-muted before:shrink-0 before:content-['•']"
                              >
                                {note}
                              </li>
                            ))}
                          </ul>
                        )}

                        {activeSection.linkTo && (
                          <Link
                            to={activeSection.linkTo}
                            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                          >
                            Open {activeSection.linkLabel}
                            <ArrowRight className="h-4 w-4" />
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
          <p className="mt-4 text-center text-sm text-muted">
            Choose a topic above to load its guide.
          </p>
        )}
      </InteractiveCard>
    </div>
  )
}
