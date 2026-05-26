import { Avatar, AvatarFallback } from '@components/employee/ui/avatar'

/** Initials-only avatar — profile photos are not fetched to avoid slow API calls. */
export function EmployeePhotoAvatar({ employeeId: _employeeId, name, className, fallbackClassName }) {
  const initials =
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2) ?? 'U'

  return (
    <Avatar className={className}>
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  )
}
