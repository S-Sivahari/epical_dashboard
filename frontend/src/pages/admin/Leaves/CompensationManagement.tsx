import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useEmployees } from '@hooks/useEmployees'
import { Search, Plus, Trash2, Edit2 } from 'lucide-react'

interface CompensationEntry {
  id: string
  employeeId: string
  employeeName: string
  days: number
  reason: string
  appliedDate: string
  createdBy: string
}

export function CompensationManagement() {
  const { employees } = useEmployees()
  const [compensationData, setCompensationData] = useState<CompensationEntry[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    employeeId: '',
    days: '',
    reason: '',
  })

  // Filter compensation data by search term
  const filteredData = useMemo(() => {
    return compensationData.filter(
      (item) =>
        item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [compensationData, searchTerm])

  const handleAddEntry = () => {
    if (!formData.employeeId || !formData.days || !formData.reason) {
      toast.error('Please fill all fields')
      return
    }

    const selectedEmployee = employees.find((e) => e.id === formData.employeeId)
    if (!selectedEmployee) {
      toast.error('Invalid employee selected')
      return
    }

    if (editingId) {
      // Edit existing entry
      setCompensationData(
        compensationData.map((item) =>
          item.id === editingId
            ? {
                ...item,
                employeeId: formData.employeeId,
                employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName ?? ''}`.trim(),
                days: parseInt(formData.days),
                reason: formData.reason,
              }
            : item
        )
      )
      toast.success('Compensation entry updated')
      setEditingId(null)
    } else {
      // Add new entry
      const newEntry: CompensationEntry = {
        id: `comp-${Date.now()}`,
        employeeId: formData.employeeId,
        employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName ?? ''}`.trim(),
        days: parseInt(formData.days),
        reason: formData.reason,
        appliedDate: new Date().toISOString(),
        createdBy: 'Admin',
      }
      setCompensationData([newEntry, ...compensationData])
      toast.success('Compensation entry added')
    }

    setFormData({ employeeId: '', days: '', reason: '' })
    setIsFormOpen(false)
  }

  const handleEditEntry = (entry: CompensationEntry) => {
    setFormData({
      employeeId: entry.employeeId,
      days: entry.days.toString(),
      reason: entry.reason,
    })
    setEditingId(entry.id)
    setIsFormOpen(true)
  }

  const handleDeleteEntry = (id: string) => {
    setCompensationData(compensationData.filter((item) => item.id !== id))
    toast.success('Compensation entry deleted')
  }

  const columns: Column<CompensationEntry>[] = [
    {
      key: 'employeeName',
      header: 'Employee Name',
      render: (item) => <span className="font-medium">{item.employeeName}</span>,
    },
    {
      key: 'employeeId',
      header: 'Employee ID',
      render: (item) => <span className="text-muted text-sm">{item.employeeId}</span>,
    },
    {
      key: 'days',
      header: 'Compensation Days',
      render: (item) => (
        <Badge variant="info" className="font-semibold">
          {item.days} days
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (item) => <span className="text-sm text-muted">{item.reason}</span>,
    },
    {
      key: 'appliedDate',
      header: 'Applied Date',
      render: (item) => new Date(item.appliedDate).toLocaleDateString(),
    },
    {
      key: 'createdBy',
      header: 'Created By',
      render: (item) => <span className="text-xs text-muted">{item.createdBy}</span>,
    },
    {
      key: 'id',
      header: 'Actions',
      render: (item) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleEditEntry(item)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDeleteEntry(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
        <h3 className="font-semibold text-blue-900 text-sm">Compensation Leave Management</h3>
        <p className="text-xs text-blue-800 mt-2">
          Grant additional leave days to employees as compensation. These entries help track make-up time and additional benefits.
        </p>
      </div>

      {/* Add New Entry Section */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-ink">
            {isFormOpen ? (editingId ? 'Edit Compensation' : 'Add New Compensation') : 'Add Compensation Entry'}
          </h3>
          {!isFormOpen && (
            <Button
              size="sm"
              onClick={() => {
                setIsFormOpen(true)
                setEditingId(null)
                setFormData({ employeeId: '', days: '', reason: '' })
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          )}
        </div>

        {isFormOpen && (
          <div className="space-y-4 bg-gray-50 p-4 rounded-lg mb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink">Select Employee</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Choose an employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName ?? ''} ({emp.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink">Compensation Days</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Enter number of days"
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Reason</label>
              <textarea
                placeholder="Reason for compensation (e.g., Overtime work, Weekend assignment, etc.)"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsFormOpen(false)
                  setEditingId(null)
                  setFormData({ employeeId: '', days: '', reason: '' })
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddEntry}>
                {editingId ? 'Update' : 'Add'} Entry
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filter */}
      {compensationData.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <label className="mb-1 block text-xs font-medium text-muted">Search by Employee Name or ID</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search..."
              className="pl-9 h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Compensation Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={false}
          empty="No compensation entries yet. Add one to get started."
        />
      </div>

      {/* Summary Stats */}
      {compensationData.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-muted mb-1">Total Entries</p>
            <p className="text-2xl font-bold text-ink">{compensationData.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-muted mb-1">Total Days Allotted</p>
            <p className="text-2xl font-bold text-primary">
              {compensationData.reduce((sum, item) => sum + item.days, 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-muted mb-1">This Month</p>
            <p className="text-2xl font-bold text-ink">
              {compensationData.filter(
                (item) => new Date(item.appliedDate).getMonth() === new Date().getMonth()
              ).length}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
