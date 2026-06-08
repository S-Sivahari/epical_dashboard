import { getApiBaseUrl } from '@/config/apiBase'

/**
 * Avatar URL for an employee: uploaded photo endpoint, or OAuth avatarUrl fallback.
 * Uses the API base so img tags hit /api (Vite proxy in dev), not the Vite origin.
 */
export function getEmployeeAvatarUrl(
  employee: {
    id?: string
    avatarUrl?: string
    hasPhoto?: boolean
  },
  cacheBust?: string | number,
): string | undefined {
  if (employee?.hasPhoto && employee?.id) {
    const base = `${getApiBaseUrl()}/employees/${employee.id}/photo`
    return cacheBust != null ? `${base}?v=${cacheBust}` : base
  }

  if (employee?.avatarUrl) {
    return employee.avatarUrl
  }

  return undefined
}
