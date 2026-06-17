import { ChevronRight, ExternalLink, FolderKanban } from 'lucide-react'
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
  displayProjectClientName,
  getProjectCode,
} from '@/utils/metalRoutingProjectDisplay'
import { metalRoutingCardStyle } from '@/utils/metalRoutingCardTheme'
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
  hideTechnology,
}: {
  variant: 'dashboard' | 'cell-routing'
  projects: DashboardProject[]
  startIndex?: number
  loading?: boolean
  pdkModules?: PdkModule[]
  savingId?: string | null
  selectedProjectId?: string | null
  hideTechnology?: boolean
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
        const cardSeed = project.id || project.projectName
        const clientLabel = displayProjectClientName(project.clientName)

        return (
          <article
            key={project.id}
            className={cn(
              'metal-routing-project-card metal-routing-project-card--colorful',
              variant === 'dashboard' && onSelectProject && 'is-clickable',
              isSelected && 'is-selected',
            )}
            style={metalRoutingCardStyle(cardSeed)}
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
            <span className="metal-routing-pdk-card__accent" aria-hidden />

            <div className="metal-routing-project-card__header">
              <span className="metal-routing-project-card__icon" aria-hidden>
                <FolderKanban className="h-4 w-4" />
              </span>
              <MetalRoutingPill tone={status.variant as 'success' | 'warning' | 'neutral' | 'danger'}>
                {status.label}
              </MetalRoutingPill>
            </div>

            <div className="metal-routing-project-card__content">
              <p className="metal-routing-project-card__title truncate">{project.projectName}</p>
              <p className="metal-routing-project-card__code truncate">{projectCode}</p>
              {clientLabel ? (
                <p className="truncate text-sm text-muted">{clientLabel}</p>
              ) : null}
              {!hideTechnology ? (
                <p className="truncate text-xs text-muted">{project.technologyNode}</p>
              ) : null}
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
                <span className="metal-routing-assigned-pdk text-sm font-medium">{project.pdkModuleName}</span>
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
                  Open
                </Button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function MetalRoutingProjectListRows({
  variant = 'cell-routing',
  projects,
  startIndex = 0,
  loading,
  onOpenRouting,
  onSelectProject,
  pdkModules = [],
  savingId = null,
  selectedProjectId,
  onAssignPdk,
  hideTechnology,
}: {
  variant?: 'cell-routing' | 'dashboard'
  projects: DashboardProject[]
  startIndex?: number
  loading?: boolean
  hideTechnology?: boolean
  onOpenRouting?: (projectId: string) => void
  onSelectProject?: (projectId: string) => void
  pdkModules?: PdkModule[]
  savingId?: string | null
  selectedProjectId?: string | null
  onAssignPdk?: (projectId: string, pdkModuleId: string) => void
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

  const isSimpleList = variant === 'cell-routing'

  return (
    <div className={cn('metal-routing-pdk-list', isSimpleList && 'metal-routing-pdk-list--simple')}>
      {projects.map((project, index) => {
        const globalIndex = startIndex + index
        const projectCode = getProjectCode(project, globalIndex)
        const status =
          variant === 'cell-routing'
            ? cellRoutingDisplayStatus(project)
            : { label: project.status, variant: dashboardStatusVariant(project.status) }
        const cardSeed = project.id || project.projectName
        const isSelected = variant === 'dashboard' && selectedProjectId === project.id
        const clientLabel = displayProjectClientName(project.clientName)
        const metaParts = [projectCode]
        if (clientLabel) metaParts.push(clientLabel)
        if (isSimpleList && project.pdkModuleName) metaParts.push(project.pdkModuleName)

        return (
          <button
            key={project.id}
            type="button"
            className={cn(
              'metal-routing-pdk-list-row',
              isSimpleList
                ? 'metal-routing-pdk-list-row--simple'
                : 'metal-routing-pdk-list-row--colorful',
              isSelected && 'is-selected',
            )}
            onClick={() => {
              if (variant === 'dashboard') onSelectProject?.(project.id)
              else onOpenRouting?.(project.id)
            }}
            style={isSimpleList ? undefined : metalRoutingCardStyle(cardSeed)}
          >
            {!isSimpleList ? <span className="metal-routing-pdk-list-row__accent" aria-hidden /> : null}
            <span
              className={cn(
                'metal-routing-pdk-card__icon',
                isSimpleList && 'metal-routing-pdk-card__icon--compact',
              )}
              aria-hidden
            >
              <FolderKanban className={isSimpleList ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </span>
            <div className={cn('min-w-0 flex-1 text-left', isSimpleList && 'metal-routing-pdk-list-row__content')}>
              <p className={cn('font-semibold text-ink break-words', isSimpleList && 'metal-routing-pdk-list-row__name')}>
                {project.projectName}
              </p>
              <p className={cn('text-muted', isSimpleList ? 'metal-routing-pdk-list-row__meta' : 'text-xs')}>
                {metaParts.join(' · ')}
              </p>
              {!isSimpleList ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {!hideTechnology ? (
                    <span className="metal-routing-meta-chip metal-routing-meta-chip--node">
                      {project.technologyNode}
                    </span>
                  ) : null}
                  {project.pdkModuleName ? (
                    <span className="metal-routing-meta-chip metal-routing-meta-chip--metals">
                      {project.pdkModuleName}
                    </span>
                  ) : (
                    <span className="metal-routing-meta-chip metal-routing-meta-chip--na">Unassigned</span>
                  )}
                  <MetalRoutingPill tone={status.variant as 'success' | 'warning' | 'neutral' | 'danger'}>
                    {status.label}
                  </MetalRoutingPill>
                </div>
              ) : null}
              {variant === 'dashboard' ? (
                <select
                  className="metal-routing-pdk-select mt-2 w-full max-w-full"
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
              ) : null}
              {!isSimpleList ? (
                <p className="mt-1 text-xs text-muted">
                  Updated {formatRelativeUpdated(project.updatedAt)}
                </p>
              ) : null}
            </div>
            {isSimpleList ? (
              <MetalRoutingPill
                className="metal-routing-pdk-list-row__status"
                tone={status.variant as 'success' | 'warning' | 'neutral' | 'danger'}
              >
                {status.label}
              </MetalRoutingPill>
            ) : null}
            <ChevronRight
              className={cn(
                'shrink-0 text-muted',
                isSimpleList ? 'metal-routing-pdk-list-row__chevron h-4 w-4' : 'h-4 w-4',
              )}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}
