import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  CalendarCheck,
  Megaphone,
  Receipt,
  Search,
  UserPlus,
} from 'lucide-react'
import { ADMIN_NAV_ITEMS } from '@constants/adminNavigation'
import { ROUTES } from '@constants/routes'
import { useDashboardStore } from '@store/dashboardStore'
import { cn } from '@/utils/cn'
import { scaleIn } from '@/utils/motionPresets'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: typeof UserPlus
  keywords?: string[]
  action: () => void
}

export function CommandPalette() {
  const open = useDashboardStore((s) => s.commandPaletteOpen)
  const setOpen = useDashboardStore((s) => s.setCommandPaletteOpen)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const items: CommandItem[] = useMemo(
    () => [
      ...ADMIN_NAV_ITEMS.map((item) => ({
        id: `nav-${item.to}`,
        label: item.label,
        description: 'Go to page',
        icon: item.icon,
        keywords: [item.navLabel ?? '', item.label, item.to.replace('/admin/', '')],
        action: () => navigate(item.to),
      })),
      {
        id: 'add-emp',
        label: 'Add Employee',
        description: 'Quick action',
        icon: UserPlus,
        action: () => navigate(ROUTES.EMPLOYEE_ADD),
        keywords: ['create', 'hire', 'employee'],
      },
      {
        id: 'approve',
        label: 'Approve Leave Requests',
        description: 'Quick action',
        icon: CalendarCheck,
        action: () => navigate(ROUTES.LEAVES),
        keywords: ['leave', 'approve'],
      },
      {
        id: 'payslips',
        label: 'Generate Payslip',
        description: 'Quick action',
        icon: Receipt,
        action: () => navigate(ROUTES.PAYSLIPS),
        keywords: ['payroll', 'payslip'],
      },
      {
        id: 'news',
        label: 'Post Announcement',
        description: 'Quick action',
        icon: Megaphone,
        action: () => navigate(ROUTES.NEWS),
        keywords: ['announce', 'news'],
      },
      {
        id: 'event',
        label: 'Create Calendar Event',
        description: 'Quick action',
        icon: Calendar,
        action: () => navigate(ROUTES.CALENDAR),
        keywords: ['calendar', 'event'],
      },
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
        item.keywords?.some((k) => k.toLowerCase().includes(q)),
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
                placeholder="Search pages and actions..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <kbd className="cmd-kbd hidden sm:inline">ESC</kbd>
            </div>
            <div className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">No results found</p>
              ) : (
                filtered.map((item, index) => {
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
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'cmd-palette-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left',
                        index === activeIndex && 'cmd-palette-item-active',
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
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
