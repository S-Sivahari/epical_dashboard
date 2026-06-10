import type { DashboardProject } from '@/types/pdkMetalRouting'

export function formatRelativeUpdated(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Date.now() - date.getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getProjectCode(project: DashboardProject, index: number): string {
  return project.projectCode ?? `PRJ-${String(index + 1).padStart(3, '0')}`
}

export function dashboardStatusVariant(status: string): 'success' | 'warning' | 'neutral' | 'danger' {
  const normalized = status.toLowerCase()
  if (normalized === 'active') return 'success'
  if (normalized === 'completed') return 'neutral'
  if (normalized === 'cancelled' || normalized === 'rejected') return 'danger'
  return 'warning'
}

export function cellRoutingDisplayStatus(
  project: DashboardProject,
): { label: string; variant: 'success' | 'warning' } {
  if (!project.pdkModuleId) {
    return { label: 'Unassigned', variant: 'warning' }
  }
  const normalized = project.status.toLowerCase()
  if (normalized === 'active') return { label: 'Active', variant: 'success' }
  return { label: project.status || 'Active', variant: 'success' }
}
