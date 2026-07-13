import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, X } from 'lucide-react'
import { useFormSessionDraft } from '@hooks/useFormSessionDraft'
import { Button } from '@components/employee/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/employee/ui/dialog'
import { LeaveBalancePanel } from '@components/employee/leave/LeaveBalancePanel'
import { LeaveApplyForm } from '@components/employee/leave/LeaveApplyForm'
import { LeavePendingPanel } from '@components/employee/leave/LeavePendingPanel'
import { LeaveHistoryPanel } from '@components/employee/leave/LeaveHistoryPanel'
import { Badge } from '@components/employee/ui/badge'
import { statusVariant } from '@components/employee/ui/badge-utils'
import {
  formatAppliedDate,
  formatLeaveDayCount,
} from '@components/employee/leave/leaveRequestUtils'
import { useLeaveStore } from '@store/employee/leaveStore'
import { useToast } from '@components/employee/shared/ToastProvider'
import { useAuthStore } from '@store/authStore'

import * as leaveService from '@services/leaveService'
import * as employeeService from '@services/employeeService'
import {
  eachIsoDateInRange,
  getLeaveDateBounds,
  ISO_DATE_REGEX,
  isWeekendIso,
  leaveRangeError,
  parseIsoDate,
} from '@/utils/dateValidation'
import { canCancelLeave } from '@/utils/leaveFilters'
import { formatLeaveBalances } from '@/utils/leaveBalances'
import { getRequestedLeaveDays, isCasualSameDayLeave } from '@/utils/leaveCalculator'
import { cn } from '@pages/employee/lib/utils'

const leaveBounds = getLeaveDateBounds()

function LeaveHistoryStatusCell({ row }) {
  const [reasonOpen, setReasonOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!reasonOpen) return undefined

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setReasonOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [reasonOpen])

  const isRejected = row.status === 'Rejected'
  const rejectionReason = row.rejectionReason?.trim() || 'No reason provided'

  return (
    <div ref={rootRef} className="emp-leave-history-status">
      <div className="emp-leave-history-status__main">
        {isRejected ? (
          <>
            <button
              type="button"
              className="emp-leave-rejected-status-trigger"
              onClick={() => setReasonOpen((open) => !open)}
              aria-expanded={reasonOpen}
              aria-haspopup="dialog"
              aria-label={`Rejected. ${reasonOpen ? 'Hide' : 'Show'} rejection reason`}
            >
              <Badge
                variant={statusVariant(row.status)}
                className="emp-leave-status-badge emp-leave-status-badge--interactive"
              >
                <span>{row.status}</span>
                <ChevronDown
                  className={cn(
                    'emp-leave-rejected-status-trigger__chevron',
                    reasonOpen && 'is-open',
                  )}
                  aria-hidden
                />
              </Badge>
            </button>
            {reasonOpen ? (
              <div
                className="emp-leave-rejected-reason-popover"
                role="dialog"
                aria-label="Rejection reason"
              >
                <p className="emp-leave-rejected-reason-popover__label">Rejection reason</p>
                <p className="emp-leave-rejected-reason-popover__text">{rejectionReason}</p>
              </div>
            ) : null}
          </>
        ) : (
          <Badge variant={statusVariant(row.status)} className="emp-leave-status-badge">
            {row.status}
          </Badge>
        )}
      </div>
      {row.status === 'Cancelled' && row.cancelReason ? (
        <div className="emp-leave-history-note emp-leave-history-status__note mt-1.5 w-full max-w-full rounded-md border border-border bg-slate-50 px-2 py-1.5 text-[11px] leading-snug">
          <span className="font-semibold">Note: </span>
          {row.cancelReason}
        </div>
      ) : null}
    </div>
  )
}

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

