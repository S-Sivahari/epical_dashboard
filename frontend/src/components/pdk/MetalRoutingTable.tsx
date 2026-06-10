import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@components/ui/Button'
import type { MetalRoutingMetal, MetalRoutingRoute } from '@/types/pdkMetalRouting'
import { cn } from '@/utils/cn'

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(4) : '—'
}

const thClass = 'border border-yellow-400 px-2 py-2'
const tdClass = 'border border-lime-500 px-2 py-2'

function HighlightSummaryRow({
  metal,
  route,
  variant,
}: {
  metal: MetalRoutingMetal
  route: MetalRoutingRoute
  variant: 'min' | 'max' | 'both'
}) {
  return (
    <tr
      className={cn(
        'bg-lime-400/70 font-medium text-black',
        (variant === 'min' || variant === 'both') && 'ring-2 ring-inset ring-amber-600',
        variant === 'max' && 'ring-2 ring-inset ring-orange-500',
      )}
    >
      <td className={tdClass}>
        {metal.metalType}
        {variant === 'min' || variant === 'both' ? (
          <span className="ml-1 rounded bg-amber-200 px-1 text-[10px]">MIN</span>
        ) : null}
        {variant === 'max' || variant === 'both' ? (
          <span className="ml-1 rounded bg-orange-200 px-1 text-[10px]">MAX Z</span>
        ) : null}
      </td>
      <td className={tdClass}>{metal.width}</td>
      <td className={tdClass}>{metal.length}</td>
      <td className={tdClass}>{fmt(metal.givenCurrentDensity)}</td>
      <td className={tdClass}>{fmt(metal.implementedCurrentMetalCapacity)}</td>
      <td className={cn(tdClass, 'bg-lime-300/80 text-center font-bold')}>
        {fmt(route.minimumMetalCurrentCapacity)}
      </td>
      <td className={tdClass}>{fmt(metal.routingMetalImpedance)}</td>
      <td className={cn(tdClass, 'bg-lime-300/80 text-center font-bold')}>
        {fmt(route.totalImpedance)}
      </td>
      <td className={cn(tdClass, 'w-10 px-1')} />
    </tr>
  )
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
  const minMetal = metals.find((m) => m._id === route.minCapacityMetalId)
  const maxMetal = metals.find((m) => m._id === route.highestImpedanceMetalId)
  const sameHighlightMetal =
    minMetal && maxMetal && minMetal._id === maxMetal._id ? minMetal : null

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

      <div className={cn('flex min-h-0 flex-col', fullScreen && 'flex-1')}>
        <div className={cn('overflow-auto', fullScreen ? 'min-h-0 shrink' : '')}>
          <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-yellow-300 text-[11px] font-bold uppercase text-black">
                <th className={thClass}>Metal Type</th>
                <th className={thClass}>Metal Width (µm)</th>
                <th className={thClass}>Metal Length (µm)</th>
                <th className={thClass}>Given Current Density (mA)</th>
                <th className={thClass}>Implemented Metal Current Capacity (mA)</th>
                <th className={thClass}>Minimum Metal Current Capacity (mA)</th>
                <th className={thClass}>Routing Metal Impedance (Ω)</th>
                <th className={thClass}>Total Impedance (Ω)</th>
                <th className={cn(thClass, 'w-10')} />
              </tr>
            </thead>
            <tbody>
              {metals.length === 0 ? (
                <tr className="bg-lime-400/60 text-black">
                  <td className={cn(tdClass, 'py-6 text-center text-muted')} colSpan={9}>
                    No metals yet. Click &quot;Add metal&quot; to enter metal type, width, and length.
                  </td>
                </tr>
              ) : (
                metals.map((metal, index) => (
                  <tr key={metal._id} className="bg-lime-400/70 font-medium text-black">
                    <td className={tdClass}>{metal.metalType}</td>
                    <td className={tdClass}>{metal.width}</td>
                    <td className={tdClass}>{metal.length}</td>
                    <td className={tdClass}>{fmt(metal.givenCurrentDensity)}</td>
                    <td className={tdClass}>{fmt(metal.implementedCurrentMetalCapacity)}</td>
                    {index === 0 ? (
                      <td
                        className={cn(tdClass, 'bg-lime-300/80 text-center font-bold align-middle')}
                        rowSpan={rowCount}
                      >
                        {fmt(route.minimumMetalCurrentCapacity)}
                      </td>
                    ) : null}
                    <td className={tdClass}>{fmt(metal.routingMetalImpedance)}</td>
                    {index === 0 ? (
                      <td
                        className={cn(tdClass, 'bg-lime-300/80 text-center font-bold align-middle')}
                        rowSpan={rowCount}
                      >
                        {fmt(route.totalImpedance)}
                      </td>
                    ) : null}
                    <td className={cn(tdClass, 'px-1')}>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="h-3.5 w-3.5 text-red-800" />}
                        onClick={() => onRemoveMetal(metal._id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {metals.length > 0 && (minMetal || maxMetal) ? (
          <div
            className={cn(
              'border-t border-border bg-white px-2 pb-2 pt-2',
              fullScreen && 'flex min-h-0 flex-1 flex-col justify-end',
            )}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                <tbody>
                  {sameHighlightMetal ? (
                    <HighlightSummaryRow metal={sameHighlightMetal} route={route} variant="both" />
                  ) : (
                    <>
                      {minMetal ? (
                        <HighlightSummaryRow metal={minMetal} route={route} variant="min" />
                      ) : null}
                      {maxMetal ? (
                        <HighlightSummaryRow metal={maxMetal} route={route} variant="max" />
                      ) : null}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
