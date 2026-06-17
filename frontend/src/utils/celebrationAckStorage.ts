const STORAGE_KEY = 'epical_leave_reaction_ack_v1'
const LEGACY_APPROVAL_KEY = 'epical_celebrated_leave_approvals_v1'
const MAX_STORED_IDS = 200

function readIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const legacyRaw = window.localStorage.getItem(LEGACY_APPROVAL_KEY)
      if (!legacyRaw) return []
      const legacyParsed = JSON.parse(legacyRaw)
      return Array.isArray(legacyParsed)
        ? legacyParsed.filter((id): id is string => typeof id === 'string')
        : []
    }
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

export function hasAcknowledgedLeaveReaction(notificationId: string): boolean {
  return readIds().includes(notificationId)
}

export function markLeaveReactionAcknowledged(notificationId: string) {
  const ids = readIds()
  if (ids.includes(notificationId)) return
  writeIds([...ids, notificationId])
}

/** @deprecated use hasAcknowledgedLeaveReaction */
export function hasCelebratedLeaveApproval(notificationId: string): boolean {
  return hasAcknowledgedLeaveReaction(notificationId)
}

/** @deprecated use markLeaveReactionAcknowledged */
export function markLeaveApprovalCelebrated(notificationId: string) {
  markLeaveReactionAcknowledged(notificationId)
}

export function clearLeaveReactionAckForTests() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_APPROVAL_KEY)
}

/** @deprecated */
export function clearCelebratedLeaveApprovalsForTests() {
  clearLeaveReactionAckForTests()
}
