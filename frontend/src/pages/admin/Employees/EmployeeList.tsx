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
  LayoutGrid,
  Table,
  Mail,
  Calendar,
  Hash,
  Upload,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { PaginationBar } from '@components/tables/Pagination'
import { useEmployees } from '@hooks/useEmployees'
import type { Employee } from '@/types'
import { stringToHueColor, stringToHue } from '@/utils/stringColor'
import { getEmployeeAvatarUrl } from '@/utils/getAvatarUrl'
import { EmployeeAvatar } from '@components/ui/EmployeeAvatar'
import {
  exportActiveDirectoryExcel,
  exportActiveDirectoryPdf,
} from '@/utils/activeDirectoryExport'
import { formatDate } from '@/utils/formatDate'
import { useAuthStore } from '@store/authStore'
import { ROUTES } from '@constants/routes'
import {
  activeDirectoryExportFilename,
} from '@/constants/employeeExport'
import {
  downloadEmployeeImportTemplate,
  parseEmployeeImportFile,
} from '@services/employeeService'
import {
  EmployeeBulkImportModal,
  type EmployeeImportPreviewRow,
} from './EmployeeBulkImportModal'

function makeImportTempId(rowNumber: number) {
  return `import-row-${rowNumber}-${Math.random().toString(36).slice(2, 8)}`
}

const STATUS_OPTIONS: { value: Employee['status']; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Notice Period', label: 'Notice Period' },
  { value: 'Deactivated', label: 'Deactivated' },
]

const filterSelectClass =
  'employee-directory-filter-select h-10 w-full min-w-[9.5rem] cursor-pointer appearance-none pl-3 pr-9 text-sm font-medium'

