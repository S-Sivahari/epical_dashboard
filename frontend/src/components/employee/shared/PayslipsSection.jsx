import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader,
  Receipt,
  Search,
  X,
} from 'lucide-react'
import {
  downloadMyPayslipPdf,
  fetchMyPayslipPdfUrl,
  openMyPayslipPdf,
} from '@services/payslipService'
import { Button } from '@components/employee/ui/button'
import { DataTable } from '@components/employee/shared/DataTable'
import { FilterDropdown } from '@components/employee/shared/FilterDropdown'
import { SearchBar } from '@components/employee/shared/SearchBar'
import { useToast } from '@components/employee/shared/ToastProvider'
import { useAuthStore } from '@store/authStore'
import { cn } from '@pages/employee/lib/utils'

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

function formatCurrency(value) {
  if (value == null || value === '') return null
  const num =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9.-]/g, ''))
  if (Number.isNaN(num)) return String(value)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num)
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
  return payslip.sentAt ? 'Paid' : 'Pending'
}

function enrichPayslip(payslip) {
  const period = parsePayPeriod(payslip.payMonth)
  const status = getPayslipStatus(payslip)
  const netFormatted = formatCurrency(payslip.netSalary)

  return {
    ...payslip,
    periodLabel: period.label,
    month: period.month,
    year: period.year,
    monthValue: period.monthValue,
    yearValue: period.yearValue,
    paymentDateLabel: formatDate(payslip.sentAt),
    status,
    netSalaryLabel: netFormatted ?? '—',
  }
}

function getVisiblePageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set([1, total, current, current - 1, current + 1])
  return [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
}

function buildPayslipColumns(onView, onDownload) {
  return [
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
    { key: 'paymentDateLabel', label: 'Payment date' },
    { key: 'netSalaryLabel', label: 'Net salary' },
    { key: 'status', label: 'Status' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onView(row)}>
            <ExternalLink className="h-3.5 w-3.5" />
            View
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onDownload(row)}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      ),
    },
  ]
}

function SalaryLine({ label, value }) {
  const formatted = formatCurrency(value)
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-foreground">{formatted ?? '—'}</span>
    </div>
  )
}

export function PayslipsSection({ payslips, loading }) {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [viewPayslip, setViewPayslip] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

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
        p.paymentDateLabel.toLowerCase().includes(query) ||
        p.netSalaryLabel.toLowerCase().includes(query)
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

  useEffect(() => {
    let cancelled = false
    if (!viewPayslip) {
      setPreviewUrl(null)
      return undefined
    }

    setPreviewLoading(true)
    fetchMyPayslipPdfUrl(viewPayslip.id)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: 'Could not load payslip',
            description: 'Try again or download the PDF instead.',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
    }
  }, [viewPayslip, toast])

  const handleDownload = useCallback(
    async (row) => {
      try {
        const fileName = row.fileName || `payslip-${row.periodLabel}.pdf`
        await downloadMyPayslipPdf(
          row.id,
          fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
        )
      } catch {
        toast({
          title: 'Download failed',
          description: 'We could not download this payslip.',
        })
      }
    },
    [toast],
  )

  const payslipColumns = useMemo(
    () =>
      buildPayslipColumns(
        (row) => setViewPayslip(row),
        (row) => void handleDownload(row),
      ),
    [handleDownload],
  )

  const hasBreakdown =
    viewPayslip &&
    (viewPayslip.basicPay != null ||
      viewPayslip.allowances != null ||
      viewPayslip.bonuses != null ||
      viewPayslip.deductions != null ||
      viewPayslip.netSalary != null)

  return (
    <>
      <div className="animate-in fade-in duration-200 rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold">Payslip history</h3>
              <p className="mt-1 text-sm text-muted">
                Payroll records issued by HR — search, filter, and download your payslips
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
              Your payslip history will appear here once HR sends them from Payslip Management.
              Records update automatically when new payslips are issued.
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
                    { value: 'Paid', label: 'Paid' },
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
                <DataTable columns={payslipColumns} data={pagedPayslips} statusKey="status" />

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
      </div>

      {viewPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close payslip details"
            onClick={() => setViewPayslip(null)}
          />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <h3 className="font-heading text-xl font-semibold">Payslip details</h3>
                <p className="mt-1 text-sm text-muted">{viewPayslip.periodLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewPayslip(null)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-5">
                  <div className="rounded-xl border border-border bg-surface/30 p-4">
                    <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted">
                      Employee details
                    </h4>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Name</dt>
                        <dd className="font-medium text-right">
                          {viewPayslip.employeeName || user?.name || '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Employee ID</dt>
                        <dd className="font-medium text-right">
                          {viewPayslip.employeeId || user?.id || '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Designation</dt>
                        <dd className="font-medium text-right">{user?.designation || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Payment date</dt>
                        <dd className="font-medium text-right">{viewPayslip.paymentDateLabel}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Status</dt>
                        <dd className="font-medium text-right">{viewPayslip.status}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-xl border border-border bg-surface/30 p-4">
                    <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted">
                      Salary breakdown
                    </h4>
                    {hasBreakdown ? (
                      <div className="mt-3">
                        <SalaryLine label="Basic pay" value={viewPayslip.basicPay} />
                        <SalaryLine label="Allowances" value={viewPayslip.allowances} />
                        <SalaryLine label="Bonuses" value={viewPayslip.bonuses} />
                        <SalaryLine label="Deductions" value={viewPayslip.deductions} />
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-3">
                          <span className="text-sm font-semibold text-primary">Net salary</span>
                          <span className="font-heading text-lg font-bold text-primary">
                            {formatCurrency(viewPayslip.netSalary) ?? '—'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted">
                        Detailed salary figures are included in your official payslip document.
                        Review the PDF preview or download the file for the full breakdown.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => void openMyPayslipPdf(viewPayslip.id)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in new tab
                    </Button>
                    <Button className="gap-1.5" onClick={() => void handleDownload(viewPayslip)}>
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface/20 p-3">
                  <h4 className="mb-3 px-1 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
                    Payslip preview
                  </h4>
                  <div className="overflow-hidden rounded-lg border border-border bg-white">
                    {previewLoading ? (
                      <div className="flex h-[420px] items-center justify-center text-muted">
                        <Loader className="h-5 w-5 animate-spin" />
                      </div>
                    ) : previewUrl ? (
                      <iframe
                        title={`Payslip ${viewPayslip.periodLabel}`}
                        src={previewUrl}
                        className="h-[420px] w-full"
                      />
                    ) : (
                      <div className="flex h-[420px] items-center justify-center px-6 text-center text-sm text-muted">
                        Payslip preview unavailable. Use download or open in a new tab.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}