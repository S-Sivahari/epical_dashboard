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
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-dash-card shrink-0 p-3 sm:p-3.5"
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
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
    </motion.section>
  )
}
