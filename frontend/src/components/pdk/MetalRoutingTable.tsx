import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@components/ui/Button'
import type { MetalRoutingRoute } from '@/types/pdkMetalRouting'
import { cn } from '@/utils/cn'

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(4) : '—'
}

export function MetalRoutingTable({
  route,
  onAddMetal,
  onRemoveMetal,
  fullScreen,
}: {
  route: MetalRoutingRoute
  onAddMetal: () => void
  onRemoveMetal: (metalId: string) => void
  fullScreen?: boolean
}) {
  const metals = route.metals
  const rowCount = Math.max(metals.length, 1)

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden border border-border bg-white shadow-sm',
        fullScreen ? 'min-h-0 flex-1 rounded-lg' : 'rounded-xl',
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="grid flex-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-xs font-medium uppercase text-muted">From Cell</span>
            <p className="font-semibold text-ink">{route.fromCell}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-muted">To Cell</span>
            <p className="font-semibold text-ink">{route.toCell}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-muted">From Signal</span>
            <p className="font-semibold text-ink">{route.fromSignal}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-muted">To Signal</span>
            <p className="font-semibold text-ink">{route.toSignal}</p>
          </div>
        </div>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={onAddMetal}>
          Add metal
        </Button>
      </div>

      <div className={cn('overflow-auto', fullScreen && 'min-h-0 flex-1')}>
        <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-yellow-300 text-[11px] font-bold uppercase text-black">
              <th className="border border-yellow-400 px-2 py-2">Metal Type</th>
              <th className="border border-yellow-400 px-2 py-2">Metal Width (µm)</th>
              <th className="border border-yellow-400 px-2 py-2">Metal Length (µm)</th>
              <th className="border border-yellow-400 px-2 py-2">Given Current Density (mA)</th>
              <th className="border border-yellow-400 px-2 py-2">Implemented Metal Current Capacity (mA)</th>
              <th className="border border-yellow-400 px-2 py-2">Minimum Metal Current Capacity (mA)</th>
              <th className="border border-yellow-400 px-2 py-2">Routing Metal Impedance (Ω)</th>
              <th className="border border-yellow-400 px-2 py-2">Total Impedance (Ω)</th>
              <th className="border border-yellow-400 w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {metals.length === 0 ? (
              <tr className="bg-lime-400/60 text-black">
                <td className="border border-lime-500 px-2 py-6 text-center text-muted" colSpan={9}>
                  No metals yet. Click &quot;Add metal&quot; to enter metal type, width, and length.
                </td>
              </tr>
            ) : (
              metals.map((metal, index) => {
                const isMin = metal._id === route.minCapacityMetalId
                const isMaxZ = metal._id === route.highestImpedanceMetalId

                return (
                  <tr
                    key={metal._id}
                    className={cn(
                      'bg-lime-400/70 font-medium text-black',
                      (isMin || isMaxZ) && 'ring-2 ring-inset ring-amber-600',
                    )}
                  >
                    <td className="border border-lime-500 px-2 py-2">
                      {metal.metalType}
                      {isMin ? <span className="ml-1 rounded bg-amber-200 px-1 text-[10px]">MIN</span> : null}
                      {isMaxZ ? <span className="ml-1 rounded bg-orange-200 px-1 text-[10px]">MAX Z</span> : null}
                    </td>
                    <td className="border border-lime-500 px-2 py-2">{metal.width}</td>
                    <td className="border border-lime-500 px-2 py-2">{metal.length}</td>
                    <td className="border border-lime-500 px-2 py-2">{fmt(metal.givenCurrentDensity)}</td>
                    <td className="border border-lime-500 px-2 py-2">{fmt(metal.implementedCurrentMetalCapacity)}</td>
                    {index === 0 ? (
                      <td className="border border-lime-500 bg-lime-300/80 px-2 py-2 text-center font-bold align-middle" rowSpan={rowCount}>
                        {fmt(route.minimumMetalCurrentCapacity)}
                      </td>
                    ) : null}
                    <td className="border border-lime-500 px-2 py-2">{fmt(metal.routingMetalImpedance)}</td>
                    {index === 0 ? (
                      <td className="border border-lime-500 bg-lime-300/80 px-2 py-2 text-center font-bold align-middle" rowSpan={rowCount}>
                        {fmt(route.totalImpedance)}
                      </td>
                    ) : null}
                    <td className="border border-lime-500 px-1 py-2">
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-800" />} onClick={() => onRemoveMetal(metal._id)} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
