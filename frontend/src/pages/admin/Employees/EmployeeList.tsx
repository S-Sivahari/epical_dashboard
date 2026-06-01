import { Link } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Search, X, CheckSquare, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { PaginationBar } from '@components/tables/Pagination'
import { SelectField } from '@components/forms/SelectField'
import { useEmployees } from '@hooks/useEmployees'
import type { Employee } from '@/types'
import { stringToHueColor } from '@/utils/stringColor'
import { EmployeeAvatar } from '@components/ui/EmployeeAvatar'
import { exportToExcel } from '@/utils/exportExcel'
import { exportToPDF } from '@/utils/exportPDF'
import { formatDate } from '@/utils/formatDate'
import { useAuthStore } from '@store/authStore'
import {
  ACTIVE_DIRECTORY_EXPORT_HEADERS,
  ACTIVE_DIRECTORY_REPORT_OPTIONS,
  activeDirectoryExportFilename,
} from '@/constants/employeeExport'

const STATUS_OPTIONS: { value: Employee['status']; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Deactivated', label: 'Deactivated' },
  { value: 'Notice Period', label: 'Notice Period' },
]

/** Native filter selects: dropdown options stay system-styled; the control chrome is themed here. */
const filterSelectClass =
  'admin-field h-10 w-full cursor-pointer appearance-none pl-3 pr-10 text-sm font-medium shadow-sm'