const historyColumns = [
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
      <div className="emp-leave-history-applied mx-auto w-full min-w-0 max-w-full">
        <span>{formatAppliedDate(row.createdAt)}</span>
        {row.recordKind === 'compensation' && row.reason ? (
          <div className="emp-leave-history-note mt-1.5 w-full max-w-full rounded-md border border-border bg-slate-50 px-2 py-1.5 text-[11px] leading-snug">
            {row.reason}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <LeaveHistoryStatusCell row={row} />,
  },
]

export default function LeaveRequest() {
  const { requests, fetchRequests, addRequest } = useLeaveStore()
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [historyFromDate, setHistoryFromDate] = useState('')
  const [historyToDate, setHistoryToDate] = useState('')
  const [leaveBalances, setLeaveBalances] = useState(() => formatLeaveBalances({}, { includeLop: true }))
  const [holidays, setHolidays] = useState([])

  const leaveFormDefaults = {
    leaveDuration: 'Full Day',
    type: '',
    halfDaySession: '',
    fromDate: '',
    toDate: '',
    reason: '',
  }

  const { control, register, handleSubmit, setValue, watch, reset, setError, clearErrors, trigger, formState: { errors, isSubmitting } } = useForm({
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

  const leaveOwnerIds = useMemo(() => {
    const ids = new Set()
    if (user?.id) ids.add(String(user.id))
    if (employeeProfile?.id) ids.add(String(employeeProfile.id))
    if (employeeProfile?.employeeId) {
      ids.add(String(employeeProfile.employeeId))
      ids.add(String(employeeProfile.employeeId).toUpperCase())
    }
    return ids
  }, [user?.id, employeeProfile?.id, employeeProfile?.employeeId])

  const resolvedEmployeeId = employeeProfile?.id || user?.id || ''
  const resolvedEmployeeName = useMemo(() => {
    if (employeeProfile) {
      const name = [employeeProfile.firstName, employeeProfile.middleName, employeeProfile.lastName]
        .filter(Boolean)
        .join(' ')
        .trim()
      if (name) return name
    }
    return user?.name || 'Unknown'
  }, [employeeProfile, user?.name])

  const sickBalanceRemaining = useMemo(() => {
    const sick = leaveBalances.find((lb) => lb.key === 'sick')
    if (!sick) return 0
    return Math.max(0, sick.remaining ?? Math.max(0, sick.total - sick.used))
  }, [leaveBalances])

  const earnedBalanceRemaining = useMemo(() => {
    const earned = leaveBalances.find((lb) => lb.key === 'earned')
    if (!earned) return 0
    return Math.max(0, earned.remaining ?? Math.max(0, earned.total - earned.used))
  }, [leaveBalances])

  const compensationBalanceRemaining = useMemo(() => {
    const comp = leaveBalances.find((lb) => lb.key === 'compensation')
    if (!comp) return 0
    return Math.max(0, comp.remaining ?? Math.max(0, comp.total - comp.used))
  }, [leaveBalances])

  const availableLeaveTypes = useMemo(
    () =>
      leaveTypes.filter((t) => {
        if (t === 'Compensation Leave') return compensationBalanceRemaining > 0
        return true
      }),
    [compensationBalanceRemaining],
  )

  const casualBalanceRemaining = useMemo(() => {
    const casual = leaveBalances.find((lb) => lb.key === 'casual')
    if (!casual) return 0
    return Math.max(0, casual.remaining ?? Math.max(0, casual.total - casual.used))
  }, [leaveBalances])

  const isCasualSameDay =
    selectedLeaveType === 'Casual Leave' && fromDate && isCasualSameDayLeave(fromDate)

  const showLopNotice = selectedLeaveType === 'LOP'

  const [cancellingId, setCancellingId] = useState(null)
  const [holidayWarning, setHolidayWarning] = useState('')
  const overlapErrorActiveRef = useRef(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [leaveToCancel, setLeaveToCancel] = useState(null)
  const [exceedDialogOpen, setExceedDialogOpen] = useState(false)
  const [exceedDialogMessage, setExceedDialogMessage] = useState('')

  const normalizeDate = (date) => {
    if (!date) return ''
    const trimmed = String(date).trim()
    if (ISO_DATE_REGEX.test(trimmed)) return trimmed
    const d = new Date(trimmed)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
  }

  const getDateRange = (start, end) => eachIsoDateInRange(start, end)

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
      (r) => leaveOwnerIds.has(String(r.employeeId)) && ['Approved', 'Pending'].includes(r.status)
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

    employeeService.getMyEmployee()
      .then((profile) => setEmployeeProfile(profile))
      .catch(() => {})
    
    // Fetch Balances
    leaveService.getBalances().then((data) => {
      setLeaveBalances(formatLeaveBalances(data, { includeLop: true }))
    }).catch(console.error)

    // Fetch Holidays
    leaveService.getHolidays().then((data) => {
      const formatted = data
        .filter((h) => !h.skipped)
        .map((h) => ({ date: String(h.date).slice(0, 10), name: h.title }))
      setHolidays(formatted)
    }).catch(console.error)

    // Poll for updates every 5 seconds WITHOUT loading indicator
    const leaveInterval = setInterval(() => {
      fetchRequests()
    }, 5000)

    const balanceInterval = setInterval(() => {
      leaveService.getBalances().then((data) => {
        setLeaveBalances(formatLeaveBalances(data, { includeLop: true }))
      }).catch(console.error)
    }, 5000)

    return () => {
      clearInterval(leaveInterval)
      clearInterval(balanceInterval)
    }
  }, [fetchRequests])

  useEffect(() => {
    if (selectedLeaveType === 'Compensation Leave' && compensationBalanceRemaining <= 0) {
      setValue('type', '', { shouldValidate: true })
    }
  }, [selectedLeaveType, compensationBalanceRemaining, setValue])

  const getLeaveBalanceError = (data) => {
    const requestedDays = getRequestedLeaveDays(data.leaveDuration, data.fromDate, data.toDate, holidays)
    if (requestedDays <= 0) {
      return 'Selected dates have no working days. Adjust your dates or choose a working day for half-day leave.'
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
    const conflict = validateLeaveConflict()
    if (conflict.message) {
      overlapErrorActiveRef.current = true
      setError('toDate', { type: 'overlap', message: conflict.message })
      clearErrors('fromDate')
    } else if (overlapErrorActiveRef.current) {
      overlapErrorActiveRef.current = false
      clearErrors('toDate')
      void trigger('toDate')
    }
  }, [fromDate, toDate, leaveDuration, halfDaySession, requests, user, leaveOwnerIds, setError, clearErrors, trigger])

  const requestedWorkingDays = useMemo(() => {
    if (!fromDate || !toDate) return null
    return getRequestedLeaveDays(leaveDuration, fromDate, toDate, holidays)
  }, [fromDate, toDate, leaveDuration, holidays])

  // Holiday guidance: check if selected date range contains holidays/weekends
  useEffect(() => {
    if (!fromDate || !toDate) { setHolidayWarning(''); return }
    if (toDate < fromDate) { setHolidayWarning(''); return }

    const holidayHits = []
    let weekendCount = 0
    for (const iso of eachIsoDateInRange(fromDate, toDate)) {
      if (isWeekendIso(iso)) {
        weekendCount++
      } else {
        const hol = holidays.find((h) => h.date.slice(0, 10) === iso)
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
      const newBalances = await leaveService.getBalances()
      setLeaveBalances(formatLeaveBalances(newBalances, { includeLop: true }))
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
              className="emp-leave-cancel-btn"
              title="Cancel this request"
              aria-label="Cancel pending leave request"
            >
              <X className="h-3 w-3" aria-hidden />
              {cancellingId === row.id ? 'Cancelling…' : 'Cancel'}
            </button>
          ) : (
            <span className="text-xs text-muted">—</span>
          ),
      },
    ],
    [cancellingId],
  )

  const historyLeaves = useMemo(() => {
    const statusMap = {
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
    }
    const historyStatuses = Object.values(statusMap)

    const matchesStatus = (row) => {
      if (statusFilter === 'all') return historyStatuses.includes(row.status)
      return row.status === statusMap[statusFilter]
    }

    const matchesHistoryDateRange = (row) => {
      if (!historyFromDate && !historyToDate) return true
      const rowDate = normalizeDate(row.from) || normalizeDate(row.createdAt)
      if (!rowDate) return true
      if (historyFromDate && rowDate < historyFromDate) return false
      if (historyToDate && rowDate > historyToDate) return false
      return true
    }

    const term = search.trim().toLowerCase()

    return requests
      .filter(matchesStatus)
      .filter((r) => {
        if (!term) return true
        return (
          (r.reason && r.reason.toLowerCase().includes(term)) ||
          (r.employeeName && r.employeeName.toLowerCase().includes(term))
        )
      })
      .filter(matchesHistoryDateRange)
      .map((r) => ({ ...r, recordKind: 'leave' }))
      .sort((a, b) => {
        const da = new Date(a.createdAt || a.from || 0).getTime()
        const db = new Date(b.createdAt || b.from || 0).getTime()
        return db - da
      })
  }, [requests, search, statusFilter, historyFromDate, historyToDate])

  const onSubmit = async (data) => {
    console.log('Leave request submitted', data)
    if (!user || !resolvedEmployeeId) {
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
      setError('toDate', { type: 'overlap', message: conflict.message })
      clearErrors('fromDate')
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
      const created = await addRequest({
        employeeId: resolvedEmployeeId,
        employeeName: resolvedEmployeeName,
        type: data.type,
        leaveDuration: data.leaveDuration,
        halfDaySession: data.leaveDuration === 'Half Day' ? data.halfDaySession : undefined,
        from: data.fromDate,
        to: data.toDate,
        reason: data.reason.trim(),
      })
      const lopDays = Number(created?.lopDays ?? 0) || 0
      const paidDays = Math.max(0, (Number(created?.days) || 0) - lopDays)
      let description = 'Leave request submitted successfully!'
      if (lopDays > 0 && data.type !== 'LOP') {
        description =
          paidDays > 0
            ? `Submitted: ${paidDays} day${paidDays === 1 ? '' : 's'} from ${data.type}, ${lopDays} day${lopDays === 1 ? '' : 's'} as LOP.`
            : `Submitted as LOP (${lopDays} day${lopDays === 1 ? '' : 's'}).`
      }
      toast({ title: 'Success', description })
      clearDraft()
      reset(leaveFormDefaults)
      
      // Refresh balances and notifications after submission
      const newBalances = await leaveService.getBalances()
      setLeaveBalances(formatLeaveBalances(newBalances, { includeLop: true }))
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Failed to submit leave request' })
    }
  }

  return (
    <div
      className="emp-leave-page flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      data-employee-leave
    >
      <div className="emp-leave-top flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="emp-leave-layout">
          <div className="emp-leave-column emp-leave-column--left">
            <LeaveApplyForm
              onSubmit={handleSubmit(onSubmit, onError)}
              control={control}
              register={register}
              watch={watch}
              setValue={setValue}
              errors={errors}
              isSubmitting={isSubmitting}
              leaveBounds={leaveBounds}
              availableLeaveTypes={availableLeaveTypes}
              leaveDurations={leaveDurations}
              halfDaySessions={halfDaySessions}
              showLopNotice={showLopNotice}
              selectedLeaveType={selectedLeaveType}
              casualBalanceRemaining={casualBalanceRemaining}
              earnedBalanceRemaining={earnedBalanceRemaining}
              sickBalanceRemaining={sickBalanceRemaining}
              requestedWorkingDays={requestedWorkingDays}
              isCasualSameDay={isCasualSameDay}
              holidayWarning={holidayWarning}
            />

            <LeavePendingPanel columns={pendingColumns} pendingLeaves={pendingLeaves} />
          </div>

          <div className="emp-leave-column emp-leave-column--right">
            <LeaveBalancePanel balances={leaveBalances} selectedLeaveType={selectedLeaveType} />

            <LeaveHistoryPanel
              columns={historyColumns}
              historyLeaves={historyLeaves}
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              historyFromDate={historyFromDate}
              onHistoryFromDateChange={setHistoryFromDate}
              historyToDate={historyToDate}
              onHistoryToDateChange={setHistoryToDate}
              onClearDateRange={() => {
                setHistoryFromDate('')
                setHistoryToDate('')
              }}
              leaveBoundsMax={leaveBounds.max}
            />
          </div>
        </div>
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
            <Button className="emp-dash-btn" onClick={() => setExceedDialogOpen(false)}>OK</Button>
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
