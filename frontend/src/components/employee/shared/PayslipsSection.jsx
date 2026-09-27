import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Loader,
  Mail,
  Receipt,
  Search,
} from 'lucide-react'
import { resendMyPayslipEmail } from '@services/payslipService'
import { Button } from '@components/employee/ui/button'
import { DataTable } from '@components/employee/shared/DataTable'
import { FilterDropdown } from '@components/employee/shared/FilterDropdown'
import { SearchBar } from '@components/employee/shared/SearchBar'
import { useToast } from '@components/employee/shared/ToastProvider'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

const PAGE_SIZE = 10

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

function parsePayPeriod(payMonth) {
  if (!payMonth) return { month: '—', year: '—', monthValue: '', yearValue: '', label: '—' }

  const trimmed = String(payMonth).trim()

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/)
  if (isoMatch) {
    const year = isoMatch[1]
    const monthIndex = Number(isoMatch[2]) - 1
    return {
      month: MONTH_NAMES[monthIndex] ?? trimmed,
      year,
      monthValue: String(monthIndex + 1).padStart(2, '0'),
      yearValue: year,
      label: `${MONTH_NAMES[monthIndex] ?? trimmed} ${year}`,
    }
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const monthIndex = Number(slashMatch[1]) - 1
    const year = slashMatch[2]
    return {
      month: MONTH_NAMES[monthIndex] ?? trimmed,
      year,
      monthValue: String(monthIndex + 1).padStart(2, '0'),
      yearValue: year,
      label: `${MONTH_NAMES[monthIndex] ?? trimmed} ${year}`,
    }
  }

  const yearMatch = trimmed.match(/(20\d{2})/)
  const year = yearMatch ? yearMatch[1] : '—'
  const monthMatch = MONTH_NAMES.find((name) =>
    trimmed.toLowerCase().includes(name.toLowerCase()),
  )
  const monthIndex = monthMatch ? MONTH_NAMES.indexOf(monthMatch) : -1

  return {
    month: monthMatch ?? trimmed,
    year,
    monthValue: monthIndex >= 0 ? String(monthIndex + 1).padStart(2, '0') : '',
    yearValue: year !== '—' ? year : '',
    label: trimmed,
  }
}

function getPayslipStatus(payslip) {
  if (payslip.status === 'Pending') return 'Pending'
  return payslip.sentAt ? 'Uploaded' : 'Pending'
}

function enrichPayslip(payslip) {
  const period = parsePayPeriod(payslip.payMonth)
  const status = getPayslipStatus(payslip)

  return {
    ...payslip,
    periodLabel: period.label,
    month: period.month,
    year: period.year,
    monthValue: period.monthValue,
    yearValue: period.yearValue,
    paymentDateLabel: formatDate(payslip.sentAt),
    status,
  }
}

function getVisiblePageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set([1, total, current, current - 1, current + 1])
  return [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
}

