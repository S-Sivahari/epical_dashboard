import { Link } from 'react-router-dom'
import { EmployeeAvatar } from '@components/ui/EmployeeAvatar'
import { Badge } from '@components/ui/Badge'
import type { Employee } from '@/types'
import { stringToHueColor } from '@/utils/stringColor'

export function EmployeeCard({ employee }: { employee: Employee }) {
  const name = `${employee.firstName} ${employee.lastName}`
  const color = stringToHueColor(employee.id)

  return (
    <Link
      to={`/admin/employees/${employee.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm transition-ui hover:border-primary/40"
    >
      <EmployeeAvatar employeeId={employee.id} name={name} color={color} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{name}</p>
        <p className="truncate text-sm text-muted">
          {employee.role}
        </p>
      </div>
      <Badge
        variant={employee.status === 'Active' ? 'success' : 'neutral'}
      >
        {employee.status}
      </Badge>
    </Link>
  )
}
