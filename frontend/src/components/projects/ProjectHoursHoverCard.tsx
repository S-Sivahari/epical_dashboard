import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export interface ProjectHoursHoverCardProps {
  projectName: string
  hours: number
  percentage: string
  isGreaterThanAverage: boolean
  cardBg: string
  client?: string
  technologyNode?: string
  accessType?: string
  onCardClick: () => void
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2 border-b border-slate-100/90 py-2 last:border-b-0 last:pb-0 first:pt-0">
      <dt className="type-card-label-caps text-[10px] text-slate-400">{label}</dt>
      <dd className="type-body min-w-0 text-right text-[11px] font-semibold leading-snug text-slate-700 break-words">
        {value}
      </dd>
    </div>
  )
}

export function ProjectHoursHoverCard({
  projectName,
  hours,
  percentage,
  isGreaterThanAverage,
  cardBg,
  client,
  technologyNode,
  accessType,
  onCardClick,
}: ProjectHoursHoverCardProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={onCardClick}
          className={`flex w-full min-h-[5.75rem] flex-col justify-between rounded-xl p-4 text-left text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 ${cardBg}`}
        >
          <div
            className="truncate text-sm font-black uppercase leading-tight tracking-wide opacity-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
            title={projectName}
          >
            {projectName}
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-1">
            <span className="type-metric text-xl font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">{hours.toFixed(1)}</span>
            <span className="text-xs font-extrabold opacity-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              {isGreaterThanAverage ? '+' : ''}
              {percentage}%
            </span>
          </div>
        </button>
      </Tooltip.Trigger>

      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          align="center"
          sideOffset={10}
          collisionPadding={16}
          avoidCollisions
          sticky="partial"
          className="z-[250] w-[min(15.5rem,calc(100vw-2rem))] origin-[var(--radix-tooltip-content-transform-origin)] rounded-xl border border-slate-200/90 bg-white p-0 text-slate-800 shadow-[0_16px_48px_-8px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/[0.05] animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150"
        >
          <div className="overflow-hidden rounded-xl">
            <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/90 to-white px-3.5 py-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-3.5 w-1 shrink-0 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" aria-hidden />
                <p className="type-card-title min-w-0 flex-1 text-[11px] leading-snug text-slate-800 break-words">
                  {projectName}
                </p>
              </div>
            </div>

            <dl className="px-3.5 py-2">
              <DetailRow label="Client" value={client || '—'} />
              <DetailRow label="Tech Node" value={technologyNode || '—'} />
              <DetailRow label="Total Hours" value={`${hours.toFixed(1)}h`} />
              <DetailRow label="Access" value={<span className="capitalize">{accessType || '—'}</span>} />
            </dl>
          </div>

          <Tooltip.Arrow
            width={14}
            height={7}
            className="fill-white drop-shadow-[0_1px_0_rgba(226,232,240,0.9)]"
          />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function ProjectHoursHoverCardProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={120} skipDelayDuration={80} disableHoverableContent>
      {children}
    </Tooltip.Provider>
  )
}
