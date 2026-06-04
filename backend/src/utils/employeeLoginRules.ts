import { normalizeLoginEmail } from './employeeAuth';

const BLOCKED_STATUSES = new Set(['Deactivated', 'Inactive']);

export class EmployeeLoginError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = 'EmployeeLoginError';
    this.status = status;
  }
}

function normalizedField(value?: string): string {
  return value && String(value).trim() ? normalizeLoginEmail(String(value)) : '';
}

/** Company email set and non-empty. */
export function hasCompanyEmail(employee: { email?: string }): boolean {
  return !!normalizedField(employee.email);
}

export function hasPersonalEmail(employee: { personalEmail?: string }): boolean {
  return !!normalizedField(employee.personalEmail);
}

export function assertEmployeeNotBlocked(employee: { status?: string }): void {
  const status = String(employee.status ?? '').trim();
  if (BLOCKED_STATUSES.has(status)) {
    throw new EmployeeLoginError(
      'This account is deactivated and cannot access the portal. Contact HR.',
      403,
    );
  }
}

/**
 * Login email rules:
 * - Only personal email when no company email is on file.
 * - Only company email when both are on file.
 * - After company email is removed, personal email works again.
 */
export function assertLoginEmailAllowedForEmployee(
  employee: { email?: string; personalEmail?: string; status?: string },
  loginEmail: string,
): void {
  assertEmployeeNotBlocked(employee);

  const normalizedLogin = normalizeLoginEmail(loginEmail);
  const company = normalizedField(employee.email);
  const personal = normalizedField(employee.personalEmail);

  if (company && personal) {
    if (normalizedLogin !== company) {
      throw new EmployeeLoginError(
        'Please sign in with your company email address.',
        403,
      );
    }
    return;
  }

  if (!company && personal) {
    if (normalizedLogin !== personal) {
      throw new EmployeeLoginError(
        'Please sign in with your registered personal email address.',
        403,
      );
    }
    return;
  }

  if (company && !personal) {
    if (normalizedLogin !== company) {
      throw new EmployeeLoginError(
        'Please sign in with your company email address.',
        403,
      );
    }
    return;
  }

  throw new EmployeeLoginError('No login email is configured for this employee. Contact HR.', 403);
}

export function assertPersonalAndCompanyEmailsDiffer(
  personalEmail?: string,
  companyEmail?: string,
): void {
  const personal = normalizedField(personalEmail);
  const company = normalizedField(companyEmail);
  if (personal && company && personal === company) {
    const err: any = new Error('Personal email and company email cannot be the same.');
    err.code = 'EMAILS_MUST_DIFFER';
    throw err;
  }
}
