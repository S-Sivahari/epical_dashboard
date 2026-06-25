import { useEffect, useState } from 'react'
import { useAuthStore } from '@store/authStore'
import * as employeeService from '@services/employeeService'
import { getEmployeeAvatarUrl } from '@/utils/getAvatarUrl'
import { getEmployeeFirstName } from '@/utils/employeeDisplayName'

/** Command-bar avatar + stable first-name label from the employee profile. */
export function useMyEmployeeAvatar(): { avatarUrl?: string; firstName: string } {
  const user = useAuthStore((s) => s.user)
  const patchUser = useAuthStore((s) => s.patchUser)
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl)
  const [firstName, setFirstName] = useState(() => getEmployeeFirstName(undefined, user?.name))

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(undefined)
      setFirstName('')
      return
    }

    setFirstName(getEmployeeFirstName(undefined, user.name))

    let cancelled = false
    void (async () => {
      try {
        const emp = await employeeService.getMyEmployee()
        if (cancelled) return
        const url = getEmployeeAvatarUrl(emp) ?? user.avatarUrl
        setAvatarUrl(url)
        setFirstName(getEmployeeFirstName(emp, user.name))

        const patch: { avatarUrl?: string } = {}
        if (url && url !== user.avatarUrl) patch.avatarUrl = url
        if (Object.keys(patch).length > 0) patchUser(patch)
      } catch {
        if (!cancelled) {
          setAvatarUrl(user.avatarUrl)
          setFirstName(getEmployeeFirstName(undefined, user.name))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.name, user?.avatarUrl, patchUser])

  return {
    avatarUrl: avatarUrl ?? user?.avatarUrl,
    firstName: firstName || getEmployeeFirstName(undefined, user?.name) || 'Employee',
  }
}
