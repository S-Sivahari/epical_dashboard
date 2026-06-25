import { useEffect, useState } from 'react'
import { useAuthStore } from '@store/authStore'
import * as employeeService from '@services/employeeService'
import { getEmployeeAvatarUrl } from '@/utils/getAvatarUrl'
import { buildEmployeeFullName } from '@/utils/employeeDisplayName'

/** Keep command-bar avatar and display name aligned with the canonical employee profile. */
export function useMyEmployeeAvatar(): string | undefined {
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
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

        const patch: { avatarUrl?: string; name?: string } = {}
        if (url && url !== user.avatarUrl) patch.avatarUrl = url
        // Only sync the employee full name when on the employee portal.
        // Admins manage their own display name separately via the admin profile.
        if (role === 'employee') {
          const nextName = buildEmployeeFullName(emp)
          if (nextName && nextName !== user.name) patch.name = nextName
        }
        if (Object.keys(patch).length > 0) patchUser(patch)
      } catch {
        if (!cancelled) setAvatarUrl(user.avatarUrl)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.avatarUrl, user?.name, role, patchUser])

  return avatarUrl ?? user?.avatarUrl
}
