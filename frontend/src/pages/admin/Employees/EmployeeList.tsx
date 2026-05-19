import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Plus, UserMinus, UserCheck, Download } from 'lucide-react'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { ConfirmModal } from '@components/modals/ConfirmModal'
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
import { exportToExcel } from '@/utils/exportExcel'
import { exportToPDF } from '@/utils/exportPDF'
import { formatDate } from '@/utils/formatDate'

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

  const [nameQuery, setNameQuery] = useState(filters.name)
  const [idQuery, setIdQuery] = useState(filters.employeeId)
  const [statusTarget, setStatusTarget] = useState<{
    e: Employee
    status: Employee['status']
  } | null>(null)
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

      if (format === 'pdf') {
        await exportToPDF(res.data, filename, headers)
        return
      }

      exportToExcel(res.data, filename, headers)
    } finally {
      setExporting(null)
    }
  }

  useEffect(() => {
    setFilters({ name: dqName, employeeId: dqId })
  }, [dqName, dqId, setFilters])

  const commonColumns: Column<Employee>[] = [
    {
      key: 'firstName',
      header: 'Employee name',
      sortable: true,
      render: (e) => {
        const name = `${e.firstName} ${e.lastName}`
        return (
          <div className="flex items-center gap-3">
            <Avatar name={name} color={stringToHueColor(e.id)} />
            <div>
              <p className="font-medium text-ink">{name}</p>
              <p className="text-xs text-muted">{e.email}</p>
            </div>
          </div>
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
        <Badge variant={e.status === 'Active' ? 'success' : 'neutral'}>{e.status}</Badge>
      ),
    },
  ]

  const columns: Column<Employee>[] = [
    ...commonColumns,
    {
      key: 'id',
      header: 'EDIT',
      render: (e) => (
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/admin/employees/${e.id}/edit`}>Edit</Link>
        </Button>
      ),
    },
    {
      key: 'ops',
      header: 'ACCOUNT',

      className: 'w-24',
      render: (e) => (
        <div className="flex items-center gap-2 -ml-4">
          {e.status === 'Active' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusTarget({ e, status: 'Inactive' })}
                title="Mark inactive"
              >
                <UserMinus className="h-4 w-4 text-warning" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusTarget({ e, status: 'Resigned' })}
                title="Mark resigned"
              >
                <UserMinus className="h-4 w-4 text-muted" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusTarget({ e, status: 'Active' })}
              title="Reactivate"
            >
              <UserCheck className="h-4 w-4 text-success" />
            </Button>
          )}
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
              { value: 'Active', label: 'Active' },
              { value: 'Contract', label: 'Contract' },
              { value: 'Intern', label: 'Intern' },
              { value: 'Notice Period', label: 'Notice Period' },
            ]}
          />
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
              { value: 'Resigned', label: 'Resigned' },
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

      <ConfirmModal
        isOpen={!!statusTarget}
        title={`${statusTarget?.status} Employee`}
        description={
          statusTarget
            ? `Are you sure you want to set ${statusTarget.e.firstName} ${statusTarget.e.lastName} to ${statusTarget.status}?`
            : "Are you sure you want to change this employee's status?"
        }
        confirmLabel={statusTarget?.status || 'Confirm'}
        danger={statusTarget?.status !== 'Active'}
        onClose={() => setStatusTarget(null)}
        onConfirm={async () => {
          if (!statusTarget) return
          await updateEmployeeStatus(statusTarget.e.id, statusTarget.status)
          setStatusTarget(null)
        }}
      />
    </PageWrapper>
  )
}
