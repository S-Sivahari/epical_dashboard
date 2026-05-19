import { motion } from 'framer-motion'
import { Calendar, Building2, BadgeCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@components/employee/ui/avatar'
import { formatDate } from '@pages/employee/lib/utils'

export function ProfileCard({ employee }) {
  if (!employee) return null
  const initials = employee.name
    .split(' ')
    .map((n) => n[0])
    .join('')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-emerald-600 to-teal-600 p-6 text-white shadow-lg md:p-8"
    >
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/5" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar className="h-24 w-24 border-4 border-white/30 shadow-lg">
          <AvatarImage src={employee.avatarUrl ?? employee.avatar} alt={employee.name} />
          <AvatarFallback className="bg-white/20 text-2xl text-white">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">{employee.name}</h2>
          <p className="mt-1 text-emerald-100">ID: {employee.id}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm">
              <BadgeCheck className="h-4 w-4 shrink-0 opacity-80" />
              <span>{employee.designation}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 shrink-0 opacity-80" />
              <span>{employee.department}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 shrink-0 opacity-80" />
              <span>Joined {formatDate(employee.joinedAt ?? employee.joiningDate)}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
