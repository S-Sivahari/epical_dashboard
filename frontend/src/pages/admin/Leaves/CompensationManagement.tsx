import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useEmployees } from '@hooks/useEmployees'
import { Search, Trash2, Edit2, ChevronDown, Plus } from 'lucide-react'
import {
  listCompensation,
  createCompensation,
  updateCompensation,
  deleteCompensation,
  type CompensationEntry,
} from '@services/compensationService'

export function CompensationManagement({
  onExportDataChange,
  onSearchChange,
}: {
  onExportDataChange?: (rows: Array<{
    employeeName: string
    employeeId: string
    compensationDays: number
    reason: string
    appliedDate: string
    createdBy: string
  }>) => void
  onSearchChange?: (term: string) => void
} = {}) {
  const { employees } = useEmployees()
  const POLL_MS = 30000

  // ── State ──────────────────────────────────────────────────────────────────
  const [compensationData, setCompensationData] = useState<CompensationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Form (always visible, no toggle button)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [days, setDays] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Employee multi-select dropdown
  const [empDropOpen, setEmpDropOpen] = useState(false)
  const [empSearch, setEmpSearch] = useState('')
  const empDropRef = useRef<HTMLDivElement>(null)

  // Delete confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<CompensationEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    void loadData()
    const interval = setInterval(() => {
      void loadData(true)
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [])

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await listCompensation()
      setCompensationData(data)
    } catch {
      if (!silent) toast.error('Failed to load compensation entries')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (empDropRef.current && !empDropRef.current.contains(e.target as Node)) {
        setEmpDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Export callback ────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    return compensationData.filter(
      (item) =>
        item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employeeId.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [compensationData, searchTerm])

  useEffect(() => {
    onExportDataChange?.(
      filteredData.map((item) => ({
        employeeName: item.employeeName,
        employeeId: item.employeeId,
        compensationDays: item.days,
        reason: item.reason,
        appliedDate: new Date(item.appliedDate).toLocaleDateString(),
        createdBy: item.createdBy,
      })),
    )
  }, [filteredData, onExportDataChange])

  useEffect(() => {
    onSearchChange?.(searchTerm)
  }, [searchTerm, onSearchChange])

  // ── Employee multi-select helpers ──────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    const q = empSearch.toLowerCase()
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName ?? ''}`.toLowerCase().includes(q) ||
        String(e.employeeId || e.id || '').toLowerCase().includes(q),
    )
  }, [employees, empSearch])

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    )
  }

  const resetForm = () => {
    setEditingId(null)
    setSelectedEmployees([])
    setDays('')
    setReason('')
    setEmpDropOpen(false)
    setEmpSearch('')
  }

  // ── Validate days is a multiple of 0.5 ────────────────────────────────────
  const validateDays = (val: string): boolean => {
    const d = parseFloat(val)
    if (isNaN(d) || d <= 0) {
      toast.error('Days must be a positive number')
      return false
    }
    if (d % 0.5 !== 0) {
      toast.error('Compensation days must be in multiples of 0.5')
      return false
    }
    return true
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateDays(days)) return
    if (!reason.trim()) {
      toast.error('Please provide a reason')
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        const updated = await updateCompensation(editingId, {
          days: parseFloat(days),
          reason,
        })
        setCompensationData((prev) =>
          prev.map((item) => (item.id === editingId ? updated : item)),
        )
        toast.success('Compensation entry updated')
        resetForm()
      } else {
        if (selectedEmployees.length === 0) {
          toast.error('Select at least one employee')
          setSubmitting(false)
          return
        }
        const entries = selectedEmployees.map((empId) => {
          const emp = employees.find((e) => e.id === empId)!
          return {
            employeeId: String(emp.employeeId || emp.id),
            employeeName: `${emp.firstName} ${emp.lastName ?? ''}`.trim(),
            days: parseFloat(days),
            reason,
          }
        })
        const created = await createCompensation(entries)
        setCompensationData((prev) => [...created, ...prev])
        toast.success(
          `Compensation added for ${created.length} employee${created.length > 1 ? 's' : ''}`,
        )
        resetForm()
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save compensation')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (entry: CompensationEntry) => {
    const emp = employees.find(
      (e) => String(e.employeeId || e.id) === String(entry.employeeId),
    )
    setEditingId(entry.id)
    setSelectedEmployees(emp ? [emp.id] : [])
    setDays(String(entry.days))
    setReason(entry.reason)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const openDeleteConfirm = (entry: CompensationEntry) => {
    setEntryToDelete(entry)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return
    setDeleting(true)
    try {
      const res = await deleteCompensation(entryToDelete.id)
      if (res && res.skipped) {
        toast.warning(res.message || 'Deletion skipped because the employee has already used this earned leave.')
      } else {
        setCompensationData((prev) => prev.filter((item) => item.id !== entryToDelete.id))
        toast.success('Compensation entry deleted')
      }
      setDeleteConfirmOpen(false)
      setEntryToDelete(null)
    } catch {
      toast.error('Failed to delete compensation entry')
    } finally {
      setDeleting(false)
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns: Column<CompensationEntry>[] = [
    {
      key: 'employeeName',
      header: 'Employee',
      render: (item) => (
        <div>
          <span className="font-medium text-ink block">{item.employeeName}</span>
          <span className="text-xs text-muted">{item.employeeId}</span>
        </div>
      ),
    },
    {
      key: 'days',
      header: 'Days',
      render: (item) => (
        <Badge variant="info" className="font-semibold">
          {item.days} {item.days === 1 ? 'day' : 'days'}
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
      header: 'Date',
      render: (item) => (
        <span className="text-sm text-muted">
          {new Date(item.appliedDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
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
          <Button size="sm" variant="secondary" onClick={() => handleEdit(item)} title="Edit">
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => openDeleteConfirm(item)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Add / Edit Form (always visible) ──────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-ink mb-4">
          {editingId ? 'Edit Compensation Entry' : 'Add Compensation'}
        </h3>
        <div className="grid gap-6 lg:grid-cols-2 items-start bg-gray-50 p-4 rounded-lg">
          <div className="space-y-4 min-w-0">
          {/* Employee multi-select */}
          {!editingId && (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">
                Select Employees <span className="text-red-500">*</span>
              </label>
              <div ref={empDropRef} className="relative">
                <button
                  type="button"
                  onClick={() => setEmpDropOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <span className={selectedEmployees.length === 0 ? 'text-muted' : 'text-ink'}>
                    {selectedEmployees.length === 0
                      ? 'Choose employees...'
                      : `${selectedEmployees.length} employee${selectedEmployees.length > 1 ? 's' : ''} selected`}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted" />
                </button>

                {empDropOpen && (
                  <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-white shadow-lg max-h-64 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                        <input
                          autoFocus
                          placeholder="Search employees..."
                          value={empSearch}
                          onChange={(e) => setEmpSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 px-2 py-1.5 border-b border-border">
                      <button
                        type="button"
                        className="text-xs text-primary font-medium hover:underline"
                        onClick={() =>
                          setSelectedEmployees(filteredEmployees.map((e) => e.id))
                        }
                      >
                        Select All
                      </button>
                      <span className="text-muted">·</span>
                      <button
                        type="button"
                        className="text-xs text-muted hover:underline"
                        onClick={() => setSelectedEmployees([])}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {filteredEmployees.length === 0 ? (
                        <p className="text-center text-sm text-muted py-4">No employees found</p>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <label
                            key={emp.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-surface cursor-pointer text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedEmployees.includes(emp.id)}
                              onChange={() => toggleEmployee(emp.id)}
                              className="h-4 w-4 accent-primary rounded"
                            />
                            <span className="flex-1 text-ink">
                              {`${emp.firstName} ${emp.lastName ?? ''}`.trim()}
                            </span>
                            <span className="text-xs text-muted shrink-0">
                              {emp.employeeId || emp.id}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected chips */}
              {selectedEmployees.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedEmployees.map((empId) => {
                    const emp = employees.find((e) => e.id === empId)
                    if (!emp) return null
                    return (
                      <span
                        key={empId}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium"
                      >
                        {`${emp.firstName} ${emp.lastName ?? ''}`.trim()}
                        <button
                          type="button"
                          onClick={() => toggleEmployee(empId)}
                          className="ml-0.5 hover:text-primary/70"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* When editing, show employee name read-only */}
          {editingId && (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Employee</label>
              <div className="px-3 py-2 rounded-lg border border-border bg-gray-100 text-sm text-ink">
                {compensationData.find((e) => e.id === editingId)?.employeeName}
                <span className="text-muted ml-2">
                  ({compensationData.find((e) => e.id === editingId)?.employeeId})
                </span>
              </div>
            </div>
          )}

          </div>

          <div className="space-y-4 min-w-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">
                Compensation Days <span className="text-red-500">*</span>
                <span className="text-muted ml-1">(multiples of 0.5)</span>
              </label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g. 1, 1.5, 2"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">
                Reason <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Overtime — weekend deployment"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {editingId && (
              <Button variant="secondary" size="sm" onClick={resetForm} disabled={submitting}>
                Cancel Edit
              </Button>
            )}
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : editingId ? 'Update Entry' : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add {selectedEmployees.length > 1 ? `${selectedEmployees.length} Entries` : 'Entry'}
                </>
              )}
            </Button>
          </div>
          </div>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search by name or ID…"
            className="pl-9 h-9 text-sm"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              onSearchChange?.(e.target.value)
            }}
          />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          empty="No compensation entries. Add one above."
        />
      </div>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Compensation Entry"
        description={`Permanently delete the ${entryToDelete?.days}-day compensation record for ${entryToDelete?.employeeName}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
        onClose={() => {
          if (deleting) return
          setDeleteConfirmOpen(false)
          setEntryToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
