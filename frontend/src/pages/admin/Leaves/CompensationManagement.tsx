import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useEmployees } from '@hooks/useEmployees'
import { Search, Trash2, Edit2, ChevronDown, Plus, Check } from 'lucide-react'
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

  // Form
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
      }
      setDeleteConfirmOpen(false)
      setEntryToDelete(null)
    } catch {
      toast.error('Failed to delete compensation entry')
    } finally {
      setDeleting(false)
    }
  }

  // ── Analytics data ────────────────────────────────────────────────────────
  const totalDays = useMemo(() =>
    compensationData.reduce((sum, item) => sum + item.days, 0), [compensationData]
  )

  const avgDays = useMemo(() =>
    compensationData.length > 0 ? (totalDays / compensationData.length).toFixed(1) : 0,
    [totalDays, compensationData.length]
  )

  const topEmployees = useMemo(() => {
    const map: Record<string, number> = {}
    compensationData.forEach(item => {
      map[item.employeeName] = (map[item.employeeName] || 0) + item.days
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  }, [compensationData])

  const recentActivity = useMemo(() => {
    return [...compensationData]
      .sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime())
      .slice(0, 10)
  }, [compensationData])

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns: Column<CompensationEntry>[] = [
    {
      key: 'employeeName',
      header: 'Employee',
      render: (item) => (
        <div>
          <span className="font-medium text-gray-800 block">{item.employeeName}</span>
          <span className="text-xs text-gray-500">{item.employeeId}</span>
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
      render: (item) => <span className="text-sm text-gray-600">{item.reason}</span>,
    },
    {
      key: 'appliedDate',
      header: 'Date',
      render: (item) => (
        <span className="text-sm text-gray-600">
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
      render: (item) => <span className="text-xs text-gray-600">{item.createdBy}</span>,
    },
    {
      key: 'id',
      header: 'Actions',
      render: (item) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => handleEdit(item)} title="Edit" className="h-8 px-2">
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => openDeleteConfirm(item)}
            title="Delete"
            className="h-8 px-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[270px_1fr_290px]">
      {/* ════════════════════════════════════════════════════════
          LEFT COLUMN — Compensation Insights
      ════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        {/* Compensation Summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-800">Compensation Summary</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-emerald-50 to-white p-3">
              <p className="text-xs text-gray-500 font-medium uppercase mb-1">Total Days</p>
              <p className="text-2xl font-bold text-emerald-700">{totalDays}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-3">
              <p className="text-xs text-gray-500 font-medium uppercase mb-1">Entries</p>
              <p className="text-2xl font-bold text-blue-700">{compensationData.length}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-purple-50 to-white p-3 col-span-2">
              <p className="text-xs text-gray-500 font-medium uppercase mb-1">Average/Entry</p>
              <p className="text-xl font-bold text-purple-700">{avgDays} days</p>
            </div>
          </div>
        </div>

        {/* Top Recipients */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex-1">
          <h3 className="mb-3 text-sm font-bold text-gray-800">Top Recipients</h3>
          {topEmployees.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No compensation yet.</p>
          ) : (
            <div className="space-y-2.5">
              {topEmployees.map(([name, daysVal], idx) => (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                      {idx + 1}
                    </span>
                    <p className="text-xs font-semibold text-gray-800 truncate">{name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    {daysVal}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CENTER COLUMN — Add Form + Data Table
      ════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Add / Edit Form */}
        <div className="border-b border-gray-100 p-4 space-y-4 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-800">
            {editingId ? 'Edit Compensation Entry' : 'Add Compensation'}
          </h3>
          <div className="space-y-4">
            {/* Employee multi-select */}
            {!editingId && (
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Select Employees <span className="text-red-500">*</span>
                </label>
                <div ref={empDropRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setEmpDropOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <span className={selectedEmployees.length === 0 ? 'text-gray-500' : 'text-gray-800'}>
                      {selectedEmployees.length === 0
                        ? 'Choose employees...'
                        : `${selectedEmployees.length} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>

                  {empDropOpen && (
                    <div className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-64 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <input
                            autoFocus
                            placeholder="Search employees..."
                            value={empSearch}
                            onChange={(e) => setEmpSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 px-2 py-1.5 border-b border-gray-100 text-xs">
                        <button
                          type="button"
                          className="text-emerald-600 font-medium hover:underline"
                          onClick={() =>
                            setSelectedEmployees(filteredEmployees.map((e) => e.id))
                          }
                        >
                          Select All
                        </button>
                        <span className="text-gray-300">·</span>
                        <button
                          type="button"
                          className="text-gray-500 hover:underline"
                          onClick={() => setSelectedEmployees([])}
                        >
                          Clear
                        </button>
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {filteredEmployees.length === 0 ? (
                          <p className="text-center text-sm text-gray-400 py-4">No employees found</p>
                        ) : (
                          filteredEmployees.map((emp) => (
                            <label
                              key={emp.id}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={selectedEmployees.includes(emp.id)}
                                onChange={() => toggleEmployee(emp.id)}
                                className="h-4 w-4 accent-emerald-600 rounded"
                              />
                              <span className="flex-1 text-gray-800">
                                {`${emp.firstName} ${emp.lastName ?? ''}`.trim()}
                              </span>
                              <span className="text-xs text-gray-500 shrink-0">
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
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 font-medium"
                        >
                          {`${emp.firstName} ${emp.lastName ?? ''}`.trim()}
                          <button
                            type="button"
                            onClick={() => toggleEmployee(empId)}
                            className="ml-0.5 hover:text-emerald-600"
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
                <label className="mb-2 block text-xs font-medium text-gray-700">Employee</label>
                <div className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800">
                  {compensationData.find((e) => e.id === editingId)?.employeeName}
                  <span className="text-gray-500 ml-2">
                    ({compensationData.find((e) => e.id === editingId)?.employeeId})
                  </span>
                </div>
              </div>
            )}

            {/* Days & Reason fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Days <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="e.g. 1, 1.5"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Reason <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Overtime"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              {editingId && (
                <Button variant="secondary" size="sm" onClick={resetForm} disabled={submitting} className="h-9">
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={handleSubmit} disabled={submitting} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? 'Saving…' : editingId ? 'Update' : 'Add Entry'}
              </Button>
            </div>
          </div>
        </div>

        {/* Search & Table */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-white">
          <h3 className="text-sm font-bold text-gray-800">Compensation Entries</h3>
          <div className="relative w-40">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search..."
              className="pl-8 h-8 text-sm"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                onSearchChange?.(e.target.value)
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredData}
            loading={loading}
            empty="No compensation entries."
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          RIGHT COLUMN — Recent Activity
      ════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: '520px' }}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 shrink-0">
          <h3 className="text-sm font-bold text-gray-800">Recent Activity</h3>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8 text-xs text-gray-400">No activity yet.</div>
        ) : (
          <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5 px-3 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="mt-0.5 shrink-0">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                    <Check className="h-3 w-3 text-emerald-700" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-800 leading-snug">
                    <span className="text-emerald-700">{item.employeeName}</span>
                    {` added ${item.days}d compensation`}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{item.reason}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    {new Date(item.appliedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                    onClick={() => handleEdit(item)}
                  >
                    <Edit2 className="h-2.5 w-2.5" /> Edit
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"
                    onClick={() => openDeleteConfirm(item)}
                  >
                    <Trash2 className="h-2.5 w-2.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
