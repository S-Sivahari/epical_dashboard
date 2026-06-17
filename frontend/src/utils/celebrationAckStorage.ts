const STORAGE_KEY = 'epical_celebrated_leave_approvals_v1'
const MAX_STORED_IDS = 200

function readIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeIds(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-MAX_STORED_IDS)))
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function hasCelebratedLeaveApproval(notificationId: string): boolean {
  return readIds().includes(notificationId)
}

export function markLeaveApprovalCelebrated(notificationId: string) {
  const ids = readIds()
  if (ids.includes(notificationId)) return
  writeIds([...ids, notificationId])
}

export function clearCelebratedLeaveApprovalsForTests() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
