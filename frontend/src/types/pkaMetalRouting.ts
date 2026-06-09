export interface PkaModuleMetalSpec {
  _id?: string
  metalType: string
  currentDensityAt110: number
  sheetResistance: number
}

export interface PkaModule {
  _id: string
  name: string
  technologyNode: string
  notes: string
  metals: PkaModuleMetalSpec[]
  createdAt?: string
  updatedAt?: string
}

export interface MetalEntry {
  _id: string
  metalType: string
  width: number
  length: number
  pkaModuleId: string
  pkaModuleName: string
  givenCurrentDensity: number
  sheetResistance: number
  implementedCurrentMetalCapacity: number
  routingMetalImpedance: number
}

export interface MetalRoutingRoute {
  _id: string
  fromCell: string
  toCell: string
  fromSignal: string
  toSignal: string
  metals: MetalEntry[]
  minimumMetalCurrentCapacity: number
  totalImpedance: number
  minCapacityMetalId?: string | null
  highestImpedanceMetalId?: string | null
  createdBy?: string
  createdByName?: string
  createdAt?: string
  updatedAt?: string
}

export interface RoutingFilter {
  fromCell: string
  toCell: string
  fromSignal: string
  toSignal: string
}

export interface MetalRoutingContext {
  cellNames: string[]
  signals: string[]
  routes: Array<Pick<MetalRoutingRoute, '_id' | 'fromCell' | 'toCell' | 'fromSignal' | 'toSignal' | 'updatedAt' | 'metals'>>
}

export interface AnalysisSummary {
  minimumMetalCurrentCapacity: number
  totalImpedance: number
  minCapacityMetalIndex: number
  highestImpedanceMetalIndex: number
}
