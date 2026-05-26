export type EmploymentType = 'Full-time' | 'Contract' | 'Intern'
export type EmployeeStatus = 'Active' | 'Inactive' | 'Notice Period' | 'Deactivated' | 'Archived'

export type EmployeeActivityType = 'status_change' | 'profile_edit'

export interface EmployeeActivityEntry {
  type: EmployeeActivityType
  at: string
  by: string
  summary: string
  reason?: string
  fromStatus?: string
  toStatus?: string
  changedFields?: string[]
}

export interface Employee {
  id: string
  employeeId: string
  firstName: string
  middleName?: string
  lastName?: string
  address?: string
  permanentAddress?: string
  communicationAddress?: string
  dob?: string
  gender?: string
  department: string
  designation: string
  role: string
  reportingManager?: string
  managerId?: string
  employmentType: EmploymentType
  joinedAt: string
  status: EmployeeStatus
  email: string
  personalEmail?: string
  phone?: string
  avatarUrl?: string
  salaryGrade?: string
  ctc?: number
  bankName?: string
  accountNumber?: string
  ifsc?: string
  uan?: string
  pfEsi?: 'on' | 'off'
  aadhaar?: string
  pan?: string
  passport?: string
  emergencyContact?: {
    name?: string
    phone?: string
    email?: string
    relation?: string
    address?: string
  }
  activityHistory?: EmployeeActivityEntry[]
  [key: string]: unknown
}

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  type: string
  leaveDuration: 'Full Day' | 'Half Day'
  halfDaySession?: 'First Half' | 'Second Half'
  from: string
  to: string
  days: number
  totalLeaveDays?: number
  reason: string
  status: LeaveStatus
  rejectionReason?: string
  createdAt?: string
  updatedAt?: string
  cancellationReason?: string
  approvalDate?: string
  approvedBy?: string
}

/** Employee leave rollup for admin profile modal (`GET /leaves/employee/:id/summary`). */
export interface EmployeeLeaveSummary {
  employeeId: string
  employeeName?: string
  balances: Array<{
    type: string
    total: number
    used: number
    pending: number
    remaining: number
  }>
  currentLeaves: LeaveRequest[]
  history: LeaveRequest[]
}

export interface Holiday {
  id: string
  title: string
  date: string
  description?: string
  type: 'National' | 'Company' | 'Optional' | 'Company Event'
  skipped?: boolean
  skippedReason?: string
}

/** Timed / all-day company events (meetings, town halls) stored separately from holidays */
export interface CompanyCalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  description?: string
}

export interface CompensationLeave {
  id: string
  employeeId: string
  employeeName: string
  days: number
  reason: string
  status: 'Active' | 'Cancelled' | 'Archived'
  createdBy: string
  createdAt: string
  updatedAt?: string
  cancelled?: boolean
  cancelledBy?: string
  cancelledAt?: string
  cancellationReason?: string
  archivedAt?: string
  archivedReason?: string
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

export interface TicketComment {
  id: string
  authorId: string
  authorName: string
  authorRole: 'Admin' | 'Employee'
  text: string
  createdAt: string
}

export interface TicketAttachmentMeta {
  filename: string
  contentType: string
  uploadedAt: string
}

export interface Ticket {
  id: string
  employeeId: string
  employeeName: string
  title: string
  description?: string
  priority: TicketPriority
  status: TicketStatus
  projectId?: string
  projectName?: string
  comments?: TicketComment[]
  attachment?: TicketAttachmentMeta
  hasAttachment?: boolean
  createdAt: string
  updatedAt?: string
}

export type DocumentRequestStatus = 'Requested' | 'Approved' | 'Rejected'

/** HR document request workflow (requested → approved/rejected). */
export interface DocumentRequestRecord {
  id: string
  employeeUserId: string
  employeeId: string
  employeeName: string
  documentType: string
  documentName: string
  reason: string
  status: DocumentRequestStatus
  requestedAt: string
  processedAt?: string
  processedBy?: string
  rejectionReason?: string
  /** Set by API after upload fulfillments (admin). */
  hasFulfillmentFile?: boolean
}

/** @deprecated Legacy shape — prefer DocumentRequestRecord */
export interface DocumentItem {
  id: string
  fileName: string
  employeeName: string
  uploadedAt: string
  status: DocumentRequestStatus
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  description?: string
  color?: string
}