export interface PdkModuleMetalSpec {
  _id?: string
  metalType: string
  currentDensityAt110: number
  sheetResistance: number
}

export interface PdkModule {
  _id: string
  name: string
  technologyNode: string
  notes: string
  metals: PdkModuleMetalSpec[]
  createdAt?: string
  updatedAt?: string
}

export type MetalConnectionType = 'series' | 'parallel'

export interface MetalEntry {
  _id: string
  metalType: string
  width: number
  length: number
  pdkModuleId: string
  pdkModuleName: string
  givenCurrentDensity: number
  schematicCurrentDensity?: number
  sheetResistance: number
  implementedCurrentMetalCapacity: number
  routingMetalImpedance: number
  connectionType?: MetalConnectionType
}

export interface MetalRoutingRoute {
  _id: string
  projectId: string
  signal: string
  fromCell: string
  toCell: string
  /** Schematic current density (mA/µm) for this signal — used as Given J on all metals */
  schematicCurrentDensity?: number
  /** @deprecated legacy */
  fromSignal?: string
  /** @deprecated legacy */
  toSignal?: string
  metals: MetalEntry[]
  minimumMetalCurrentCapacity: number
  totalImpedance: number
  minCapacityMetalId?: string | null
  highestImpedanceMetalId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface RoutingFilter {
  projectId: string
  signal: string
  fromCell: string
  toCell: string
  schematicCurrentDensity?: number
  /** @deprecated legacy lookup */
  fromSignal?: string
  /** @deprecated legacy lookup */
  toSignal?: string
}

export type ProjectCellTypeKey = 'BLOCK' | 'IO' | 'ESD' | 'TOP'

export interface ProjectCellsByType {
  BLOCK: string[]
  IO: string[]
  ESD: string[]
  TOP: string[]
}

export interface DashboardProject {
  id: string
  projectCode?: string
  projectName: string
  clientName: string
  technologyNode: string
  status: string
  pdkModuleId: string | null
  pdkModuleName: string | null
  updatedAt?: string | null
}

export interface RouteDailyTrendPoint {
  date: string
  label: string
  total: number
  added: number
}

export interface RoutePeriodTrend {
  delta: number
  growthPercent: number
  periodLabel: string
}

export interface RouteActivityInsights {
  mostActiveCell: string | null
  mostActiveLibrary: string | null
  latestRouteAddedAt: string | null
  latestRouteLabel: string | null
}

export interface RouteBreakdownItem {
  name: string
  count: number
}

export interface RecentRouteAddition {
  id: string
  signal?: string
  fromCell: string
  toCell: string
  fromSignal: string
  toSignal: string
  createdAt: string
  libraryName: string | null
}

export type RouteTrendRange = '7' | '30' | '90'

export interface ProjectRouteMetrics {
  totalRoutes: number
  periodTrend: RoutePeriodTrend
  trendsByRange: Record<RouteTrendRange, RouteDailyTrendPoint[]>
  insights: RouteActivityInsights
  routesByLibrary: RouteBreakdownItem[]
  routesByCell: RouteBreakdownItem[]
  recentAdditions: RecentRouteAddition[]
}

export interface ImpedanceLayerContribution {
  metalType: string
  impedance: number
}

export interface ImpedanceRoutePoint {
  routeId: string
  routeLabel: string
  routeName: string
  signalPath: string
  impedance: number
  updatedAt: string
  layerContributions: ImpedanceLayerContribution[]
}

export interface ProjectImpedanceMetrics {
  hasData: boolean
  routePoints: ImpedanceRoutePoint[]
}

export type ImpedanceRunRange = '1' | '7' | '30' | 'all'

export interface ImpedanceTrendIntel {
  direction: 'increasing' | 'decreasing' | 'stable'
  previousImpedance: number
  currentImpedance: number
  changeOhm: number
  changePercent: number
}

export interface ImpedanceEngineeringStats {
  average: number
  min: number
  minRouteLabel: string
  max: number
  maxRouteLabel: string
  total: number
  measuredRouteCount: number
}

export interface ImpedanceInsightSummary {
  headline: string
  details: string[]
}

export interface ImpedanceInsightItem {
  tone: 'success' | 'warning' | 'info'
  message: string
}

export interface ImpedanceRouteTableRow {
  routeId: string
  routeLabel: string
  routeName: string
  signalPath: string
  impedance: number
  vsAverage: number
  changePercent: number
  rank: number
  trendDirection: 'up' | 'down' | 'stable'
  updatedAt: string
  layerContributions: ImpedanceLayerContribution[]
}

export interface ImpedanceAverageStatus {
  label: string
  tone: 'success' | 'warning' | 'danger'
}

export interface ProjectMinCapacityMetrics {
  hasData: boolean
  minimumMetalCurrentCapacity: number
  maximumCapacityInProject: number
  minimumLayer: string | null
  lastUpdatedAt: string | null
}

export interface MetalRoutingDashboardMetrics {
  totalRoutes: number
  completedRoutes: number
  pendingRoutes: number
  totalRoutingImpedance: number
  selectedProjectId: string | null
  selectedProjectName: string | null
  projectRouteMetrics: ProjectRouteMetrics
  projectImpedanceMetrics: ProjectImpedanceMetrics
  projectMinCapacityMetrics: ProjectMinCapacityMetrics
}

export interface ProjectRoutingContext {
  project: {
    id: string
    projectName: string
    clientName: string
    technologyNode: string
    pdkModuleId: string | null
  }
  cellNames: string[]
  cellsByType?: ProjectCellsByType
  pdkModule: PdkModule | null
  routes: SavedRouteSummary[]
  signals?: SignalRouteSummary[]
}

export interface SignalRouteSummary {
  _id: string
  projectId?: string
  signal: string
  fromCell: string
  toCell: string
  schematicCurrentDensity?: number
  totalImpedance: number
  minimumMetalCurrentCapacity: number
  updatedAt?: string
  metalCount: number
}

export interface SavedRouteSummary {
  _id: string
  projectId?: string
  signal?: string
  fromCell: string
  toCell: string
  fromSignal: string
  toSignal: string
  totalImpedance?: number
  minimumMetalCurrentCapacity?: number
  updatedAt?: string
  metalCount: number
}

export interface AnalysisSummary {
  minimumMetalCurrentCapacity: number
  totalImpedance: number
  minCapacityMetalIndex: number
  highestImpedanceMetalIndex: number
}
