import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Plus, Download } from 'lucide-react'
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
import { toast } from 'sonner'
import { useAuthStore } from '@store/authStore'

const STATUS_OPTIONS: { value: Employee['status']; label: string }[] = [
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Active', label: 'Active' },
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
    setPageSize,
    sort,
    setSort,
    updateEmployeeStatus,
  } = useEmployees()

  const user = useAuthStore((s) => s.user)

  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  // Status change confirmation modal
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{ employee: Employee; newStatus: Employee['status'] } | null>(null)
  const [statusChangeReason, setStatusChangeReason] = useState('')
  const [statusReasonError, setStatusReasonError] = useState('')
  const reasonInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    employeeService.getEmployees({ pageSize: 1000 })
      .then((res) => setAllEmployees(res.data))
      .catch(() => {})
  }, [])

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(format)
    try {
      const res = await employeeService.getEmployees({
        name: filters.name || undefined,
        department: filters.department,
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
      // Check if this is an active directory export (only Active status filter applied)
      const isActiveDirectoryExport = filters.status === 'Active' && !filters.name && !filters.department && !filters.employmentType
      
      let filename = `EpicalLayouts_EmployeeDetails_${exportDate}`
      if (isActiveDirectoryExport) {
        filename = `EpicalLayouts_EmployeeDetails_${exportDate}`
      }

      // Define headers based on whether this is active directory export or full details export
      const headers: { key: keyof Employee; label: string }[] = [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'email', label: 'Email' },
        { key: 'department', label: 'Department' },
        { key: 'designation', label: 'Designation' },
        { key: 'employmentType', label: 'Employment Type' },
        { key: 'status', label: 'Status' },
        { key: 'joinedAt', label: 'Joined At' },
      ]

      let excelHeaders: { key: keyof Employee; label: string }[] = []
      
      if (isActiveDirectoryExport) {
        // Active Directory - Only basic information
        excelHeaders = [
          { key: 'employeeId', label: 'Employee ID' },
          { key: 'firstName', label: 'First Name' },
          { key: 'lastName', label: 'Last Name' },
          { key: 'email', label: 'Work Email' },
          { key: 'phone', label: 'Phone Number' },
          { key: 'department', label: 'Department' },
          { key: 'designation', label: 'Designation' },
          { key: 'employmentType', label: 'Employment Type' },
          { key: 'joinedAt', label: 'Joined At' },
          { key: 'status', label: 'Account Status' },
        ]
      } else {
        // Full Details Export
        excelHeaders = [
          { key: 'employeeId', label: 'Employee ID' },
          { key: 'firstName', label: 'First Name' },
          { key: 'middleName', label: 'Middle Name' },
          { key: 'lastName', label: 'Last Name' },
          { key: 'email', label: 'Work Email' },
          { key: 'personalEmail', label: 'Personal Email' },
          { key: 'phone', label: 'Phone Number' },
          { key: 'dob', label: 'Date of Birth' },
          { key: 'gender', label: 'Gender' },
          { key: 'permanentAddress', label: 'Permanent Address' },
          { key: 'communicationAddress', label: 'Communication Address' },
          { key: 'department', label: 'Department' },
          { key: 'designation', label: 'Designation' },
          { key: 'role', label: 'Role' },
          { key: 'employmentType', label: 'Employment Type' },
          { key: 'joinedAt', label: 'Joined At' },
          { key: 'status', label: 'Account Status' },
          { key: 'ctc', label: 'CTC (Annual)' },
          { key: 'bankName', label: 'Bank Name' },
          { key: 'accountNumber', label: 'Account Number' },
          { key: 'ifsc', label: 'IFSC Code' },
          { key: 'uan', label: 'UAN' },
          { key: 'pfEsi', label: 'PF / ESI' },
          { key: 'aadhaar', label: 'Aadhaar Number' },
          { key: 'pan', label: 'PAN' },
          { key: 'passport', label: 'Passport Number' },
        ]
      }

      const exportOptions = {
        generatedBy: user?.name || 'Admin',
        filters: {
          name: filters.name,
          department: filters.department,
          employmentType: filters.employmentType,
          status: filters.status,
        },
        compactMode: format === 'pdf', // Enable compact mode for PDF
      }

      if (format === 'pdf') {
        await exportToPDF(fullEmployeeData, filename, headers, exportOptions)
        return
      }

      exportToExcel(fullEmployeeData, filename, excelHeaders, exportOptions)
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
    setSavingStatusId(employee.id)
    try {
      await updateEmployeeStatus(employee.id, newStatus)
      toast.success(`${employee.firstName} ${employee.lastName ?? ''}`.trim() + ` set to ${newStatus}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update status')
    } finally {
      setSavingStatusId(null)
      setPendingStatusChange(null)
      setStatusChangeReason('')
    }
  }

  const commonColumns: Column<Employee>[] = [
    {
      key: 'firstName',
      header: 'Employee name',
      sortable: true,
      render: (e) => {
        const name = `${e.firstName} ${e.lastName}`
        return (
          <Link to={`/admin/employees/${e.id}`} className="flex items-center gap-3 group">
            <Avatar src={getPhotoUrl(e.id)} name={name} color={stringToHueColor(e.id)} />
            <div>
              <p className="font-medium text-ink group-hover:text-primary transition-ui">{name}</p>
              <p className="text-xs text-muted">{e.email}</p>
            </div>
          </Link>
        )
      },
    },
    {
      key: 'employeeId',
      header: 'Employee ID',
      sortable: true,
      render: (e) => (
        <span className="font-mono text-xs font-medium text-primary">{e.employeeId}</span>
      ),
    },
    { key: 'department', header: 'Dept', sortable: true },
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
  ]

  const columns: Column<Employee>[] = [
    ...commonColumns,

    {
      key: 'ops',
      header: 'ACCOUNT',
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

  return (
    <PageWrapper>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-surface/50 p-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex w-full flex-nowrap gap-3 items-center flex-1">
          <div className="flex-1 min-w-0">
            <select
              value={filters.name}
              onChange={(e) => setFilters({ name: e.target.value === 'all' ? '' : e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm outline-none transition-ui focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All employees</option>
              {allEmployees.map((emp) => {
                const fullName = `${emp.firstName} ${emp.lastName ?? ''}`.trim()
                return (
                  <option key={emp.id} value={fullName}>
                    {emp.employeeId ? `${emp.employeeId} — ${fullName}` : fullName}
                  </option>
                )
              })}
            </select>
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
          <Button
            variant="secondary"
            onClick={() => handleExport('pdf')}
            loading={exporting === 'pdf'}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('excel')}
            loading={exporting === 'excel'}
          >
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

      <div className="space-y-12 pb-12">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">Active Directory</h3>
            <span className="text-sm text-muted">{pagination.total} total</span>
          </div>
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
          <PaginationBar
            className="mt-4"
            total={pagination.total}
            page={pagination.page}
            pageSize={pagination.pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>
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
