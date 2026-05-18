import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
import { formatDate } from '@/utils/formatDate'
import { stringToHueColor } from '@/utils/stringColor'

export function EmployeeList() {
  const {
    employees,
    loading,
    filters,
    setFilters,
    pagination,
    setPage,
    setPageSize,
    deleteEmployee,
  } = useEmployees()
  const [q, setQ] = useState(filters.q)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const dq = useDebounce(q, 300)
  useEffect(() => {
    setFilters({ q: dq })
  }, [dq, setFilters])

  const columns: Column<Employee>[] = [
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
    { key: 'department', header: 'Department' },
    { key: 'designation', header: 'Designation' },
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
            e.status === 'Active'
              ? 'success'
              : e.status === 'On Leave'
                ? 'warning'
                : e.status === 'Probation'
                  ? 'info'
                  : 'neutral'
          }
        >
          {e.status}
        </Badge>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (e) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/dashboard/employees/${e.id}`}>View</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/dashboard/employees/${e.id}/edit`}>Edit</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(e)}
            aria-label={`Delete ${e.firstName} ${e.lastName}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageWrapper>
      <PageHeader
        title="Employees"
        subtitle="Directory, filters, and quick actions."
        breadcrumb={<Breadcrumb items={[{ label: 'Employees', to: '/dashboard/employees' }]} />}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} asChild>
            <Link to="/dashboard/employees/add">Add Employee</Link>
          </Button>
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
          <SelectField
            label="Department"
            value={filters.department}
            onChange={(e) => setFilters({ department: e.target.value })}
            options={[
              { value: 'all', label: 'All departments' },
              { value: 'Engineering', label: 'Engineering' },
              { value: 'People', label: 'People' },
              { value: 'Finance', label: 'Finance' },
              { value: 'Operations', label: 'Operations' },
              { value: 'Sales', label: 'Sales' },
              { value: 'Marketing', label: 'Marketing' },
            ]}
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
              { value: 'Active', label: 'Active' },
              { value: 'On Leave', label: 'On Leave' },
              { value: 'Probation', label: 'Probation' },
              { value: 'Inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </FilterBar>

      <DataTable columns={columns} data={employees} loading={loading} />

      <PaginationBar
        className="mt-4"
        total={pagination.total}
        page={pagination.page}
        pageSize={pagination.pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete employee"
        description={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.firstName} ${deleteTarget.lastName}? This action cannot be undone.`
            : 'Are you sure you want to delete this employee? This action cannot be undone.'
        }
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteEmployee(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </PageWrapper>
  )
}
