import { useNavigate } from 'react-router-dom'
import { ClipboardList, FileText, Newspaper, UserPlus } from 'lucide-react'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'

const quickActions = [
  { label: 'Add Employee', icon: UserPlus, route: ROUTES.EMPLOYEE_ADD },
  { label: 'Review Leaves', icon: ClipboardList, route: ROUTES.LEAVES },
  { label: 'Document Requests', icon: FileText, route: ROUTES.DOCUMENTS },
  { label: 'Manage News', icon: Newspaper, route: ROUTES.NEWS },
] as const

export function DashboardQuickActionsSidebar({ className }: { className?: string }) {
  const navigate = useNavigate()

  return (
    <aside className={cn('dashboard-actions-sidebar', className)} aria-label="Quick actions">
      <p className="dashboard-actions-sidebar-title">Quick Actions</p>
      <div className="dashboard-actions-sidebar-list">
        {quickActions.map(({ label, icon: Icon, route }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(route)}
            className="dashboard-action-sidebar-btn"
          >
            <span className="dashboard-action-sidebar-icon">
              <Icon className="h-6 w-6" strokeWidth={2} />
            </span>
            <span className="dashboard-action-sidebar-label">{label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
