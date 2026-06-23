export type EmployeeView = 'Public' | 'Private';

export const EMPLOYEE_VIEW_DEFAULT: EmployeeView = 'Public';

export function normalizeEmployeeView(value?: string | null): EmployeeView {
  return String(value ?? '').trim() === 'Private' ? 'Private' : 'Public';
}

export function isPublicEmployeeView(value?: string | null): boolean {
  return normalizeEmployeeView(value) === 'Public';
}
