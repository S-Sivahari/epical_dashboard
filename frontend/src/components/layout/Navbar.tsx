import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore } from '@store/authStore'
import { useMediaQuery } from '@hooks/useMediaQuery'

function titleCase(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function Navbar() {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const isLg = useMediaQuery('(min-width: 1024px)')

  const title = useMemo(() => {
    if (pathname === '/admin') return 'Dashboard'
    const parts = pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] ?? 'dashboard'
    if (last.match(/^[a-z0-9-]+$/i) && last.length < 24) return titleCase(last)
    return 'HRMS'
  }, [pathname])

  return (
    <header
      className="fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/90 px-4 backdrop-blur lg:left-[260px]"
      style={{ paddingLeft: isLg ? undefined : '3.25rem' }}
    >
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-semibold text-ink">{title}</p>
        <p className="truncate text-xs text-muted">Signed in as {user?.email}</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-2 py-1.5 text-left text-sm transition-ui hover:bg-surface"
            >
              <Avatar name={user?.name ?? 'Admin'} size="sm" />
              <span className="hidden max-w-[120px] truncate font-medium text-ink sm:inline">
                {user?.name}
              </span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[200px] rounded-xl border border-border bg-white p-1 shadow-md"
              sideOffset={6}
              align="end"
            >
              <DropdownMenu.Item
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-surface"
                onSelect={() => navigate('/admin/settings')}
              >
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-danger outline-none hover:bg-red-50"
                onSelect={() => {
                  logout()
                  navigate('/auth/login')
                }}
              >
                Log out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
