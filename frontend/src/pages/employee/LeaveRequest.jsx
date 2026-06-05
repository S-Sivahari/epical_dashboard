import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Controller } from 'react-hook-form'
import { AlertTriangle, X, Clock, History, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { useFormSessionDraft } from '@hooks/useFormSessionDraft'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { Button } from '@components/employee/ui/button'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/employee/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { DataTable } from '@components/employee/shared/DataTable'
import { SearchBar } from '@components/employee/shared/SearchBar'
import { FilterDropdown } from '@components/employee/shared/FilterDropdown'
import { useLeaveStore } from '@store/employee/leaveStore'
import { useToast } from '@components/employee/shared/ToastProvider'
import { useAuthStore } from '@store/authStore'

import * as leaveService from '@services/leaveService'
import { listCompensation } from '@services/compensationService'
import { DateInput } from '@components/shared/DateInput'
import {
  getLeaveDateBounds,
  ISO_DATE_REGEX,
  leaveRangeError,
  parseIsoDate,
} from '@/utils/dateValidation'
import { canCancelLeave } from '@/utils/leaveFilters'
import { formatLeaveBalances } from '@/utils/leaveBalances'
import { getRequestedLeaveDays, isCasualSameDayLeave } from '@/utils/leaveCalculator'

const leaveBounds = getLeaveDateBounds()

const leaveSchema = z
  .object({
    type: z.string().min(1, 'Select leave type'),
    leaveDuration: z.enum(['Full Day', 'Half Day']),
    halfDaySession: z.string().optional(),
    fromDate: z
      .string()
      .min(1, 'From date required')
      .regex(ISO_DATE_REGEX, 'Enter a valid date as dd/mm/yyyy')
      .refine((v) => parseIsoDate(v).valid, 'Invalid calendar date')
      .refine(
        (v) => v >= leaveBounds.min && v <= leaveBounds.max,
        `Leave can only be applied from today up to ${leaveBounds.max.split('-').reverse().join('/')}`,
      ),
    toDate: z
      .string()
      .min(1, 'To date required')
      .regex(ISO_DATE_REGEX, 'Enter a valid date as dd/mm/yyyy')
      .refine((v) => parseIsoDate(v).valid, 'Invalid calendar date')
      .refine(
        (v) => v >= leaveBounds.min && v <= leaveBounds.max,
        `Leave can only be applied from today up to ${leaveBounds.max.split('-').reverse().join('/')}`,
      ),
    reason: z
      .string()
      .min(1, 'Please provide a reason for leave')
      .max(500, 'Reason must be 500 characters or less'),
  })
  .superRefine((data, ctx) => {
    if (data.leaveDuration === 'Half Day') {
      if (!data.halfDaySession) {
        ctx.addIssue({ path: ['halfDaySession'], code: 'custom', message: 'Select First Half or Second Half' })
      }
      if (data.fromDate && data.toDate && data.fromDate !== data.toDate) {
        ctx.addIssue({ path: ['toDate'], code: 'custom', message: 'From and To date must match for half-day leave' })
      }
    }
    if (data.fromDate && data.toDate) {
      const rangeErr = leaveRangeError(data.fromDate, data.toDate)
      if (rangeErr) {
        ctx.addIssue({ path: ['toDate'], code: 'custom', message: rangeErr })
      }
    }
  })

const leaveTypes = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Compensation Leave', 'LOP']
const leaveDurations = ['Full Day', 'Half Day']
const halfDaySessions = ['First Half', 'Second Half']

const BALANCE_SHORT_LABELS = {
  casual: 'Casual',
  sick: 'Sick',
  earned: 'Earned',
  compensation: 'Comp',
  lop: 'LOP',
}

function currentMonthPrefix() {
  return new Date().toISOString().slice(0, 7)
}

const CARD_CLASS = portalCardClass({ className: 'emp-leave-card' })

function SectionHeader({ icon: Icon, title, description, children, className, noBorder = false, compact = false }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        noBorder ? 'mb-2 border-b-0 pb-0' : 'mb-5 border-b border-border pb-4',
        className,
      )}
    >
      <div className={cn('flex min-w-0 items-start', compact ? 'gap-2' : 'gap-3')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
            compact ? 'h-8 w-8' : 'h-10 w-10',
          )}
        >
          <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </div>
        <div className="min-w-0">
          <h3 className={cn('font-heading font-semibold text-foreground', compact ? 'text-base' : 'text-lg')}>
            {title}
          </h3>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">{children}</div> : null}
    </div>
  )
}

function getVisiblePageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set([1, total, current, current - 1, current + 1])
  return [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
}
function formatAppliedDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

