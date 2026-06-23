import { useCallback, useEffect, useState } from 'react'
import { Layers, ChevronDown } from 'lucide-react'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { showPortalError, showPortalSuccess } from '@/utils/portalNotice'
import type { PdkModule, ProjectRoutingContext } from '@/types/pdkMetalRouting'
import {
  assignPdkToProject,
  fetchPdkModules,
  fetchProjectContext,
} from '@services/pdkMetalRoutingService'
import { useParams } from 'react-router-dom'
import { cn } from '@/utils/cn'

export function ProjectPdkSelectionPage() {
  const { projectId = '' } = useParams()
  const [context, setContext] = useState<ProjectRoutingContext | null>(null)
  const [modules, setModules] = useState<PdkModule[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [notice, setNotice] = useState<TopNotice | null>(null)
  const dismissNotice = useCallback(() => setNotice(null), [])

  const load = async () => {
    setLoading(true)
    try {
      const [mods, ctx] = await Promise.all([fetchPdkModules(), fetchProjectContext(projectId)])
      setModules(mods)
      setContext(ctx)
    } catch {
      showPortalError(setNotice, 'Failed to load project', 'Refresh the page or try again later.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) void load()
  }, [projectId])

  const handleAssign = async (pdkModuleId: string) => {
    setAssigning(true)
    try {
      await assignPdkToProject(projectId, pdkModuleId || null)
      showPortalSuccess(setNotice, 'PDK assigned', 'PDK module assigned to project.')
      setContext(await fetchProjectContext(projectId))
    } catch {
      showPortalError(setNotice, 'Assignment failed', 'Failed to assign PDK module.')
    } finally {
      setAssigning(false)
    }
  }

  const assignedModule = modules.find((m) => m._id === context?.project.pdkModuleId)
  const clientLine = [
    context?.project.clientName,
    context?.project.technologyNode,
  ].filter(Boolean).join(' · ')

  return (
    <MetalRoutingPageShell className="metal-routing-pdk-selection-shell min-h-0 flex-1">
      <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
      <div className="metal-routing-pdk-selection-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="metal-routing-pdk-selection metal-routing-dashboard metal-routing-cell-project-page">
          <header className="metal-routing-pdk-selection__header metal-routing-cell-project-top">
            <div className="metal-routing-cell-project-hero">
              <span className="metal-routing-cell-project-hero__icon" aria-hidden>
                <Layers className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="metal-routing-pdk-selection__eyebrow">PDK Selection</p>
                <h1 className="metal-routing-pdk-selection__title">
                  {loading ? 'Loading…' : context?.project.projectName ?? 'Project'}
                </h1>
                {clientLine ? (
                  <p className="metal-routing-pdk-selection__subtitle">{clientLine}</p>
                ) : null}
              </div>
            </div>
          </header>

          <section className="metal-routing-overview-card metal-routing-cell-project-panel metal-routing-pdk-selection__panel">
            {loading ? (
              <p className="metal-routing-pdk-selection__loading">Loading project…</p>
            ) : (
              <div className="metal-routing-pdk-selection__body">
                <div className="metal-routing-pdk-selection__meta">
                  <div className="metal-routing-pdk-selection__field">
                    <span className="metal-routing-pdk-selection__label">Project</span>
                    <p className="metal-routing-pdk-selection__value">{context?.project.projectName}</p>
                  </div>
                  <div className="metal-routing-pdk-selection__field">
                    <span className="metal-routing-pdk-selection__label">Client</span>
                    <p className="metal-routing-pdk-selection__value">{context?.project.clientName || '—'}</p>
                  </div>
                  <div className="metal-routing-pdk-selection__field">
                    <span className="metal-routing-pdk-selection__label">Technology</span>
                    <p className="metal-routing-pdk-selection__value">{context?.project.technologyNode || '—'}</p>
                  </div>
                </div>

                <div className="metal-routing-pdk-selection__assign">
                  <label className="metal-routing-pdk-selection__section-title" htmlFor="pdk-module-select">
                    Assigned PDK module
                  </label>
                  <p className="metal-routing-pdk-selection__hint">
                    Manage PDK module definitions from the global PDK Modules page on the projects dashboard.
                  </p>
                  <div className="metal-routing-pdk-selection__select-wrap">
                    <select
                      id="pdk-module-select"
                      className="metal-routing-pdk-selection__select"
                      value={context?.project.pdkModuleId ?? ''}
                      disabled={assigning}
                      onChange={(e) => void handleAssign(e.target.value)}
                    >
                      <option value="">— Not assigned —</option>
                      {modules.map((m) => (
                        <option key={m._id} value={m._id}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="metal-routing-pdk-selection__select-icon" aria-hidden />
                  </div>

                  {assignedModule ? (
                    <div className="metal-routing-pdk-selection__module-card">
                      <p className="metal-routing-pdk-selection__module-name">{assignedModule.name}</p>
                      <p className="metal-routing-pdk-selection__module-meta">
                        {assignedModule.technologyNode || 'No node'}
                        {assignedModule.notes ? ` · ${assignedModule.notes}` : ''}
                      </p>
                      <p className="metal-routing-pdk-selection__module-meta">
                        {assignedModule.metals.length} metal layer{assignedModule.metals.length === 1 ? '' : 's'} defined
                      </p>
                    </div>
                  ) : (
                    <p className={cn('metal-routing-pdk-selection__empty')}>
                      No PDK assigned yet. Select a module to enable signal analysis and metal calculations.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </MetalRoutingPageShell>
  )
}
