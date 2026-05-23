import { motion } from 'framer-motion'
import { BookOpen, Clock, FileText, CalendarOff } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ProfileCard } from '@components/employee/shared/ProfileCard'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { LeaveCard } from '@components/employee/shared/LeaveCard'
import { AnnouncementBanner } from '@components/employee/shared/AnnouncementBanner'
import { AssignedProjectsSection } from '@components/employee/shared/AssignedProjectsSection'
import { CalendarWidget } from '@components/employee/shared/CalendarWidget'
import { Progress } from '@components/employee/ui/progress'
import { useAuthStore } from '@store/authStore'
import { announcements, leaveBalances, leaveChartData, holidays } from '@pages/employee/data/mockData'
import { formatDate } from '@pages/employee/lib/utils'
import { NotificationAlerts } from '@components/employee/NotificationAlerts'

const weeklyTarget = 40
const weeklyCompleted = 39.5
const productivity = Math.round((weeklyCompleted / weeklyTarget) * 100)

export default function Dashboard() {
  const employee = useAuthStore((s) => s.user)

  return (
    <div className="space-y-6">
      <NotificationAlerts />
      <AnnouncementBanner announcements={announcements} />
      <ProfileCard employee={employee} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard title="Completed Courses" value="2" icon={BookOpen} trend="+1 this quarter" />
        <KPIStatCard title="Monthly Hours" value="156h" icon={Clock} trend="On track" />
        <KPIStatCard title="Pending Leave" value="1" icon={CalendarOff} />
        <KPIStatCard title="Pending Documents" value="1" icon={FileText} />
      </div>

      <AssignedProjectsSection />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-1">
          <h3 className="font-heading text-lg font-semibold">Working Time</h3>
          <p className="mt-1 text-sm text-muted">Weekly progress</p>
          <div className="mt-6">
            <div className="flex items-end justify-between">
              <span className="font-heading text-3xl font-bold text-primary">
                {weeklyCompleted}h
              </span>
              <span className="text-sm text-muted">/ {weeklyTarget}h target</span>
            </div>
            <Progress value={productivity} className="mt-4 h-3" />
            <p className="mt-2 text-sm text-muted">
              Productivity: <span className="font-semibold text-primary">{productivity}%</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <h3 className="font-heading text-lg font-semibold">Leave Analytics</h3>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leaveChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {leaveChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {leaveBalances.map((lb) => (
                <LeaveCard
                  key={lb.key}
                  type={lb.type}
                  used={lb.used}
                  total={lb.total}
                  color={lb.color}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CalendarWidget holidays={holidays} highlightDates={holidays.map((h) => h.date)} />
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-heading text-lg font-semibold">Upcoming Holidays</h3>
          <ul className="mt-4 space-y-3">
            {holidays.map((h) => (
              <li
                key={h.date}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <span className="font-medium">{h.name}</span>
                <span className="text-sm text-muted">{formatDate(h.date)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
