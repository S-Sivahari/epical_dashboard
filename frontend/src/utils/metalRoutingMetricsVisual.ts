import type {
  MetalRoutingDashboardMetrics,
  RouteDailyTrendPoint,
  RoutePeriodTrend,
  RouteTrendRange,
} from '@/types/pdkMetalRouting'



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



export function getTrendForRange(
  chartData: RouteDailyTrendPoint[],
  range: RouteTrendRange,
): RoutePeriodTrend {
  const periodLabel =
    range === '7' ? 'this week' : range === '30' ? 'this month' : 'last 90 days'
  if (chartData.length === 0) {
    return { delta: 0, growthPercent: 0, periodLabel }
  }
  const delta = chartData.reduce((sum, point) => sum + point.added, 0)
  const baseline = chartData[0].total - chartData[0].added
  const growthPercent =
    baseline > 0 ? Math.round((delta / baseline) * 1000) / 10 : delta > 0 ? 100 : 0
  return { delta, growthPercent, periodLabel }
}

export function getRouteTrendYDomain(points: RouteDailyTrendPoint[]): [number, number] {
  if (points.length === 0) return [0, 5]
  const max = Math.max(...points.map((point) => point.total), 1)
  if (max <= 5) return [0, 5]
  if (max <= 20) return [0, Math.ceil(max / 2) * 2]
  if (max <= 100) return [0, Math.ceil(max / 10) * 10]
  if (max <= 1000) return [0, Math.ceil(max / 100) * 100]
  return [0, Math.ceil(max / 1000) * 1000]
}

export function formatRelativeRouteTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}


