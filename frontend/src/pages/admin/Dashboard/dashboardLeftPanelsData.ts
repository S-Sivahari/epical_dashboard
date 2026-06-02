export type OutTodayEntry = {
  id: string
  name: string
  leaveType: 'Annual' | 'Sick' | 'WFH' | string
  returnDate: string
}

export type DeadlineUrgency = 'red' | 'amber' | 'green'

export type UpcomingDeadline = {
  id: string
  dateLabel: string
  label: string
  urgency: DeadlineUrgency
}

export type MissingTimesheetEntry = {
  id: string
  name: string
}

export const OUT_TODAY_TOTAL_EMPLOYEES = 11

export const MOCK_OUT_TODAY: OutTodayEntry[] = [
  { id: '1', name: 'Ashwin M', leaveType: 'Annual', returnDate: 'Jun 4' },
  { id: '2', name: 'Priya R', leaveType: 'Sick', returnDate: 'Jun 3' },
  { id: '3', name: 'Kirthi V', leaveType: 'WFH', returnDate: 'Today EOD' },
  { id: '4', name: 'Shwetha S', leaveType: 'Annual', returnDate: 'Jun 6' },
]

export const MOCK_UPCOMING_DEADLINES: UpcomingDeadline[] = [
  { id: '1', dateLabel: 'Jun 2', label: 'Timesheet cutoff — current period', urgency: 'red' },
  { id: '2', dateLabel: 'Jun 2', label: 'Payroll run — May cycle', urgency: 'red' },
  { id: '3', dateLabel: 'Jun 3', label: 'Probation end — Chandra Sekar', urgency: 'amber' },
  { id: '4', dateLabel: 'Jun 4', label: 'Contract renewal — Shwetha S', urgency: 'amber' },
  { id: '5', dateLabel: 'Jun 6', label: 'Open enrollment documentation due', urgency: 'green' },
  { id: '6', dateLabel: 'Jun 7', label: 'Quarterly review submissions', urgency: 'green' },
]

export const MOCK_MISSING_TIMESHEETS: MissingTimesheetEntry[] = [
  { id: '1', name: 'Rahul K' },
  { id: '2', name: 'Meera L' },
  { id: '3', name: 'Vikram N' },
]
