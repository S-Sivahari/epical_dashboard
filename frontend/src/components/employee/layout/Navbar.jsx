import { Menu, User, ChevronDown } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/90 backdrop-blur px-4 shadow-sm md:px-6">
      <div className="flex min-w-0 items-center gap-4 overflow-hidden">
        <button
          type="button"
          onClick={() => setSidebarMobileOpen(true)}
          className="rounded-xl p-2 hover:bg-surface transition-ui lg:hidden shrink-0"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-black" />
        </button>
        <div className="hidden sm:block min-w-0 overflow-hidden">
          <h1 className="font-display text-2xl font-bold text-black truncate">{title}</h1>
          {showWelcomeSubtitle && (
            <p className="text-xs text-muted font-medium">Welcome back, {firstName}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <NotificationDropdown />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-2 py-1.5 text-left text-sm transition-ui hover:bg-surface"
            >
              <EmployeePhotoAvatar employeeId={user?.id} name={user?.name ?? 'Employee'} className="h-8 w-8" />
              <span className="hidden max-w-[100px] truncate font-medium text-ink md:inline">
                {user?.name}
              </span>
              <ChevronDown className="h-4 w-4 text-black" />
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
                void logout()
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
