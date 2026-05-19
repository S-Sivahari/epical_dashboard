import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Plus, Archive, UserMinus, UserCheck, ShieldAlert, Download } from 'lucide-react'
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
import { exportToCSV } from '@/utils/exportCSV'
import { exportToExcel } from '@/utils/exportExcel'
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
    updateEmployeeStatus,
  } = useEmployees()
  
  const [q, setQ] = useState(filters.q)
  const [statusTarget, setStatusTarget] = useState<{ e: Employee; status: Employee['status'] } | null>(null)
  const [deactivatedList, setDeactivatedList] = useState<Employee[]>([])
  const [archivedList, setArchivedList] = useState<Employee[]>([])
  const [loadingExtras, setLoadingExtras] = useState(false)
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null)

  const dq = useDebounce(q, 300)
  
  const fetchExtras = async () => {
    setLoadingExtras(true)
    try {
      const [dRes, aRes] = await Promise.all([
        employeeService.getEmployees({ status: 'Deactivated', pageSize: 100 }),
        employeeService.getEmployees({ status: 'Archived', pageSize: 100 }),
      ])
      setDeactivatedList(dRes.data)
      setArchivedList(aRes.data)
    } finally {
      setLoadingExtras(false)
    }
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    setExporting(format)
    try {
      const res = await employeeService.getEmployees({
        q: filters.q || undefined,
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
        { key: 'designation', label: 'Designation' },
        { key: 'employmentType', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'joinedAt', label: 'Joined At' },
      ]

      if (format === 'csv') {
        exportToCSV(res.data, filename, headers)
      } else {
        exportToExcel(res.data, filename, headers)
      }
    } finally {
      setExporting(null)
    }
  }



  useEffect(() => {
    setFilters({ q: dq })
  }, [dq, setFilters])

  useEffect(() => {
    fetchExtras()
  }, [employees]) // Refresh extras when main list changes (e.g. after a status update)

  const commonColumns: Column<Employee>[] = [
    {
      key: 'firstName',
      header: 'Employee',
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
      render: (e) => <span className="font-mono text-xs font-medium text-primary">{e.employeeId}</span>,
    },
    { key: 'designation', header: 'Designation' },
    { key: 'department', header: 'Dept' },
    { key: 'employmentType', header: 'Type' },
    {
      key: 'joinedAt',
      header: 'Joined',
      render: (e) => <span className="text-muted">{formatDate(e.joinedAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (
        <Badge
          variant={
            e.status === 'Active' ? 'success' : 
            e.status === 'Deactivated' ? 'danger' : 
            e.status === 'Archived' ? 'neutral' : 'neutral'
          }
        >
          {e.status}
        </Badge>
      ),
    },
  ]

  const columns: Column<Employee>[] = [
    ...commonColumns,
    {
      key: 'id',
      header: 'VIEW',
      render: (e) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/employees/${e.id}`}>View</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/employees/${e.id}/edit`}>Edit</Link>
          </Button>
        </div>
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
                onClick={() => setStatusTarget({ e, status: 'Deactivated' })}
                title="Deactivate"
              >
                <UserMinus className="h-4 w-4 text-warning" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusTarget({ e, status: 'Archived' })}
                title="Archive"
              >
                <Archive className="h-4 w-4 text-muted" />
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
        subtitle="Manage your workforce status and directory."
        breadcrumb={<Breadcrumb items={[{ label: 'Employees', to: '/admin/employees' }]} />}
        actions={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => handleExport('csv')} loading={exporting === 'csv'}>
              <Download className="h-4 w-4" />
              CSV
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
        }

      />


      <FilterBar>
        <div className="grid w-full gap-3 md:grid-cols-4">
          <Input
            label="Search"
            placeholder="Name, email, ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Input
            label="Department"
            placeholder="Type department"
            value={filters.department === 'all' ? '' : filters.department}
            onChange={(e) => setFilters({ department: e.target.value || 'all' })}
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
              { value: 'all', label: 'All Active' },
              { value: 'Active', label: 'Active' },
              { value: 'On Leave', label: 'On Leave' },
              { value: 'Probation', label: 'Probation' },
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
          <DataTable columns={columns} data={employees} loading={loading} />
          <PaginationBar
            className="mt-4"
            total={pagination.total}
            page={pagination.page}
            pageSize={pagination.pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>

        {(deactivatedList.length > 0 || loadingExtras) && (
          <section className="rounded-2xl border border-border bg-surface/50 p-6">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-warning">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="font-display text-lg font-semibold">Deactivated Employees</h3>
              </div>
              <p className="text-sm text-muted">Accounts that are currently disabled and cannot access the system.</p>
            </div>
            <DataTable columns={columns} data={deactivatedList} loading={loadingExtras} />
          </section>
        )}

        {(archivedList.length > 0 || loadingExtras) && (
          <section className="rounded-2xl border border-border bg-surface/30 p-6">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-muted">
                <Archive className="h-5 w-5" />
                <h3 className="font-display text-lg font-semibold">Archived Records</h3>
              </div>
              <p className="text-sm text-muted">Historical employee records preserved for compliance and reference.</p>
            </div>
            <DataTable columns={columns} data={archivedList} loading={loadingExtras} />
          </section>
        )}
      </div>

      <ConfirmModal
        isOpen={!!statusTarget}
        title={`${statusTarget?.status} Employee`}
        description={
          statusTarget
            ? `Are you sure you want to set ${statusTarget.e.firstName} ${statusTarget.e.lastName} to ${statusTarget.status}?`
            : 'Are you sure you want to change this employee\'s status?'
        }
        confirmLabel={statusTarget?.status || 'Confirm'}
        danger={statusTarget?.status === 'Deactivated'}
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

