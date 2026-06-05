export const company = {
  name: 'Epical Technologies',
  portalTitle: 'Employee Portal',
  logo: 'E',
}

export const employee = {
  id: 'EMP-2024-0847',
  name: 'Sarah Mitchell',
  email: 'sarah.mitchell@epical.com',
  designation: 'Senior Product Designer',
  joiningDate: '2021-03-15',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
}

export const announcements = [
  { id: 1, title: 'Q2 Town Hall — June 12', excerpt: 'Join leadership for quarterly updates and team recognition.', gradient: 'from-emerald-600 to-teal-500' },
  { id: 2, title: 'New Health Benefits Enrollment', excerpt: 'Open enrollment window closes May 30. Review your options.', gradient: 'from-green-600 to-lime-500' },
  { id: 3, title: 'Remote Work Policy Update', excerpt: 'Updated hybrid schedule guidelines effective next month.', gradient: 'from-primary-700 to-emerald-500' },
  { id: 4, title: 'Team Offsite — Bangalore', excerpt: 'Annual design team retreat scheduled for July 8–10.', gradient: 'from-teal-600 to-cyan-500' },
]

export const leaveBalances = [
  { type: 'Casual Leave', used: 4, total: 12, color: '#266b1c', key: 'casual' },
  { type: 'Sick Leave', used: 2, total: 10, color: '#3b82f6', key: 'sick' },
  { type: 'Earned Leave', used: 6, total: 18, color: '#8b5cf6', key: 'earned' },
]

export const leaveChartData = [
  { name: 'Casual', value: 4, color: '#266b1c' },
  { name: 'Sick', value: 2, color: '#3b82f6' },
  { name: 'Earned', value: 6, color: '#8b5cf6' },
  { name: 'Remaining', value: 28, color: '#e2e8f0' },
]

export const holidays = [
  { date: '2026-05-26', name: 'Memorial Day' },
  { date: '2026-06-19', name: 'Juneteenth' },
  { date: '2026-07-04', name: 'Independence Day' },
  { date: '2026-08-15', name: 'Company Foundation Day' },
  { date: '2026-09-07', name: 'Labor Day' },
]

export const calendarEvents = [
  { id: '1', title: 'Team Standup', date: '2026-05-20', type: 'meeting' },
  { id: '2', title: 'Design Review', date: '2026-05-22', type: 'meeting' },
  { id: '3', title: 'Memorial Day', date: '2026-05-26', type: 'holiday' },
  { id: '4', title: 'Product Launch', date: '2026-05-28', type: 'event' },
  { id: '5', title: 'All Hands', date: '2026-06-02', type: 'meeting' },
]

export const leaveHistory = [
  { id: 1, type: 'Casual Leave', leaveDuration: 'Full Day', startDate: '2026-04-10', endDate: '2026-04-11', days: 2, totalLeaveDays: 2, reason: 'Personal errands', status: 'Approved' },
  { id: 2, type: 'Sick Leave', leaveDuration: 'Full Day', startDate: '2026-03-05', endDate: '2026-03-05', days: 1, totalLeaveDays: 1, reason: 'Medical appointment', status: 'Approved' },
  { id: 3, type: 'Earned Leave', leaveDuration: 'Full Day', startDate: '2026-02-14', endDate: '2026-02-18', days: 5, totalLeaveDays: 5, reason: 'Family vacation', status: 'Approved' },
  { id: 4, type: 'Casual Leave', leaveDuration: 'Half Day', halfDaySession: 'First Half', startDate: '2026-05-25', endDate: '2026-05-25', days: 0.5, totalLeaveDays: 0.5, reason: 'Personal appointment', status: 'Pending' },
]

export const timesheetProjects = ['Epical HRMS', 'Design System', 'Mobile App', 'Internal Tools']

export const weeklyHours = [
  { day: 'Mon', hours: 8.5, target: 8 },
  { day: 'Tue', hours: 7.5, target: 8 },
  { day: 'Wed', hours: 9, target: 8 },
  { day: 'Thu', hours: 8, target: 8 },
  { day: 'Fri', hours: 6.5, target: 8 },
]

