import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { CompanyLogo } from '@components/auth/CompanyLogo'
import { EmployeePhotoAvatar } from '@components/employee/shared/EmployeePhotoAvatar'
import { NotificationBell } from '@components/layout/NotificationBell'
import { PortalToggle } from '@components/layout/PortalToggle'
import { CommandBarNewsMarquee } from '@components/layout/CommandBarNewsMarquee'
import { useAuthStore } from '@store/authStore'
import { useMyEmployeeAvatar } from '@hooks/useMyEmployeeAvatar'
import { cn } from '@/utils/cn'
import {
  getEmployeePageTitle,
  shouldShowEmployeeBackButton,
} from '@constants/employeeNavigation'
import { DashboardActiveTimer } from '@components/employee/shared/DashboardActiveTimer'

export function EmployeeCommandBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const portalAdmin = useAuthStore((s) => s.portalAdmin)
  const logout = useAuthStore((s) => s.logout)
  const avatarUrl = useMyEmployeeAvatar()

  const pageTitle = useMemo(() => getEmployeePageTitle(pathname), [pathname])
  const showBack = shouldShowEmployeeBackButton(pathname)

  const handleLogout = () => {
    void logout()
    navigate('/auth/login')
  }

  return (
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
          to="/employee"
          className="employee-cmd-bar__logo-link inline-flex shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--neon-green)]"
          title="Dashboard"
          aria-label="Go to dashboard"
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
        <DashboardActiveTimer variant="commandBar" />

        <NotificationBell />

        <PortalToggle />

        <Link
          to="/employee/profile"
          className="cmd-profile-btn inline-flex shrink-0 overflow-hidden rounded-full"
          title="My profile"
          aria-label="Go to my profile"
        >
          <EmployeePhotoAvatar
            employeeId={user?.id}
            name={user?.name ?? 'Employee'}
            fallbackSrc={avatarUrl ?? user?.avatarUrl}
            className="h-8 w-8"
            fallbackClassName="bg-[#266b1c] text-xs text-white"
          />
        </Link>

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
  )
}
