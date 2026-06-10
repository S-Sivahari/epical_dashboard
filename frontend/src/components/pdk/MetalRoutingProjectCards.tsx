import { ExternalLink, FolderKanban } from 'lucide-react'
import { Button } from '@components/ui/Button'
import {
  MetalRoutingCardGridSkeleton,
  MetalRoutingEmptyState,
  MetalRoutingPill,
} from '@components/pdk/MetalRoutingSkeleton'
import type { DashboardProject, PdkModule } from '@/types/pdkMetalRouting'
import {
  cellRoutingDisplayStatus,
  dashboardStatusVariant,
  formatRelativeUpdated,
  getProjectCode,
} from '@/utils/metalRoutingProjectDisplay'
import { cn } from '@/utils/cn'

export function MetalRoutingProjectCards({
  variant,
  projects,
  startIndex = 0,
  loading,
  pdkModules = [],
  savingId = null,
  selectedProjectId,
  onSelectProject,
  onAssignPdk,
  onOpenRouting,
}: {
  variant: 'dashboard' | 'cell-routing'
  projects: DashboardProject[]
  startIndex?: number
  loading?: boolean
  pdkModules?: PdkModule[]
  savingId?: string | null
  selectedProjectId?: string | null
  onSelectProject?: (projectId: string) => void
  onAssignPdk?: (projectId: string, pdkModuleId: string) => void
  onOpenRouting?: (projectId: string) => void
}) {
  if (loading) {
    return <MetalRoutingCardGridSkeleton count={6} />
  }

  if (projects.length === 0) {
    return (
      <MetalRoutingEmptyState
        title="No projects found"
        description="Try adjusting your search or filter criteria."
      />
    )
  }

  return (
    <div className="metal-routing-project-grid">
      {projects.map((project, index) => {
        const globalIndex = startIndex + index
        const projectCode = getProjectCode(project, globalIndex)
        const isSelected = selectedProjectId === project.id
        const status =
          variant === 'cell-routing'
            ? cellRoutingDisplayStatus(project)
            : { label: project.status, variant: dashboardStatusVariant(project.status) }

        return (
          <article
            key={project.id}
            className={cn(
              'metal-routing-project-card',
              variant === 'dashboard' && onSelectProject && 'is-clickable',
              isSelected && 'is-selected',
            )}
            onClick={
              variant === 'dashboard' && onSelectProject
                ? () => onSelectProject(project.id)
                : undefined
            }
            onKeyDown={
              variant === 'dashboard' && onSelectProject
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectProject(project.id)
                    }
                  }
                : undefined
            }
            role={variant === 'dashboard' && onSelectProject ? 'button' : undefined}
            tabIndex={variant === 'dashboard' && onSelectProject ? 0 : undefined}
          >
            <div className="metal-routing-project-card__body">
              <span className="metal-routing-project-card__icon" aria-hidden>
                <FolderKanban className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{project.projectName}</p>
                <p className="truncate text-xs text-muted">{projectCode}</p>
                <p className="mt-1 truncate text-sm text-muted">{project.clientName}</p>
                <p className="truncate text-xs text-muted">{project.technologyNode}</p>
              </div>
              <MetalRoutingPill tone={status.variant as 'success' | 'warning' | 'neutral' | 'danger'}>
                {status.label}
              </MetalRoutingPill>
            </div>

            <div className="metal-routing-project-card__meta">
              {variant === 'dashboard' ? (
                <select
                  className="metal-routing-pdk-select w-full"
                  value={project.pdkModuleId ?? ''}
                  disabled={savingId === project.id || pdkModules.length === 0}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation()
                    onAssignPdk?.(project.id, e.target.value)
                  }}
                  aria-label={`Assign PDK for ${project.projectName}`}
                >
                  <option value="">— Not assigned —</option>
                  {pdkModules.map((mod) => (
                    <option key={mod._id} value={mod._id}>
                      {mod.name}
                    </option>
                  ))}
                </select>
              ) : project.pdkModuleName ? (
                <span className="metal-routing-assigned-pdk text-sm">{project.pdkModuleName}</span>
              ) : (
                <span className="metal-routing-unassigned-pdk text-sm">— Not assigned —</span>
              )}
            </div>

            <div className="metal-routing-project-card__footer">
              <span className="text-xs text-muted">
                Updated {formatRelativeUpdated(project.updatedAt)}
              </span>
              {variant === 'cell-routing' && onOpenRouting ? (
                <Button
                  type="button"
                  size="sm"
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  onClick={() => onOpenRouting(project.id)}
                >
                  Open Routing
                </Button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
