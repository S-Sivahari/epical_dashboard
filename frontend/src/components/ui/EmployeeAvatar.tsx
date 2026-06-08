import { Avatar } from '@components/ui/Avatar'

/** Initials-only avatar — profile photos are not fetched to avoid slow N+1 API calls. */
export function EmployeeAvatar({
  employeeId: _employeeId,
  name,
  size = 'md',
  color,
  className,
}: {
  employeeId?: string
  name: string
  size?: 'sm' | 'md' | 'lg'
  color?: string
  className?: string
}) {
  return <Avatar name={name} size={size} color={color} className={className} />
}
