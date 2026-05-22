import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
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

const leaveSchema = z
  .object({
    type: z.string().min(1, 'Select leave type'),
    leaveDuration: z.enum(['Full Day', 'Half Day']),
    halfDaySession: z.string().optional(),
    fromDate: z.string().min(1, 'From date required'),
    toDate: z.string().min(1, 'To date required'),
    reason: z.string().min(5, 'Reason must be at least 5 characters'),
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
  })

const leaveTypes = ['Sick Leave', 'Casual Leave', 'Earned Leave']
const leaveDurations = ['Full Day', 'Half Day']
const halfDaySessions = ['First Half', 'Second Half']
const columns = [
  { key: 'type', label: 'Leave Type' },
  { key: 'leaveDuration', label: 'Duration' },
  { key: 'from', label: 'Start Date' },
  { key: 'to', label: 'End Date' },
  { key: 'days', label: 'Days' },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status' },
  { key: 'rejectionReason', label: 'Rejection Reason' },
]

export default function LeaveRequest() {
  const navigate = useNavigate()
  const { requests, fetchRequests, addRequest } = useLeaveStore()
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [leaveBalances, setLeaveBalances] = useState([])
  const [holidays, setHolidays] = useState([])

  const { control, register, handleSubmit, setValue, watch, reset, setError, clearErrors, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leaveDuration: 'Full Day',
      type: '',
      halfDaySession: '',
    },
  })

  const leaveDuration = watch('leaveDuration')
  const fromDate = watch('fromDate')
  const toDate = watch('toDate')
  const halfDaySession = watch('halfDaySession')

  const [conflictMessage, setConflictMessage] = useState('')

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
      const formatted = [
        { key: 'casual', type: 'Casual Leave', used: data['Casual Leave']?.used || 0, total: data['Casual Leave']?.total || 12, color: '#16a34a' },
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

    // Poll for updates every 5 seconds WITHOUT loading indicator
    const leaveInterval = setInterval(() => {
      fetchRequests()
    }, 5000)

    const balanceInterval = setInterval(() => {
      leaveService.getBalances().then((data) => {
        const formatted = [
          { key: 'casual', type: 'Casual Leave', used: data['Casual Leave']?.used || 0, total: data['Casual Leave']?.total || 12, color: '#16a34a' },
          { key: 'sick', type: 'Sick Leave', used: data['Sick Leave']?.used || 0, total: data['Sick Leave']?.total || 12, color: '#3b82f6' },
          { key: 'earned', type: 'Earned Leave', used: data['Earned Leave']?.used || 0, total: data['Earned Leave']?.total || 0, color: '#8b5cf6' },
        ]
        setLeaveBalances(formatted)
      }).catch(console.error)
    }, 5000)

    return () => {
      clearInterval(leaveInterval)
      clearInterval(balanceInterval)
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

  const filtered = requests.filter((r) => {
    const matchSearch = !search || r.type.toLowerCase().includes(search.toLowerCase()) || r.reason.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter
    return matchSearch && matchStatus
  })

  const onError = (errors) => {
    console.log('Leave request validation failed', errors)
    toast({ title: 'Validation error', description: 'Please complete all required fields before submitting.' })
  }

  const pendingLeaves = requests.filter((r) => r.status === 'Pending')
  const historyLeaves = filtered.filter((r) => r.status !== 'Pending')

  const onSubmit = async (data) => {
    console.log('Leave request submitted', data)
    if (!user) {
      toast({ title: 'Error', description: 'User not authenticated' })
      return
    }

    const currentFrom = new Date(data.fromDate)
    const currentTo = new Date(data.toDate)

    if (currentTo < currentFrom) {
      setError('toDate', { type: 'manual', message: 'End date must be the same or after the start date' })
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
        reason: data.reason,
      })
      toast({ title: 'Success', description: 'Leave request submitted successfully!' })
      reset({ leaveDuration: 'Full Day', type: '', halfDaySession: '', fromDate: '', toDate: '', reason: '' })
      
      // Refresh balances and notifications after submission
      const newBalances = await leaveService.getBalances()
      setLeaveBalances([
        { key: 'casual', type: 'Casual Leave', used: newBalances['Casual Leave']?.used || 0, total: newBalances['Casual Leave']?.total || 12, color: '#16a34a' },
        { key: 'sick', type: 'Sick Leave', used: newBalances['Sick Leave']?.used || 0, total: newBalances['Sick Leave']?.total || 12, color: '#3b82f6' },
        { key: 'earned', type: 'Earned Leave', used: newBalances['Earned Leave']?.used || 0, total: newBalances['Earned Leave']?.total || 0, color: '#8b5cf6' },
      ])
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Failed to submit leave request' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Calendar Icon */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">Leave Management</h2>
        <button
          type="button"
          onClick={() => navigate('/employee/calendar')}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 transition-colors"
          title="View Company Calendar"
        >
          <Calendar className="h-5 w-5" />
          Calendar
        </button>
      </div>


      {/* Apply Leave Form & Leave Balances & Pending Requests */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Apply for Leave Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
            <h3 className="font-heading text-lg font-semibold">Apply for Leave</h3>
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
                <Input type="date" className="mt-1" {...register('fromDate')} />
                {errors.fromDate && <p className="mt-1 text-xs text-danger">{errors.fromDate.message}</p>}
              </div>
              <div>
                <Label>To Date *</Label>
                <Input
                  type="date"
                  className="mt-1"
                  {...register('toDate')}
                  disabled={leaveDuration === 'Half Day'}
                />
                {leaveDuration === 'Half Day' && (
                  <p className="mt-1 text-xs text-muted">Half-day leave must have the same start and end date.</p>
                )}
                {errors.toDate && <p className="mt-1 text-xs text-danger">{errors.toDate.message}</p>}
              </div>
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea className="mt-1" {...register('reason')} placeholder="Reason for leave" />
              {errors.reason && <p className="mt-1 text-xs text-danger">{errors.reason.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">Submit Request</Button>
          </form>
        </div>

        {/* Right Column: Leave Balance & Pending Requests */}
        <div className="lg:col-span-2 space-y-6">
          {/* Leave Balance */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-heading text-lg font-semibold mb-4">Leave Balance</h3>

            <div className="space-y-3">
              {leaveBalances.map((lb) => (
                <LeaveCard key={lb.key} type={lb.type} used={lb.used} total={lb.total} color={lb.color} />
              ))}
            </div>
          </div>

          {/* Pending Requests */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-heading text-lg font-semibold mb-4">Pending Requests</h3>
            {pendingLeaves.length === 0 ? (
              <p className="text-sm text-muted">No pending leave requests</p>
            ) : (
              <div className="space-y-3">
                {pendingLeaves.map((req) => (
                  <div key={req.id} className="rounded-lg border border-yellow-300 bg-yellow-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium">{req.type}</p>
                        <p className="text-xs text-muted mt-1">{req.from} to {req.to} ({req.days} days)</p>
                        <p className="text-xs text-muted mt-1">{req.reason}</p>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium whitespace-nowrap text-yellow-700 bg-yellow-200">
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leave History Table */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-heading text-lg font-semibold mb-4">Leave History</h3>
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search leave history..." className="max-w-xs" />
          <FilterDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        </div>
        <DataTable columns={columns} data={historyLeaves} statusKey="status" />
      </div>
    </div>
  )
}
