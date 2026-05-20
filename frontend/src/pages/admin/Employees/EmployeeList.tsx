import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Plus, Download } from 'lucide-react'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import { DataTable, type Column } from '@components/tables/DataTable'
import { FilterBar } from '@components/tables/FilterBar'
import { PaginationBar } from '@components/tables/Pagination'
import { SelectField } from '@components/forms/SelectField'
import { useEmployees } from '@hooks/useEmployees'
import { useDebounce } from '@hooks/useDebounce'
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

  const [nameQuery, setNameQuery] = useState(filters.name)
  const [idQuery, setIdQuery] = useState(filters.employeeId)
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  const dqName = useDebounce(nameQuery, 300)
  const dqId = useDebounce(idQuery, 300)

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(format)
    try {
      const res = await employeeService.getEmployees({
        name: filters.name || undefined,
        employeeId: filters.employeeId || undefined,
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

      const filename = `employees_${new Date().toISOString().split('T')[0]}`
      const headers: { key: keyof Employee; label: string }[] = [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'email', label: 'Email' },
        { key: 'department', label: 'Department' },
        { key: 'employmentType', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'joinedAt', label: 'Joined At' },
      ]

      const excelHeaders: { key: keyof Employee; label: string }[] = [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'email', label: 'Work Email' },
        { key: 'personalEmail', label: 'Personal Email' },
        { key: 'phone', label: 'Phone Number' },
        { key: 'dob', label: 'Date of Birth' },
        { key: 'gender', label: 'Gender' },
        { key: 'department', label: 'Department' },
        { key: 'designation', label: 'Designation' },
        { key: 'role', label: 'Role' },
        { key: 'employmentType', label: 'Employment Type' },
        { key: 'joinedAt', label: 'Joined At' },
        { key: 'reportingManager', label: 'Reporting Manager' },
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
        { key: 'address', label: 'Address' },
      ]

      const exportOptions = {
        generatedBy: user?.name || 'Admin',
        filters: {
          name: filters.name,
          employeeId: filters.employeeId,
          department: filters.department,
          employmentType: filters.employmentType,
          status: filters.status,
        },
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

  useEffect(() => {
    setFilters({ name: dqName, employeeId: dqId })
  }, [dqName, dqId, setFilters])

  const statusVariant = (s: string) => {
    switch (s) {
      case 'Active': return 'success'
      case 'Notice Period': return 'warning'
      case 'Inactive': return 'neutral'
      case 'Deactivated': return 'danger'
      default: return 'neutral'
    }
  }

  const handleAccountStatusChange = async (employee: Employee, status: Employee['status']) => {
    if (employee.status === status) return

    setSavingStatusId(employee.id)
    try {
      await updateEmployeeStatus(employee.id, status)
      toast.success(`${employee.firstName} ${employee.lastName ?? ''}`.trim() + ` set to ${status}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update status')
    } finally {
      setSavingStatusId(null)
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
              void handleAccountStatusChange(e, event.target.value as Employee['status'])
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
      <PageHeader
        title="Employees"
        breadcrumb={<Breadcrumb items={[{ label: 'Employees', to: '/admin/employees' }]} />}
        actions={
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
        }
      />

      <FilterBar>
        <div className="grid w-full gap-3 md:grid-cols-4">
          <Input
            label="Employee name"
            placeholder="Search by name"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
          />
          <Input
            label="Employee ID"
            placeholder="Search by employee ID"
            value={idQuery}
            onChange={(e) => setIdQuery(e.target.value)}
          />
          <SelectField
            label="Employment type"
            value={filters.employmentType}
            onChange={(e) => setFilters({ employmentType: e.target.value })}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'Full-time', label: 'Full-time' },
              { value: 'Contract', label: 'Contract' },
              { value: 'Intern', label: 'Intern' },
            ]}
          />
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            options={[
              { value: 'all', label: 'All statuses' },
              ...STATUS_OPTIONS,
            ]}
          />
        </div>
      </FilterBar>

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

    </PageWrapper>
  )
}
