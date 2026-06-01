import { Link } from 'react-router-dom'
import { useState, useRef, useCallback } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Plus,
  Search,
  X,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Eye,
  Pencil,
  MoreVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { PaginationBar } from '@components/tables/Pagination'
import { useEmployees } from '@hooks/useEmployees'
import type { Employee } from '@/types'
import { stringToHueColor } from '@/utils/stringColor'
import { EmployeeAvatar } from '@components/ui/EmployeeAvatar'
import { exportToExcel } from '@/utils/exportExcel'
import { exportToPDF } from '@/utils/exportPDF'
import { formatDate } from '@/utils/formatDate'
import { useAuthStore } from '@store/authStore'
import { ROUTES } from '@constants/routes'
import {
  ACTIVE_DIRECTORY_EXPORT_HEADERS,
  ACTIVE_DIRECTORY_REPORT_OPTIONS,
  activeDirectoryExportFilename,
} from '@/constants/employeeExport'

const STATUS_OPTIONS: { value: Employee['status']; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Notice Period', label: 'Notice Period' },
  { value: 'Deactivated', label: 'Deactivated' },
]

const filterSelectClass =
  'employee-directory-filter-select h-10 w-full min-w-[9.5rem] cursor-pointer appearance-none pl-3 pr-9 text-sm font-medium'

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

  const dataColumns: Column<Employee>[] = [
    {
      key: 'firstName',
      header: 'Employee',
      sortable: true,
      render: (e) => {
        const name = `${e.firstName} ${e.lastName}`
        return (
          <Link to={ROUTES.EMPLOYEE(e.id!)} className="employee-directory-employee-link group flex items-center gap-3">
            <EmployeeAvatar employeeId={e.id} name={name} color={stringToHueColor(e.id)} />
            <div className="min-w-0">
              <p className="font-semibold text-[#1a4712] transition-colors group-hover:text-[#266b1c]">{name}</p>
              <p className="text-xs font-medium text-slate-500">{e.employeeId}</p>
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
        <span className="text-sm text-slate-700">
          {e.personalEmail ? e.personalEmail : <span className="text-slate-400">—</span>}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Company Email',
      className: 'min-w-[240px]',
      render: (e) => (
        <span className="text-sm text-slate-700">
          {e.email ? e.email : <span className="text-slate-400">—</span>}
        </span>
      ),
    },
    {
      key: 'employmentType',
      header: 'Type',
      sortable: true,
      render: (e) => <span className="text-sm font-medium text-slate-700">{e.employmentType}</span>,
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      sortable: true,
      render: (e) => <span className="text-sm text-slate-700">{formatDate(e.joinedAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (e) => (
        <Badge variant={statusVariant(e.status)} className="employee-directory-status-badge px-3 py-1 text-xs font-semibold">
          {e.status}
        </Badge>
      ),
    },
    {
      key: 'ops' as const,
      header: 'Actions',
      className: 'w-32 text-right',
      render: (e) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
          role="presentation"
        >
          <Link
            to={ROUTES.EMPLOYEE(e.id!)}
            className="employee-directory-action-btn"
            title="View employee"
            aria-label={`View ${e.firstName} ${e.lastName ?? ''}`.trim()}
          >
            <Eye className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link
            to={ROUTES.EMPLOYEE_EDIT(e.id!)}
            className="employee-directory-action-btn"
            title="Edit employee"
            aria-label={`Edit ${e.firstName} ${e.lastName ?? ''}`.trim()}
          >
            <Pencil className="h-4 w-4" strokeWidth={2} />
          </Link>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="employee-directory-action-btn disabled:opacity-50"
                title="Change account status"
                aria-label={`Change status for ${e.firstName} ${e.lastName ?? ''}`.trim()}
                disabled={savingStatusId === e.id}
              >
                <MoreVertical className="h-4 w-4" strokeWidth={2} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="admin-navbar-menu z-50 min-w-[180px] p-1"
                sideOffset={4}
                align="end"
              >
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Change status
                </p>
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenu.Item
                    key={option.value}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-surface/80 data-[disabled]:opacity-50"
                    disabled={e.status === option.value || savingStatusId === e.id}
                    onSelect={() => requestStatusChange(e, option.value)}
                  >
                    {option.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      ),
    },
  ]

  return (
    <div className="crewiq-dashboard employee-pages employee-directory-view">
      <div className="employee-directory-bg" aria-hidden>
        <div className="employee-directory-bg-gradient" />
        <div className="employee-directory-bg-leaves" />
      </div>

      <div className="employee-directory-shell">
        <header className="employee-directory-header">
          <h1 className="employee-directory-title">Employee Active Directory</h1>
        </header>

        <div className="employee-directory-toolbar">
          <div className="employee-directory-toolbar-filters">
            <div className="employee-directory-search-wrap">
              <Search className="employee-directory-search-icon" strokeWidth={2} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by Name, Email, or EPL..."
                className="employee-directory-search-input"
              />
              {searchInput ? (
                <button
                  type="button"
                  className="employee-directory-search-clear"
                  onClick={() => handleSearchChange('')}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="employee-directory-select-wrap">
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
              <ChevronDown className="employee-directory-select-icon" aria-hidden />
            </div>

            <div className="employee-directory-select-wrap">
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
              <ChevronDown className="employee-directory-select-icon" aria-hidden />
            </div>
          </div>

          <div className="employee-directory-toolbar-actions">
            <button
              type="button"
              className="employee-directory-export-btn"
              onClick={() => void handleExport('pdf')}
              disabled={exporting === 'pdf'}
            >
              <FileText className="h-4 w-4 text-red-600" strokeWidth={2} />
              Export PDF
            </button>
            <button
              type="button"
              className="employee-directory-export-btn"
              onClick={() => void handleExport('excel')}
              disabled={exporting === 'excel'}
            >
              <FileSpreadsheet className="h-4 w-4 text-[#266b1c]" strokeWidth={2} />
              Export Excel
            </button>
            <Button asChild size="lg" className="employee-directory-add-btn shrink-0">
              <Link to={ROUTES.EMPLOYEE_ADD}>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Employee
              </Link>
            </Button>
          </div>
        </div>

        <section className="employee-directory-table-section">
          <div className="employee-directory-table-head">
            <h2 className="employee-directory-table-title">Employees List</h2>
          </div>

          <DataTable
            className="employee-list-table employee-directory-table"
            columns={dataColumns}
            data={employees}
            loading={loading}
            brandHeader
            striped
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
            <div className="employee-directory-pagination">
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
        </section>
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
                  statusReasonError ? 'border-[#f87171] focus:ring-[#f87171]/20' : 'focus:ring-[#266b1c]/30'
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
    </div>
  )
}
