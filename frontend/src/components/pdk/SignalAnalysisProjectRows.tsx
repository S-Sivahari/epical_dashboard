import type { CSSProperties } from 'react'
import { Activity, ChevronDown, ChevronRight, ChevronUp, Layers } from 'lucide-react'
import {
  MetalRoutingEmptyState,
  MetalRoutingPill,
} from '@components/pdk/MetalRoutingSkeleton'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import {
  cellRoutingDisplayStatus,
  displayProjectClientName,
  getProjectCode,
  isProjectPdkAssigned,
} from '@/utils/metalRoutingProjectDisplay'
import { metalRoutingListRowStyle } from '@/utils/metalRoutingCardTheme'
import { cn } from '@/utils/cn'

function projectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function SignalAnalysisProjectRows({
  projects,
  startIndex = 0,
  loading,
  hideTechnology,
  nameSortAsc = true,
  onToggleNameSort,
  onOpenRouting,
}: {
  projects: DashboardProject[]
  startIndex?: number
  loading?: boolean
  hideTechnology?: boolean
  nameSortAsc?: boolean
  onToggleNameSort?: () => void
  onOpenRouting: (projectId: string) => void
}) {
  if (loading) {
    return (
      <div className="signal-analysis-table__loading" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="signal-analysis-table__skeleton-row"
            style={{ '--row-i': i } as CSSProperties}
          />
        ))}
      </div>
    )
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
    <div className="signal-analysis-table">
      <div
        className={cn(
          'signal-analysis-table__head',
          hideTechnology && 'signal-analysis-table__head--no-tech',
        )}
        role="row"
      >
        <span className="signal-analysis-table__th signal-analysis-table__th--icon" aria-hidden />
        <span className="signal-analysis-table__th signal-analysis-table__th--name" role="columnheader">
          {onToggleNameSort ? (
            <button
              type="button"
              className="signal-analysis-table__sort-btn"
              onClick={onToggleNameSort}
              aria-label={`Sort by project name ${nameSortAsc ? 'ascending' : 'descending'}`}
            >
              <span>Project name</span>
              <span className="signal-analysis-table__sort-icon" aria-hidden>
                {nameSortAsc ? (
                  <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
              </span>
            </button>
          ) : (
            'Project name'
          )}
        </span>
        <span className="signal-analysis-table__th signal-analysis-table__th--code" role="columnheader">
          Code
        </span>
        {!hideTechnology ? (
          <span className="signal-analysis-table__th signal-analysis-table__th--node" role="columnheader">
            Technology
          </span>
        ) : null}
        <span className="signal-analysis-table__th signal-analysis-table__th--status" role="columnheader">
          Status
        </span>
        <span className="signal-analysis-table__th signal-analysis-table__th--assign" role="columnheader">
          PDK
        </span>
        <span className="signal-analysis-table__th signal-analysis-table__th--action" aria-hidden />
      </div>

      <div className="signal-analysis-table__body">
        {projects.map((project, index) => {
          const globalIndex = startIndex + index
          const projectCode = getProjectCode(project, globalIndex)
          const status = cellRoutingDisplayStatus(project)
          const clientLabel = displayProjectClientName(project.clientName)
          const initials = projectInitials(project.projectName)
          const cardSeed = project.id || project.projectName

          return (
            <button
              key={project.id}
              type="button"
              className={cn(
                'signal-analysis-table__row',
                hideTechnology && 'signal-analysis-table__row--no-tech',
              )}
              style={{
                ...metalRoutingListRowStyle(cardSeed),
                '--row-i': index,
              } as CSSProperties}
              onClick={() => onOpenRouting(project.id)}
            >
              <span className="signal-analysis-table__cell signal-analysis-table__cell--icon">
                <span className="signal-analysis-table__avatar" aria-hidden>
                  {initials}
                </span>
              </span>

              <span className="signal-analysis-table__cell signal-analysis-table__cell--name">
                <span className="signal-analysis-table__project-name">{project.projectName}</span>
                {clientLabel ? (
                  <span className="signal-analysis-table__client">{clientLabel}</span>
                ) : null}
              </span>

              <span className="signal-analysis-table__cell signal-analysis-table__cell--code">
                <span className="signal-analysis-table__code">{projectCode}</span>
              </span>

              {!hideTechnology ? (
                <span className="signal-analysis-table__cell signal-analysis-table__cell--node">
                  <span className="signal-analysis-table__node">{project.technologyNode || '—'}</span>
                </span>
              ) : null}

              <span className="signal-analysis-table__cell signal-analysis-table__cell--status">
                <MetalRoutingPill
                  className="signal-analysis-table__status-pill"
                  tone={status.variant as 'success' | 'warning' | 'neutral' | 'danger'}
                >
                  {status.label === 'Active' ? (
                    <>
                      <Activity className="h-3 w-3" aria-hidden />
                      {status.label}
                    </>
                  ) : (
                    status.label
                  )}
                </MetalRoutingPill>
              </span>

              <span className="signal-analysis-table__cell signal-analysis-table__cell--assign">
                {isProjectPdkAssigned(project) && project.pdkModuleName ? (
                  <span
                    className="signal-analysis-table__pdk"
                    title={project.pdkModuleName}
                  >
                    <Layers className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="signal-analysis-table__pdk-name">{project.pdkModuleName}</span>
                  </span>
                ) : (
                  <span className="signal-analysis-table__unassigned">Unassigned</span>
                )}
              </span>

              <span className="signal-analysis-table__cell signal-analysis-table__cell--action">
                <ChevronRight className="signal-analysis-table__chevron" aria-hidden />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
