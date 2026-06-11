export type MetalRoutingColumnHeader = {
  label: string
  unit?: string
}

/** Display unit for routing/total impedance across metal-routing UI and exports. */
export const METAL_ROUTING_IMPEDANCE_UNIT = 'mΩ'

/** Column labels/units match engineering spec; units must not be CSS-uppercased (µm, mA, mΩ). */
export const METAL_ROUTING_TABLE_HEADERS = {
  metalType: { label: 'Metal Type' },
  width: { label: 'Metal Width', unit: '(µm)' },
  length: { label: 'Metal Length', unit: '(µm)' },
  givenDensity: { label: 'Given Current Capability', unit: ' (mA)' },
  implementedCapacity: { label: 'Implemented Metal Current Capability', unit: '(mA)' },
  minCapacity: { label: 'Minimum Metal Current Capability', unit: '(mA)' },
  routingImpedance: { label: 'Routing Metal Impedence', unit: '(mΩ)' },
  totalImpedance: { label: 'Total Impedence', unit: '(mΩ)' },
} as const satisfies Record<string, MetalRoutingColumnHeader>

export function formatMetalRoutingHeaderText(header: MetalRoutingColumnHeader): string {
  return header.unit ? `${header.label}${header.unit}` : header.label
}
