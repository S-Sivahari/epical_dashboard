export const DEPARTMENTS = [
  'Engineering',
  'People',
  'Finance',
  'Operations',
  'Sales',
  'Marketing',
] as const

export type Department = (typeof DEPARTMENTS)[number]
