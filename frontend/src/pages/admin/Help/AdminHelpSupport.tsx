import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutGrid,
  Newspaper,
  Receipt,
  Ticket,
  Users,
} from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { cn } from '@/utils/cn'
import { adminPortalGuideSections } from '@pages/admin/data/adminPortalGuide'

const guideIcons: Record<string, typeof BookOpen> = {
  dashboard: LayoutGrid,
  leaves: CalendarCheck,
  employees: Users,
  projects: Briefcase,
  documents: FileText,
  payslips: Receipt,
  calendar: CalendarDays,
  tickets: Ticket,
  news: Newspaper,
}

export function AdminHelpSupport() {
  const [activeKey, setActiveKey] = useState<string | null>('leaves')

  const toggleGuide = (key: string) => {
    setActiveKey((prev) => (prev === key ? null : key))
  }

  const activeSection = adminPortalGuideSections.find((s) => s.key === activeKey)

  return (
    <PageWrapper fillViewport className="admin-hub-page-wrap relative z-10 !py-3 font-body">
      <div className="crewiq-dashboard admin-settings-view admin-help-view relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-settings-shell relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <header className="admin-settings-hub-header shrink-0">
            <div className="admin-settings-hero-top">
              <h1 className="admin-settings-hero-title font-display">Admin Portal Guide</h1>
            </div>
          </header>

          <div className="admin-settings-body">
            <section className="admin-settings-panel">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--dash-border-green)] bg-[#f4faf6]">
                  <BookOpen className="h-5 w-5 admin-settings-text-brand" />
                </div>
                <div>
                  <h2 className="admin-settings-panel-title font-display">All admin activities</h2>
                  <p className="admin-settings-panel-text">
                    Select a topic for step-by-step instructions.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {adminPortalGuideSections.map((section) => {
                  const Icon = guideIcons[section.key] ?? BookOpen
                  const isActive = activeKey === section.key
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => toggleGuide(section.key)}
                      className={cn(
                        'admin-help-topic-btn flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-all',
                        isActive && 'admin-help-topic-btn--active',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--dash-border-green)] bg-white',
                          isActive && 'admin-settings-text-brand bg-[#f4faf6]',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 leading-snug admin-settings-text-brand">
                        {section.title}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200',
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
                        <div className="admin-help-detail mt-5 rounded-xl border border-[var(--dash-border-green)] bg-[#f4faf6] p-5 sm:p-6">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--dash-border-green)] bg-white">
                              <Icon className="h-5 w-5 admin-settings-text-brand" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="admin-settings-panel-title font-display">
                                {activeSection.title}
                              </h3>
                              <p className="admin-settings-panel-text">{activeSection.summary}</p>

                              <ol className="mt-4 space-y-3">
                                {activeSection.steps.map((step, idx) => (
                                  <li key={idx} className="flex gap-3 admin-settings-panel-text !mt-0">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--dash-border-green)] bg-white text-xs font-bold admin-settings-text-brand">
                                      {idx + 1}
                                    </span>
                                    <span className="leading-relaxed">{step}</span>
                                  </li>
                                ))}
                              </ol>

                              {activeSection.notes && activeSection.notes.length > 0 && (
                                <ul className="admin-settings-list mt-5">
                                  {activeSection.notes.map((note, idx) => (
                                    <li key={idx} className="admin-settings-list-item">
                                      {note}
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {activeSection.linkTo && (
                                <Link
                                  to={activeSection.linkTo}
                                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold admin-settings-text-brand hover:underline"
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
                <p className="admin-settings-panel-text mt-4 text-center">
                  Choose a topic above to load its guide.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
