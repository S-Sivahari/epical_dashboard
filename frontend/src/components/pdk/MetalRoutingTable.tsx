import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { MetalRoutingColumnHeaderCell } from '@components/pdk/MetalRoutingColumnHeader'
import { METAL_ROUTING_TABLE_HEADERS } from '@/constants/metalRoutingTableHeaders'
import type { MetalConnectionType, MetalEntry, MetalRoutingRoute } from '@/types/pdkMetalRouting'
import { cn } from '@/utils/cn'

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(4) : '—'
}

function isImplementedBelowGiven(
  metal: MetalEntry,
  givenCurrentCapability?: number,
): boolean {
  return (
    givenCurrentCapability != null
    && Number.isFinite(givenCurrentCapability)
    && Number.isFinite(metal.implementedCurrentMetalCapacity)
    && metal.implementedCurrentMetalCapacity < givenCurrentCapability
  )
}

const thClass = 'border border-yellow-400 px-2 py-2'
const tdClass = 'border border-lime-500 px-2 py-2'
const summaryTdClass = cn(
  tdClass,
  'metal-routing-metal-table__summary bg-white text-center font-bold align-middle',
)

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
  const givenCurrentCapability = route.schematicCurrentDensity

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
            <span className="text-xs font-medium uppercase text-muted">Signal Name</span>
            <p className="font-semibold text-ink">{route.signal}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-muted">From</span>
            <p className="font-semibold text-ink">{route.fromCell}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-muted">To</span>
            <p className="font-semibold text-ink">{route.toCell}</p>
          </div>
          {route.schematicCurrentDensity != null ? (
            <div>
              <span className="text-xs font-medium uppercase text-muted">Given current capability</span>
              <p className="font-semibold text-ink">{fmt(route.schematicCurrentDensity)} mA</p>
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
            <tr className="metal-routing-metal-table__head bg-yellow-300 text-[11px] font-bold text-black">
              <th className={thClass}>
                <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.metalType} />
              </th>
              <th className={thClass}>
                <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.width} />
              </th>
              <th className={thClass}>
                <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.length} />
              </th>
              <th className={thClass}>
                <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.givenDensity} />
              </th>
              <th className={thClass}>
                <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.implementedCapacity} />
              </th>
              <th className={thClass}>
                <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.minCapacity} />
              </th>
              <th className={thClass}>
                <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.routingImpedance} />
              </th>
              <th className={thClass}>
                <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.totalImpedance} />
              </th>
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
                const isMinRow = metal._id === route.minCapacityMetalId
                const isMaxZ = metal._id === route.highestImpedanceMetalId
                const belowGiven = isImplementedBelowGiven(metal, givenCurrentCapability)
                const isFlaggedRow = isMinRow || isMaxZ
                const dataTdClass = cn(
                  tdClass,
                  isFlaggedRow ? 'bg-rose-100/90' : 'bg-lime-400/70',
                )

                return (
                  <tr key={metal._id} className="font-medium text-black">
                    <td className={dataTdClass}>
                      <span className="inline-flex items-center">
                        {metal.metalType}
                        {index > 0 ? <ConnectionIcon type={metal.connectionType} /> : null}
                      </span>
                    </td>
                    <td className={dataTdClass}>{metal.width}</td>
                    <td className={dataTdClass}>{metal.length}</td>
                    {index === 0 ? (
                      <td className={summaryTdClass} rowSpan={rowCount}>
                        {givenCurrentCapability != null ? fmt(givenCurrentCapability) : '—'}
                      </td>
                    ) : null}
                    <td
                      className={cn(
                        dataTdClass,
                        belowGiven && 'bg-red-500/75',
                      )}
                      title={
                        isMinRow
                          ? 'Minimum implemented metal current capability in this route'
                          : belowGiven
                            ? 'Implemented metal current capability is below given current capability'
                            : undefined
                      }
                    >
                      {fmt(metal.implementedCurrentMetalCapacity)}
                      {isMinRow ? <FlagBadge label="MIN" tone="min" /> : null}
                    </td>
                    {index === 0 ? (
                      <td className={summaryTdClass} rowSpan={rowCount}>
                        {fmt(route.minimumMetalCurrentCapacity)}
                      </td>
                    ) : null}
                    <td className={dataTdClass}>
                      {fmt(metal.routingMetalImpedance)}
                      {isMaxZ ? <FlagBadge label="MAX" tone="max" /> : null}
                    </td>
                    {index === 0 ? (
                      <td className={summaryTdClass} rowSpan={rowCount}>
                        {fmt(route.totalImpedance)}
                      </td>
                    ) : null}
                    <td className={cn(dataTdClass, 'px-1')}>
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
