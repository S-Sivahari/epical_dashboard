import { Modal } from '@components/ui/Modal'
import type { ImpedanceRoutePoint } from '@/types/pdkMetalRouting'

export function MetalRoutingImpedanceRouteModal({
  isOpen,
  onClose,
  route,
}: {
  isOpen: boolean
  onClose: () => void
  route: ImpedanceRoutePoint | null
}) {
  if (!route) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Route ${route.routeLabel} Impedance Breakdown`}
      size="lg"
    >
      <div className="metal-routing-impedance-route-detail">
        <div className="metal-routing-impedance-route-detail__meta">
          <p className="metal-routing-impedance-route-detail__path">{route.routeName}</p>
          <p className="metal-routing-impedance-route-detail__signal">{route.signalPath}</p>
        </div>

        <div className="metal-routing-impedance-route-detail__total">
          <span>Total Impedance</span>
          <strong>{route.impedance.toFixed(2)} Ω</strong>
        </div>

        <h4 className="metal-routing-impedance-route-detail__section">Layer Contributions</h4>
        {route.layerContributions.length === 0 ? (
          <p className="metal-routing-impedance-route-detail__empty">No metal layer data available.</p>
        ) : (
          <ul className="metal-routing-impedance-route-detail__layers">
            {route.layerContributions.map((layer) => (
              <li key={`${route.routeId}-${layer.metalType}`}>
                <span>{layer.metalType}</span>
                <span>{layer.impedance.toFixed(2)} Ω</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
