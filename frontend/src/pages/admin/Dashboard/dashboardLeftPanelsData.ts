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

export type PendingProjectReviewEntry = {
  id: string
  projectId: string
  cellId: string
  projectName: string
  cellName: string
  employeeName: string
  reviewPoint?: string | null
  stageAtRequest?: string
}

