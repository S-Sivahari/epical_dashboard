import type { MetalRoutingDashboardMetrics } from '@/types/pdkMetalRouting'



export interface ImpedanceSegment {

  segment: string

  impedance: number

  status: 'complete' | 'pending'

}



export interface ImpedanceChartPoint {

  segment: string

  impedance: number

  status: 'complete' | 'pending'

}



export type RoutingHealthTone = 'healthy' | 'warning' | 'attention' | 'neutral'



export interface RoutingHealth {

  label: string

  tone: RoutingHealthTone

  description: string

}



export function buildImpedanceSegments(metrics: MetalRoutingDashboardMetrics): ImpedanceSegment[] {

  const total = Math.max(metrics.totalRoutes, 1)

  const perCompleted =

    metrics.completedRoutes > 0 ? metrics.totalRoutingImpedance / metrics.completedRoutes : 0



  return Array.from({ length: total }, (_, index) => ({

    segment: `R${index + 1}`,

    impedance: index < metrics.completedRoutes ? perCompleted : 0,

    status: index < metrics.completedRoutes ? 'complete' : 'pending',

  }))

}



export function buildImpedanceChartData(metrics: MetalRoutingDashboardMetrics): ImpedanceChartPoint[] {

  return buildImpedanceSegments(metrics)

}



export function getImpedanceChartDomain(metrics: MetalRoutingDashboardMetrics): [number, number] {

  const maxSegment = Math.max(

    ...buildImpedanceSegments(metrics).map((point) => point.impedance),

    metrics.totalRoutingImpedance,

    0.5,

  )

  const ceiling = Math.max(3, Math.ceil(maxSegment * 1.35 * 10) / 10)

  return [0, ceiling]

}



export function getImpedanceReferenceValue(metrics: MetalRoutingDashboardMetrics): number | null {

  if (metrics.completedRoutes <= 0 || metrics.totalRoutingImpedance <= 0) return null

  const perRoute = metrics.totalRoutingImpedance / metrics.completedRoutes

  return Math.round(perRoute * 1.15 * 100) / 100

}



export function getCompletionPercent(metrics: MetalRoutingDashboardMetrics): number {

  if (metrics.totalRoutes <= 0) return 0

  return Math.round((metrics.completedRoutes / metrics.totalRoutes) * 100)

}



export function getRoutingHealth(metrics: MetalRoutingDashboardMetrics): RoutingHealth {

  const { totalRoutes, completedRoutes, pendingRoutes } = metrics



  if (totalRoutes === 0) {

    return {

      label: 'No Routes',

      tone: 'neutral',

      description: 'Create or import routes to begin analysis.',

    }

  }



  if (completedRoutes === totalRoutes && pendingRoutes === 0) {

    return {

      label: 'Healthy',

      tone: 'healthy',

      description: 'All routes complete with calculations.',

    }

  }



  const completionRatio = completedRoutes / totalRoutes

  if (pendingRoutes > 0 && completionRatio >= 0.5) {

    return {

      label: 'Warning',

      tone: 'warning',

      description: `${pendingRoutes} route${pendingRoutes === 1 ? '' : 's'} still need attention.`,

    }

  }



  return {

    label: 'Attention Needed',

    tone: 'attention',

    description: `${pendingRoutes} pending · ${completedRoutes}/${totalRoutes} complete`,

  }

}



export function topologyDisplayCount(totalRoutes: number): number {

  if (totalRoutes <= 0) return 0

  return Math.min(totalRoutes, 6)

}



/** Vertical lane offsets (0–1) for the routing schematic paths. */

export function topologyLaneOffsets(count: number): number[] {

  if (count <= 0) return []

  if (count === 1) return [0.5]

  const spread = 0.55

  const start = 0.5 - spread / 2

  const step = count > 1 ? spread / (count - 1) : 0

  return Array.from({ length: count }, (_, index) => start + step * index)

}


