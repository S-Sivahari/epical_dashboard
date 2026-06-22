/**
 * Step-by-step guides for the admin portal.
 */

export const adminPortalGuideSections = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    summary: 'Overview, pending approvals queue, activity, and company news.',
    linkTo: '/admin',
    linkLabel: 'Dashboard',
    steps: [
      'Open Dashboard from the top navigation.',
      'Review KPIs and charts on the left — headcount, attendance, leave trends.',
      'Use the Pending approvals queue on the right to approve or reject leave and document requests.',
      'Rejecting always requires a reason; the employee sees it in their portal.',
      'Scroll activity and news panels for recent changes across the company.',
    ],
  },
  {
    key: 'leaves',
    title: 'Leave management',
    summary: 'Approve, reject, revoke, and manage compensation credits.',
    linkTo: '/admin/leaves',
    linkLabel: 'Manage Leaves',
    steps: [
      'Leave Requests tab shows Pending, Approved, and Rejected for the current month.',
      'Pending — approve or reject (reason required). Employee applications appear here immediately.',
      'Approved — revoke with reason if plans change; revoked leaves move to Rejected and balance is restored.',
      'Rejected — includes both rejected applications and revoked approved leaves for the month.',
      'Approved column (left) lists all approved leaves in the month; Recent Activity shows applies, approvals, rejections, and employee cancellations.',
      'Compensation tab — credit compensation leave days to employees; they can use them once credited.',
    ],
    notes: [
      'You cannot revoke approved leave that has already ended (past end date).',
      'Employee-cancelled pending requests appear in Recent Activity, not in the status tabs.',
    ],
  },
  {
    key: 'employees',
    title: 'Employees',
    summary: 'Add, edit, and view employee profiles and leave allocations.',
    linkTo: '/admin/employees',
    linkLabel: 'Manage Employees',
    steps: [
      'Browse the employee list and open a profile for full details.',
      'Add Employee to onboard someone new — set join date for earned-leave accrual.',
      'Edit employee to update role, contact, photo, and optional per-person leave allotments.',
      'From an employee profile or leave hub, open leave summary to see balances and history.',
    ],
  },
  {
    key: 'projects',
    title: 'Projects & timesheets',
    summary: 'Projects, task assignment, and timesheet review.',
    linkTo: '/admin/timesheet?tab=timesheets',
    linkLabel: 'Timesheets',
    steps: [
      'Create and manage projects; assign employees to tasks.',
      'Employees check in on assigned tasks from their Timesheet page.',
      'Review submitted sessions, approvals, and analytics from the Projects hub.',
    ],
  },
  {
    key: 'documents',
    title: 'Document requests',
    summary: 'Fulfill employee document requests and upload files.',
    linkTo: '/admin/documents',
    linkLabel: 'Documents',
    steps: [
      'Open Requested to review pending employee document requests.',
      'Upload the fulfillment file before approving a request.',
      'Approve or reject with a reason; rejected requests show the reason to the employee.',
      'Use History to browse past requests; filter by Approved or Rejected and download fulfilled files.',
    ],
  },
  {
    key: 'payslips',
    title: 'Payslips',
    summary: 'Upload and publish payslip batches for employees.',
    linkTo: '/admin/payslips',
    linkLabel: 'Payslips',
    steps: [
      'Create or open a payslip batch for a pay period.',
      'Upload PDFs per employee and publish when ready.',
      'Employees download payslips from their Documents page after publication.',
    ],
  },
  {
    key: 'calendar',
    title: 'Company calendar',
    summary: 'Holidays and company events visible to everyone.',
    linkTo: '/admin/calendar',
    linkLabel: 'Calendar',
    steps: [
      'Add national, company, or optional holidays.',
      'Add company events with date and optional time.',
      'Skip a holiday when it is a working day for your team.',
      'Employees see the same calendar when planning leave.',
    ],
  },
  {
    key: 'tickets',
    title: 'Tickets',
    summary: 'Employee support tickets and status updates.',
    linkTo: '/admin/tickets',
    linkLabel: 'Tickets',
    steps: [
      'View open tickets in the kanban board.',
      'Open a ticket to review the employee description and update status.',
      'Move tickets between Pending, In Progress, and Completed as work progresses.',
      'Delete a ticket only when it should be permanently removed from the system.',
    ],
  },
  {
    key: 'news',
    title: 'Company news',
    summary: 'Announcements shown on employee and admin dashboards.',
    linkTo: '/admin/news',
    linkLabel: 'News',
    steps: [
      'Publish news items with title, body, and optional image.',
      'Active items appear in the dashboard marquee and news panels.',
    ],
  },
  {
    key: 'shortcuts',
    title: 'Shortcuts & quick settings',
    summary: 'Navigation wheel, notification sounds, and the hidden quick panel.',
    linkTo: '/admin/help',
    linkLabel: 'Admin Guide',
    steps: [
      'Navigation wheel — hold Ctrl+Shift anywhere in the portal to open the radial menu. Tap Shift to move to the next section, or hold Shift to cycle quickly. Release Ctrl to jump to the highlighted page.',
      'Quick panel — press Ctrl+Left Arrow to slide open a panel from the right with a live clock and timezone picker.',
      'Notification sound — in the quick panel, use Import sound to upload an audio file from your device (saved in this browser). Tap Test to preview; Reset returns to the default app sound.',
      'Imported sounds play for your dashboard notifications (alerts, updates, etc.) on this device.',
      'Close the quick panel with the × button, by clicking outside, or press Ctrl+Left Arrow again.',
    ],
    notes: [
      'Shortcuts are disabled while typing in a form field.',
      'Custom notification sounds are stored locally in your browser, not on the server.',
    ],
  },
]
