import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { CompanyLogo } from '@components/auth/CompanyLogo'
import { Avatar } from '@components/ui/Avatar'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { CommandBarNewsMarquee } from '@components/layout/CommandBarNewsMarquee'
import { NotificationBell } from '@components/layout/NotificationBell'
import { PortalToggle } from '@components/layout/PortalToggle'
import { useAuthStore } from '@store/authStore'
import api from '@services/api'
import { shouldShowAdminBackButton } from '@constants/adminNavigation'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'

function titleCase(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const routeTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/employees': 'Employees',
  '/admin/leaves': 'Leave Management',
  '/admin/timesheet': 'Projects & Timesheets',
  '/admin/project-management': 'Project Management',
  '/admin/project-analysis': 'Project Management',
  '/admin/projects': 'Projects',
  '/admin/tickets': 'Tickets',
  '/admin/payslips': 'Payslips',
  '/admin/calendar': 'Calendar',
  '/admin/news': 'News',
  '/admin/documents': 'Documents',
  '/admin/settings': 'Settings',
  '/admin/analytics': 'Analytics',
  '/admin/achievements': 'Achievements',
  '/admin/training': 'Training',
}

export function CommandBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const portalAdmin = useAuthStore((s) => s.portalAdmin)
  const logout = useAuthStore((s) => s.logout)
  const patchUser = useAuthStore((s) => s.patchUser)
  const [profileOpen, setProfileOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)

  const pageTitle = useMemo(() => {
    if (pathname.startsWith('/admin/project-management') || pathname.startsWith('/admin/project-analysis')) {
      return 'Project Management'
    }
    if (routeTitles[pathname]) return routeTitles[pathname]
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length > 2) {
      const parentPath = `/${parts[0]}/${parts[1]}`
      if (routeTitles[parentPath]) return routeTitles[parentPath]
    }
    const last = parts[parts.length - 1] ?? 'dashboard'
    if (last.match(/^[a-z0-9-]+$/i) && last.length < 24) return titleCase(last)
    return 'Admin'
  }, [pathname])

  const showBack = shouldShowAdminBackButton(pathname)

  const handleLogout = () => {
    void logout()
    navigate('/auth/login')
  }

  const openProfileModal = () => {
    setNameDraft(user?.name ?? '')
    setProfileOpen(true)
  }

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      toast.error('Name is required')
      return
    }
    setSavingName(true)
    try {
      const { data } = await api.patch<{ user: { name: string } }>('/auth/me', { name: trimmed })
      patchUser({ name: data.user.name })
      toast.success('Display name updated')
      setProfileOpen(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

  return (
    <>
      <header
        className={cn(
          'cmd-bar employee-cmd-bar flex h-16 shrink-0 items-center gap-2 px-4 sm:gap-3 lg:px-5',
          portalAdmin && 'employee-cmd-bar--dual-portal',
        )}
      >
        <div className="employee-cmd-bar__decor" aria-hidden>
          <span className="employee-cmd-bar__facets employee-cmd-bar__facets--right" />
          <span className="employee-cmd-bar__grid employee-cmd-bar__grid--right" />
        </div>

        <div className="employee-cmd-bar__news">
          <CommandBarNewsMarquee className="w-full min-w-0" />
        </div>

        <div className="employee-cmd-bar__slashes" aria-hidden>
          <span className="employee-cmd-bar__slash employee-cmd-bar__slash--forest" />
          <span className="employee-cmd-bar__slash employee-cmd-bar__slash--mint" />
          <span className="employee-cmd-bar__slash-accent employee-cmd-bar__slash-accent--top" />
          <span className="employee-cmd-bar__slash-accent employee-cmd-bar__slash-accent--bottom" />
        </div>

        <div className="employee-cmd-bar__brand flex shrink-0 items-center gap-2.5 sm:gap-3">
          <Link
            to={ROUTES.DASHBOARD}
            className="employee-cmd-bar__logo-link inline-flex shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--neon-green)]"
            title="Dashboard"
            aria-label="Go to dashboard home"
          >
            <CompanyLogo className="employee-cmd-bar__logo h-10 w-10 shrink-0 sm:h-11 sm:w-11" alt="Epical Layouts" />
          </Link>

          {user ? (
            <div className="employee-cmd-bar__identity min-w-0">
              <p className="employee-cmd-bar__name truncate font-display font-extrabold">
                {user.name}
              </p>
              <p className="employee-cmd-bar__page-title truncate font-medium">
                {pageTitle}
              </p>
            </div>
          ) : (
            <div className="employee-cmd-bar__identity min-w-0">
              <p className="truncate font-display text-lg font-semibold tracking-tight text-[var(--text-primary)] lg:text-xl">
                {pageTitle}
              </p>
            </div>
          )}

          {showBack && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="cmd-bar-icon-btn shrink-0"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="employee-cmd-bar__rail min-w-0 flex-1" aria-hidden />

        <div className="employee-cmd-bar__tail flex shrink-0 items-center gap-1.5 sm:gap-2">
          <NotificationBell />

          <PortalToggle />

          <button
            type="button"
            onClick={openProfileModal}
            className="cmd-profile-btn inline-flex shrink-0 overflow-hidden rounded-full !ring-0"
            title="Edit display name"
            aria-label="Edit display name"
          >
            <Avatar
              name={user?.name ?? 'Admin'}
              src={user?.avatarUrl}
              size="sm"
              color="#266b1c"
              className="!ring-0"
            />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="cmd-logout-btn inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold sm:px-3"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Log out</span>
          </button>
        </div>
      </header>

      <Modal
        isOpen={profileOpen}
        onClose={() => {
          if (savingName) return
          setProfileOpen(false)
        }}
        title="Edit display name"
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-display-name" className="block text-sm font-medium text-ink">
              Name
            </label>
            <Input
              id="admin-display-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your display name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveName()
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setProfileOpen(false)}
              disabled={savingName}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveName()} disabled={savingName}>
              {savingName ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
