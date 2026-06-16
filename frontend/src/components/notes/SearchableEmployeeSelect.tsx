import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, User } from 'lucide-react'
import type { NoteProjectEmployee } from '@/types/notes'
import { cn } from '@/utils/cn'

type Props = {
  label?: string
  value: string
  onChange: (employeeId: string, employee: NoteProjectEmployee | null) => void
  employees: NoteProjectEmployee[]
  loading?: boolean
  disabled?: boolean
  id?: string
}

export function SearchableEmployeeSelect({
  label = 'Employee',
  value,
  onChange,
  employees,
  loading = false,
  disabled = false,
  id = 'notes-employee-select',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => employees.find((employee) => employee.id === value) ?? null,
    [employees, value],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return employees
    return employees.filter((employee) => {
      const haystack = `${employee.name} ${employee.employeeId}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [employees, search])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectEmployee = (employee: NoteProjectEmployee) => {
    onChange(employee.id, employee)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="admin-notes-field" ref={ref}>
      <span className="admin-notes-field__label">{label}</span>
      <button
        id={id}
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'admin-notes-select-trigger',
          (disabled || loading) && 'admin-notes-select-trigger--disabled',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <User className="h-4 w-4 shrink-0 text-[#2f6b4f]" />
        <span className="truncate text-left">
          {loading ? 'Loading employees…' : selected?.name || 'Select employee'}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && !loading && !disabled ? (
        <div className="admin-notes-select-dropdown" role="listbox">
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
                  aria-selected={value === employee.id}
                  onClick={() => selectEmployee(employee)}
                  className={cn(
                    'admin-notes-select-option',
                    value === employee.id && 'admin-notes-select-option--selected',
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
