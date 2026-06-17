export type DailyNoteStatus = 'draft' | 'in_progress' | 'completed' | 'email_sent'

export type NoteActor = {
  id: string
  name: string
}

export type NoteProjectOption = {
  id: string
  name: string
  client: string
  technologyNode: string
  status: string
  accessType?: 'public' | 'private'
  visibleUsers?: string[]
}

export type NoteProjectEmployee = {
  id: string
  employeeId: string
  name: string
}

export type NoteChildBlock = {
  _id: string
  title: string
  projectId: string
  projectName: string
  employeeIds: string[]
  employees: NoteActor[]
  description: string
  includeInEmail: boolean
  sortOrder: number
  archived: boolean
  createdBy: NoteActor
  updatedBy: NoteActor
  createdAt: string
  updatedAt: string
}

export type NoteEmailDeliveryStatus = 'sent' | 'failed' | 'partial'

export type NoteEmailDelivery = {
  sentBy: NoteActor
  sentAt: string
  recipientCount: number
  deliveryStatus: NoteEmailDeliveryStatus
  errorMessage?: string
}

export type NoteEmailRecipient = {
  id: string
  name: string
  email: string
}

export type NoteEmailEmployeeEntry = {
  childBlockId: string
  employeeName: string
  lines: string[]
  descriptionText: string
}

export type NoteEmailProjectGroup = {
  projectId: string
  projectName: string
  employees: NoteEmailEmployeeEntry[]
}

export type DailyNotesEmailSendOptions = {
  recipientEmployeeIds?: string[]
}

export type DailyNotesEmailPreview = {
  subject: string
  html: string
  text: string
  date: string
  dailyBlockName: string
  allRecipients: NoteEmailRecipient[]
  recipients: NoteEmailRecipient[]
  recipientEmployeeCount: number
  recipientEmailCount: number
  recipientScope: 'all_working_employees' | 'selected_employees'
  projectGroups: NoteEmailProjectGroup[]
  canSend: boolean
  warnings: string[]
}

export type DailyNotesEmailSendResult = {
  block: DailyNoteBlock
  delivery: NoteEmailDelivery & { successCount: number }
}

export type DailyNoteBlock = {
  _id: string
  date: string
  name: string
  status: DailyNoteStatus
  archived: boolean
  childBlockCount: number
  childBlocks: NoteChildBlock[]
  lastEmailDelivery: NoteEmailDelivery | null
  createdBy: NoteActor
  updatedBy: NoteActor
  createdAt: string
  updatedAt: string
}

export type ChildBlockInput = {
  title: string
  projectId?: string
  employeeIds?: string[]
  description?: string
  includeInEmail?: boolean
}

export type NoteSearchMatchField = 'date' | 'title' | 'project' | 'employee' | 'description'

export type NoteSearchResult = {
  dailyBlockId: string
  date: string
  dailyBlockName: string
  dailyBlockStatus: DailyNoteStatus
  dailyBlockArchived: boolean
  childBlockId: string
  childTitle: string
  projectId: string
  projectName: string
  employeeNames: string[]
  descriptionSnippet: string
  matchedFields: NoteSearchMatchField[]
  childArchived: boolean
}

export type NotesSearchResponse = {
  results: NoteSearchResult[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export type NotesSearchFilterOptions = {
  projects: Array<{ id: string; name: string }>
  employees: Array<{ id: string; name: string }>
}

export type NotesSearchParams = {
  q?: string
  from?: string
  to?: string
  week?: string
  projectId?: string
  employeeId?: string
  status?: DailyNoteStatus
  page?: number
  limit?: number
}

export type NotesDelegation = {
  _id: string
  date: string
  employeeId: string
  employeeName: string
  assignedBy: NoteActor & { email?: string }
  createdAt: string
  updatedAt: string
}

export type NotesAccess = {
  role: 'admin' | 'employee'
  canAccessToday: boolean
  showNotesNav: boolean
  delegatedDates: string[]
}
