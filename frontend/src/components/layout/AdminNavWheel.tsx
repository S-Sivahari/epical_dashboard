import { useLocation } from 'react-router-dom'
import { ADMIN_NAV_ITEMS, isAdminNavActive } from '@constants/adminNavigation'
import { PortalNavWheel } from '@components/layout/PortalNavWheel'

export function AdminNavWheel() {
  const { pathname } = useLocation()

  return (
    <PortalNavWheel
      items={ADMIN_NAV_ITEMS}
      isItemActive={(path, item) => isAdminNavActive(path, item.to, item.end)}
      ariaLabel="Admin quick navigation wheel"
    />
  )
}
