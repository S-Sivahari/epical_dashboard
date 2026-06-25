import type { ProjectCell } from '@/types/projectWorkspace'
import { CELL_WORKFLOW_STAGES } from '@/types/projectWorkspace'
import { formatWorkflowDurationFromMs } from '@/utils/durationFormat'

export type HoldPeriodSummary = {
  startedAt: string
  endedAt: string | null
  durationMs: number
  formatted: string
  reason?: string
  heldBy?: string
}

export type StageTimeSummary = {
  stageKey: string
  label: string
  totalMs: number
  formatted: string
  isActive: boolean
}

export type CellCompletionTimeSummaryData = {
  startedAt: string | null
  completedAt: string | null
  productiveMs: number
  productiveFormatted: string
  estimatedHours: number
  actualHours: number
  holdPeriods: HoldPeriodSummary[]
  totalHoldMs: number
  totalHoldFormatted: string
  stageBreakdown: StageTimeSummary[]
}

function parseTime(value?: string | null): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function durationBetween(start: string, end: string | null, fallbackEnd?: string | null): number {
  const startMs = parseTime(start)
  if (startMs == null) return 0
  const endMs = parseTime(end) ?? parseTime(fallbackEnd) ?? Date.now()
  return Math.max(0, endMs - startMs)
}

function earliestTimestamp(values: Array<string | null | undefined>): string | null {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  return sorted[0] ?? null
}

function parseHoldPeriods(
  activityLog: ProjectCell['activityLog'],
  completedAt: string | null,
): HoldPeriodSummary[] {
  const entries = [...(activityLog ?? [])].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  )

  const periods: HoldPeriodSummary[] = []
  let openHold: {
    startedAt: string
    reason?: string
    heldBy?: string
  } | null = null

  for (const entry of entries) {
    if (entry.action === 'hold') {
      openHold = {
        startedAt: entry.at,
        reason: entry.detail,
        heldBy: entry.userName,
      }
      continue
    }

    if (entry.action === 'hold_released' && openHold) {
      const durationMs = durationBetween(openHold.startedAt, entry.at)
      periods.push({
        startedAt: openHold.startedAt,
        endedAt: entry.at,
        durationMs,
        formatted: formatWorkflowDurationFromMs(durationMs),
        reason: openHold.reason,
        heldBy: openHold.heldBy,
      })
      openHold = null
    }
  }

  if (openHold) {
    const durationMs = durationBetween(openHold.startedAt, null, completedAt)
    periods.push({
      startedAt: openHold.startedAt,
      endedAt: completedAt,
      durationMs,
      formatted: formatWorkflowDurationFromMs(durationMs),
      reason: openHold.reason,
      heldBy: openHold.heldBy,
    })
  }

  return periods
}

export function buildCellCompletionTimeSummary(cell: ProjectCell): CellCompletionTimeSummaryData {
  const timing = cell.workflowTiming
  const completedAt = timing?.workflowCompletionTime
    ?? [...(cell.activityLog ?? [])]
      .filter((entry) => entry.action === 'completed')
      .map((entry) => entry.at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    ?? null

  const startedAt = earliestTimestamp([
    ...(timing?.stages ?? []).flatMap((stage) => [
      stage.stageStartTime,
      stage.checkInTime,
    ]),
    ...(cell.activityLog ?? [])
      .filter((entry) => entry.action === 'workflow_update' || entry.action === 'created')
      .map((entry) => entry.at),
  ])

  const productiveMs = cell.productiveWorkDuration?.totalMs
    ?? cell.workflowDuration?.totalMs
    ?? timing?.workflowDuration?.totalMs
    ?? 0

  const holdPeriods = parseHoldPeriods(cell.activityLog, completedAt)
  const totalHoldMs = holdPeriods.reduce((sum, period) => sum + period.durationMs, 0)

  const stageBreakdown = (timing?.stages ?? [])
    .map((stage) => {
      const meta = CELL_WORKFLOW_STAGES.find((item) => item.key === stage.stageKey)
      const totalMs = stage.totalMs ?? 0
      return {
        stageKey: stage.stageKey,
        label: meta?.label ?? stage.stageKey,
        totalMs,
        formatted: stage.formattedTotal ?? formatWorkflowDurationFromMs(totalMs),
        isActive: Boolean(stage.isActive),
      }
    })
    .filter((stage) => stage.totalMs > 0 || stage.isActive)

  return {
    startedAt,
    completedAt,
    productiveMs,
    productiveFormatted: formatWorkflowDurationFromMs(productiveMs),
    estimatedHours: Number(cell.estimatedEffort) || 0,
    actualHours: Math.round((productiveMs / 3_600_000) * 10) / 10,
    holdPeriods,
    totalHoldMs,
    totalHoldFormatted: formatWorkflowDurationFromMs(totalHoldMs),
    stageBreakdown,
  }
}
