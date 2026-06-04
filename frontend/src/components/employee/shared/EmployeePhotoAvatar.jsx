import { Avatar, AvatarFallback } from '@components/employee/ui/avatar'
import { cn } from '@pages/employee/lib/utils'

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
      <AvatarFallback
        className={cn(
          'bg-white/20 font-semibold text-white',
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
