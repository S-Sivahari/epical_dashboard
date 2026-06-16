import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { createChildBlock } from '@/services/notesService'
import type { DailyNoteBlock } from '@/types/notes'
import type { Employee } from '@/types'
import { employeesAvailableForProjectDay } from '@/utils/notesBootstrap'
import { cn } from '@/utils/cn'

type Props = {
  block: DailyNoteBlock
  projectId: string
  projectName: string
  employees: Employee[]
  disabled?: boolean
  onBlockChange: (block: DailyNoteBlock) => void
}

export function AddProjectEmployeeControl({
  block,
  projectId,
  projectName,
  employees,
  disabled = false,
  onBlockChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const available = useMemo(
    () => employeesAvailableForProjectDay(employees, block, projectId),
    [block, employees, projectId],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return available
    return available.filter((employee) => {
      const haystack = `${employee.name} ${employee.employeeId}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [available, search])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAdd = async (employeeId: string, employeeName: string) => {
    setAddingId(employeeId)
    try {
      const updated = await createChildBlock(block._id, {
        title: projectName,
        projectId,
        employeeIds: [employeeId],
        description: '',
        includeInEmail: true,
      })
      onBlockChange(updated)
      setOpen(false)
      setSearch('')
      toast.success(`${employeeName} added to ${projectName}`)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr.response?.data?.error || 'Failed to add employee')
    } finally {
      setAddingId(null)
    }
  }

  const noneLeft = available.length === 0

  return (
    <div className="notes-notepad__add-employee" ref={ref}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        icon={addingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        disabled={disabled || noneLeft || Boolean(addingId)}
        onClick={() => setOpen((current) => !current)}
        title={noneLeft ? 'All employees already have a note on this project today' : 'Add another employee to this project'}
      >
        Add employee
      </Button>

      {open && !noneLeft ? (
        <div className="notes-notepad__add-employee-dropdown" role="listbox" aria-label={`Add employee to ${projectName}`}>
          <div className="admin-notes-select-search">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees…"
              className="flex-1 bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>
          <div className="admin-notes-select-options">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">No matching employees</p>
            ) : (
              filtered.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  role="option"
                  disabled={addingId === employee.id}
                  onClick={() => void handleAdd(employee.id, employee.name)}
                  className={cn(
                    'admin-notes-select-option',
                    addingId === employee.id && 'admin-notes-select-option--selected',
                  )}
                >
                  <span className="font-medium">{employee.name}</span>
                  <span className="text-xs text-slate-500">{employee.employeeId}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