function buildPayslipColumns(onSendEmail, sendingId) {
  return [
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
    { key: 'paymentDateLabel', label: 'Issued on' },
    { key: 'status', label: 'Status' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={sendingId === row.id}
          onClick={() => onSendEmail(row)}
        >
          {sendingId === row.id ? (
            <Loader className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          {sendingId === row.id ? 'Sending…' : 'Send to email'}
        </Button>
      ),
    },
  ]
}

export function PayslipsSection({ payslips, loading }) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [sendingId, setSendingId] = useState(null)

  const enrichedPayslips = useMemo(
    () =>
      [...payslips]
        .map(enrichPayslip)
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()),
    [payslips],
  )

  const monthOptions = useMemo(() => {
    const values = new Set(
      enrichedPayslips.map((p) => p.monthValue).filter(Boolean),
    )
    return [
      { value: 'all', label: 'All months' },
      ...[...values]
        .sort()
        .map((value) => ({
          value,
          label: MONTH_NAMES[Number(value) - 1] ?? value,
        })),
    ]
  }, [enrichedPayslips])

  const yearOptions = useMemo(() => {
    const values = new Set(
      enrichedPayslips.map((p) => p.yearValue).filter(Boolean),
    )
    return [
      { value: 'all', label: 'All years' },
      ...[...values].sort((a, b) => Number(b) - Number(a)).map((value) => ({
        value,
        label: value,
      })),
    ]
  }, [enrichedPayslips])

  const filteredPayslips = useMemo(() => {
    const query = search.trim().toLowerCase()
    return enrichedPayslips.filter((p) => {
      if (monthFilter !== 'all' && p.monthValue !== monthFilter) return false
      if (yearFilter !== 'all' && p.yearValue !== yearFilter) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (!query) return true
      return (
        p.periodLabel.toLowerCase().includes(query) ||
        p.month.toLowerCase().includes(query) ||
        p.year.toLowerCase().includes(query) ||
        p.fileName?.toLowerCase().includes(query) ||
        p.paymentDateLabel.toLowerCase().includes(query)
      )
    })
  }, [enrichedPayslips, search, monthFilter, yearFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPayslips.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedPayslips = filteredPayslips.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )
  const visiblePages = useMemo(
    () => getVisiblePageNumbers(safePage, totalPages),
    [safePage, totalPages],
  )

  useEffect(() => {
    setPage(1)
  }, [search, monthFilter, yearFilter, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleSendEmail = useCallback(
    async (row) => {
      setSendingId(row.id)
      try {
        const result = await resendMyPayslipEmail(row.id)
        toast({
          title: 'Payslip sent',
          description: `Your payslip was emailed to ${result.sentTo}. You can also check your inbox for the original copy.`,
        })
      } catch (err) {
        const status = err?.response?.status
        const message = err?.response?.data?.error
        toast({
          title: status === 429 ? 'Too many requests' : 'Could not send email',
          description:
            message || 'Please try again or contact HR if the problem continues.',
        })
      } finally {
        setSendingId(null)
      }
    },
    [toast],
  )

  const payslipColumns = useMemo(
    () => buildPayslipColumns((row) => void handleSendEmail(row), sendingId),
    [handleSendEmail, sendingId],
  )

  return (
    <InteractiveCard className={portalCardClass({ className: 'animate-in fade-in p-6 duration-200' })}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold">Payslip history</h3>
            <p className="mt-1 text-sm text-muted">
            Payslips appear here as soon as they're published by the admin. Use "Send to Email" if you'd like a copy sent to your inbox.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm">
          <span className="text-muted">Total records:</span>{' '}
          <span className="font-semibold text-foreground">{enrichedPayslips.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted">
          <Loader className="h-5 w-5 animate-spin" />
          Loading payslips…
        </div>
      ) : enrichedPayslips.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Receipt className="h-7 w-7" />
          </div>
          <p className="font-heading text-lg font-semibold text-foreground">No payslips yet</p>
          <p className="mt-2 max-w-md text-sm text-muted">
          Your payslip history will be displayed here once published by the admin. You can request an email copy any time using "Send to Email".
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search payslips…"
                className="w-full sm:max-w-xs"
              />
              <FilterDropdown
                value={monthFilter}
                onChange={setMonthFilter}
                options={monthOptions}
                placeholder="Month"
              />
              <FilterDropdown
                value={yearFilter}
                onChange={setYearFilter}
                options={yearOptions}
                placeholder="Year"
              />
              <FilterDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All status' },
                  { value: 'Uploaded', label: 'Uploaded' },
                  { value: 'Pending', label: 'Pending' },
                ]}
                placeholder="Status"
              />
            </div>
          </div>

          {filteredPayslips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
              <Search className="mx-auto mb-3 h-6 w-6" />
              No payslips match your search or filters.
            </div>
          ) : (
            <>
              <DataTable
                columns={payslipColumns}
                data={pagedPayslips}
                statusKey="status"
                tableTheme="payslip-hub"
              />

              <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filteredPayslips.length)} of{' '}
                  {filteredPayslips.length} payslips
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {visiblePages.map((pageNum, index) => {
                      const prevPage = visiblePages[index - 1]
                      const showEllipsis = prevPage != null && pageNum - prevPage > 1
                      return (
                        <span key={pageNum} className="flex items-center gap-1">
                          {showEllipsis && (
                            <span className="px-1 text-sm text-muted">…</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPage(pageNum)}
                            className={cn(
                              'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
                              pageNum === safePage
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted hover:bg-surface hover:text-foreground',
                            )}
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
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </InteractiveCard>
  )
}
