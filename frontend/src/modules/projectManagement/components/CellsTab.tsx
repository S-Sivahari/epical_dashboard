import { useEffect, useState, useCallback } from 'react'
import api from '@/services/api'
import { Spinner } from '@components/ui/Spinner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { toast } from 'sonner'
import { useAuthStore } from '@store/authStore'
import {
  Layers,
  Plus,
  Archive,
  UserPlus,
  Sliders,
  History
} from 'lucide-react'

interface Project {
  _id: string
  id: string
  projectName?: string
  name: string
}

interface Library {
  _id: string
  name: string
  isArchived: boolean
}

interface Cell {
  _id: string
  name: string
  viewType: 'Schematic' | 'Symbol' | 'Layout'
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP'
  progress: number
  status: 'Not Started' | 'In Progress' | 'Submitted For Review' | 'Completed' | 'Rejected'
  isArchived: boolean
  assignedEmployee?: string
  view?: View | null
  views?: View[]
}

interface View {
  _id: string
  cellId: string
  viewType: 'Schematic' | 'Symbol' | 'Layout'
  status: 'In Progress' | 'Submitted For Review' | 'Completed' | 'Rejected'
  currentStage: string
  completedStages: string[]
  checkpointStatus: {
    checkpoint1: 'None' | 'Pending' | 'Approved' | 'Rejected'
    checkpoint2: 'None' | 'Pending' | 'Approved' | 'Rejected'
  }
  reviewStatus: string
  progress: number
}

interface Assignment {
  _id: string
  viewId: string
  employeeId: string
  isArchived: boolean
}

interface Employee {
  id: string
  employeeId?: string
  firstName: string
  lastName?: string
  email: string
}

interface AuditLog {
  _id: string
  user: string
  action: string
  targetId: string
  targetType: string
  previousState: any
  newState: any
  timestamp: string
}

