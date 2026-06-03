import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Controller } from 'react-hook-form'
import { AlertTriangle, X, Clock, History, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { Button } from '@components/employee/ui/button'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { DataTable } from '@components/employee/shared/DataTable'
import { SearchBar } from '@components/employee/shared/SearchBar'
import { FilterDropdown } from '@components/employee/shared/FilterDropdown'
import { LeaveCard } from '@components/employee/shared/LeaveCard'
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

const leaveTypes = ['Sick Leave', 'Casual Leave', 'Earned Leave']
const leaveDurations = ['Full Day', 'Half Day']
const halfDaySessions = ['First Half', 'Second Half']

const CARD_CLASS = portalCardClass({ className: 'p-5 sm:p-6' })

function SectionHeader({ icon: Icon, title, description, children, className }) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold text-foreground">{title}</h3>
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

const columns = [
  { key: 'type', label: 'Leave Type' },
  { key: 'leaveDuration', label: 'Duration' },
  { key: 'from', label: 'Start Date' },
  { key: 'to', label: 'End Date' },
  { key: 'days', label: 'Days' },
  {
    key: 'createdAt',
    label: 'Applied',
    render: (row) => (
      <div className="min-w-[6.5rem]">
        <span className="text-muted">{formatAppliedDate(row.createdAt)}</span>
        {row.recordKind === 'compensation' && row.reason ? (
          <div className="mt-1.5 max-w-[200px] rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-[11px] leading-snug text-foreground">
            {row.reason}
          </div>
        ) : null}
        {row.status === 'Rejected' && row.rejectionReason ? (
          <div className="mt-1.5 max-w-[200px] rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] leading-snug text-red-900">
            {row.rejectionReason}
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [leaveBalances, setLeaveBalances] = useState([])
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

  const { control, register, handleSubmit, setValue, watch, reset, setError, clearErrors, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leaveDuration: 'Full Day',
      type: '',
      halfDaySession: '',
      fromDate: '',
      toDate: '',
      reason: '',
    },
  })

  const leaveDuration = watch('leaveDuration')
  const fromDate = watch('fromDate')
  const toDate = watch('toDate')
  const halfDaySession = watch('halfDaySession')

  const [conflictMessage, setConflictMessage] = useState('')
  const [holidayWarning, setHolidayWarning] = useState('')

  // Cancel pending leave
  const [cancellingId, setCancellingId] = useState(null)

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
    if (request.leaveDuration === 'half Day') {
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
      const formatted = [
        { key: 'casual', type: 'Casual Leave', used: data['Casual Leave']?.used || 0, total: data['Casual Leave']?.total || 12, color: '#266b1c' },
        { key: 'sick', type: 'Sick Leave', used: data['Sick Leave']?.used || 0, total: data['Sick Leave']?.total || 12, color: '#3b82f6' },
        { key: 'earned', type: 'Earned Leave', used: data['Earned Leave']?.used || 0, total: data['Earned Leave']?.total || 0, color: '#8b5cf6' },
      ]
      setLeaveBalances(formatted)
    }).catch(console.error)

    // Fetch Holidays
    leaveService.getHolidays().then((data) => {
      const formatted = data.map(h => ({ date: h.date, name: h.title }))
      setHolidays(formatted)
    }).catch(console.error)

    void loadCompensation()

    // Poll for updates every 5 seconds WITHOUT loading indicator
    const leaveInterval = setInterval(() => {
      fetchRequests()
    }, 5000)

    const balanceInterval = setInterval(() => {
      leaveService.getBalances().then((data) => {
        const formatted = [
          { key: 'casual', type: 'Casual Leave', used: data['Casual Leave']?.used || 0, total: data['Casual Leave']?.total || 12, color: '#266b1c' },
          { key: 'sick', type: 'Sick Leave', used: data['Sick Leave']?.used || 0, total: data['Sick Leave']?.total || 12, color: '#3b82f6' },
          { key: 'earned', type: 'Earned Leave', used: data['Earned Leave']?.used || 0, total: data['Earned Leave']?.total || 0, color: '#8b5cf6' },
        ]
        setLeaveBalances(formatted)
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
      (statusFilter === 'approved' && r.status === 'Approved')
    return matchSearch && matchStatus
  })

  const onError = (errors) => {
    console.log('Leave request validation failed', errors)
    toast({ title: 'Validation error', description: 'Please complete all required fields before submitting.' })
  }

  const handleCancel = async (leave) => {
    setCancellingId(leave.id)
    try {
      await leaveService.cancelLeave(leave.id)
      toast({ title: 'Cancelled', description: 'Your leave request has been cancelled.' })
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
      { key: 'leaveDuration', label: 'Duration' },
      { key: 'from', label: 'Start Date' },
      { key: 'to', label: 'End Date' },
      { key: 'days', label: 'Days' },
      { key: 'status', label: 'Status' },
      {
        key: 'actions',
        label: 'Action',
        render: (row) => (
          <button
            type="button"
            onClick={() => handleCancel(row)}
            disabled={cancellingId === row.id}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
            title="Cancel this request"
          >
            <X className="h-3.5 w-3.5" />
            {cancellingId === row.id ? 'Cancelling…' : 'Cancel'}
          </button>
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
        type: 'Earned Leave (Compensation)',
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
    const leaveRows = filtered
      .filter((r) => r.status !== 'Pending')
      .map((r) => ({ ...r, recordKind: 'leave' }))

    const term = search.trim().toLowerCase()
    const compRows = compensationHistoryRows.filter((entry) => {
      const matchSearch =
        !term ||
        entry.type.toLowerCase().includes(term) ||
        (entry.reason && entry.reason.toLowerCase().includes(term))
      const matchStatus = statusFilter === 'all' || statusFilter === 'credited'
      return matchSearch && matchStatus
    })

    return [...leaveRows, ...compRows].sort((a, b) => {
      const da = new Date(a.createdAt || a.from || 0).getTime()
      const db = new Date(b.createdAt || b.from || 0).getTime()
      return db - da
    })
  }, [filtered, compensationHistoryRows, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(historyLeaves.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedHistory = historyLeaves.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, pageSize])

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
      reset({
        leaveDuration: 'Full Day',
        type: '',
        halfDaySession: '',
        fromDate: '',
        toDate: '',
        reason: '',
      })
      
      // Refresh balances and notifications after submission
      const newBalances = await leaveService.getBalances()
      setLeaveBalances([
        { key: 'casual', type: 'Casual Leave', used: newBalances['Casual Leave']?.used || 0, total: newBalances['Casual Leave']?.total || 12, color: '#266b1c' },
        { key: 'sick', type: 'Sick Leave', used: newBalances['Sick Leave']?.used || 0, total: newBalances['Sick Leave']?.total || 12, color: '#3b82f6' },
        { key: 'earned', type: 'Earned Leave', used: newBalances['Earned Leave']?.used || 0, total: newBalances['Earned Leave']?.total || 0, color: '#8b5cf6' },
      ])
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Failed to submit leave request' })
    }
  }

  const visiblePageNumbers = getVisiblePageNumbers(currentPage, totalPages)

  return (
    <div className="emp-leave-page max-w-full space-y-5 overflow-x-hidden">
      <div className="emp-leave-top">
        <div className="emp-leave-top-grid">
        <InteractiveCard
          as="form"
          selectable={false}
          onSubmit={handleSubmit(onSubmit, onError)}
          className={cn(CARD_CLASS, 'emp-leave-apply-card flex h-full min-h-0 flex-col space-y-4')}
        >
          <div className="emp-leave-apply-head">
            <h3 className="font-heading text-lg font-semibold text-foreground">Apply for leave</h3>
            <p className="mt-1 text-sm text-muted">Submit a new leave request for HR approval.</p>
          </div>
          <div>
            <Label>Leave Type *</Label>
            <Select value={watch('type')} onValueChange={(v) => setValue('type', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {leaveTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.type && <p className="mt-1 text-xs text-danger">{errors.type.message}</p>}
          </div>
          <div>
            <Label>Leave Duration *</Label>
            <Select value={watch('leaveDuration')} onValueChange={(v) => setValue('leaveDuration', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select duration" /></SelectTrigger>
              <SelectContent>
                {leaveDurations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.leaveDuration && <p className="mt-1 text-xs text-danger">{errors.leaveDuration.message}</p>}
          </div>
          {leaveDuration === 'Half Day' && (
            <div>
              <Label>Half-day Session *</Label>
              <Select value={watch('halfDaySession')} onValueChange={(v) => setValue('halfDaySession', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>
                  {halfDaySessions.map((session) => (
                    <SelectItem key={session} value={session}>{session}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.halfDaySession && <p className="mt-1 text-xs text-danger">{errors.halfDaySession.message}</p>}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>From Date *</Label>
              <Controller
                name="fromDate"
                control={control}
                render={({ field }) => (
                  <DateInput
                    className="mt-1 rounded-xl"
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
                    className="mt-1 rounded-xl"
                    value={field.value || ''}
                    onChange={field.onChange}
                    minDate={leaveBounds.min}
                    maxDate={leaveBounds.max}
                    disabled={leaveDuration === 'Half Day'}
                    error={errors.toDate?.message}
                  />
                )}
              />
              {leaveDuration === 'Half Day' && (
                <p className="mt-1 text-xs text-muted">Half-day leave uses the same start and end date.</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted">
            Dates must be in dd/mm/yyyy format. Leave can be applied from today up to{' '}
            {leaveBounds.max.split('-').reverse().join('/')}.
          </p>
          <div className="emp-leave-reason-block rounded-xl border border-primary/10 bg-white/85 p-3 shadow-sm">
            <Label htmlFor="leave-reason">Reason for leave *</Label>
            <Textarea
              id="leave-reason"
              rows={3}
              placeholder="Briefly explain why you are requesting leave…"
              className="mt-1.5 min-h-[5rem] resize-y rounded-xl border-border bg-white"
              {...register('reason')}
            />
            {errors.reason && <p className="mt-1 text-xs text-danger">{errors.reason.message}</p>}
          </div>
          {holidayWarning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{holidayWarning}</span>
            </div>
          )}
          <div className="mt-auto pt-1">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </div>
        </InteractiveCard>

        <div className="emp-leave-top-aside">
        <InteractiveCard className={cn(CARD_CLASS, 'emp-leave-balance-card flex h-full min-h-0 flex-col')}>
          <SectionHeader
            icon={BarChart3}
            title="Leave balance"
            description="Used & remaining"
          />
          <div className="emp-leave-balance-stack flex-1">
            {leaveBalances.map((lb) => (
              <LeaveCard
                key={lb.key}
                type={lb.type}
                used={lb.used}
                total={lb.total}
                color={lb.color}
                embedded
                className="h-full"
              />
            ))}
          </div>
        </InteractiveCard>

        <InteractiveCard className={cn(CARD_CLASS, 'emp-leave-pending-card flex h-full min-h-0 flex-col')}>
        <SectionHeader
          icon={Clock}
          title="Pending requests"
          description="Awaiting HR approval"
          className="emp-leave-section-head"
        />
        <DataTable
          columns={pendingColumns}
          data={pendingLeaves}
          statusKey="status"
          compact
          emptyMessage="No pending leave requests."
        />
        </InteractiveCard>
        </div>
        </div>
      </div>

      <InteractiveCard className={cn(CARD_CLASS, 'emp-leave-history-card')}>
        <SectionHeader
          icon={History}
          title="Leave history"
          description="Approved, rejected, and compensation credits on earned leave"
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search leave history…"
            className="w-full min-w-0 sm:max-w-xs"
          />
        </SectionHeader>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <FilterDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'credited', label: 'Credited' },
            ]}
          />
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-xs text-muted">Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-9 w-[90px]">
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
          <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
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
  )
}
