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
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="min-w-0 text-right text-[11px] font-semibold leading-snug text-slate-700 break-words">
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
          className={`flex w-full min-h-[4.25rem] flex-col justify-between rounded-xl p-3 text-left text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 ${cardBg}`}
        >
          <div
            className="truncate text-[11px] font-black uppercase leading-tight tracking-wide opacity-95"
            title={projectName}
          >
            {projectName}
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-base font-black tracking-tight tabular-nums">{hours.toFixed(1)}</span>
            <span className="text-[10px] font-extrabold opacity-95">
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
          className="z-[250] w-[min(15.5rem,calc(100vw-2rem))] origin-[var(--radix-tooltip-content-transform-origin)] rounded-xl border border-slate-200/90 bg-white p-0 text-slate-800 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/[0.04] animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150"
        >
          <div className="overflow-hidden rounded-xl">
            <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/90 to-white px-3.5 py-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-3.5 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <p className="min-w-0 flex-1 text-[11px] font-bold leading-snug text-slate-800 break-words">
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
