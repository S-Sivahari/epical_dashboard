export type PendingApprovalKind = 'leave' | 'document'

export type PendingApprovalTask = {
  id: string
  title: string
  requestedAgo: string
  kind: PendingApprovalKind
  sourceId: string
  /** Leave requests only */
  leaveType?: string
  /** Document requests only — must upload before approve */
  hasFulfillmentFile?: boolean
}

export type SystemActivityEntry = {
  id: string
  message: string
  time: string
}

/** @deprecated Dashboard builds the queue from live API data via buildPendingApprovals */
export const DASHBOARD_PENDING_APPROVALS: PendingApprovalTask[] = []
export const DASHBOARD_SYSTEM_ACTIVITY: SystemActivityEntry[] = [
  {
    id: '1',
    message: 'Kirthi updated personal bank details',
    time: '12m ago',
  },
  {
    id: '2',
    message: 'New employee profile created for Chandra Sekar',
    time: '1h ago',
  },
  {
    id: '3',
    message: 'Leave balance adjusted for Sivahari S S by Admin',
    time: '10:34 AM',
  },
  {
    id: '4',
    message: 'Payslip batch export completed for May 2026',
    time: '11:02 AM',
  },
  {
    id: '5',
    message: 'Ashwin M submitted timesheet for approval',
    time: 'Yesterday',
  },
  {
    id: '6',
    message: 'HR policy document v2.4 published to employee portal',
    time: 'Yesterday',
  },
]