export const workSessions = [
  { id: 1, project: 'Epical HRMS', task: 'Dashboard UI components', start: '09:00', end: '12:30', hours: 3.5, date: '2026-05-18' },
  { id: 2, project: 'Design System', task: 'Token documentation', start: '13:30', end: '17:00', hours: 3.5, date: '2026-05-18' },
  { id: 3, project: 'Epical HRMS', task: 'Leave module wireframes', start: '09:15', end: '12:00', hours: 2.75, date: '2026-05-17' },
]

export const documentTypes = ['Offer Letter', 'Joining Letter', 'Experience Certificate', 'Salary Certificate', 'ITR Document']

export const documentRequests = [
  { id: 1, type: 'Salary Certificate', reason: 'Home loan application', requestedDate: '2026-05-10', status: 'Approved' },
  { id: 2, type: 'Experience Certificate', reason: 'Visa processing', requestedDate: '2026-04-22', status: 'Pending' },
  { id: 3, type: 'ITR Document', reason: 'Tax filing', requestedDate: '2026-03-15', status: 'Approved' },
]

export const approvedDocuments = [
  { id: 1, name: 'Salary Certificate — May 2026', type: 'Salary Certificate', date: '2026-05-12' },
  { id: 2, name: 'ITR Document — FY 2025', type: 'ITR Document', date: '2026-03-18' },
]

export const payslips = [
  { id: 1, month: 'April 2026', amount: '$8,450.00', date: '2026-04-30' },
  { id: 2, month: 'March 2026', amount: '$8,450.00', date: '2026-03-31' },
  { id: 3, month: 'February 2026', amount: '$8,450.00', date: '2026-02-28' },
]

export const courses = [
  { id: 1, title: 'Advanced React Patterns', category: 'Development', duration: '12h', progress: 65, enrolled: true, suggested: true },
  { id: 2, title: 'Leadership Essentials', category: 'Management', duration: '8h', progress: 100, enrolled: true, suggested: false },
  { id: 3, title: 'UX Research Methods', category: 'Design', duration: '10h', progress: 30, enrolled: true, suggested: true },
  { id: 4, title: 'Data Privacy & Compliance', category: 'Compliance', duration: '4h', progress: 0, enrolled: false, suggested: true },
  { id: 5, title: 'Agile Project Management', category: 'Management', duration: '6h', progress: 0, enrolled: false, suggested: true },
]

export const achievements = [
  { id: 1, title: 'Employee of the Quarter', date: '2026-Q1', description: 'Outstanding contribution to product design', icon: 'trophy' },
  { id: 2, title: '5 Years Milestone', date: '2026-03-15', description: 'Completed 5 years at Epical Technologies', icon: 'award' },
  { id: 3, title: 'Innovation Champion', date: '2025-11-20', description: 'Led design system adoption across teams', icon: 'star' },
  { id: 4, title: 'Perfect Attendance', date: '2025', description: 'Zero unplanned absences for the year', icon: 'medal' },
]

export const supportTickets = [
  { id: 'TKT-1042', title: 'VPN connection issues', priority: 'High', reason: 'Cannot connect to office VPN from home', status: 'In Progress', date: '2026-05-16' },
  { id: 'TKT-1038', title: 'Payslip download error', priority: 'Medium', reason: 'PDF download fails on mobile', status: 'Resolved', date: '2026-05-10' },
  { id: 'TKT-1031', title: 'Leave balance mismatch', priority: 'Low', reason: 'Earned leave shows incorrect balance', status: 'Open', date: '2026-05-05' },
]

export const notifications = [
  { id: 1, title: 'Leave request approved', message: 'Your casual leave for May 25–26 has been approved.', time: '2h ago', read: false },
  { id: 2, title: 'New course assigned', message: 'Data Privacy & Compliance has been assigned to you.', time: '5h ago', read: false },
  { id: 3, title: 'Document ready', message: 'Your salary certificate is ready for download.', time: '1d ago', read: true },
]

