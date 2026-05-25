import { useEffect, useState } from 'react'
import { Avatar } from '@components/ui/Avatar'
import { fetchEmployeePhoto } from '@services/uploadService'

export function EmployeeAvatar({
  employeeId,
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
  const [src, setSrc] = useState<string | undefined>()

  useEffect(() => {
    if (!employeeId) {
      setSrc(undefined)
      return
    }

    let objectUrl: string | null = null
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

  return <Avatar src={src} name={name} size={size} color={color} className={className} />
}
