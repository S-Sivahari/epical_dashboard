const GRANT_KEY = 'epical:project-analysis-grant'
const SESSION_KEY = 'epical:project-analysis-session'

/** Time allowed between clicking the launch button and the new tab loading. */
const GRANT_TTL_MS = 60_000

/** In-memory mirror of sessionStorage — avoids re-reading storage on every check in one navigation. */
let activeSession = false

function readStoredSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function persistSession(): void {
  activeSession = true
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* private mode / storage blocked — in-memory only for this navigation */
  }
}

/**
 * Called from the Timesheet "Project Analysis" button before opening a new tab.
 * Uses localStorage so the grant is visible to the newly opened tab.
 */
export function grantProjectAnalysisAccess(): void {
  localStorage.setItem(GRANT_KEY, String(Date.now()))
}

export function hasProjectAnalysisSession(): boolean {
  return activeSession || readStoredSession()
}

export function ensureProjectAnalysisSession(): void {
  grantProjectAnalysisAccess()
  persistSession()
}

/**
 * Accept entry when this tab was opened from the launch button (one-time grant)
 * or when the user is already browsing Project Analysis in this tab (sessionStorage).
 */
export function consumeProjectAnalysisAccess(): boolean {
  if (activeSession || readStoredSession()) {
    persistSession()
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
  persistSession()
  return true
}

export function canAccessProjectAnalysis(role: string | null | undefined): boolean {
  if (role === 'admin' || role === 'employee') return true
  return consumeProjectAnalysisAccess()
}

export function clearProjectAnalysisSession(): void {
  activeSession = false
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function isProjectAnalysisPath(path: string): boolean {
  return (
    path.startsWith('/admin/project-management') ||
    path.startsWith('/admin/project-analysis') ||
    path.startsWith('/employee/project-analysis')
  )
}

/** Open Project Analysis in a new tab with a one-time launch grant. */
export function openProjectAnalysisTab(url: string): void {
  ensureProjectAnalysisSession()
  const opened = window.open(url, '_blank')
  if (!opened) {
    // Popup blocked — stay in this tab so Project Management still opens.
    window.location.assign(url)
  }
}
