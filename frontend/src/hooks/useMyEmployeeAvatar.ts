import { useEffect, useState } from 'react'
import { useAuthStore } from '@store/authStore'
import * as employeeService from '@services/employeeService'
import { getEmployeeAvatarUrl } from '@/utils/getAvatarUrl'

/** Uploaded profile photo or OAuth avatar for the logged-in employee. */
export function useMyEmployeeAvatar(): string | undefined {
  const user = useAuthStore((s) => s.user)
  const patchUser = useAuthStore((s) => s.patchUser)
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl)

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(undefined)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const emp = await employeeService.getMyEmployee()
        if (cancelled) return
        const url = getEmployeeAvatarUrl(emp) ?? user.avatarUrl
        setAvatarUrl(url)
        if (url && url !== user.avatarUrl) {
          patchUser({ avatarUrl: url })
        }
      } catch {
        if (!cancelled) setAvatarUrl(user.avatarUrl)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.avatarUrl, patchUser])

  return avatarUrl ?? user?.avatarUrl
}
