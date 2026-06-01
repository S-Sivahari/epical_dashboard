import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Briefcase,
  Calendar,
  FileText,
  LayoutGrid,
  Megaphone,
  Receipt,
  Search,
  Sparkles,
  Ticket,
  Trophy,
  UserPlus,
  Users,
  BookOpen,
  CalendarCheck,
} from 'lucide-react'
import { ROUTES } from '@constants/routes'
import { useDashboardStore } from '@store/dashboardStore'
import { cn } from '@/utils/cn'
import { scaleIn } from '@/utils/motionPresets'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: typeof LayoutGrid
  action: () => void
  group: 'Navigate' | 'Quick Actions' | 'AI Suggestions'
  keywords?: string[]
}

export function CommandPalette() {
  const open = useDashboardStore((s) => s.commandPaletteOpen)
  const setOpen = useDashboardStore((s) => s.setCommandPaletteOpen)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const items: CommandItem[] = useMemo(
    () => [
      { id: 'dash', label: 'Dashboard', description: 'Dashboard home', icon: LayoutGrid, group: 'Navigate', action: () => navigate(ROUTES.DASHBOARD), keywords: ['home', 'overview'] },
      { id: 'emp', label: 'Manage Employees', icon: Users, group: 'Navigate', action: () => navigate(ROUTES.EMPLOYEES) },
      { id: 'add-emp', label: 'Add Employee', icon: UserPlus, group: 'Quick Actions', action: () => navigate(ROUTES.EMPLOYEE_ADD), keywords: ['create', 'hire'] },
      { id: 'leaves', label: 'Manage Leaves', icon: CalendarCheck, group: 'Navigate', action: () => navigate(ROUTES.LEAVES) },
      { id: 'approve', label: 'Approve Requests', description: 'Review pending leave requests', icon: CalendarCheck, group: 'Quick Actions', action: () => navigate(ROUTES.LEAVES) },
      { id: 'projects', label: 'Projects & Timesheets', icon: Briefcase, group: 'Navigate', action: () => navigate(ROUTES.PROJECTS) },
      { id: 'calendar', label: 'Company Calendar', icon: Calendar, group: 'Navigate', action: () => navigate(ROUTES.CALENDAR) },
      { id: 'payslips', label: 'Generate Payslip', icon: Receipt, group: 'Quick Actions', action: () => navigate(ROUTES.PAYSLIPS), keywords: ['payroll'] },
      { id: 'payslip-mgmt', label: 'Payslip Management', icon: Receipt, group: 'Navigate', action: () => navigate(ROUTES.PAYSLIPS) },
      { id: 'news', label: 'Post Announcement', icon: Megaphone, group: 'Quick Actions', action: () => navigate(ROUTES.NEWS), keywords: ['announce'] },
      { id: 'news-mgmt', label: 'Manage News', icon: Megaphone, group: 'Navigate', action: () => navigate(ROUTES.NEWS) },
      { id: 'event', label: 'Create Event', icon: Calendar, group: 'Quick Actions', action: () => navigate(ROUTES.CALENDAR) },
      { id: 'docs', label: 'Document Requests', icon: FileText, group: 'Navigate', action: () => navigate(ROUTES.DOCUMENTS) },
      { id: 'tickets', label: 'Tickets', icon: Ticket, group: 'Navigate', action: () => navigate(ROUTES.TICKETS) },
      { id: 'training', label: 'Training & Courses', icon: BookOpen, group: 'Navigate', action: () => navigate(ROUTES.TRAINING) },
      { id: 'achievements', label: 'Company Achievements', icon: Trophy, group: 'Navigate', action: () => navigate(ROUTES.ACHIEVEMENTS) },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Navigate', action: () => navigate(ROUTES.ANALYTICS) },
      { id: 'ai-report', label: 'Generate attendance report', description: 'AI suggestion', icon: Sparkles, group: 'AI Suggestions', action: () => navigate(ROUTES.ANALYTICS), keywords: ['ai', 'report'] },
      { id: 'ai-leaves', label: 'Summarize pending leaves', description: 'AI suggestion', icon: Sparkles, group: 'AI Suggestions', action: () => navigate(ROUTES.LEAVES), keywords: ['ai', 'summary'] },
    ],
    [navigate],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k.includes(q)),
    )
  }, [items, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
      if (!open) return
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault()
        filtered[activeIndex].action()
        setOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen, filtered, activeIndex])

  const groups = ['Quick Actions', 'Navigate', 'AI Suggestions'] as const

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="cmd-palette-overlay fixed inset-0 z-[100]"
            onClick={() => setOpen(false)}
          />
          <motion.div
            {...scaleIn}
            className="cmd-palette fixed left-1/2 top-[15%] z-[101] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands, pages, actions..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <kbd className="cmd-kbd hidden sm:inline">ESC</kbd>
            </div>
            <div className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">No results found</p>
              ) : (
                groups.map((group) => {
                  const groupItems = filtered.filter((i) => i.group === group)
                  if (groupItems.length === 0) return null
                  return (
                    <div key={group} className="mb-2">
                      <p className="cmd-palette-group-label px-2 py-1.5">{group}</p>
                      {groupItems.map((item) => {
                        const globalIdx = filtered.indexOf(item)
                        const Icon = item.icon
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              item.action()
                              setOpen(false)
                              setQuery('')
                            }}
                            onMouseEnter={() => setActiveIndex(globalIdx)}
                            className={cn(
                              'cmd-palette-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left',
                              globalIdx === activeIndex && 'cmd-palette-item-active',
                            )}
                          >
                            <span className="cmd-palette-icon flex h-8 w-8 items-center justify-center rounded-lg">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
                              {item.description && (
                                <span className="block truncate text-xs text-[var(--text-muted)]">{item.description}</span>
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
