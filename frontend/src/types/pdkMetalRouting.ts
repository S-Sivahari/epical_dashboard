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

export interface MetalEntry {
  _id: string
  metalType: string
  width: number
  length: number
  pdkModuleId: string
  pdkModuleName: string
  givenCurrentDensity: number
  sheetResistance: number
  implementedCurrentMetalCapacity: number
  routingMetalImpedance: number
}

export interface MetalRoutingRoute {
  _id: string
  projectId: string
  fromCell: string
  toCell: string
  fromSignal: string
  toSignal: string
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
  fromCell: string
  toCell: string
  fromSignal: string
  toSignal: string
}

export interface DashboardProject {
  id: string
  projectName: string
  clientName: string
  technologyNode: string
  status: string
  pdkModuleId: string | null
  pdkModuleName: string | null
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
  pdkModule: PdkModule | null
  routes: Array<Pick<MetalRoutingRoute, '_id' | 'fromCell' | 'toCell' | 'fromSignal' | 'toSignal' | 'updatedAt' | 'metals'>>
}

export interface AnalysisSummary {
  minimumMetalCurrentCapacity: number
  totalImpedance: number
  minCapacityMetalIndex: number
  highestImpedanceMetalIndex: number
}
