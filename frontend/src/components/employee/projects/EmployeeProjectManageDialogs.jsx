import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/employee/ui/dialog'
import { cn } from '@pages/employee/lib/utils'
import { CELL_TYPE_LABELS } from '@pages/admin/Projects/projectWorkspaceUi'
import { calculateEstimatedHours, CELL_COMPLEXITY_OPTIONS, DEFAULT_BASE_HOURS, formatComplexityFactor } from '@/utils/effortEstimationUtils'
import { createMyProjectCell, createMyProjectLibrary, fetchMyEffortPrediction } from '@services/employeeProjectService'
import { useAuthStore } from '@store/authStore'

const CELL_TYPES = ['block', 'IO', 'ESD', 'TOP']

function emptyCellForm(libraryId, technologyNode) {
  return {
    libraryId,
    name: '',
    description: '',
    cellType: 'block',
    technologyNode,
    complexity: 'Medium',
    baseHours: DEFAULT_BASE_HOURS,
    estimatedEffort: 0,
    assignedEmployeeId: '',
    assignedEmployeeName: '',
    dependencyCellIds: [],
    views: { layout: '', symbol: '', schematic: '' },
  }
}

export function EmployeeCreateLibraryDialog({
  open,
  onOpenChange,
  projectId,
  isTeamLead = false,
  assigneeOptions = [],
  onCreated,
}) {
  const user = useAuthStore((s) => s.user)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('')
  const [assignedEmployeeName, setAssignedEmployeeName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setDescription('')
    if (isTeamLead) {
      setAssignedEmployeeId('')
      setAssignedEmployeeName('')
    } else if (user?.id) {
      setAssignedEmployeeId(user.id)
      setAssignedEmployeeName(user.name || 'Me')
    }
  }, [open, isTeamLead, user])

  const assignees = useMemo(() => {
    const map = new Map()
    for (const option of assigneeOptions) {
      if (option?.id) map.set(option.id, option)
    }
    if (user?.id && !map.has(user.id)) {
      map.set(user.id, { id: user.id, name: user.name || 'Me' })
    }
    return [...map.values()]
  }, [assigneeOptions, user])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await createMyProjectLibrary(projectId, {
        name: name.trim(),
        description: description.trim(),
        ...(isTeamLead && assignedEmployeeId
          ? { assignedEmployeeId, assignedEmployeeName }
          : {}),
      })
      onOpenChange(false)
      onCreated?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New library</DialogTitle>
          <DialogDescription>Add a library to organize cells in this project.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="text-sm font-medium">
            Library name
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Description
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {isTeamLead ? (
            <label className="text-sm font-medium">
              Assign employee
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={assignedEmployeeId || ''}
                onChange={(e) => {
                  const emp = assignees.find((x) => x.id === e.target.value)
                  setAssignedEmployeeId(e.target.value)
                  setAssignedEmployeeName(emp?.name || '')
                }}
              >
                <option value="">Unassigned</option>
                {assignees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-slate-500">This library will be assigned to you.</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="admin-projects-employee-reviews-link"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="admin-projects-workflow-review-request-btn"
              disabled={saving || !name.trim()}
              onClick={() => void handleCreate()}
            >
              {saving ? 'Creating…' : 'Create library'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function EmployeeCreateCellDialog({
  open,
  onOpenChange,
  projectId,
  libraries = [],
  libraryCellCounts,
  technologyNode = '',
  assigneeOptions = [],
  isTeamLead = false,
  defaultLibraryId = null,
  onCreated,
}) {
  const user = useAuthStore((s) => s.user)
  const [cellForm, setCellForm] = useState(null)
  const [effortPreview, setEffortPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const libraryId = defaultLibraryId || libraries[0]?.id || ''
    const form = emptyCellForm(libraryId, technologyNode)
    setCellForm(form)
  }, [open, defaultLibraryId, libraries, technologyNode, isTeamLead, user])

  useEffect(() => {
    if (!open || !cellForm || !projectId) return
    const load = async () => {
      try {
        const data = await fetchMyEffortPrediction(projectId, {
          cellType: cellForm.cellType,
          technologyNode: cellForm.technologyNode,
          complexity: cellForm.complexity,
          baseHours: cellForm.baseHours ?? 0,
        })
        setEffortPreview(data)
      } catch {
        setEffortPreview(null)
      }
    }
    void load()
  }, [open, cellForm, projectId])

  const assignees = useMemo(() => {
    const map = new Map()
    for (const option of assigneeOptions) {
      if (option?.id) map.set(option.id, option)
    }
    if (user?.id && !map.has(user.id)) {
      map.set(user.id, { id: user.id, name: user.name || 'Me' })
    }
    return [...map.values()]
  }, [assigneeOptions, user])

  const handleCreate = async () => {
    if (!cellForm?.libraryId || !cellForm.name?.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...cellForm,
        name: cellForm.name.trim(),
      }
      if (!isTeamLead) {
        delete payload.assignedEmployeeId
        delete payload.assignedEmployeeName
      }
      await createMyProjectCell(projectId, cellForm.libraryId, payload)
      onOpenChange(false)
      onCreated?.()
    } finally {
      setSaving(false)
    }
  }

  if (!cellForm) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New cell</DialogTitle>
          <DialogDescription>Create a cell in the selected library.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <p className="admin-projects-field-label">Target library</p>
            <div className="admin-projects-library-pick">
              <div className="admin-projects-libraries-list">
                {libraries.map((lib) => (
                  <button
                    key={lib.id}
                    type="button"
                    onClick={() => setCellForm((f) => ({ ...f, libraryId: lib.id }))}
                    className={cn(
                      'admin-projects-library-nav',
                      cellForm.libraryId === lib.id && 'is-active',
                    )}
                  >
                    <span className="admin-projects-library-nav-label">{lib.name}</span>
                    <span className="admin-projects-library-badge">{libraryCellCounts?.get?.(lib.id) ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="text-sm font-medium">
            Cell name
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={cellForm.name}
              onChange={(e) => setCellForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium">
            Cell type
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={cellForm.cellType}
              onChange={(e) => setCellForm((f) => ({ ...f, cellType: e.target.value }))}
            >
              {CELL_TYPES.map((type) => (
                <option key={type} value={type}>{CELL_TYPE_LABELS[type] ?? type}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Description
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={cellForm.description}
              onChange={(e) => setCellForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium">
            Complexity
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={cellForm.complexity}
              onChange={(e) => setCellForm((f) => ({ ...f, complexity: e.target.value }))}
            >
              {CELL_COMPLEXITY_OPTIONS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Base hours (1 day = {DEFAULT_BASE_HOURS}h)
            <input
              type="number"
              min={0}
              step="any"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={String(cellForm.baseHours ?? 0)}
              onChange={(e) => setCellForm((f) => ({ ...f, baseHours: Number(e.target.value) }))}
            />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
            <p className="font-semibold text-slate-700">Effort estimate preview</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Complexity factor</dt>
                <dd>{formatComplexityFactor(cellForm.complexity)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Estimated hours</dt>
                <dd>{effortPreview?.estimatedHours ?? calculateEstimatedHours(cellForm.baseHours ?? 0, cellForm.complexity)}h</dd>
              </div>
            </dl>
          </div>
          {isTeamLead ? (
            <label className="text-sm font-medium">
              Assign employee
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={cellForm.assignedEmployeeId || ''}
                onChange={(e) => {
                  const emp = assignees.find((x) => x.id === e.target.value)
                  setCellForm((f) => ({
                    ...f,
                    assignedEmployeeId: e.target.value,
                    assignedEmployeeName: emp?.name || '',
                  }))
                }}
              >
                <option value="">Unassigned</option>
                {assignees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-slate-500">
              This cell will remain unassigned until your team lead assigns it to an engineer.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="admin-projects-employee-reviews-link" onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="admin-projects-workflow-review-request-btn"
              disabled={saving || !cellForm.name?.trim() || !cellForm.libraryId}
              onClick={() => void handleCreate()}
            >
              {saving ? 'Creating…' : 'Create cell'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
