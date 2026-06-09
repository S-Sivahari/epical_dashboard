import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { Button } from '@components/ui/Button'
import { MetalRoutingTable } from '@components/pdk/MetalRoutingTable'
import { AddMetalModal } from '@components/pdk/AddMetalModal'
import type { MetalRoutingRoute, ProjectRoutingContext } from '@/types/pdkMetalRouting'
import {
  addMetalToRoute,
  downloadRouteExcel,
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

  const loadContext = useCallback(async () => {
    if (!projectId) return
    try {
      setContext(await fetchProjectContext(projectId))
    } catch {
      toast.error('Failed to load project')
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

  if (route) {
    return (
      <MetalRoutingPageShell fill className="!p-0">
        <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => setRoute(null)}
            >
              Back to route setup
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  void downloadRouteExcel(
                    route._id,
                    `metal-routing_${route.fromCell}_${route.toCell}.xlsx`.replace(/\s+/g, '_'),
                  ).then(() => toast.success('Exported'))
                }
              >
                Export Excel
              </Button>
            </div>
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

      <div className="mt-4 mb-6">
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

      {context?.routes?.length ? (
        <section className="rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Saved routes in this project</h2>
          </div>
          <ul className="divide-y divide-border">
            {context.routes.map((item) => (
              <li key={item._id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-surface/50"
                  onClick={() => {
                    setFilter({
                      fromCell: item.fromCell,
                      toCell: item.toCell,
                      fromSignal: item.fromSignal,
                      toSignal: item.toSignal,
                    })
                    void lookupRoute({
                      projectId,
                      fromCell: item.fromCell,
                      toCell: item.toCell,
                      fromSignal: item.fromSignal,
                      toSignal: item.toSignal,
                    }).then((r) => r && setRoute(r))
                  }}
                >
                  <span className="font-medium text-primary">
                    {item.fromCell} → {item.toCell} · {item.fromSignal} → {item.toSignal}
                  </span>
                  <span className="text-xs text-muted">{item.metals?.length ?? 0} metal(s)</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
