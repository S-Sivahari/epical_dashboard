const GRANT_KEY = 'epical:project-analysis-grant'

/** Time allowed between clicking the launch button and the new tab loading. */
const GRANT_TTL_MS = 60_000

/** In-memory only — survives SPA navigation but not a full page reload. */
let activeSession = false

/**
 * Called from the Timesheet "Project Analysis" button before opening a new tab.
 * Uses localStorage so the grant is visible to the newly opened tab.
 */
export function grantProjectAnalysisAccess(): void {
  localStorage.setItem(GRANT_KEY, String(Date.now()))
}

export function hasProjectAnalysisSession(): boolean {
  return activeSession
}

/**
 * Accept entry when this tab was opened from the launch button (one-time grant)
 * or when the user is already browsing inside Project Analysis in this tab.
 */
export function consumeProjectAnalysisAccess(): boolean {
  if (activeSession) {
    return true
  }

  const raw = localStorage.getItem(GRANT_KEY)
  if (!raw) {
    return false
  }

  const grantedAt = Number(raw)
  if (!Number.isFinite(grantedAt) || Date.now() - grantedAt > GRANT_TTL_MS) {
    localStorage.removeItem(GRANT_KEY)
    return false
  }

  localStorage.removeItem(GRANT_KEY)
  activeSession = true
  return true
}

export function clearProjectAnalysisSession(): void {
  activeSession = false
}

export function isProjectAnalysisPath(path: string): boolean {
  return path.startsWith('/admin/project-analysis')
}

/** Open Project Analysis in a new tab with a one-time launch grant. */
export function openProjectAnalysisTab(url: string): void {
  grantProjectAnalysisAccess()
  window.open(url, '_blank', 'noopener,noreferrer')
}
