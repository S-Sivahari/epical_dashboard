import { useCallback, useEffect, useState } from 'react'
import { Download, Layers, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { PkaModulesPanel } from '@components/pka/PkaModulesPanel'
import { MetalRoutingTable } from '@components/pka/MetalRoutingTable'
import { AddMetalModal } from '@components/pka/AddMetalModal'
import type { MetalRoutingContext, MetalRoutingRoute, PkaModule } from '@/types/pkaMetalRouting'
import {
  addMetalToRoute,
  downloadRouteExcel,
  fetchMetalRoutingContext,
  fetchPkaModules,
  lookupRoute,
  removeMetalFromRoute,
  resolveRoute,
} from '@services/pkaMetalRoutingService'

export function MetalRoutingPage({ isAdmin: _isAdmin }: { isAdmin: boolean }) {
  const [context, setContext] = useState<MetalRoutingContext | null>(null)
  const [filter, setFilter] = useState({
    fromCell: '',
    toCell: '',
    fromSignal: '',
    toSignal: '',
  })
  const [route, setRoute] = useState<MetalRoutingRoute | null>(null)
  const [pkaModules, setPkaModules] = useState<PkaModule[]>([])
  const [loading, setLoading] = useState(false)
  const [pkaPanelOpen, setPkaPanelOpen] = useState(false)
  const [addMetalOpen, setAddMetalOpen] = useState(false)
  const [addingMetal, setAddingMetal] = useState(false)

  const loadContext = useCallback(async () => {
    try {
      const [ctx, modules] = await Promise.all([fetchMetalRoutingContext(), fetchPkaModules()])
      setContext(ctx)
      setPkaModules(modules)
    } catch {
      toast.error('Failed to load routing context')
    }
  }, [])

  useEffect(() => {
    void loadContext()
  }, [loadContext])

  const handleOpenRoute = async () => {
    if (!filter.fromCell || !filter.toCell || !filter.fromSignal || !filter.toSignal) {
      toast.error('All four values are required as a unique set')
      return
    }
    setLoading(true)
    try {
      const existing = await lookupRoute(filter)
      const opened = existing ?? (await resolveRoute(filter))
      setRoute(opened)
      if (existing) {
        toast.success('Loaded existing route for this combination')
      } else {
        toast.success('Created new route for this unique combination')
      }
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

  const handleLoadSavedRoute = (r: {
    fromCell: string
    toCell: string
    fromSignal: string
    toSignal: string
  }) => {
    setFilter({
      fromCell: r.fromCell,
      toCell: r.toCell,
      fromSignal: r.fromSignal,
      toSignal: r.toSignal,
    })
    void (async () => {
      setLoading(true)
      try {
        const existing = await lookupRoute(r)
        if (existing) setRoute(existing)
      } finally {
        setLoading(false)
      }
    })()
  }

  const handleAddMetal = async (payload: {
    metalType: string
    width: number
    length: number
    pkaModuleId: string
  }) => {
    if (!route) return
    setAddingMetal(true)
    try {
      const result = await addMetalToRoute(filter, payload)
      setRoute(result.route)
      setAddMetalOpen(false)
      await loadContext()
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
    if (!route || !window.confirm('Remove this metal row?')) return
    try {
      const updated = await removeMetalFromRoute(filter, metalId)
      setRoute(updated)
      toast.success('Metal row removed')
    } catch {
      toast.error('Failed to remove metal')
    }
  }

  const handleExport = async () => {
    if (!route) return
    try {
      await downloadRouteExcel(
        route._id,
        `metal-routing_${route.fromCell}_${route.toCell}.xlsx`.replace(/\s+/g, '_'),
      )
      toast.success('Excel exported')
    } catch {
      toast.error('Export failed')
    }
  }

  const cellOptions = context?.cellNames ?? []
  const signalOptions = context?.signals ?? []

  return (
    <PageWrapper scrollable>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Metal Routing Analysis</h1>
          <p className="mt-1 text-sm text-muted">
            The combination of From Cell, To Cell, From Signal, and To Signal is unique — one route per set.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Layers className="h-4 w-4" />}
            onClick={() => setPkaPanelOpen(true)}
          >
            PKA Modules
          </Button>
          {route ? (
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => void handleExport()}>
              Export Excel
            </Button>
          ) : null}
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-ink">Open route (unique 4-value set)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">From Cell</span>
            <input
              list="from-cells"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filter.fromCell}
              onChange={(e) => setFilter((f) => ({ ...f, fromCell: e.target.value }))}
              placeholder="Select or type cell"
            />
            <datalist id="from-cells">
              {cellOptions.map((c) => (
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
              placeholder="Select or type cell"
            />
            <datalist id="to-cells">
              {cellOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">From Signal</span>
            <input
              list="from-signals"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filter.fromSignal}
              onChange={(e) => setFilter((f) => ({ ...f, fromSignal: e.target.value }))}
              placeholder="Select or type signal"
            />
            <datalist id="from-signals">
              {signalOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">To Signal</span>
            <input
              list="to-signals"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filter.toSignal}
              onChange={(e) => setFilter((f) => ({ ...f, toSignal: e.target.value }))}
              placeholder="Select or type signal"
            />
            <datalist id="to-signals">
              {signalOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="mt-3">
          <Button loading={loading} icon={<Search className="h-4 w-4" />} onClick={() => void handleOpenRoute()}>
            Open route
          </Button>
        </div>
      </section>

      {route ? (
        <MetalRoutingTable
          route={route}
          onAddMetal={() => setAddMetalOpen(true)}
          onRemoveMetal={(id) => void handleRemoveMetal(id)}
        />
      ) : null}

      {context?.routes?.length ? (
        <section className="mt-8 rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Saved routes</h2>
          </div>
          <ul className="divide-y divide-border">
            {context.routes.map((item) => (
              <li key={item._id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-surface/50"
                  onClick={() => handleLoadSavedRoute(item)}
                >
                  <span className="font-medium text-primary">
                    {item.fromCell} → {item.toCell} · {item.fromSignal} → {item.toSignal}
                  </span>
                  <span className="text-xs text-muted">
                    {item.metals?.length ?? 0} metal(s)
                    {item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleString()}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PkaModulesPanel isOpen={pkaPanelOpen} onClose={() => setPkaPanelOpen(false)} />

      <AddMetalModal
        isOpen={addMetalOpen}
        onClose={() => setAddMetalOpen(false)}
        pkaModules={pkaModules}
        adding={addingMetal}
        onAdd={handleAddMetal}
      />
    </PageWrapper>
  )
}
