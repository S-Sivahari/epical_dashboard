import { Link } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Download, Search, X, CheckSquare } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import { Modal } from '@components/ui/Modal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { PaginationBar } from '@components/tables/Pagination'
import { SelectField } from '@components/forms/SelectField'
import { useEmployees } from '@hooks/useEmployees'
import type { Employee } from '@/types'
import { stringToHueColor } from '@/utils/stringColor'
import * as employeeService from '@services/employeeService'
import { getPhotoUrl } from '@/services/uploadService'
import { exportToExcel } from '@/utils/exportExcel'
import { exportToPDF } from '@/utils/exportPDF'
import { formatDate } from '@/utils/formatDate'
import { useAuthStore } from '@store/authStore'

const STATUS_OPTIONS: { value: Employee['status']; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Deactivated', label: 'Deactivated' },
  { value: 'Notice Period', label: 'Notice Period' },
]

export function EmployeeList() {
  const {
    employees,
    loading,
    filters,
    setFilters,
    pagination,
    setPage,
    sort,
    setSort,
    updateEmployeeStatus,
    bulkUpdateStatus,
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

  const handleBulkStatusApply = async () => {
    if (selectedIds.size === 0) return
    setBulkSaving(true)
    try {
      await bulkUpdateStatus(Array.from(selectedIds), bulkStatus)
      exitSelectionMode()
    } finally {
      setBulkSaving(false)
    }
  }

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(format)
    try {
      const res = await employeeService.getEmployees({
        name: filters.name || undefined,
        employmentType: filters.employmentType,
        status: filters.status,
        pageSize: 1000,
      })
      const fullEmployeeData = await Promise.all(
        res.data.map(async (employee) => {
          try {
            return await employeeService.getEmployee(employee.id)
          } catch {
            return employee
          }
        }),
      )

      const exportDate = new Date().toISOString().split('T')[0]
      const filename = `EpicalLayouts_EmployeeDetails_${exportDate}`

      const headers: { key: keyof Employee; label: string }[] = [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'email', label: 'Company Email' },
        { key: 'personalEmail', label: 'Personal Email' },
        { key: 'employmentType', label: 'Employment Type' },
        { key: 'status', label: 'Status' },
        { key: 'joinedAt', label: 'Joined At' },
      ]

      const exportOptions = {
        generatedBy: user?.name || 'Admin',
        filters: {
          name: filters.name,
          employmentType: filters.employmentType,
          status: filters.status,
        },
        compactMode: format === 'pdf',
      }

      if (format === 'pdf') {
        await exportToPDF(fullEmployeeData, filename, headers, exportOptions)
        return
      }

      exportToExcel(fullEmployeeData, filename, headers, exportOptions)
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
      await updateEmployeeStatus(employee.id!, newStatus)
    } catch (err) {
      setStatusReasonError(err instanceof Error ? err.message : 'Could not update status')
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
        className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
        checked={allSelected}
        onChange={toggleSelectAll}
        aria-label="Select all employees"
      />
    ) as any,
    className: 'w-10 px-3',
    render: (e) => (
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
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
            <Avatar src={getPhotoUrl(e.id)} name={name} color={stringToHueColor(e.id)} />
            <div>
              <p className="font-medium text-ink group-hover:text-primary transition-ui">{name}</p>
              <p className="text-xs text-muted font-mono">{e.employeeId}</p>
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
          {e.personalEmail ? e.personalEmail : <span className="text-muted">—</span>}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Company Email',
      className: 'min-w-[260px]',
      render: (e) => (
        <span className="text-sm text-ink">
          {e.email ? e.email : <span className="text-muted">—</span>}
        </span>
      ),
    },
    { key: 'employmentType', header: 'Type', sortable: true },
    {
      key: 'joinedAt',
      header: 'Joined',
      sortable: true,
      render: (e) => <span className="text-muted">{formatDate(e.joinedAt)}</span>,
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
      className: 'w-44',
      render: (e) => (
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
              e.status === 'Active'
                ? 'bg-emerald-500'
                : e.status === 'Notice Period'
                  ? 'bg-amber-500'
                  : e.status === 'Deactivated'
                    ? 'bg-red-500'
                    : 'bg-gray-400'
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
            className="h-8 min-w-[132px] px-2 text-xs"
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
    <PageWrapper>
      {/* Active Directory heading above the filter toolbar */}
      <div className="mb-3">
        <h3 className="font-display text-lg font-semibold text-ink">Active Directory</h3>
      </div>

      {/* Filter toolbar */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-surface/50 p-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex w-full flex-nowrap gap-3 items-center flex-1">
          {/* Free-text search — Feature 7 */}
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search employees…"
              className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-ink shadow-sm outline-none transition-ui focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {searchInput && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <select
              value={filters.employmentType}
              onChange={(e) => setFilters({ employmentType: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm outline-none transition-ui focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All types</option>
              <option value="Full-time">Full-time</option>
              <option value="Contract">Contract</option>
              <option value="Intern">Intern</option>
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm outline-none transition-ui focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="secondary" onClick={() => handleExport('excel')} loading={exporting === 'excel'}>
            <Download className="h-4 w-4" />
            Excel
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
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-ink">
            {selectedIds.size} employee{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted">Change status to:</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as Employee['status'])}
              className="h-8 rounded-lg border border-border bg-white px-2 text-sm text-ink"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Button size="sm" onClick={handleBulkStatusApply} loading={bulkSaving}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelectionMode}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4 pb-12">
        <PaginationBar
          total={pagination.total}
          page={pagination.page}
          pageSize={pagination.pageSize}
          onPageChange={setPage}
        />
        <DataTable
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
      </div>

      {/* Status Change Confirmation Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Confirm Status Change"
        size="sm"
      >
        {pendingStatusChange && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              You are about to change{' '}
              <span className="font-semibold text-ink">
                {pendingStatusChange.employee.firstName} {pendingStatusChange.employee.lastName}
              </span>
              's status from{' '}
              <span className="font-semibold text-ink">{pendingStatusChange.employee.status}</span>
              {' '}to{' '}
              <span className="font-semibold text-ink">{pendingStatusChange.newStatus}</span>.
            </p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                ref={reasonInputRef}
                value={statusChangeReason}
                onChange={(e) => {
                  setStatusChangeReason(e.target.value)
                  if (statusReasonError) setStatusReasonError('')
                }}
                placeholder="Provide a reason for this status change..."
                className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 resize-none transition-shadow ${
                  statusReasonError ? 'border-red-500 focus:ring-red-200' : 'border-border focus:ring-primary/30'
                }`}
                rows={3}
              />
              {statusReasonError && (
                <p className="text-xs text-red-500 font-medium">{statusReasonError}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
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
    </PageWrapper>
  )
}