export function CellsTab() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const store = useAuthStore
    if (store) {
      setIsAdmin(store.getState().role === 'admin')
      return store.subscribe(state => {
        setIsAdmin(state.role === 'admin')
      })
    }
  }, [])

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [libraries, setLibraries] = useState<Library[]>([])
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('')
  
  const [cells, setCells] = useState<Cell[]>([])
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingLibs, setLoadingLibs] = useState(false)
  const [loadingCells, setLoadingCells] = useState(false)

  // Modals state
  const [createCellOpen, setCreateCellOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)

  // Modal active targets
  const [activeView, setActiveView] = useState<View | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Fields
  const [cellName, setCellName] = useState('')
  const [viewType, setViewType] = useState<'Schematic' | 'Symbol' | 'Layout'>('Layout')
  const [checklistType, setChecklistType] = useState<'Block' | 'IO' | 'ESD' | 'TOP'>('Block')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

  // Override form states
  const [overrideStatus, setOverrideStatus] = useState<string>('In Progress')
  const [overrideStage, setOverrideStage] = useState<string>('Design')
  const [overrideCP1, setOverrideCP1] = useState<string>('None')
  const [overrideCP2, setOverrideCP2] = useState<string>('None')

  // Fetch projects & employees
  useEffect(() => {
    Promise.all([
      api.get('/projects'),
      api.get('/employees')
    ]).then(([projRes, empRes]) => {
      const projList = Array.isArray(projRes.data) ? projRes.data : (projRes.data?.data || [])
      const empList = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.data || [])
      setProjects(projList)
      setEmployees(empList)
      if (projList.length > 0) {
        setSelectedProjectId(projList[0].id)
      }
    }).catch(() => toast.error('Failed to load initial workspace data'))
      .finally(() => setLoadingProjects(false))
  }, [])

  // Fetch libraries on project selection
  useEffect(() => {
    if (!selectedProjectId) {
      setLibraries([])
      setSelectedLibraryId('')
      return
    }
    setLoadingLibs(true)
    api.get(`/project-management/libraries?projectId=${selectedProjectId}&archived=false`)
      .then(res => {
        setLibraries(res.data)
        if (res.data.length > 0) {
          setSelectedLibraryId(res.data[0]._id)
        } else {
          setSelectedLibraryId('')
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLibs(false))
  }, [selectedProjectId])

  // Reset selected cell when library changes
  useEffect(() => {
    setSelectedCell(null)
  }, [selectedLibraryId])

  // Fetch cells
  const fetchCells = useCallback(async () => {
    if (!selectedLibraryId) {
      setCells([])
      setSelectedCell(null)
      setAssignments([])
      return
    }
    try {
      setLoadingCells(true)
      const res = await api.get(`/project-management/cells?libraryId=${selectedLibraryId}&archived=false`)
      setCells(res.data)
      setSelectedCell(prevSelected => {
        if (!prevSelected) return null
        const matched = res.data.find((c: Cell) => c._id === prevSelected._id)
        return matched || null
      })
    } catch {
      toast.error('Failed to load cells')
    } finally {
      setLoadingCells(false)
    }
  }, [selectedLibraryId])

  useEffect(() => {
    fetchCells()
  }, [fetchCells])

  // Fetch assignments for selected library/project
  const fetchAssignments = useCallback(async () => {
    if (!selectedLibraryId) return
    try {
      const res = await api.get(`/project-management/assignments?archived=false`)
      setAssignments(res.data)
    } catch {}
  }, [selectedLibraryId])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  // Handle Cell selection
  const handleCellSelect = (cell: Cell) => {
    setSelectedCell(cell)
  }

  // Handle Create Cell
  const handleCreateCell = async () => {
    if (!cellName.trim()) {
      toast.error('Cell Name is required')
      return
    }

    try {
      const res = await api.post('/project-management/cells', {
        libraryId: selectedLibraryId,
        name: cellName.trim(),
        viewType,
        checklistType,
      })
      toast.success(`Cell workspace (${viewType}) created successfully`)
      setCreateCellOpen(false)
      setCellName('')

      // Auto-select the newly created cell with its single view
      if (res.data && res.data.cell) {
        setSelectedCell({
          ...res.data.cell,
          view: res.data.view || null,
          views: res.data.views || [],
        })
      }

      fetchCells()
      fetchAssignments()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create cell')
    }
  }

  // Handle Archive Cell (Admin only)
  const handleArchiveCell = async (cellId: string) => {
    if (!isAdmin) return
    try {
      await api.post(`/project-management/cells/${cellId}/archive`)
      toast.success('Cell archived successfully')
      if (selectedCell?._id === cellId) {
        setSelectedCell(null)
      }
      fetchCells()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to archive cell')
    }
  }

  // Open Assignment modal (cell-based)
  const openAssignModal = (cell: Cell) => {
    // Find the cell's single view for backward compat display
    const v = cell.view || (cell.views && cell.views[0]) || null
    setActiveView(v)
    const existing = assignments.find(a => a.viewId === v?._id)
    setSelectedEmployeeId(existing ? existing.employeeId : '')
    setAssignOpen(true)
  }

  // Submit Assignment (cell-based)
  const handleAssignEmployee = async () => {
    if (!selectedCell || !selectedEmployeeId) {
      toast.error('Please select an employee')
      return
    }

    try {
      await api.post('/project-management/assignments', {
        cellId: selectedCell._id,
        employeeId: selectedEmployeeId,
      })
      toast.success('Employee assigned successfully')
      setAssignOpen(false)
      fetchAssignments()
      fetchCells()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to assign employee')
    }
  }

  // Archive Assignment (Unassign) - cell-based
  const handleArchiveAssignment = async (cellId: string) => {
    const cellView = cells.find(c => c._id === cellId)
    const viewId = cellView?.view?._id || (cellView?.views && cellView.views[0]?._id)
    const existing = viewId ? assignments.find(a => a.viewId === viewId) : null
    if (!existing) return

    try {
      await api.post(`/project-management/assignments/${existing._id}/archive`)
      toast.success('Assignment archived (employee unassigned)')
      fetchAssignments()
      fetchCells()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to archive assignment')
    }
  }

  // Open Override Modal
  const openOverrideModal = (view: View) => {
    setActiveView(view)
    setOverrideStatus(view.status)
    setOverrideStage(view.currentStage)
    setOverrideCP1(view.checkpointStatus.checkpoint1)
    setOverrideCP2(view.checkpointStatus.checkpoint2)
    setOverrideOpen(true)
  }

  // Submit Workflow Override (Admin only)
  const handleOverride = async () => {
    if (!activeView) return

    try {
      await api.post(`/project-management/views/${activeView._id}/override`, {
        status: overrideStatus,
        currentStage: overrideStage,
        checkpointStatus: {
          checkpoint1: overrideCP1,
          checkpoint2: overrideCP2
        }
      })
      toast.success('Workflow state overridden successfully')
      setOverrideOpen(false)
      fetchCells()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to override workflow')
    }
  }

  // Open Audit Modal
  const openAuditModal = async (viewId: string) => {
    try {
      setLoadingAudit(true)
      setAuditOpen(true)
      const res = await api.get(`/project-management/audit-logs?search=${viewId}`)
      setAuditLogs(res.data)
    } catch {
      toast.error('Failed to load audit logs')
    } finally {
      setLoadingAudit(false)
    }
  }

  const getEmployeeName = (empId: string) => {
    const emp = employees.find(e => e.id === empId || e.employeeId === empId)
    return emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : 'Unknown Employee'
  }

  if (loadingProjects) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
      {/* Sidebar: Projects/Libraries & Cells List */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-4">
          {/* Project Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider leading-none">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.projectName || p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Library Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider leading-none">Select Library</label>
            {loadingLibs ? (
              <Spinner className="h-4 w-4 text-emerald-600 mt-2" />
            ) : (
              <select
                value={selectedLibraryId}
                onChange={e => setSelectedLibraryId(e.target.value)}
                disabled={libraries.length === 0}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full disabled:opacity-50"
              >
                {libraries.length === 0 ? (
                  <option>No libraries found</option>
                ) : (
                  libraries.map(l => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
        </div>

        {/* Cells list inside selected library */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Library Cells</span>
            {selectedLibraryId && (
              <Button
                onClick={() => setCreateCellOpen(true)}
                className="h-7 px-2 bg-emerald-50 hover:bg-emerald-100 text-[var(--emerald-dark)] text-[10px] font-bold flex items-center gap-1 rounded"
              >
                <Plus className="h-3 w-3" /> Add Cell
              </Button>
            )}
          </div>

          {loadingCells ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner className="h-5 w-5 text-emerald-600" />
            </div>
          ) : cells.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No cells created in this library.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {cells.map(c => {
                const active = selectedCell?._id === c._id
                return (
                  <div 
                    key={c._id} 
                    onClick={() => handleCellSelect(c)}
                    className={`p-3 rounded-xl border transition-all text-xs flex justify-between items-center cursor-pointer ${
                      active 
                        ? 'border-[var(--emerald-dark)] bg-emerald-50/20 shadow-sm' 
                        : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-bold text-slate-800 truncate">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          c.viewType === 'Layout' ? 'bg-violet-50 text-violet-600' :
                          c.viewType === 'Schematic' ? 'bg-sky-50 text-sky-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>{c.viewType}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{c.checklistType}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono font-bold text-slate-600">{c.progress}%</span>
                        <Badge variant={c.status === 'Completed' ? 'success' : 'neutral'}>
                          {c.status}
                        </Badge>
                      </div>
                      
                      {isAdmin && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleArchiveCell(c._id)
                          }}
                          className="h-7 w-7 p-0 hover:bg-rose-50 text-rose-600 flex items-center justify-center rounded border border-rose-100/30"
                          title="Archive Cell"
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Panel: Cell Workspace details (single view) */}
      <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-6">
        {selectedCell ? (() => {
          const view = selectedCell.view || (selectedCell.views && selectedCell.views[0]) || null
          const assignRecord = view ? assignments.find(a => a.viewId === view._id) : null
          const assignedEmpName = assignRecord ? getEmployeeName(assignRecord.employeeId) : 'Unassigned'

          return (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-800 leading-tight">Cell Workspace: {selectedCell.name}</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  View Type: <span className="font-bold text-slate-600">{selectedCell.viewType}</span> • Checklist: {selectedCell.checklistType} • Progress: {selectedCell.progress}%
                </p>
              </div>
              <Badge variant={
                selectedCell.status === 'Completed' ? 'success' :
                selectedCell.status === 'Submitted For Review' ? 'warning' :
                selectedCell.status === 'Rejected' ? 'danger' : 'neutral'
              }>
                {selectedCell.status}
              </Badge>
            </div>

            {/* Single View Panel */}
            {view ? (
              <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/40 hover:bg-slate-50/80 transition-all space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      selectedCell.viewType === 'Layout' ? 'bg-violet-50 text-violet-600' :
                      selectedCell.viewType === 'Schematic' ? 'bg-sky-50 text-sky-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 leading-none">{selectedCell.viewType} View</h4>
                      <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Current Stage: {view.currentStage}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={
                      view.status === 'Completed' ? 'success' : 
                      view.status === 'Submitted For Review' ? 'warning' : 
                      view.status === 'Rejected' ? 'danger' : 'neutral'
                    }>
                      {view.status}
                    </Badge>
                    <span className="font-mono text-xs font-bold text-slate-655 bg-slate-100 px-2.5 py-1 rounded">Progress: {view.progress}%</span>
                  </div>
                </div>

                {/* Stage workflow diagram (Layout only) */}
                {selectedCell.viewType === 'Layout' && (
                  <div className="bg-white rounded-xl p-3 border border-slate-100 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span className="text-slate-400 uppercase tracking-wider pr-1">Workflow:</span>
                    {[
                      { stage: 'Floor Plan', label: 'FP' },
                      { stage: 'DRC Review', label: 'DRC Rev' },
                      { stage: 'Routing', label: 'Routing' },
                      { stage: 'DRC', label: 'DRC' },
                      { stage: 'LVS', label: 'LVS' },
                      { stage: 'Submit For Review', label: 'Submit' }
                    ].map((s, i) => {
                      const current = view.currentStage === s.stage
                      const completed = view.completedStages.includes(s.stage)
                      return (
                        <div key={s.stage} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-slate-300">→</span>}
                          <span className={`px-2 py-1 rounded ${
                            current 
                              ? 'bg-[var(--emerald-dark)] text-white font-bold' 
                              : completed 
                                ? 'bg-emerald-50 text-emerald-800' 
                                : 'bg-slate-50 text-slate-400'
                          }`}>
                            {s.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* View Type immutability notice */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-[10px] font-bold text-indigo-600">
                  View Type: <span className="font-extrabold">{selectedCell.viewType}</span> — immutable after creation
                </div>

                {/* Footer with assignment and admin actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-500">
                    <span className="text-slate-400">Assigned:</span>
                    <span className={assignRecord ? 'text-slate-800 font-bold' : 'text-slate-400 italic'}>
                      {assignedEmpName}
                    </span>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      {assignRecord ? (
                        <Button
                          onClick={() => handleArchiveAssignment(selectedCell._id)}
                          className="h-8 px-2.5 border border-rose-100 hover:bg-rose-50 text-rose-600 flex items-center gap-1.5 rounded-lg text-[10px] font-bold"
                        >
                          Unassign
                        </Button>
                      ) : (
                        <Button
                          onClick={() => openAssignModal(selectedCell)}
                          className="h-8 px-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 rounded-lg text-[10px] font-bold"
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Assign
                        </Button>
                      )}

                      <Button
                        onClick={() => view && openOverrideModal(view)}
                        className="h-8 px-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 rounded-lg text-[10px] font-bold"
                        title="Override Workflow status"
                      >
                        <Sliders className="h-3.5 w-3.5" /> Override
                      </Button>

                      <Button
                        onClick={() => view && openAuditModal(view._id)}
                        className="h-8 px-2.5 border border-slate-200 hover:bg-slate-50 text-slate-650 flex items-center gap-1.5 rounded-lg text-[10px] font-bold"
                        title="View Audit Trails"
                      >
                        <History className="h-3.5 w-3.5" /> Audit
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No view data available for this cell.</p>
            )}
          </div>
          )
        })() : (
          <div className="flex h-96 flex-col justify-center items-center gap-2 text-slate-400">
            <Layers className="h-12 w-12 text-slate-350" />
            <p className="text-xs font-bold">Select a cell workspace from the left sidebar to view progress and assignments.</p>
          </div>
        )}
      </div>

      {/* CREATE CELL MODAL */}
      <Modal isOpen={createCellOpen} onClose={() => setCreateCellOpen(false)} title="Create Cell Workspace">
        <div className="space-y-4 p-4 text-xs font-semibold">
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Cell Name</label>
            <Input value={cellName} onChange={e => setCellName(e.target.value)} placeholder="e.g. PLL_Cell_01" className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">View Type <span className="text-rose-500">(immutable after creation)</span></label>
            <select
              value={viewType}
              onChange={e => setViewType(e.target.value as any)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
            >
              <option value="Schematic">Schematic</option>
              <option value="Symbol">Symbol</option>
              <option value="Layout">Layout</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Checklist Template Type</label>
            <select
              value={checklistType}
              onChange={e => setChecklistType(e.target.value as any)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
            >
              <option value="Block">Block Checklist</option>
              <option value="IO">IO Checklist</option>
              <option value="ESD">ESD Checklist</option>
              <option value="TOP">TOP Checklist</option>
            </select>
          </div>
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg p-3 text-[10px] font-bold text-indigo-600 leading-normal">
            Each cell contains exactly one View Type. Once selected, the View Type cannot be changed. The latest checklist template version will be attached automatically.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateCellOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCell} className="bg-[var(--emerald-dark)] text-white hover:bg-emerald-800">Create Cell</Button>
          </div>
        </div>
      </Modal>

      {/* ASSIGN EMPLOYEE MODAL */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Employee">
        <div className="space-y-4 p-4 text-xs font-semibold">
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Select Workspace Employee</label>
            <select
              value={selectedEmployeeId}
              onChange={e => setSelectedEmployeeId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
            >
              <option value="">-- Select Employee --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName || ''} ({emp.email})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignEmployee} className="bg-[var(--emerald-dark)] text-white hover:bg-emerald-800">Confirm Assignment</Button>
          </div>
        </div>
      </Modal>

      {/* OVERRIDE WORKFLOW MODAL */}
      <Modal isOpen={overrideOpen} onClose={() => setOverrideOpen(false)} title="Override View Workflow State">
        <div className="space-y-4 p-4 text-xs font-semibold">
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Status</label>
            <select
              value={overrideStatus}
              onChange={e => setOverrideStatus(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
            >
              <option value="In Progress">In Progress</option>
              <option value="Submitted For Review">Submitted For Review</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Current Stage</label>
            {activeView?.viewType === 'Layout' ? (
              <select
                value={overrideStage}
                onChange={e => setOverrideStage(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
              >
                <option value="Floor Plan">Floor Plan</option>
                <option value="DRC Review">DRC Review</option>
                <option value="Routing">Routing</option>
                <option value="DRC">DRC</option>
                <option value="LVS">LVS</option>
                <option value="Submit For Review">Submit For Review</option>
              </select>
            ) : (
              <Input value={overrideStage} onChange={e => setOverrideStage(e.target.value)} className="h-9" />
            )}
          </div>

          {activeView?.viewType === 'Layout' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-500 uppercase">Checkpoint 1</label>
                <select
                  value={overrideCP1}
                  onChange={e => setOverrideCP1(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
                >
                  <option value="None">None</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-500 uppercase">Checkpoint 2</label>
                <select
                  value={overrideCP2}
                  onChange={e => setOverrideCP2(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
                >
                  <option value="None">None</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button onClick={handleOverride} className="bg-[var(--emerald-dark)] text-white hover:bg-emerald-800">Apply Override</Button>
          </div>
        </div>
      </Modal>

      {/* VIEW AUDIT TRAILS MODAL */}
      <Modal isOpen={auditOpen} onClose={() => setAuditOpen(false)} title="View Audit Trail">
        <div className="p-4 space-y-4 max-h-[450px] overflow-y-auto text-xs font-semibold">
          {loadingAudit ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner className="h-6 w-6 text-emerald-600" />
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-slate-400 italic text-center py-6">No audits recorded for this view workspace.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log._id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-none">Modified by: <span className="font-bold text-slate-600">{log.user}</span></p>
                  
                  {log.previousState && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono leading-tight bg-white p-2 rounded border border-slate-100">
                      <div className="text-rose-600 truncate">Previous: {JSON.stringify(log.previousState)}</div>
                      <div className="text-emerald-700 truncate">New: {JSON.stringify(log.newState)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

    </div>
  )
}
