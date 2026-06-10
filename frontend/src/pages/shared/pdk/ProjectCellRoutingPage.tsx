import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { toast } from 'sonner'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { Button } from '@components/ui/Button'
import { MetalRoutingTable } from '@components/pdk/MetalRoutingTable'
import { AddMetalModal } from '@components/pdk/AddMetalModal'
import { MetalRoutingExcelActions } from '@components/pdk/MetalRoutingExcelActions'
import type { MetalRoutingRoute, ProjectRoutingContext, SavedRouteSummary } from '@/types/pdkMetalRouting'
import type { MetalRoutingImportResult } from '@services/pdkMetalRoutingService'
import {
  addMetalToRoute,
  fetchProjectContext,
  lookupRoute,
  removeMetalFromRoute,
  resolveRoute,
} from '@services/pdkMetalRoutingService'

export function ProjectCellRoutingPage({ basePath }: { basePath: string }) {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [context, setContext] = useState<ProjectRoutingContext | null>(null)
  const [filter, setFilter] = useState({ fromCell: '', toCell: '', fromSignal: '', toSignal: '' })
  const [route, setRoute] = useState<MetalRoutingRoute | null>(null)
  const [loading, setLoading] = useState(false)
  const [addMetalOpen, setAddMetalOpen] = useState(false)
  const [addingMetal, setAddingMetal] = useState(false)

  const loadContext = useCallback(async (): Promise<ProjectRoutingContext | null> => {
    if (!projectId) return null
    try {
      const fresh = await fetchProjectContext(projectId)
      setContext(fresh)
      return fresh
    } catch {
      toast.error('Failed to load project')
      return null
    }
  }, [projectId])

  useEffect(() => {
    void loadContext()
  }, [loadContext])

  const routingFilter = {
    projectId,
    fromCell: filter.fromCell,
    toCell: filter.toCell,
    fromSignal: filter.fromSignal,
    toSignal: filter.toSignal,
  }

  const handleOpenRoute = async () => {
    if (!filter.fromCell || !filter.toCell || !filter.fromSignal || !filter.toSignal) {
      toast.error('All four routing values are required as a unique set')
      return
    }
    if (!context?.pdkModule) {
      toast.error('Assign a PDK module to this project from the Dashboard first')
      return
    }
    setLoading(true)
    try {
      const existing = await lookupRoute(routingFilter)
      const opened = existing ?? (await resolveRoute(routingFilter))
      setRoute(opened)
      toast.success(existing ? 'Route loaded' : 'New route created for this combination')
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(message ?? 'Failed to open route')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMetal = async (payload: { metalType: string; width: number; length: number }) => {
    setAddingMetal(true)
    try {
      const result = await addMetalToRoute(routingFilter, payload)
      setRoute(result.route)
      setAddMetalOpen(false)
      toast.success('Metal row added and saved')
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(message ?? 'Failed to add metal')
    } finally {
      setAddingMetal(false)
    }
  }

  const handleRemoveMetal = async (metalId: string) => {
    if (!window.confirm('Remove this metal row?')) return
    try {
      setRoute(await removeMetalFromRoute(routingFilter, metalId))
      toast.success('Metal removed')
    } catch {
      toast.error('Failed to remove metal')
    }
  }

  const cellNames = context?.cellNames ?? []
  const pdkAssigned = Boolean(context?.pdkModule)

  const applySavedRoutesToContext = (savedRoutes: SavedRouteSummary[]) => {
    setContext((prev) => (prev ? { ...prev, routes: savedRoutes } : prev))
  }

  const handleProjectImport = async (result: MetalRoutingImportResult) => {
    console.log('[metal-routing-import] refreshing project view', {
      projectId,
      routesImported: result.routesImported,
      savedRoutesFromApi: result.savedRoutes.length,
      parseDiagnostics: result.parseDiagnostics,
    })

    applySavedRoutesToContext(result.savedRoutes)

    const fresh = await loadContext()
    const visibleRoutes =
      fresh?.routes?.length && fresh.routes.length > 0 ? fresh.routes : result.savedRoutes
    applySavedRoutesToContext(visibleRoutes)

    console.log('[metal-routing-import] visible saved routes', {
      fromImportResponse: result.savedRoutes.length,
      fromContextRefresh: fresh?.routes?.length ?? 0,
      displayed: visibleRoutes.length,
    })

    if (result.routesImported > 0 && visibleRoutes.length === 0) {
      toast.error('Import saved routes but they are not visible for this project. Check backend logs.')
    }
  }

  const handleOpenSavedRoute = async (item: SavedRouteSummary) => {
    setLoading(true)
    try {
      const opened = await lookupRoute({
        projectId,
        fromCell: item.fromCell,
        toCell: item.toCell,
        fromSignal: item.fromSignal,
        toSignal: item.toSignal,
      })
      if (!opened) {
        toast.error('Saved route could not be loaded')
        return
      }
      setFilter({
        fromCell: item.fromCell,
        toCell: item.toCell,
        fromSignal: item.fromSignal,
        toSignal: item.toSignal,
      })
      setRoute(opened)
    } catch {
      toast.error('Failed to open saved route')
    } finally {
      setLoading(false)
    }
  }

  const refreshAfterImport = async (importedRoute?: MetalRoutingRoute) => {
    await loadContext()
    if (!importedRoute) return

    const nextFilter = {
      projectId,
      fromCell: importedRoute.fromCell,
      toCell: importedRoute.toCell,
      fromSignal: importedRoute.fromSignal,
      toSignal: importedRoute.toSignal,
    }
    setFilter({
      fromCell: nextFilter.fromCell,
      toCell: nextFilter.toCell,
      fromSignal: nextFilter.fromSignal,
      toSignal: nextFilter.toSignal,
    })
    try {
      const refreshed = await lookupRoute(nextFilter)
      setRoute(refreshed ?? importedRoute)
    } catch {
      setRoute(importedRoute)
    }
  }

  if (route) {
    return (
      <MetalRoutingPageShell fill className="!p-0">
        <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => {
                setRoute(null)
                void loadContext()
              }}
            >
              Back to route setup
            </Button>
            <MetalRoutingExcelActions
              projectId={projectId}
              routeId={route._id}
              pdkAssigned={pdkAssigned}
              exportFilename={`metal-routing_${route.fromCell}_${route.toCell}.xlsx`.replace(/\s+/g, '_')}
              onImported={(result) => {
                const match = result.routes.find(
                  (r) =>
                    r.fromCell === route.fromCell &&
                    r.toCell === route.toCell &&
                    r.fromSignal === route.fromSignal &&
                    r.toSignal === route.toSignal,
                )
                void refreshAfterImport(match ?? result.routes[0])
              }}
            />
          </div>
          <MetalRoutingTable
            fullScreen
            route={route}
            onAddMetal={() => setAddMetalOpen(true)}
            onRemoveMetal={(id) => void handleRemoveMetal(id)}
          />
        </div>
        <AddMetalModal
          isOpen={addMetalOpen}
          onClose={() => setAddMetalOpen(false)}
          projectId={projectId}
          pdkModule={context?.pdkModule ?? null}
          adding={addingMetal}
          onAdd={handleAddMetal}
        />
      </MetalRoutingPageShell>
    )
  }

  return (
    <MetalRoutingPageShell>
      <Button
        size="sm"
        variant="ghost"
        icon={<ArrowLeft className="h-4 w-4" />}
        onClick={() => navigate(`${basePath}/cell-routing`)}
      >
        Back to projects
      </Button>

      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-ink">{context?.project.projectName ?? 'Cell Routing'}</h1>
          <p className="mt-1 text-sm text-muted">
            PDK: {context?.pdkModule?.name ?? 'Not assigned'}
            {context?.pdkModule ? null : (
              <>
                {' '}
                —{' '}
                <button type="button" className="text-primary underline" onClick={() => navigate(`${basePath}/dashboard`)}>
                  assign from Dashboard
                </button>
              </>
            )}
          </p>
        </div>
        <div className="w-full shrink-0 lg:w-auto lg:max-w-xl">
          <MetalRoutingExcelActions
            projectId={projectId}
            pdkAssigned={pdkAssigned}
            exportFilename={`${context?.project.projectName ?? 'project'}_metal-routing.xlsx`.replace(/\s+/g, '_')}
            onImported={(result) => void handleProjectImport(result)}
          />
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-ink">Open route (unique 4-value set within project)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">From Cell</span>
            <input
              list="project-cells"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filter.fromCell}
              onChange={(e) => setFilter((f) => ({ ...f, fromCell: e.target.value }))}
            />
            <datalist id="project-cells">
              {cellNames.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">To Cell</span>
            <input
              list="to-cells"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filter.toCell}
              onChange={(e) => setFilter((f) => ({ ...f, toCell: e.target.value }))}
              placeholder="Select from list or type"
            />
            <datalist id="to-cells">
              {cellNames.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">From Signal</span>
            <input
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filter.fromSignal}
              onChange={(e) => setFilter((f) => ({ ...f, fromSignal: e.target.value }))}
              placeholder="Type signal name"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">To Signal</span>
            <input
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filter.toSignal}
              onChange={(e) => setFilter((f) => ({ ...f, toSignal: e.target.value }))}
              placeholder="Type signal name"
            />
          </label>
        </div>
        <div className="mt-3">
          <Button loading={loading} icon={<Search className="h-4 w-4" />} onClick={() => void handleOpenRoute()}>
            Open route
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Saved routes in this project</h2>
          <p className="mt-0.5 text-xs text-muted">
            Imported and manually saved routes appear here. Click a route to view calculations.
          </p>
        </div>
        {context?.routes?.length ? (
          <ul className="divide-y divide-border">
            {context.routes.map((item) => (
              <li key={item._id}>
                <button
                  type="button"
                  disabled={loading}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-surface/50 disabled:opacity-60"
                  onClick={() => void handleOpenSavedRoute(item)}
                >
                  <span className="font-medium text-primary">
                    {item.fromCell} → {item.toCell} · {item.fromSignal} → {item.toSignal}
                  </span>
                  <span className="text-xs text-muted">{item.metalCount} metal(s)</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No saved routes yet. Import an Excel file or open a route and add metals to create one.
          </p>
        )}
      </section>

      <AddMetalModal
        isOpen={addMetalOpen}
        onClose={() => setAddMetalOpen(false)}
        projectId={projectId}
        pdkModule={context?.pdkModule ?? null}
        adding={addingMetal}
        onAdd={handleAddMetal}
      />
    </MetalRoutingPageShell>
  )
}
