import { Menu, User, Settings, LogOut } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@components/employee/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/employee/ui/dropdown-menu'
import { NotificationDropdown } from '@components/employee/shared/NotificationDropdown'
import { useAuthStore } from '@store/authStore'
import { useUIStore } from '@store/employee/uiStore'
import { company } from '@pages/employee/data/mockData'

export function Navbar() {
  const user = useAuthStore((s) => s.user)
  const { setSidebarMobileOpen, setLogoutModalOpen } = useUIStore()
  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('') ?? 'U'

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
          <h1 className="font-heading text-lg font-bold text-foreground">{company.portalTitle}</h1>
          <p className="text-xs text-muted">Welcome back, {user?.name?.split(' ')[0]}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NotificationDropdown />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatarUrl} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline">{user?.name}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2">
              <User className="h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-danger focus:text-danger"
              onClick={() => setLogoutModalOpen(true)}
            >
              <LogOut className="h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
