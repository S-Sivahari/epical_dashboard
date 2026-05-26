import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@components/employee/ui/avatar'
import { fetchEmployeePhoto } from '@services/uploadService'

export function EmployeePhotoAvatar({ employeeId, name, className, fallbackClassName }) {
  const [src, setSrc] = useState(undefined)

  const initials =
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2) ?? 'U'

  useEffect(() => {
    if (!employeeId) {
      setSrc(undefined)
      return
    }

    let objectUrl = null
    let cancelled = false

    void (async () => {
      const blob = await fetchEmployeePhoto(employeeId)
      if (cancelled) return
      if (blob) {
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      } else {
        setSrc(undefined)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [employeeId])

  return (
    <Avatar className={className}>
      <AvatarImage src={src} alt={name} />
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  )
}
