import type { MetalRoutingDashboardMetrics } from '@/types/pdkMetalRouting'
import { MetalRoutingImpedanceCard } from '@components/pdk/MetalRoutingImpedanceCard'
import { MetalRoutingMinCapacityCard } from '@components/pdk/MetalRoutingMinCapacityCard'
import { MetalRoutingTotalRoutesCard } from '@components/pdk/MetalRoutingTotalRoutesCard'

export function MetalRoutingDashboardVisuals({
  metrics,
  loading,
}: {
  metrics: MetalRoutingDashboardMetrics | null
  loading?: boolean
}) {
  const data: MetalRoutingDashboardMetrics = metrics ?? {
    totalRoutes: 0,
    completedRoutes: 0,
    pendingRoutes: 0,
    totalRoutingImpedance: 0,
    selectedProjectId: null,
    selectedProjectName: null,
    projectRouteMetrics: {
      totalRoutes: 0,
      periodTrend: { delta: 0, growthPercent: 0, periodLabel: 'this week' },
      trendsByRange: { '7': [], '30': [], '90': [] },
      insights: {
        mostActiveCell: null,
        mostActiveLibrary: null,
        latestRouteAddedAt: null,
        latestRouteLabel: null,
      },
      routesByLibrary: [],
      routesByCell: [],
      recentAdditions: [],
    },
    projectImpedanceMetrics: {
      hasData: false,
      routePoints: [],
    },
    projectMinCapacityMetrics: {
      hasData: false,
      minimumMetalCurrentCapacity: 0,
      maximumCapacityInProject: 0,
      minimumLayer: null,
      lastUpdatedAt: null,
    },
  }

  return (
    <section className="metal-routing-metrics-viz" aria-label="Routing metrics visualizations">
      <MetalRoutingTotalRoutesCard
        metrics={data.projectRouteMetrics}
        projectName={data.selectedProjectName}
        loading={loading}
      />

      <MetalRoutingMinCapacityCard metrics={data.projectMinCapacityMetrics} loading={loading} />

      <MetalRoutingImpedanceCard
        metrics={data.projectImpedanceMetrics}
        projectName={data.selectedProjectName}
        loading={loading}
      />
    </section>
  )
}
