import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@components/employee/ui/avatar'
import { cn } from '@pages/employee/lib/utils'
import { getEmployeePhotoUrl, invalidateEmployeePhotoCache } from '@services/uploadService'

/** Fetches the employee profile photo once per session (cached); falls back to initials. */
export function EmployeePhotoAvatar({
  employeeId,
  name,
  className,
  fallbackClassName,
  photoVersion = 0,
  fallbackSrc,
}) {
  const [photoSrc, setPhotoSrc] = useState(null)

  useEffect(() => {
    if (!employeeId) {
      setPhotoSrc(null)
      return
    }

    if (photoVersion > 0) {
      invalidateEmployeePhotoCache(employeeId)
    }

    let cancelled = false
    void getEmployeePhotoUrl(employeeId).then((url) => {
      if (!cancelled) setPhotoSrc(url)
    })

    return () => {
      cancelled = true
    }
  }, [employeeId, photoVersion])

  const initials =
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2) ?? 'U'

  const displaySrc = photoSrc || fallbackSrc

  return (
    <Avatar className={className}>
      {displaySrc ? <AvatarImage src={displaySrc} alt={name ?? 'Profile'} /> : null}
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
