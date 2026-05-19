export type EmploymentType = 'Full-time' | 'Contract' | 'Intern'
export type EmployeeStatus = 'Active' | 'On Leave' | 'Probation' | 'Inactive'

export interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  department: string
  designation: string
  role: string
  employmentType: EmploymentType
  joinedAt: string
  status: EmployeeStatus
  email: string
  personalEmail?: string
  phone?: string
  avatarUrl?: string
  reportingManagerId?: string
  salaryGrade?: string
  ctc?: number
}

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected'

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  type: string
  from: string
  to: string
  days: number
  reason: string
  status: LeaveStatus
}

export interface Holiday {
  id: string
  title: string
  date: string
}

export interface CompensationLeave {
  id: string
  employeeId: string
  employeeName: string
  days: number
}

export interface ProjectTimesheetRow {
  id: string
  employeeId: string
  employeeName: string
  project: string
  client: string
  date: string
  hours: number
  task: string
}

export interface Course {
  id: string
  title: string
  topic: string
  platform: string
  link: string
}

export interface Achievement {
  id: string
  title: string
  description: string
  imageUrl?: string
  createdAt: string
}

export interface NewsItem {
  id: string
  title: string
  excerpt: string
  content: string
  imageUrl?: string
  publishedAt: string
  featured?: boolean
}

export type TicketStatus = 'Pending' | 'In Progress' | 'Completed'
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Ticket {
  id: string
  employeeId: string
  employeeName: string
  title: string
  priority: TicketPriority
  status: TicketStatus
  createdAt: string
}

export interface DocumentItem {
  id: string
  fileName: string
  employeeName: string
  uploadedAt: string
  status: 'Approved' | 'Requested' | 'Rejected'
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  description?: string
  color?: string
}
