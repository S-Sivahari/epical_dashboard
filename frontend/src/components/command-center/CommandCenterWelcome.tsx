import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, FileText, Newspaper, UserPlus } from 'lucide-react'
import { ROUTES } from '@constants/routes'

const quickActions = [
  { label: 'Add Employee', icon: UserPlus, route: ROUTES.EMPLOYEE_ADD },
  { label: 'Review Leaves', icon: ClipboardList, route: ROUTES.LEAVES },
  { label: 'Document Requests', icon: FileText, route: ROUTES.DOCUMENTS },
  { label: 'Manage News', icon: Newspaper, route: ROUTES.NEWS },
] as const

export function CommandCenterWelcome() {
  const navigate = useNavigate()

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="dashboard-quick-actions-bar shrink-0"
    >
      <div className="dashboard-quick-actions-grid">
        {quickActions.map(({ label, icon: Icon, route }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(route)}
            className="dashboard-quick-action-glass"
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </motion.section>
  )
}
