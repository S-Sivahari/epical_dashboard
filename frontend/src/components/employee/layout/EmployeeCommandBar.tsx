import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { CompanyLogo } from '@components/auth/CompanyLogo'
import { Avatar } from '@components/ui/Avatar'
import { NotificationBell } from '@components/layout/NotificationBell'
import { useAuthStore } from '@store/authStore'
import {
  getEmployeePageTitle,
  shouldShowEmployeeBackButton,
} from '@constants/employeeNavigation'

export function EmployeeCommandBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const pageTitle = useMemo(() => getEmployeePageTitle(pathname), [pathname])
  const showBack = shouldShowEmployeeBackButton(pathname)

  const handleLogout = () => {
    void logout()
    navigate('/auth/login')
  }

  return (
    <header className="cmd-bar flex h-[4.25rem] shrink-0 items-center gap-3 px-4 lg:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CompanyLogo className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" alt="Epical Layouts" />

        {user ? (
          <div className="min-w-0 shrink-0">
            <p className="truncate font-display text-base font-extrabold text-[#1a4712] sm:text-lg">
              {user.name}
            </p>
            <p className="truncate text-xs font-medium text-slate-600 sm:text-sm">{pageTitle}</p>
          </div>
        ) : (
          <div className="min-w-0 shrink-0">
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

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <NotificationBell />

        <Avatar
          name={user?.name ?? 'Employee'}
          src={user?.avatarUrl}
          size="sm"
          color="#266b1c"
          className="cmd-profile-btn !ring-0"
        />

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
