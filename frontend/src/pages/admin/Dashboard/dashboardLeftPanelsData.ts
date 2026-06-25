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

