import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@components/ui/Button'
import type { MetalConnectionType, MetalEntry, MetalRoutingRoute } from '@/types/pdkMetalRouting'
import { cn } from '@/utils/cn'

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(4) : '—'
}

function isCapacityBelowSchematic(
  metal: MetalEntry,
  routeSchematic?: number,
): boolean {
  const schematic = routeSchematic ?? metal.givenCurrentDensity
  if (!Number.isFinite(schematic) || schematic <= 0 || metal.width <= 0) return false
  const implementedDensity = metal.implementedCurrentMetalCapacity / metal.width
  return implementedDensity < schematic
}

const thClass = 'border border-yellow-400 px-2 py-2'
const tdClass = 'border border-lime-500 px-2 py-2'

function ConnectionIcon({ type }: { type?: MetalConnectionType }) {
  const isParallel = type === 'parallel'
  return (
    <span
      className={cn(
        'ml-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase leading-none',
        isParallel ? 'bg-violet-200 text-violet-900' : 'bg-sky-200 text-sky-900',
      )}
      title={isParallel ? 'Parallel' : 'Series'}
      aria-label={isParallel ? 'Parallel connection' : 'Series connection'}
    >
      {isParallel ? 'p' : 's'}
    </span>
  )
}

function FlagBadge({ label, tone }: { label: string; tone: 'min' | 'max' }) {
  return (
    <span
      className={cn(
        'ml-1 rounded px-1 text-[10px] font-bold uppercase tracking-wide',
        tone === 'min' ? 'bg-amber-200 text-amber-900' : 'bg-orange-200 text-orange-900',
      )}
    >
      {label}
    </span>
  )
}

export function MetalRoutingTable({
  route,
  onAddMetal,
  onEditMetal,
  onRemoveMetal,
  fullScreen,
}: {
  route: MetalRoutingRoute
  onAddMetal: () => void
  onEditMetal: (metal: MetalEntry) => void
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
            <span className="text-xs font-medium uppercase text-muted">Signal</span>
            <p className="font-semibold text-ink">{route.signal}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-muted">From Cell</span>
            <p className="font-semibold text-ink">{route.fromCell}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-muted">To Cell</span>
            <p className="font-semibold text-ink">{route.toCell}</p>
          </div>
          {route.schematicCurrentDensity != null ? (
            <div>
              <span className="text-xs font-medium uppercase text-muted">Schematic J</span>
              <p className="font-semibold text-ink">{fmt(route.schematicCurrentDensity)} mA/µm</p>
            </div>
          ) : null}
        </div>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={onAddMetal}>
          Add metal
        </Button>
      </div>

      <div className={cn('overflow-auto', fullScreen ? 'min-h-0 flex-1' : '')}>
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
              <th className={cn(thClass, 'w-20')} />
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
              metals.map((metal, index) => {
                const isMin = metal._id === route.minCapacityMetalId
                const isMaxZ = metal._id === route.highestImpedanceMetalId
                const belowSchematic = isCapacityBelowSchematic(metal, route.schematicCurrentDensity)

                return (
                  <tr
                    key={metal._id}
                    className={cn(
                      'bg-lime-400/70 font-medium text-black',
                      isMin && 'ring-1 ring-inset ring-amber-500/70',
                      isMaxZ && !isMin && 'ring-1 ring-inset ring-orange-500/70',
                      isMin && isMaxZ && 'ring-2 ring-inset ring-amber-600',
                    )}
                  >
                    <td className={tdClass}>
                      <span className="inline-flex items-center">
                        {metal.metalType}
                        <ConnectionIcon type={metal.connectionType} />
                      </span>
                    </td>
                    <td className={tdClass}>{metal.width}</td>
                    <td className={tdClass}>{metal.length}</td>
                    <td className={tdClass}>{fmt(metal.givenCurrentDensity)}</td>
                    <td
                      className={cn(
                        tdClass,
                        belowSchematic && 'bg-rose-100/80',
                      )}
                      title={
                        belowSchematic
                          ? 'Implemented metal density is below schematic current density'
                          : undefined
                      }
                    >
                      {fmt(metal.implementedCurrentMetalCapacity)}
                      {isMin ? <FlagBadge label="MIN" tone="min" /> : null}
                    </td>
                    {index === 0 ? (
                      <td
                        className={cn(tdClass, 'bg-lime-300/80 text-center font-bold align-middle')}
                        rowSpan={rowCount}
                      >
                        {fmt(route.minimumMetalCurrentCapacity)}
                      </td>
                    ) : null}
                    <td className={tdClass}>
                      {fmt(metal.routingMetalImpedance)}
                      {isMaxZ ? <FlagBadge label="MAX Z" tone="max" /> : null}
                    </td>
                    {index === 0 ? (
                      <td
                        className={cn(tdClass, 'bg-lime-300/80 text-center font-bold align-middle')}
                        rowSpan={rowCount}
                      >
                        {fmt(route.totalImpedance)}
                      </td>
                    ) : null}
                    <td className={cn(tdClass, 'px-1')}>
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil className="h-3.5 w-3.5 text-slate-700" />}
                          onClick={() => onEditMetal(metal)}
                          aria-label={`Edit ${metal.metalType}`}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 className="h-3.5 w-3.5 text-red-800" />}
                          onClick={() => onRemoveMetal(metal._id)}
                          aria-label={`Remove ${metal.metalType}`}
                        />
                      </div>
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
