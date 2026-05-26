import { Menu, User, ChevronDown } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/employee/ui/dropdown-menu'
import { NotificationDropdown } from '@components/employee/shared/NotificationDropdown'
import { EmployeePhotoAvatar } from '@components/employee/shared/EmployeePhotoAvatar'
import { useAuthStore } from '@store/authStore'
import { useUIStore } from '@store/employee/uiStore'
import { getEmployeePageHeader } from '@constants/employeeNav'

export function Navbar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { setSidebarMobileOpen } = useUIStore()
  const { title, showWelcomeSubtitle } = getEmployeePageHeader(pathname)
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 shadow-sm md:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setSidebarMobileOpen(true)}
          className="rounded-xl p-2 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden sm:block">
          <h1 className="font-heading text-lg font-bold text-foreground">{title}</h1>
          {showWelcomeSubtitle && (
            <p className="text-xs text-muted">Welcome back, {firstName}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NotificationDropdown />
        <Link
          to="/employee/profile"
          className={`hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors sm:flex ${
            pathname === '/employee/profile'
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-white text-foreground hover:bg-slate-50'
          }`}
        >
          <User className="h-4 w-4" />
          Profile
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-2 py-1.5 text-left text-sm hover:bg-slate-50"
            >
              <EmployeePhotoAvatar employeeId={user?.id} name={user?.name ?? 'Employee'} className="h-8 w-8" />
              <span className="hidden max-w-[120px] truncate font-medium text-foreground md:inline">
                {user?.name}
              </span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate('/employee/profile')}>
              <User className="h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-danger focus:text-danger"
              onClick={() => {
                logout()
                navigate('/auth/login')
              }}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
