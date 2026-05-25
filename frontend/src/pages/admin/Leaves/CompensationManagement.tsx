import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useEmployees } from '@hooks/useEmployees'
import { Search, Trash2, Edit2, XCircle, ChevronDown, History, Plus } from 'lucide-react'
import {
  listCompensation,
  createCompensation,
  updateCompensation,
  cancelCompensation,
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
    status: string
  }>) => void
  onSearchChange?: (term: string) => void
} = {}) {
  const { employees } = useEmployees()

  // ── State ──────────────────────────────────────────────────────────────────
  const [compensationData, setCompensationData] = useState<CompensationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [view, setView] = useState<'active' | 'history'>('active')

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

  // Cancel modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [entryToCancel, setEntryToCancel] = useState<CompensationEntry | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Delete confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<CompensationEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await listCompensation()
      setCompensationData(data)
    } catch {
      toast.error('Failed to load compensation entries')
    } finally {
      setLoading(false)
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
    const source = view === 'active'
      ? compensationData.filter((e) => e.status === 'Active')
      : compensationData.filter((e) => e.status === 'Cancelled')
    return source.filter(
      (item) =>
        item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employeeId.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [compensationData, searchTerm, view])

  useEffect(() => {
    onExportDataChange?.(
      filteredData.map((item) => ({
        employeeName: item.employeeName,
        employeeId: item.employeeId,
        compensationDays: item.days,
        reason: item.reason,
        appliedDate: new Date(item.appliedDate).toLocaleDateString(),
        createdBy: item.createdBy,
        status: item.status,
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
    setView('active')
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const openCancelModal = (entry: CompensationEntry) => {
    setEntryToCancel(entry)
    setCancelReason('')
    setCancelModalOpen(true)
  }

  const handleConfirmCancel = async () => {
    if (!entryToCancel) return
    setCancelling(true)
    try {
      const updated = await cancelCompensation(entryToCancel.id, cancelReason)
      setCompensationData((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      )
      toast.success(`Compensation for ${entryToCancel.employeeName} cancelled`)
      setCancelModalOpen(false)
      setEntryToCancel(null)
      setCancelReason('')
    } catch {
      toast.error('Failed to cancel compensation')
    } finally {
      setCancelling(false)
    }
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
      await deleteCompensation(entryToDelete.id)
      setCompensationData((prev) => prev.filter((item) => item.id !== entryToDelete.id))
      toast.success('Compensation entry deleted')
      setDeleteConfirmOpen(false)
      setEntryToDelete(null)
    } catch {
      toast.error('Failed to delete compensation entry')
    } finally {
      setDeleting(false)
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────────
  const activeColumns: Column<CompensationEntry>[] = [
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
            variant="warning"
            onClick={() => openCancelModal(item)}
            title="Cancel compensation"
          >
            <XCircle className="h-3.5 w-3.5" />
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

  const historyColumns: Column<CompensationEntry>[] = [
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
        <Badge variant="neutral" className="font-semibold line-through opacity-60">
          {item.days} {item.days === 1 ? 'day' : 'days'}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: 'Original Reason',
      render: (item) => <span className="text-sm text-muted">{item.reason}</span>,
    },
    {
      key: 'cancelReason',
      header: 'Cancellation Reason',
      render: (item) => (
        <span className="text-sm text-muted">{item.cancelReason || '—'}</span>
      ),
    },
    {
      key: 'cancelledAt',
      header: 'Cancelled On',
      render: (item) =>
        item.cancelledAt ? (
          <span className="text-sm text-muted">
            {new Date(item.cancelledAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'cancelledBy',
      header: 'Cancelled By',
      render: (item) => <span className="text-xs text-muted">{item.cancelledBy || '—'}</span>,
    },
    {
      key: 'id',
      header: 'Actions',
      render: (item) => (
        <Button
          size="sm"
          variant="danger"
          onClick={() => openDeleteConfirm(item)}
          title="Delete record"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  const activeEntries = compensationData.filter((e) => e.status === 'Active')
  const cancelledEntries = compensationData.filter((e) => e.status === 'Cancelled')

  return (
    <div className="space-y-6">
      {/* ── Add / Edit Form (always visible) ──────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-ink mb-4">
          {editingId ? 'Edit Compensation Entry' : 'Add Compensation'}
        </h3>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
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

      {/* ── View toggle + Search ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* View tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-surface/60 p-1 w-fit">
          <button
            onClick={() => setView('active')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              view === 'active'
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Active
            {activeEntries.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {activeEntries.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('history')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              view === 'history'
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            History
            {cancelledEntries.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted/20 text-muted text-[10px] font-bold">
                {cancelledEntries.length}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative w-64">
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
          columns={view === 'active' ? activeColumns : historyColumns}
          data={filteredData}
          loading={loading}
          empty={
            view === 'active'
              ? 'No active compensation entries. Add one above.'
              : 'No cancelled compensation entries.'
          }
        />
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      {compensationData.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-muted mb-1">Active Entries</p>
            <p className="text-2xl font-bold text-ink">{activeEntries.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-muted mb-1">Total Days (Active)</p>
            <p className="text-2xl font-bold text-primary">
              {activeEntries.reduce((sum, item) => sum + item.days, 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-muted mb-1">Added This Month</p>
            <p className="text-2xl font-bold text-ink">
              {activeEntries.filter(
                (item) =>
                  new Date(item.appliedDate).getMonth() === new Date().getMonth() &&
                  new Date(item.appliedDate).getFullYear() === new Date().getFullYear(),
              ).length}
            </p>
          </div>
        </div>
      )}

      {/* ── Cancel Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={cancelModalOpen}
        title="Cancel Compensation"
        onClose={() => {
          setCancelModalOpen(false)
          setEntryToCancel(null)
          setCancelReason('')
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            You are cancelling the <strong>{entryToCancel?.days}-day</strong> compensation for{' '}
            <strong className="text-ink">{entryToCancel?.employeeName}</strong>. The entry will be
            moved to history and will not count towards their leave balance.
          </p>
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Reason for Cancellation (Optional)
            </label>
            <textarea
              placeholder="e.g. Employee did not work the overtime..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCancelModalOpen(false)
                setEntryToCancel(null)
                setCancelReason('')
              }}
              disabled={cancelling}
            >
              Keep Entry
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling…' : 'Cancel Compensation'}
            </Button>
          </div>
        </div>
      </Modal>

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
