import { useCallback, useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
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

  return (
    <MetalRoutingPageShell className="min-h-0 flex-1">
      <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-6">
        <div className="metal-routing-dashboard metal-routing-cell-project-page">
          <header className="metal-routing-cell-project-top">
            <div className="metal-routing-cell-project-top__main">
              <div className="metal-routing-cell-project-hero">
                <span className="metal-routing-cell-project-hero__icon" aria-hidden>
                  <Layers className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h1 className="metal-routing-cell-project-hero__title">
                    {loading ? 'Loading…' : context?.project.projectName ?? 'Project'}
                  </h1>
                  <p className="metal-routing-cell-project-panel__desc">
                    {context?.project.clientName
                      ? `${context.project.clientName}${context.project.technologyNode ? ` · ${context.project.technologyNode}` : ''}`
                      : 'Project details'}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                    PDK Selection
                  </p>
                </div>
              </div>
            </div>
          </header>

          <section className="metal-routing-overview-card metal-routing-cell-project-panel">
            {loading ? (
              <p className="p-4 text-sm text-muted">Loading project…</p>
            ) : (
              <div className="space-y-5 p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="text-xs font-medium uppercase text-muted">Project</span>
                    <p className="mt-1 font-semibold text-ink">{context?.project.projectName}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium uppercase text-muted">Client</span>
                    <p className="mt-1 font-semibold text-ink">{context?.project.clientName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium uppercase text-muted">Technology</span>
                    <p className="mt-1 font-semibold text-ink">{context?.project.technologyNode || '—'}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface/40 p-4">
                  <label className="block text-sm font-medium text-ink">Assigned PDK module</label>
                  <p className="mt-1 text-sm text-muted">
                    Manage PDK module definitions from the global PDK Modules page on the projects dashboard.
                  </p>
                  <select
                    className="mt-3 h-10 w-full max-w-lg rounded-lg border border-border bg-white px-3 text-sm disabled:opacity-60"
                    value={context?.project.pdkModuleId ?? ''}
                    disabled={assigning}
                    onChange={(e) => void handleAssign(e.target.value)}
                  >
                    <option value="">— Not assigned —</option>
                    {modules.map((m) => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                  {assignedModule ? (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
                      <p className="font-semibold text-emerald-900">{assignedModule.name}</p>
                      <p className="text-emerald-800/80">
                        {assignedModule.technologyNode || 'No node'}
                        {assignedModule.notes ? ` · ${assignedModule.notes}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-emerald-800/70">
                        {assignedModule.metals.length} metal layer{assignedModule.metals.length === 1 ? '' : 's'} defined
                      </p>
                    </div>
                  ) : (
                    <p className={cn('mt-3 text-sm text-amber-800')}>
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