export function EmployeeList() {
  const {
    employees,
    loading,
    filters,
    setFilters,
    pagination,
    setPage,
    setPageSize,
    sort,
    setSort,
    updateEmployeeStatus,
    bulkUpdateStatus,
    getEmployeesForExport,
  } = useEmployees()

  const user = useAuthStore((s) => s.user)

  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  // Free-text search debounce
  const [searchInput, setSearchInput] = useState(filters.name)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = setTimeout(() => {
        setFilters({ name: value })
      }, 350)
    },
    [setFilters],
  )

  // Status change confirmation modal
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{ employee: Employee; newStatus: Employee['status'] } | null>(null)
  const [statusChangeReason, setStatusChangeReason] = useState('')
  const [statusReasonError, setStatusReasonError] = useState('')
  const reasonInputRef = useRef<HTMLTextAreaElement>(null)

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Employee['status']>('Active')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false)
  const [bulkStatusReason, setBulkStatusReason] = useState('')
  const [bulkStatusReasonError, setBulkStatusReasonError] = useState('')
  const bulkReasonInputRef = useRef<HTMLTextAreaElement>(null)

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  // Clear selection when employees change (page change, filter change)
  useEffect(() => {
    setSelectedIds(new Set())
  }, [employees])

  const allSelected = employees.length > 0 && employees.every((e) => selectedIds.has(e.id!))
  const someSelected = selectedIds.size > 0

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(employees.map((e) => e.id!)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const requestBulkStatusChange = () => {
    if (selectedIds.size === 0) return
    setBulkStatusReason('')
    setBulkStatusReasonError('')
    setBulkStatusModalOpen(true)
    setTimeout(() => bulkReasonInputRef.current?.focus(), 50)
  }

  const confirmBulkStatusChange = async () => {
    const reason = bulkStatusReason.trim()
    if (!reason) {
      setBulkStatusReasonError('Please provide a reason for the bulk status change.')
      return
    }
    if (selectedIds.size === 0) return

    setBulkStatusModalOpen(false)
    setBulkSaving(true)
    const ids = Array.from(selectedIds)
    try {
      const result = await bulkUpdateStatus(ids, bulkStatus, reason, user?.email || user?.name)
      console.info(
        '[Manage Employees] Bulk status change:',
        bulkStatus,
        `(${result.updated ?? ids.length} employees)`,
        reason,
      )
      exitSelectionMode()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update employee statuses'
      toast.error(message)
      setBulkStatusModalOpen(true)
    } finally {
      setBulkSaving(false)
      setBulkStatusReason('')
    }
  }

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(format)
    try {
      const exportData = await getEmployeesForExport()
      if (!exportData.length) {
        return
      }

      const exportDate = new Date().toISOString().split('T')[0]
      const filename = activeDirectoryExportFilename(new Date(exportDate))

      const exportOptions = {
        generatedBy: user?.name || 'Admin',
        filters: {
          name: filters.name,
          employmentType: filters.employmentType,
          status: filters.status,
        },
        compactMode: true,
        ...ACTIVE_DIRECTORY_REPORT_OPTIONS,
      }

      if (format === 'pdf') {
        await exportToPDF(exportData, filename, ACTIVE_DIRECTORY_EXPORT_HEADERS, exportOptions)
        console.info('[Manage Employees] Exported Active Directory PDF:', filename, `(${exportData.length} employees)`)
        return
      }

      exportToExcel(exportData, filename, ACTIVE_DIRECTORY_EXPORT_HEADERS, exportOptions)
      console.info('[Manage Employees] Exported Active Directory Excel:', filename, `(${exportData.length} employees)`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      toast.error(message)
    } finally {
      setExporting(null)
    }
  }

  const statusVariant = (s: string) => {
    switch (s) {
      case 'Active': return 'success'
      case 'Notice Period': return 'warning'
      case 'Inactive': return 'neutral'
      case 'Deactivated': return 'danger'
      default: return 'neutral'
    }
  }

  const requestStatusChange = (employee: Employee, status: Employee['status']) => {
    if (employee.status === status) return
    setPendingStatusChange({ employee, newStatus: status })
    setStatusChangeReason('')
    setStatusReasonError('')
    setStatusModalOpen(true)
    setTimeout(() => reasonInputRef.current?.focus(), 50)
  }

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return
    const reason = statusChangeReason.trim()
    if (!reason) {
      setStatusReasonError('Please provide a reason for the status change.')
      return
    }
    const { employee, newStatus } = pendingStatusChange
    setStatusModalOpen(false)
    setSavingStatusId(employee.id!)
    try {
      await updateEmployeeStatus(
        employee.id!,
        newStatus,
        reason,
        user?.email || user?.name,
      )
      console.info(
        '[Manage Employees] Status change:',
        employee.employeeId,
        `${employee.firstName} ${employee.lastName ?? ''}`.trim(),
        `${employee.status} → ${newStatus}`,
        reason,
      )
} catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update status'
      setStatusReasonError(message)
      toast.error(message)
      setStatusModalOpen(true)
    } finally {
      setSavingStatusId(null)
      setPendingStatusChange(null)
      setStatusChangeReason('')
    }
  }

  // Checkbox column
  const checkboxColumn: Column<Employee> = {
    key: 'select' as any,
    header: (
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-[rgba(161,161,170,0.28)] accent-[#22c55e]"
        checked={allSelected}
        onChange={toggleSelectAll}
        aria-label="Select all employees"
      />
    ) as any,
    className: 'w-10 px-3',
    render: (e) => (
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-[rgba(161,161,170,0.28)] accent-[#22c55e]"
        checked={selectedIds.has(e.id!)}
        onChange={() => toggleSelect(e.id!)}
        aria-label={`Select ${e.firstName} ${e.lastName}`}
        onClick={(ev) => ev.stopPropagation()}
      />
    ),
  }

  const dataColumns: Column<Employee>[] = [
    {
      key: 'firstName',
      header: 'Employee',
      sortable: true,
      render: (e) => {
        const name = `${e.firstName} ${e.lastName}`
        return (
          <Link to={`/admin/employees/${e.id}`} className="flex items-center gap-3 group">
            <EmployeeAvatar employeeId={e.id} name={name} color={stringToHueColor(e.id)} />
            <div>
              <p className="font-semibold text-ink group-hover:text-emerald-700 transition-ui">{name}</p>
              <p className="text-xs font-mono text-ink/80">{e.employeeId}</p>
            </div>
          </Link>
        )
      },
    },
    {
      key: 'personalEmail',
      header: 'Personal Email',
      className: 'min-w-[260px]',
      render: (e) => (
        <span className="text-sm text-ink">
          {e.personalEmail ? e.personalEmail : <span className="text-ink/60">—</span>}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Company Email',
      className: 'min-w-[260px]',
      render: (e) => (
        <span className="text-sm text-ink">
          {e.email ? e.email : <span className="text-ink/60">—</span>}
        </span>
      ),
    },
    {
      key: 'employmentType',
      header: 'Type',
      sortable: true,
      render: (e) => <span className="text-ink">{e.employmentType}</span>,
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      sortable: true,
      render: (e) => <span className="text-ink">{formatDate(e.joinedAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (e) => (
        <Badge variant={statusVariant(e.status)}>{e.status}</Badge>
      ),
    },
    {
      key: 'ops' as any,
      header: 'Account',
      className: 'w-32',
      render: (e) => (
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              e.status === 'Active'
                ? 'bg-[#34d399]'
                : e.status === 'Notice Period'
                  ? 'bg-[#fbbf24]'
                  : e.status === 'Deactivated'
                    ? 'bg-[#f87171]'
                    : 'bg-[#94a3b8]'
            }`}
            title={e.status}
          />
          <SelectField
            aria-label={`Change status for ${e.firstName} ${e.lastName ?? ''}`.trim()}
            value={e.status}
            disabled={savingStatusId === e.id}
            onChange={(event) =>
              requestStatusChange(e, event.target.value as Employee['status'])
            }
            showChevron
            className="admin-field h-8 min-w-[6.5rem] max-w-[7.5rem] flex-1 px-2 py-0 text-[11px] font-semibold text-ink disabled:opacity-60"
            options={STATUS_OPTIONS}
          />
        </div>
      ),
    },
  ]

  const columns: Column<Employee>[] = selectionMode
    ? [checkboxColumn, ...dataColumns]
    : dataColumns

  return (
    <div className="crewiq-dashboard">
      <div className="crewiq-dash-bg" />
      <PageWrapper className="relative z-10 py-4 font-body">
        {/* Active Directory heading above the filter toolbar */}
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Active Directory</h3>
          </div>
        </div>

      {/* Filter toolbar */}
      <div className="admin-panel admin-toolbar mb-4 flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex w-full flex-1 flex-nowrap items-center gap-3">
          {/* Free-text search */}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#22c55e]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search employees…"
              className="admin-field h-10 w-full pl-10 pr-9 text-sm font-medium text-ink shadow-sm placeholder:text-ink/45"
            />
            {searchInput ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink/60 transition-ui hover:bg-emerald-50 hover:text-ink"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="relative min-w-0 flex-1">
            <select
              value={filters.employmentType}
              onChange={(e) => setFilters({ employmentType: e.target.value })}
              className={filterSelectClass}
              aria-label="Filter by employment type"
            >
              <option value="all">All types</option>
              <option value="Full-time">Full-time</option>
              <option value="Contract">Contract</option>
              <option value="Intern">Intern</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#22c55e]" aria-hidden />
          </div>
          <div className="relative min-w-0 flex-1">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value })}
              className={filterSelectClass}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#22c55e]" aria-hidden />
          </div>
        </div>
        <div className="flex gap-3">
          {selectionMode ? (
            <Button variant="secondary" onClick={exitSelectionMode}>
              Cancel
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setSelectionMode(true)}>
              <CheckSquare className="h-4 w-4" />
              Select
            </Button>
          )}
          <Button variant="secondary" onClick={() => handleExport('pdf')} loading={exporting === 'pdf'}>
            <FileText className="h-4 w-4 text-red-600" />
            Export PDF
          </Button>
          <Button variant="secondary" onClick={() => handleExport('excel')} loading={exporting === 'excel'}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Excel
          </Button>
          <Button asChild>
            <Link to="/admin/employees/add">
              <Plus className="h-4 w-4" />
              Add Employee
            </Link>
          </Button>
        </div>
      </div>

      {/* Bulk action bar — appears when in selection mode with employees selected */}
      {selectionMode && someSelected && (
        <div className="admin-panel admin-panel-accent mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
          <CheckSquare className="h-4 w-4 shrink-0 text-[#22c55e]" />
          <span className="text-sm font-medium text-ink">
            {selectedIds.size} employee{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-ink">Change status to:</span>
            <div className="relative">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as Employee['status'])}
                className="admin-field h-8 max-w-[118px] cursor-pointer appearance-none pl-2 pr-7 text-[11px] font-semibold text-ink"
                aria-label="Bulk target status"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#22c55e]" aria-hidden />
            </div>
            <Button size="sm" onClick={requestBulkStatusChange} loading={bulkSaving}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelectionMode}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-0 pb-12">
        <DataTable
          className="employee-list-table rounded-b-none border-b-0"
          columns={columns}
          data={employees}
          loading={loading}
          sortColumn={sort.column}
          sortDirection={sort.direction}
          onSort={(key) => {
            if (sort.column === key) {
              setSort(key, sort.direction === 'asc' ? 'desc' : 'asc')
            } else {
              setSort(key, 'asc')
            }
          }}
        />
        {!loading && pagination.total > 0 ? (
          <div className="employee-list-table admin-panel rounded-t-none border-t-0 px-4 py-3">
            <PaginationBar
              total={pagination.total}
              page={pagination.page}
              pageSize={pagination.pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        ) : null}
      </div>

      {/* Status Change Confirmation Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Confirm Status Change"
        size="sm"
        className="admin-modal"
      >
        {pendingStatusChange && (
          <div className="space-y-4">
            <p className="text-sm text-[#a1a1aa]">
              You are about to change{' '}
              <span className="font-semibold text-white">
                {pendingStatusChange.employee.firstName} {pendingStatusChange.employee.lastName}
              </span>
              's status from{' '}
              <span className="font-semibold text-white">{pendingStatusChange.employee.status}</span>
              {' '}to{' '}
              <span className="font-semibold text-white">{pendingStatusChange.newStatus}</span>.
            </p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white">
                Reason <span className="text-[#f87171]">*</span>
              </label>
              <textarea
                ref={reasonInputRef}
                value={statusChangeReason}
                onChange={(e) => {
                  setStatusChangeReason(e.target.value)
                  if (statusReasonError) setStatusReasonError('')
                }}
                placeholder="Provide a reason for this status change..."
                className={`admin-field w-full resize-none px-3 py-2 text-sm transition-shadow ${
                  statusReasonError ? 'border-[#f87171] focus:ring-[#f87171]/20' : 'focus:ring-[#22c55e]/30'
                }`}
                rows={3}
              />
              {statusReasonError && (
                <p className="text-xs text-[#f87171] font-medium">{statusReasonError}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-[rgba(161,161,170,0.18)]">
              <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void confirmStatusChange()}>
                Confirm Change
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Status Change Confirmation Modal */}
      <Modal
        isOpen={bulkStatusModalOpen}
        onClose={() => setBulkStatusModalOpen(false)}
        title="Confirm Bulk Status Change"
        size="sm"
        className="admin-modal"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#a1a1aa]">
            You are about to change the status of{' '}
            <span className="font-semibold text-white">
              {selectedIds.size} employee{selectedIds.size === 1 ? '' : 's'}
            </span>
            {' '}to{' '}
            <span className="font-semibold text-white">{bulkStatus}</span>.
          </p>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white">
              Reason <span className="text-[#f87171]">*</span>
            </label>
            <textarea
              ref={bulkReasonInputRef}
              value={bulkStatusReason}
              onChange={(e) => {
                setBulkStatusReason(e.target.value)
                if (bulkStatusReasonError) setBulkStatusReasonError('')
              }}
              placeholder="Provide a reason for this bulk status change..."
              className={`admin-field w-full resize-none px-3 py-2 text-sm transition-shadow placeholder:text-[#71717a] ${
                bulkStatusReasonError ? 'border-[#f87171] focus:ring-[#f87171]/20' : 'focus:ring-[#22c55e]/30'
              }`}
              rows={3}
            />
            {bulkStatusReasonError && (
              <p className="text-xs text-[#f87171] font-medium">{bulkStatusReasonError}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-[rgba(161,161,170,0.18)]">
            <Button variant="secondary" onClick={() => setBulkStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmBulkStatusChange()} loading={bulkSaving}>
              Confirm Change
            </Button>
          </div>
        </div>
      </Modal>
      </PageWrapper>
    </div>
  )
}
