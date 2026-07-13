import { useEffect, useState } from 'react'
import { useAuthStore } from '@store/authStore'
import * as employeeService from '@services/employeeService'
import { getEmployeeAvatarUrl } from '@/utils/getAvatarUrl'
import { getEmployeeFirstName, resolveEmployeeDisplayName } from '@/utils/employeeDisplayName'

/** Command-bar avatar + employee display name from the employee profile. */
export function useMyEmployeeAvatar(): {
  avatarUrl?: string
  firstName: string
  fullName: string
} {
  const user = useAuthStore((s) => s.user)
  const patchUser = useAuthStore((s) => s.patchUser)
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl)
  const [firstName, setFirstName] = useState(() => getEmployeeFirstName(undefined, user?.name))
  const [fullName, setFullName] = useState(() =>
    resolveEmployeeDisplayName(undefined, user?.name),
  )

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(undefined)
      setFirstName('')
      setFullName('')
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const emp = await employeeService.getMyEmployee()
        if (cancelled) return
        const url = getEmployeeAvatarUrl(emp) ?? user.avatarUrl
        setAvatarUrl(url)
        setFirstName(getEmployeeFirstName(emp, user.name))
        setFullName(resolveEmployeeDisplayName(emp, user.name))

        const patch: { avatarUrl?: string } = {}
        if (url && url !== user.avatarUrl) patch.avatarUrl = url
        if (Object.keys(patch).length > 0) patchUser(patch)
      } catch {
        if (!cancelled) {
          setAvatarUrl(user.avatarUrl)
          setFirstName(getEmployeeFirstName(undefined, user.name))
          setFullName(resolveEmployeeDisplayName(undefined, user.name))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.name, user?.avatarUrl, patchUser])

  const resolvedFirstName = firstName || getEmployeeFirstName(undefined, user?.name) || 'Employee'
  const resolvedFullName =
    fullName || resolveEmployeeDisplayName(undefined, user?.name) || resolvedFirstName

  return {
    avatarUrl: avatarUrl ?? user?.avatarUrl,
    firstName: resolvedFirstName,
    fullName: resolvedFullName,
  }
}
