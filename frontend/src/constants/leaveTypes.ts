export const LEAVE_TYPES = [
  'Annual',
  'Sick',
  'Casual',
  'Maternity',
  'Paternity',
  'Unpaid',
] as const

export type LeaveType = (typeof LEAVE_TYPES)[number]