export function EmployeeList() {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
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
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importRows, setImportRows] = useState<EmployeeImportPreviewRow[]>([])
  const [parsingImport, setParsingImport] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement>(null)

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
      }

      if (format === 'pdf') {
        await exportActiveDirectoryPdf(exportData, filename, exportOptions)
        console.info('[Manage Employees] Exported Active Directory PDF:', filename, `(${exportData.length} employees)`)
        return
      }

      await exportActiveDirectoryExcel(exportData, filename, exportOptions)
      console.info('[Manage Employees] Exported Active Directory Excel:', filename, `(${exportData.length} employees)`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      toast.error(message)
    } finally {
      setExporting(null)
    }
  }

  const handleDownloadImportTemplate = async () => {
    try {
      setDownloadingTemplate(true)
      await downloadEmployeeImportTemplate()
      toast.success('Employee import template downloaded')
    } catch {
      toast.error('Failed to download template')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const handleImportFileChange = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return

    try {
      setParsingImport(true)
      const parsed = await parseEmployeeImportFile(file)
      const withIds = parsed.map((row) => ({
        ...row,
        tempId: makeImportTempId(row.rowNumber),
      }))
      setImportRows(withIds)
      setImportModalOpen(true)
      toast.success(`Loaded ${withIds.length} employee${withIds.length === 1 ? '' : 's'} from Excel`)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to parse Excel file')
      toast.error(message)
    } finally {
      setParsingImport(false)
      if (importFileInputRef.current) importFileInputRef.current.value = ''
    }
  }

  const handleCloseImportModal = () => {
    setImportModalOpen(false)
    setImportRows([])
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
      header: 'Employee Name',
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
    <div
      className="crewiq-dashboard employee-pages employee-directory-view"
      data-admin-employees
      data-view-mode={viewMode === 'table' ? 'list' : 'grid'}
    >
      <div className="employee-directory-bg" aria-hidden>
        <div className="employee-directory-bg-gradient" />
        <div className="employee-directory-bg-leaves" />
      </div>

      <div className="employee-directory-shell">
        <header className="employee-directory-header">
          <h1 className="employee-directory-title">Employee Directory</h1>
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
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50/50 mr-2 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-emerald-700'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'bg-white shadow-sm text-emerald-700'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Table View"
              >
                <Table className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              className="employee-directory-export-btn"
              onClick={() => void handleDownloadImportTemplate()}
              disabled={downloadingTemplate}
            >
              <Download className="h-4 w-4 text-[#266b1c]" strokeWidth={2} />
              Download Template
            </button>
            <button
              type="button"
              className="employee-directory-export-btn"
              onClick={() => importFileInputRef.current?.click()}
              disabled={parsingImport}
            >
              <Upload className="h-4 w-4 text-[#266b1c]" strokeWidth={2} />
              {parsingImport ? 'Uploading…' : 'Upload Excel'}
            </button>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => void handleImportFileChange(event.target.files)}
            />
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
            <h2 className="employee-directory-table-title">
              {viewMode === 'grid' ? 'Employee Directory' : 'Employees List'}
            </h2>
          </div>

          {viewMode === 'grid' ? (
            loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <p className="text-sm font-medium">No employees found matching the filters.</p>
              </div>
            ) : (
              <div className="employee-directory-grid grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {employees.map((e) => {
                  const name = `${e.firstName} ${e.lastName || ''}`.trim()
                  const initials = `${e.firstName?.[0] ?? ''}${e.lastName?.[0] ?? ''}`.toUpperCase()
                  
                  // Ring & Badge styling based on status
                  let ringColor = 'border-emerald-600 ring-emerald-500/20 text-emerald-700 bg-emerald-50'
                  let badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  if (e.status === 'Notice Period') {
                    ringColor = 'border-amber-500 ring-amber-500/20 text-amber-700 bg-amber-50'
                    badgeColor = 'bg-amber-100 text-amber-700 border-amber-200'
                  } else if (e.status === 'Deactivated' || e.status === 'Inactive') {
                    ringColor = 'border-red-500 ring-red-500/20 text-red-700 bg-red-50'
                    badgeColor = 'bg-red-100 text-red-700 border-red-200'
                  }

                  const hue = stringToHue(e.id || name)
                  const startColor = `hsl(${hue} 75% 95%)`
                  const borderColor = `hsl(${hue} 50% 86%)`

                  return (
                    <div
                      key={e.id}
                      className="employee-directory-card group flex flex-col border rounded-2xl p-5 shadow-[0_4px_15px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1"
                      style={{
                        background: `linear-gradient(135deg, ${startColor} 0%, #ffffff 100%)`,
                        borderColor: borderColor,
                      }}
                    >
                      {/* Top Row: Avatar & Actions */}
                      <div className="flex justify-between items-start">
                        {/* Avatar / Initials container with status badge */}
                        <div className="relative flex flex-col items-center">
                          <div className={`relative flex items-center justify-center h-16 w-16 rounded-full border-2 ring-4 ${ringColor}`}>
                            {getEmployeeAvatarUrl(e) ? (
                              <img src={getEmployeeAvatarUrl(e)} alt={name} className="h-full w-full rounded-full object-cover" />
                            ) : (
                              <span className="text-xl font-bold text-black">{initials}</span>
                            )}
                          </div>
                          <span className={`absolute -bottom-2 rounded-full px-2.5 py-0.5 text-[9px] font-bold border uppercase tracking-wider ${badgeColor}`}>
                            {e.status}
                          </span>
                        </div>

                        {/* Top-Right Action menu */}
                        <div className="flex items-center gap-1">
                          <Link
                            to={ROUTES.EMPLOYEE(e.id!)}
                            className="p-1.5 text-black hover:bg-black/5 rounded-full transition-colors"
                            title="View employee"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            to={ROUTES.EMPLOYEE_EDIT(e.id!)}
                            className="p-1.5 text-black hover:bg-black/5 rounded-full transition-colors"
                            title="Edit employee"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                type="button"
                                className="p-1.5 text-black hover:bg-black/5 rounded-full transition-colors disabled:opacity-50"
                                title="Change account status"
                                disabled={savingStatusId === e.id}
                              >
                                <MoreVertical className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                className="admin-navbar-menu z-50 min-w-[180px] p-1 bg-white border border-slate-100 shadow-lg rounded-xl"
                                sideOffset={4}
                                align="end"
                              >
                                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Change status
                                </p>
                                {STATUS_OPTIONS.map((option) => (
                                  <DropdownMenu.Item
                                    key={option.value}
                                    className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 data-[disabled]:opacity-50"
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
                      </div>

                      {/* Employee Info */}
                      <Link to={ROUTES.EMPLOYEE(e.id!)} className="block mt-5">
                        <h3 className="text-lg font-bold text-black truncate">
                          {name}
                        </h3>
                        <p className="text-sm text-black mt-0.5 truncate">{e.employmentType || '—'}</p>
                      </Link>

                      <div className="mt-4 pb-4 border-b border-slate-100/60">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-black uppercase tracking-wider">Employee ID</span>
                          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-black font-medium">
                            <Hash className="h-4 w-4 text-black mr-1.5 shrink-0" />
                            <span className="truncate" title={e.employeeId}>{e.employeeId || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="mt-4 space-y-2.5">
                        <h4 className="text-xs font-bold text-black uppercase tracking-wider">Contact Info</h4>
                        
                        <div className="flex items-center text-sm text-black truncate">
                          <Mail className="h-4 w-4 text-black mr-2 shrink-0" />
                          <span className="truncate" title={e.email}>{e.email}</span>
                        </div>
                        
                        <div className="flex items-center text-sm text-black truncate">
                          <Mail className="h-4 w-4 text-black mr-2 shrink-0" />
                          <span className="truncate" title={e.personalEmail}>{e.personalEmail || '—'}</span>
                        </div>

                        <div className="flex items-center text-sm text-black">
                          <Calendar className="h-4 w-4 text-black mr-2 shrink-0" />
                          <span>{e.joinedAt ? `${new Date(e.joinedAt).getFullYear()} Join` : '—'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
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
          )}

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
        theme="light"
        className="admin-modal"
      >
        {pendingStatusChange && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              You are about to change{' '}
              <span className="font-semibold text-slate-900">
                {pendingStatusChange.employee.firstName} {pendingStatusChange.employee.lastName}
              </span>
              's status from{' '}
              <span className="font-semibold text-slate-900">{pendingStatusChange.employee.status}</span>
              {' '}to{' '}
              <span className="font-semibold text-slate-900">{pendingStatusChange.newStatus}</span>.
            </p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-800">
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
                className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-slate-800 transition-shadow focus:outline-none focus:ring-2 ${
                  statusReasonError
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-slate-200 focus:ring-emerald-200'
                }`}
                rows={3}
              />
              {statusReasonError && (
                <p className="text-xs font-medium text-red-600">{statusReasonError}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-2">
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

      <EmployeeBulkImportModal
        open={importModalOpen}
        onClose={handleCloseImportModal}
        rows={importRows}
        onRowsChange={setImportRows}
      />
    </div>
  )
}