function formatLeaveDayCount(row) {
  if (typeof row.days === 'string' && String(row.days).startsWith('+')) return row.days
  if (row.leaveDuration === 'Half Day') return 0.5
  const days = Number(row.days)
  return Number.isNaN(days) ? row.days : days
}

const columns = [
  { key: 'type', label: 'Leave Type' },
  { key: 'from', label: 'Start Date' },
  { key: 'to', label: 'End Date' },
  { key: 'days', label: 'Days', render: (row) => formatLeaveDayCount(row) },
  {
    key: 'lopDays',
    label: 'LOP',
    render: (row) => (row.lopDays > 0 ? `${row.lopDays}d` : '—'),
  },
  {
    key: 'createdAt',
    label: 'Applied',
    render: (row) => (
      <div className="min-w-[6.5rem]">
        <span>{formatAppliedDate(row.createdAt)}</span>
        {row.recordKind === 'compensation' && row.reason ? (
          <div className="emp-leave-history-note mt-1.5 max-w-[200px] rounded-md border border-border bg-slate-50 px-2 py-1.5 text-[11px] leading-snug">
            {row.reason}
          </div>
        ) : null}
        {row.status === 'Rejected' && row.rejectionReason ? (
          <div className="emp-leave-history-note mt-1.5 max-w-[200px] rounded-md border border-border bg-slate-50 px-2 py-1.5 text-[11px] leading-snug">
            {row.rejectionReason}
          </div>
        ) : null}
        {row.status === 'Cancelled' && row.cancelReason ? (
          <div className="emp-leave-history-note mt-1.5 max-w-[200px] rounded-md border border-border bg-slate-50 px-2 py-1.5 text-[11px] leading-snug">
            {row.cancelReason}
          </div>
        ) : null}
      </div>
    ),
  },
  { key: 'status', label: 'Status' },
]

