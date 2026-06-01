import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, FileText, Newspaper, UserPlus } from 'lucide-react'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore } from '@store/authStore'
import { ROUTES } from '@constants/routes'
import { formatDate } from '@/utils/formatDate'

const quickActions = [
  { label: 'Add Employee', icon: UserPlus, route: ROUTES.EMPLOYEE_ADD },
  { label: 'Review Leaves', icon: ClipboardList, route: ROUTES.LEAVES },
  { label: 'Document Requests', icon: FileText, route: ROUTES.DOCUMENTS },
  { label: 'Manage News', icon: Newspaper, route: ROUTES.NEWS },
] as const

export function CommandCenterWelcome() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  if (!user) return null

  const firstName = user.name?.split(' ')[0] ?? 'Admin'
  const roleLabel = user.designation || user.role

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-dash-card shrink-0 p-3 sm:p-3.5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={user.name} src={user.avatarUrl} size="lg" className="h-11 w-11 shrink-0 text-sm" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-semibold text-[var(--text-primary)] sm:text-lg">
              Welcome back, {firstName}!
            </h1>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {roleLabel}
              {user.joinedAt ? (
                <>
                  {' '}
                  · Joined {formatDate(user.joinedAt, 'yyyy-MM-dd')}
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:max-w-[640px] lg:flex-1">
          {quickActions.map(({ label, icon: Icon, route }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(route)}
              className="crewiq-quick-link admin-dash-action-btn !h-9 !text-xs"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
