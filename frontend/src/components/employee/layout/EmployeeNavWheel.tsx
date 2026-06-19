import { useLocation } from 'react-router-dom'
import { isEmployeeNavActive } from '@constants/employeeNavigation'
import { PortalNavWheel } from '@components/layout/PortalNavWheel'
import { useEmployeeNavItems } from '@hooks/useEmployeeNavItems'

export function EmployeeNavWheel() {
  const { pathname } = useLocation()
  const items = useEmployeeNavItems()

  return (
    <PortalNavWheel
      items={items}
      isItemActive={(path, item) => isEmployeeNavActive(path, item.to, item.end)}
      ariaLabel="Employee quick navigation wheel"
    />
  )
}
