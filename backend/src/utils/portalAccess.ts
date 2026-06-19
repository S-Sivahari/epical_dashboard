export type PortalAccess = 'Employee' | 'Employee+Admin';

const PORTAL_ACCESS_SET = new Set<PortalAccess>(['Employee', 'Employee+Admin']);

/** Normalize form/API values to supported portal access levels. */
export function normalizePortalAccess(value?: string | null): PortalAccess {
  const trimmed = String(value ?? '').trim();
  if (trimmed === 'Employee+Admin' || trimmed === 'Admin') {
    return 'Employee+Admin';
  }
  return 'Employee';
}

export function assertValidPortalAccess(value?: string): void {
  const normalized = normalizePortalAccess(value);
  if (!PORTAL_ACCESS_SET.has(normalized)) {
    const err: any = new Error('Portal access must be Employee or Employee+Admin.');
    err.code = 'INVALID_PORTAL_ACCESS';
    throw err;
  }
}

export function employeeHasPortalAdmin(employee?: {
  portalAccess?: string;
  role?: string;
} | null): boolean {
  if (!employee) return false;
  const access = employee.portalAccess ?? employee.role;
  return access === 'Employee+Admin' || access === 'Admin';
}

/**
 * True only for employees granted Employee+Admin portal access.
 * The env-backed system admin (no employee record) never toggles portals.
 */
export function canTogglePortal(
  user?: { role?: string; portalAdmin?: boolean } | null,
  employee?: { portalAccess?: string; role?: string } | null,
): boolean {
  if (!employee) return false;
  if (String(user?.role) === 'Admin') return false;
  return employeeHasPortalAdmin(employee) || Boolean(user?.portalAdmin);
}

/** Default OAuth landing portal: employees start on employee side unless env-only admin. */
export function defaultActivePortalForLogin(
  user?: { role?: string } | null,
  employee?: { portalAccess?: string; role?: string } | null,
): 'admin' | 'employee' {
  if (!employee && String(user?.role) === 'Admin') {
    return 'admin';
  }
  return 'employee';
}
