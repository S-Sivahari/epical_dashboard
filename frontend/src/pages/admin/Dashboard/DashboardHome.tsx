import { Link } from 'react-router-dom'
import {
  Briefcase,
  ClipboardList,
  FileText,
  Users,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { HoursBarChart } from '@components/charts/BarChart'
import { KPICard } from '@components/charts/KPICard'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore } from '@store/authStore'
import { useLeaves } from '@hooks/useLeaves'
import { formatDateTime } from '@/utils/formatDate'

const quickActionClass =
  'inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-3 text-center text-sm font-medium text-ink transition-ui hover:bg-surface'

const weeklyHours = [
  { name: 'Mon', hours: 6.5 },
  { name: 'Tue', hours: 7.2 },
  { name: 'Wed', hours: 8.1 },
  { name: 'Thu', hours: 7.4 },
  { name: 'Fri', hours: 6.0 },
]

const activity = [
  { id: '1', type: 'Leave', text: 'Rahul Verma requested annual leave', at: new Date().toISOString() },
  { id: '2', type: 'Document', text: 'New document uploaded for review', at: new Date().toISOString() },
  { id: '3', type: 'News', text: 'Quarterly town hall published', at: new Date().toISOString() },
]

export function DashboardHome() {
  const user = useAuthStore((s) => s.user)
  const { leaves } = useLeaves()
  
  // Calculate real-time statistics
  const pendingLeavesCount = leaves.filter((l) => l.status === 'Pending').length

  return (
    <PageWrapper>
      <PageHeader
        title="Dashboard"
        subtitle="Operational snapshot across people, leaves, and work."
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard' }]} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-surface/70 p-5 shadow-sm lg:col-span-2"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={user?.name ?? 'Admin'} size="lg" />
              <div>
                <p className="font-display text-lg font-semibold text-ink">Welcome, {user?.name}</p>
                <p className="text-sm text-muted">
                  {user?.designation} · {user?.department} · Joined {user?.joinedAt}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/admin/employees/add" className={quickActionClass}>
              Add Employee
            </Link>
            <Link to="/admin/leaves" className={quickActionClass}>
              Review Leaves
            </Link>
            <Link to="/admin/documents" className={quickActionClass}>
              Approve Documents
            </Link>
            <Link to="/admin/news" className={quickActionClass}>
              Manage News
            </Link>
          </div>
        </motion.section>
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-border bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-semibold text-ink">Today</p>
          <p className="mt-2 text-sm text-muted">You have 3 approvals pending and 1 document awaiting review.</p>
        </motion.section>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Total Employees" value={128} trend={{ direction: 'up', label: '4.2% vs last month' }} icon={Users} />
        <KPICard title="Pending Leaves" value={pendingLeavesCount} trend={{ direction: pendingLeavesCount > 3 ? 'up' : 'down', label: 'Real-time updates' }} icon={ClipboardList} color="#f59e0b" />
        <KPICard title="Active Projects" value={14} trend={{ direction: 'up', label: '2 new' }} icon={Briefcase} color="#3b82f6" />
        <KPICard title="Pending Documents" value={6} icon={FileText} color="#64748b" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm lg:col-span-2">
          <p className="font-display text-sm font-semibold text-ink">Weekly project hours</p>
          <HoursBarChart data={weeklyHours} />
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="mb-4 border-b border-border pb-4">
          <h2 className="font-display text-lg font-semibold text-ink">Activity</h2>
          <p className="mt-1 text-sm text-muted">Latest system events</p>
        </div>
        <ul className="space-y-3">
          {activity.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface/40 px-3 py-2">
              <div>
                <Badge variant="info" className="mb-1">
                  {a.type}
                </Badge>
                <p className="text-sm text-ink">{a.text}</p>
              </div>
              <span className="text-xs text-muted">{formatDateTime(a.at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </PageWrapper>
  )
}