export default function LeaveRequest() {
  const { requests, fetchRequests, addRequest } = useLeaveStore()
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [historyFromDate, setHistoryFromDate] = useState('')
  const [historyToDate, setHistoryToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [leaveBalances, setLeaveBalances] = useState(() => formatLeaveBalances({}, { includeLop: true }))
  const [holidays, setHolidays] = useState([])
  const [compensationEntries, setCompensationEntries] = useState([])

  const loadCompensation = async () => {
    try {
      const data = await listCompensation()
      setCompensationEntries(data)
    } catch {
      console.error('Failed to load compensation entries')
    }
  }

  const leaveFormDefaults = {
    leaveDuration: 'Full Day',
    type: '',
    halfDaySession: '',
    fromDate: '',
    toDate: '',
    reason: '',
  }

  const { control, register, handleSubmit, setValue, watch, reset, setError, clearErrors, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(leaveSchema),
    defaultValues: leaveFormDefaults,
  })

  const { clearDraft } = useFormSessionDraft('employee-leave-apply', { reset, watch }, {
    defaultValues: leaveFormDefaults,
  })

  const leaveDuration = watch('leaveDuration')
  const fromDate = watch('fromDate')
  const toDate = watch('toDate')
  const halfDaySession = watch('halfDaySession')
  const selectedLeaveType = watch('type')

  const monthPrefix = currentMonthPrefix()

  const pendingSickDays = useMemo(
    () =>
      requests
        .filter(
          (r) =>
            r.status === 'Pending' &&
            r.type === 'Sick Leave' &&
            typeof r.from === 'string' &&
            r.from.startsWith(monthPrefix),
        )
        .reduce((sum, r) => sum + (Number(r.days) || 0), 0),
    [requests, monthPrefix],
  )

  const sickBalanceRemaining = useMemo(() => {
    const sick = leaveBalances.find((lb) => lb.key === 'sick')
    if (!sick) return 0
    const remaining = sick.remaining ?? Math.max(0, sick.total - sick.used)
    return Math.max(0, remaining - pendingSickDays)
  }, [leaveBalances, pendingSickDays])

  const pendingEarnedDays = useMemo(() => {
    const yearPrefix = String(new Date().getFullYear())
    return requests
      .filter(
        (r) =>
          r.status === 'Pending' &&
          r.type === 'Earned Leave' &&
          typeof r.from === 'string' &&
          r.from.startsWith(yearPrefix),
      )
      .reduce((sum, r) => sum + (Number(r.days) || 0), 0)
  }, [requests])

  const earnedBalanceRemaining = useMemo(() => {
    const earned = leaveBalances.find((lb) => lb.key === 'earned')
    if (!earned) return 0
    const remaining = earned.remaining ?? Math.max(0, earned.total - earned.used)
    return Math.max(0, remaining - pendingEarnedDays)
  }, [leaveBalances, pendingEarnedDays])

  const pendingCompensationDays = useMemo(
    () => {
      const yearPrefix = String(new Date().getFullYear())
      return requests
        .filter(
          (r) =>
            r.status === 'Pending' &&
            r.type === 'Compensation Leave' &&
            typeof r.from === 'string' &&
            r.from.startsWith(yearPrefix),
        )
        .reduce((sum, r) => sum + (Number(r.days) || 0), 0)
    },
    [requests],
  )

  const compensationBalanceRemaining = useMemo(() => {
    const comp = leaveBalances.find((lb) => lb.key === 'compensation')
    if (!comp) return 0
    const remaining = comp.remaining ?? Math.max(0, comp.total - comp.used)
    return Math.max(0, remaining - pendingCompensationDays)
  }, [leaveBalances, pendingCompensationDays])

  const availableLeaveTypes = useMemo(
    () =>
      leaveTypes.filter((t) => {
        if (t === 'Sick Leave') return sickBalanceRemaining > 0
        if (t === 'Compensation Leave') return compensationBalanceRemaining > 0
        return true
      }),
    [sickBalanceRemaining, compensationBalanceRemaining],
  )

  const casualBalanceRemaining = useMemo(() => {
    const casual = leaveBalances.find((lb) => lb.key === 'casual')
    if (!casual) return 0
    const pendingCasual = requests
      .filter(
        (r) =>
          r.status === 'Pending' &&
          r.type === 'Casual Leave' &&
          typeof r.from === 'string' &&
          r.from.startsWith(monthPrefix),
      )
      .reduce((sum, r) => sum + (Number(r.days) || 0), 0)
    const remaining = casual.remaining ?? Math.max(0, casual.total - casual.used)
    return Math.max(0, remaining - pendingCasual)
  }, [leaveBalances, requests, monthPrefix])

  const isCasualSameDay =
    selectedLeaveType === 'Casual Leave' && fromDate && isCasualSameDayLeave(fromDate)

  const showLopNotice = selectedLeaveType === 'LOP'

  const [conflictMessage, setConflictMessage] = useState('')
  const [holidayWarning, setHolidayWarning] = useState('')

  const [cancellingId, setCancellingId] = useState(null)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [leaveToCancel, setLeaveToCancel] = useState(null)
  const [exceedDialogOpen, setExceedDialogOpen] = useState(false)
  const [exceedDialogMessage, setExceedDialogMessage] = useState('')

  const normalizeDate = (date) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toISOString().slice(0, 10)
  }

  const getDateRange = (start, end) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const dates = []
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10))
    }
    return dates
  }

  const getRequestDates = (request) => {
    const start = normalizeDate(request.from)
    const end = normalizeDate(request.to)
    if (request.leaveDuration === 'Half Day') {
      return [{ date: start, session: request.halfDaySession }]
    }
    return getDateRange(start, end).map((date) => ({ date, session: 'Full Day' }))
  }

  const validateLeaveConflict = () => {
    if (!user || !fromDate || !toDate || !leaveDuration) {
      return { message: '', fields: [] }
    }

    const selectedFrom = normalizeDate(fromDate)
    const selectedTo = normalizeDate(toDate)
    if (!selectedFrom || !selectedTo) {
      return { message: '', fields: [] }
    }

    const selectedDates = getDateRange(selectedFrom, selectedTo)
    const selectedEntries = selectedDates.map((date) => ({ date, session: leaveDuration === 'Half Day' ? halfDaySession : 'Full Day' }))
    const existing = requests.filter(
      (r) => r.employeeId === user.id && ['Approved', 'Pending'].includes(r.status)
    )

    for (const request of existing) {
      const requestEntries = getRequestDates(request)
      for (const selectedEntry of selectedEntries) {
        for (const requestEntry of requestEntries) {
          const sameDate = selectedEntry.date === requestEntry.date
          if (!sameDate) continue

          if (selectedEntry.session === 'Full Day' || requestEntry.session === 'Full Day') {
            return {
              message: 'Selected dates overlap with an existing full-day or half-day leave request.',
              fields: ['fromDate', 'toDate', 'halfDaySession'],
            }
          }

          if (selectedEntry.session === requestEntry.session) {
            const sessionLabel = selectedEntry.session === 'First Half' ? 'Morning' : 'Evening'
            return {
              message: `${sessionLabel} half-day leave already exists for the selected date.`,
              fields: ['fromDate', 'toDate', 'halfDaySession'],
            }
          }
        }
      }
    }

    return { message: '', fields: [] }
  }

  useEffect(() => {
    // Initial fetch
    fetchRequests()
    
    // Fetch Balances
    leaveService.getBalances().then((data) => {
      setLeaveBalances(formatLeaveBalances(data, { includeLop: true }))
    }).catch(console.error)

    // Fetch Holidays
    leaveService.getHolidays().then((data) => {
      const formatted = data
        .filter((h) => !h.skipped)
        .map((h) => ({ date: h.date, name: h.title }))
      setHolidays(formatted)
    }).catch(console.error)

    void loadCompensation()

    // Poll for updates every 5 seconds WITHOUT loading indicator
    const leaveInterval = setInterval(() => {
      fetchRequests()
    }, 5000)

    const balanceInterval = setInterval(() => {
      leaveService.getBalances().then((data) => {
        setLeaveBalances(formatLeaveBalances(data, { includeLop: true }))
      }).catch(console.error)
    }, 5000)

    const compensationInterval = setInterval(() => {
      void loadCompensation()
    }, 30000)

    return () => {
      clearInterval(leaveInterval)
      clearInterval(balanceInterval)
      clearInterval(compensationInterval)
    }
  }, [fetchRequests])

  useEffect(() => {
    if (selectedLeaveType === 'Sick Leave' && sickBalanceRemaining <= 0) {
      setValue('type', '', { shouldValidate: true })
    }
    if (selectedLeaveType === 'Compensation Leave' && compensationBalanceRemaining <= 0) {
      setValue('type', '', { shouldValidate: true })
    }
  }, [selectedLeaveType, sickBalanceRemaining, compensationBalanceRemaining, setValue])

  const getLeaveBalanceError = (data) => {
    const requestedDays = getRequestedLeaveDays(data.leaveDuration, data.fromDate, data.toDate, holidays)
    if (requestedDays <= 0) {
      return 'Selected dates have no working days. Adjust your dates or choose a working day for half-day leave.'
    }

    if (data.type === 'Casual Leave') {
      if (isCasualSameDayLeave(data.fromDate)) {
        return 'Casual leave must be applied before your leave date. Please submit same-day leave as LOP.'
      }
      if (casualBalanceRemaining <= 0) {
        return 'Your casual leave balance is used up for this month. Please apply as LOP instead.'
      }
      if (requestedDays > casualBalanceRemaining) {
        const paid = casualBalanceRemaining
        const excess = requestedDays - paid
        return (
          `Your request is for ${requestedDays} working day${requestedDays === 1 ? '' : 's'} but only ${paid} casual day${paid === 1 ? '' : 's'} ${paid === 1 ? 'is' : 'are'} left this month.\n\n` +
          `Please submit separate requests:\n` +
          `• ${paid} day${paid === 1 ? '' : 's'} as Casual Leave\n` +
          `• ${excess} day${excess === 1 ? '' : 's'} as LOP`
        )
      }
    }

    if (data.type === 'Earned Leave') {
      if (earnedBalanceRemaining <= 0) {
        return 'Your earned leave balance is used up. Please apply as LOP instead.'
      }
      if (requestedDays > earnedBalanceRemaining) {
        return (
          `Your request is for ${requestedDays} working day${requestedDays === 1 ? '' : 's'} but only ${earnedBalanceRemaining} earned day${earnedBalanceRemaining === 1 ? '' : 's'} ${earnedBalanceRemaining === 1 ? 'is' : 'are'} left.\n\n` +
          `Please submit separate requests for earned leave and LOP.`
        )
      }
    }

    if (data.type === 'Sick Leave' && requestedDays > sickBalanceRemaining) {
      return `Insufficient sick leave balance. You have ${sickBalanceRemaining} day${sickBalanceRemaining === 1 ? '' : 's'} left.`
    }

    if (data.type === 'Compensation Leave' && requestedDays > compensationBalanceRemaining) {
      return `Insufficient compensation leave balance. You have ${compensationBalanceRemaining} day${compensationBalanceRemaining === 1 ? '' : 's'} left.`
    }

    return ''
  }

  useEffect(() => {
    if (leaveDuration === 'Half Day' && fromDate) {
      setValue('toDate', fromDate, { shouldValidate: true, shouldDirty: true })
    }
  }, [leaveDuration, fromDate, setValue])

  useEffect(() => {
    if (errors.fromDate?.type === 'manual' || errors.toDate?.type === 'manual') {
      clearErrors(['fromDate', 'toDate'])
    }
  }, [fromDate, toDate, errors.fromDate, errors.toDate, clearErrors])

  useEffect(() => {
    const conflict = validateLeaveConflict()
    setConflictMessage(conflict.message)

    clearErrors(['fromDate', 'toDate', 'halfDaySession'])
    if (conflict.message) {
      conflict.fields.forEach((field) => {
        setError(field, { type: 'manual', message: conflict.message })
      })
    }
  }, [fromDate, toDate, leaveDuration, halfDaySession, requests, user, setError, clearErrors])

  // Holiday guidance: check if selected date range contains holidays/weekends
  useEffect(() => {
    if (!fromDate || !toDate) { setHolidayWarning(''); return }
    const start = new Date(fromDate)
    const end = new Date(toDate)
    if (end < start) { setHolidayWarning(''); return }

    const holidayHits = []
    let weekendCount = 0
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10)
      const dow = d.getDay()
      if (dow === 0 || dow === 6) {
        weekendCount++
      } else {
        const hol = holidays.find((h) => h.date === iso)
        if (hol) holidayHits.push(hol.name)
      }
    }

    const parts = []
    if (holidayHits.length > 0) {
      parts.push(`${holidayHits.length} holiday${holidayHits.length > 1 ? 's' : ''} (${holidayHits.join(', ')})`)
    }
    if (weekendCount > 0) {
      parts.push(`${weekendCount} weekend day${weekendCount > 1 ? 's' : ''}`)
    }

    if (parts.length > 0) {
      setHolidayWarning(`Your selection includes ${parts.join(' and ')} which will not count as leave days.`)
    } else {
      setHolidayWarning('')
    }
  }, [fromDate, toDate, holidays])

  const filtered = requests.filter((r) => {
    const matchSearch =
      !search ||
      r.type.toLowerCase().includes(search.toLowerCase()) ||
      (r.reason && r.reason.toLowerCase().includes(search.toLowerCase()))
    const matchStatus =
      statusFilter === 'all' ||
      r.status.toLowerCase() === statusFilter ||
      (statusFilter === 'approved' && r.status === 'Approved') ||
      (statusFilter === 'cancelled' && r.status === 'Cancelled')
    return matchSearch && matchStatus
  })

  const onError = (errors) => {
    console.log('Leave request validation failed', errors)
    toast({ title: 'Validation error', description: 'Please complete all required fields before submitting.' })
  }

  const handleCancelClick = (leave) => {
    if (!canCancelLeave(leave)) {
      toast({
        title: 'Cannot cancel',
        description: 'Approved leave that has already ended cannot be cancelled.',
      })
      return
    }
    setLeaveToCancel(leave)
    setCancelConfirmOpen(true)
  }

  const handleCancelConfirm = async () => {
    if (!leaveToCancel) return
    setCancellingId(leaveToCancel.id)
    try {
      await leaveService.cancelLeave(leaveToCancel.id)
      toast({ title: 'Cancelled', description: 'Your leave request has been cancelled.' })
      setCancelConfirmOpen(false)
      setLeaveToCancel(null)
      fetchRequests()
    } catch (err) {
      toast({ title: 'Error', description: err?.response?.data?.error || 'Failed to cancel leave request' })
    } finally {
      setCancellingId(null)
    }
  }

  const pendingLeaves = requests.filter((r) => r.status === 'Pending')

  const pendingColumns = useMemo(
    () => [
      { key: 'type', label: 'Leave Type' },
      { key: 'from', label: 'Start Date' },
      { key: 'to', label: 'End Date' },
      { key: 'days', label: 'Days', render: (row) => formatLeaveDayCount(row) },
      { key: 'status', label: 'Status' },
      {
        key: 'actions',
        label: 'Action',
        render: (row) =>
          canCancelLeave(row) ? (
            <button
              type="button"
              onClick={() => handleCancelClick(row)}
              disabled={cancellingId === row.id}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
              title="Cancel this request"
            >
              <X className="h-3.5 w-3.5" />
              {cancellingId === row.id ? 'Cancelling…' : 'Cancel'}
            </button>
          ) : (
            <span className="text-xs text-muted">—</span>
          ),
      },
    ],
    [cancellingId],
  )

  const compensationHistoryRows = useMemo(
    () =>
      compensationEntries.map((entry) => ({
        id: `comp-${entry.id}`,
        recordKind: 'compensation',
        type: 'Compensation Leave',
        leaveDuration: '—',
        from: entry.appliedDate,
        to: entry.appliedDate,
        days: `+${entry.days}`,
        createdAt: entry.appliedDate,
        status: 'Credited',
        reason: entry.reason,
        createdBy: entry.createdBy,
      })),
    [compensationEntries],
  )

  const historyLeaves = useMemo(() => {
    const matchesHistoryDateRange = (row) => {
      if (!historyFromDate && !historyToDate) return true
      const rowDate = normalizeDate(row.from) || normalizeDate(row.createdAt)
      if (!rowDate) return true
      if (historyFromDate && rowDate < historyFromDate) return false
      if (historyToDate && rowDate > historyToDate) return false
      return true
    }

    const leaveRows = filtered
      .filter((r) => r.status !== 'Pending')
      .map((r) => ({ ...r, recordKind: 'leave' }))
      .filter(matchesHistoryDateRange)

    const term = search.trim().toLowerCase()
    const compRows = compensationHistoryRows
      .filter((entry) => {
        const matchSearch =
          !term ||
          entry.type.toLowerCase().includes(term) ||
          (entry.reason && entry.reason.toLowerCase().includes(term))
        const matchStatus = statusFilter === 'all' || statusFilter === 'credited'
        return matchSearch && matchStatus
      })
      .filter(matchesHistoryDateRange)

    return [...leaveRows, ...compRows].sort((a, b) => {
      const da = new Date(a.createdAt || a.from || 0).getTime()
      const db = new Date(b.createdAt || b.from || 0).getTime()
      return db - da
    })
  }, [filtered, compensationHistoryRows, search, statusFilter, historyFromDate, historyToDate])

  const totalPages = Math.max(1, Math.ceil(historyLeaves.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedHistory = historyLeaves.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, historyFromDate, historyToDate, pageSize])

  const onSubmit = async (data) => {
    console.log('Leave request submitted', data)
    if (!user) {
      toast({ title: 'Error', description: 'User not authenticated' })
      return
    }

    const rangeErr = leaveRangeError(data.fromDate, data.toDate)
    if (rangeErr) {
      setError('toDate', { type: 'manual', message: rangeErr })
      toast({ title: 'Validation error', description: rangeErr })
      return
    }

    const conflict = validateLeaveConflict()
    if (conflict.message) {
      conflict.fields.forEach((field) => {
        setError(field, { type: 'manual', message: conflict.message })
      })
      toast({ title: 'Validation error', description: conflict.message })
      return
    }

    clearErrors(['fromDate', 'toDate', 'halfDaySession'])

    const balanceError = getLeaveBalanceError(data)
    if (balanceError) {
      setExceedDialogMessage(balanceError)
      setExceedDialogOpen(true)
      return
    }

    try {
      await addRequest({
        employeeId: user.id,
        employeeName: user.name,
        type: data.type,
        leaveDuration: data.leaveDuration,
        halfDaySession: data.leaveDuration === 'Half Day' ? data.halfDaySession : undefined,
        from: data.fromDate,
        to: data.toDate,
        reason: data.reason.trim(),
      })
      toast({ title: 'Success', description: 'Leave request submitted successfully!' })
      clearDraft()
      reset(leaveFormDefaults)
      
      // Refresh balances and notifications after submission
      const newBalances = await leaveService.getBalances()
      setLeaveBalances(formatLeaveBalances(newBalances, { includeLop: true }))
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Failed to submit leave request' })
    }
  }

  const visiblePageNumbers = getVisiblePageNumbers(currentPage, totalPages)

  return (
    <div
      className="emp-leave-page flex min-h-0 flex-1 flex-col overflow-hidden"
      data-employee-leave
    >
      <div className="emp-leave-top flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="emp-leave-upper">
          <div className="emp-leave-column emp-leave-column--left">
            <InteractiveCard className={cn(CARD_CLASS, 'emp-leave-top-panel emp-leave-balance-card')}>
              <SectionHeader
                icon={BarChart3}
                title="Leave balance"
                noBorder
                compact
                className="emp-leave-balance-head"
              />
              <div className="emp-leave-balance-grid">
                {leaveBalances.map((lb) => (
                  <div
                    key={lb.key}
                    className={cn(
                      'emp-leave-balance-tile',
                      lb.isLop && 'emp-leave-balance-tile--lop',
                    )}
                    style={{ '--balance-accent': lb.color }}
                  >
                    <span className="emp-leave-balance-tile__label">
                      {BALANCE_SHORT_LABELS[lb.key] ?? lb.type}
                    </span>
                    {lb.isLop ? (
                      <>
                        <span className="emp-leave-balance-tile__num emp-leave-balance-tile__num--lop">{lb.used}</span>
                        <span className="emp-leave-balance-tile__meta">taken</span>
                      </>
                    ) : (
                      <div className="emp-leave-balance-tile__stats">
                        <span className="emp-leave-balance-tile__stat">
                          <span className="emp-leave-balance-tile__num">{lb.used}</span>
                          <span className="emp-leave-balance-tile__meta">used</span>
                        </span>
                        <span className="emp-leave-balance-tile__stat">
                          <span className="emp-leave-balance-tile__num">{lb.remaining}</span>
                          <span className="emp-leave-balance-tile__meta">left</span>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </InteractiveCard>

            <InteractiveCard className={cn(CARD_CLASS, 'emp-leave-top-panel emp-leave-pending-card flex min-h-0 flex-col')}>
              <SectionHeader
                icon={Clock}
                title="Pending requests"
                compact
                className="emp-leave-section-head"
              />
              <div className="emp-leave-pending-body">
                <DataTable
                  columns={pendingColumns}
                  data={pendingLeaves}
                  statusKey="status"
                  compact
                  emptyMessage="No pending leave requests."
                />
              </div>
            </InteractiveCard>
          </div>

          <div className="emp-leave-column emp-leave-column--right">
        <InteractiveCard
          as="form"
          selectable={false}
          onSubmit={handleSubmit(onSubmit, onError)}
          className={cn(CARD_CLASS, 'emp-leave-apply-card emp-leave-top-panel emp-leave-form-stack flex w-full flex-col')}
        >
          <div className="emp-leave-apply-head">
            <h3 className="font-heading font-semibold text-foreground">Apply for leave</h3>
          </div>
          <div>
            <Label>Leave Type *</Label>
            <Select value={watch('type')} onValueChange={(v) => setValue('type', v)}>
              <SelectTrigger className="emp-leave-control mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {availableLeaveTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.type && <p className="mt-1 text-xs text-danger">{errors.type.message}</p>}
          </div>
          <div className="emp-leave-reason-block rounded-xl border border-primary/10 bg-white/85 shadow-sm">
            <Label htmlFor="leave-reason">Reason for leave *</Label>
            <Textarea
              id="leave-reason"
              rows={2}
              placeholder="Briefly explain why you are requesting leave…"
              className="mt-1.5 resize-y rounded-xl border-border bg-white"
              {...register('reason')}
            />
            {errors.reason && <p className="mt-1 text-xs text-danger">{errors.reason.message}</p>}
          </div>
          <div className="emp-leave-form-row grid md:grid-cols-2 xl:grid-cols-3">
            <div>
              <Label>Leave Duration *</Label>
              <Select value={watch('leaveDuration')} onValueChange={(v) => setValue('leaveDuration', v)}>
                <SelectTrigger className="emp-leave-control mt-1"><SelectValue placeholder="Select duration" /></SelectTrigger>
                <SelectContent>
                  {leaveDurations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.leaveDuration && <p className="mt-1 text-xs text-danger">{errors.leaveDuration.message}</p>}
            </div>
            <div>
              <Label>From Date *</Label>
              <Controller
                name="fromDate"
                control={control}
                render={({ field }) => (
                  <DateInput
                    className="emp-leave-control mt-1 rounded-xl"
                    value={field.value || ''}
                    onChange={field.onChange}
                    minDate={leaveBounds.min}
                    maxDate={leaveBounds.max}
                    error={errors.fromDate?.message}
                  />
                )}
              />
            </div>
            <div>
              <Label>To Date *</Label>
              <Controller
                name="toDate"
                control={control}
                render={({ field }) => (
                  <DateInput
                    className="emp-leave-control mt-1 rounded-xl"
                    value={field.value || ''}
                    onChange={field.onChange}
                    minDate={leaveBounds.min}
                    maxDate={leaveBounds.max}
                    disabled={leaveDuration === 'Half Day'}
                    error={errors.toDate?.message}
                  />
                )}
              />
            </div>
          </div>
          {leaveDuration === 'Half Day' && (
            <div>
              <Label>Half-day Session *</Label>
              <Select value={watch('halfDaySession')} onValueChange={(v) => setValue('halfDaySession', v)}>
                <SelectTrigger className="emp-leave-control mt-1"><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>
                  {halfDaySessions.map((session) => (
                    <SelectItem key={session} value={session}>{session}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.halfDaySession && <p className="mt-1 text-xs text-danger">{errors.halfDaySession.message}</p>}
            </div>
          )}
          {showLopNotice && (
            <div className="emp-leave-inline-alert flex items-start rounded-lg border border-red-200 bg-red-50 text-red-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
              <span>
                This request will be recorded as <strong>LOP (Loss of Pay)</strong> and added to your LOP count.
              </span>
            </div>
          )}
          {selectedLeaveType === 'Casual Leave' && casualBalanceRemaining <= 0 && (
            <div className="emp-leave-inline-alert flex items-start rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>Your casual leave balance is used up. Select <strong>LOP</strong> to apply unpaid leave.</span>
            </div>
          )}
          {selectedLeaveType === 'Earned Leave' && earnedBalanceRemaining <= 0 && (
            <div className="emp-leave-inline-alert flex items-start rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>Your earned leave balance is used up. Select <strong>LOP</strong> to apply unpaid leave.</span>
            </div>
          )}
          {selectedLeaveType === 'Casual Leave' && casualBalanceRemaining > 0 && !isCasualSameDay && (
            <p className="text-xs text-muted">
              {casualBalanceRemaining} casual day{casualBalanceRemaining === 1 ? '' : 's'} left this month. Apply before your leave date. If you need more days, submit separate casual and LOP requests.
            </p>
          )}
          {selectedLeaveType === 'Casual Leave' && isCasualSameDay && (
            <div className="emp-leave-inline-alert flex items-start rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>Same-day leave cannot be casual. Select <strong>LOP</strong> instead.</span>
            </div>
          )}
          {holidayWarning && (
            <div className="emp-leave-inline-alert flex items-start rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{holidayWarning}</span>
            </div>
          )}
          <div className="mt-auto pt-1">
            <Button type="submit" disabled={isSubmitting} className="emp-leave-submit-btn w-full">
              {isSubmitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </div>
        </InteractiveCard>
          </div>
        </div>

        <InteractiveCard className={cn(CARD_CLASS, 'emp-leave-history-card emp-leave-top-panel flex min-h-0 flex-1 flex-col overflow-hidden')}>
          <div className="emp-leave-history-toolbar">
            <div className="emp-leave-history-toolbar__title">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
                <History className="h-4 w-4" />
              </div>
              <h3 className="font-heading text-base font-semibold text-foreground">Leave history</h3>
            </div>

            <FilterDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'credited', label: 'Credited' },
              ]}
            />

            <div className="emp-leave-history-toolbar__date">
              <span className="emp-leave-history-toolbar__date-label">From date</span>
              <DateInput
                className="emp-leave-control rounded-xl"
                value={historyFromDate}
                onChange={setHistoryFromDate}
                minDate="2000-01-01"
                maxDate={leaveBounds.max}
                placeholder="dd/mm/yyyy"
              />
            </div>

            <div className="emp-leave-history-toolbar__date">
              <span className="emp-leave-history-toolbar__date-label">To date</span>
              <DateInput
                className="emp-leave-control rounded-xl"
                value={historyToDate}
                onChange={setHistoryToDate}
                minDate={historyFromDate || '2000-01-01'}
                maxDate={leaveBounds.max}
                placeholder="dd/mm/yyyy"
              />
            </div>

            {(historyFromDate || historyToDate) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="emp-leave-history-toolbar__clear h-9 shrink-0"
                onClick={() => {
                  setHistoryFromDate('')
                  setHistoryToDate('')
                }}
              >
                Clear
              </Button>
            )}

            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search leave history…"
              className="emp-leave-history-toolbar__search"
            />

            <div className="emp-leave-history-toolbar__page-size">
              <span className="emp-leave-history-toolbar__page-size-label">Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-9 w-[4.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="emp-leave-history-scroll custom-scrollbar">
            <DataTable
              columns={columns}
              data={pagedHistory}
              statusKey="status"
              compact
              emptyMessage="No leave history records match your filters."
            />
          </div>

          {historyLeaves.length > 0 && (
            <div className="emp-leave-history-footer flex shrink-0 flex-col gap-3 border-t border-border sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, historyLeaves.length)} of {historyLeaves.length} records
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {visiblePageNumbers.map((pageNum, index) => {
                    const prevPage = visiblePageNumbers[index - 1]
                    const showEllipsis = prevPage != null && pageNum - prevPage > 1
                    return (
                      <span key={pageNum} className="flex items-center gap-1">
                        {showEllipsis && <span className="px-1 text-sm text-muted">…</span>}
                        <button
                          type="button"
                          onClick={() => setPage(pageNum)}
                          className={cn(
                            'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
                            pageNum === currentPage
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-muted hover:bg-surface hover:text-foreground',
                          )}
                          aria-label={`Page ${pageNum}`}
                          aria-current={pageNum === currentPage ? 'page' : undefined}
                        >
                          {pageNum}
                        </button>
                      </span>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </InteractiveCard>
      </div>

      <Dialog open={exceedDialogOpen} onOpenChange={setExceedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot submit leave request</DialogTitle>
            <DialogDescription className="whitespace-pre-line pt-1">
              {exceedDialogMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setExceedDialogOpen(false)}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelConfirmOpen}
        onOpenChange={(open) => {
          setCancelConfirmOpen(open)
          if (!open) setLeaveToCancel(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel leave request?</DialogTitle>
            <DialogDescription>
              {leaveToCancel
                ? `This will cancel your ${leaveToCancel.type} request (${leaveToCancel.from} to ${leaveToCancel.to}).`
                : 'This will cancel your leave request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCancelConfirmOpen(false)
                setLeaveToCancel(null)
              }}
              disabled={Boolean(cancellingId)}
            >
              Keep request
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleCancelConfirm()}
              disabled={Boolean(cancellingId)}
            >
              {cancellingId ? 'Cancelling…' : 'Yes, cancel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
