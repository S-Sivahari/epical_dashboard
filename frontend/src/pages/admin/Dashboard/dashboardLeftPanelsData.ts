export type OutTodayEntry = {
  id: string
  name: string
  leaveType: 'Annual' | 'Sick' | 'WFH' | string
  returnDate: string
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

export const MOCK_MISSING_TIMESHEETS: MissingTimesheetEntry[] = [
  { id: '1', name: 'Rahul K' },
  { id: '2', name: 'Meera L' },
  { id: '3', name: 'Vikram N' },
]
