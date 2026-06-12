import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, Users } from 'lucide-react'
import type { NoteProjectEmployee } from '@/types/notes'
import { cn } from '@/utils/cn'

type Props = {
  label?: string
  value: string[]
  onChange: (employeeIds: string[]) => void
  employees: NoteProjectEmployee[]
  loading?: boolean
  disabled?: boolean
  id?: string
}

export function SearchableEmployeeMultiSelect({
  label = 'Employees',
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

  const selectedEmployees = useMemo(
    () => employees.filter((employee) => value.includes(employee.id)),
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

  const toggleEmployee = (employeeId: string) => {
    onChange(
      value.includes(employeeId)
        ? value.filter((id) => id !== employeeId)
        : [...value, employeeId],
    )
  }

  const triggerLabel = useMemo(() => {
    if (disabled) return 'Select a project first'
    if (loading) return 'Loading employees…'
    if (selectedEmployees.length === 0) return 'Select employees'
    if (selectedEmployees.length === 1) return selectedEmployees[0].name
    return `${selectedEmployees.length} employees selected`
  }, [disabled, loading, selectedEmployees])

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
        <Users className="h-4 w-4 shrink-0 text-[#2f6b4f]" />
        <span className="truncate text-left">{triggerLabel}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {selectedEmployees.length > 0 ? (
        <div className="admin-notes-selected-tags">
          {selectedEmployees.map((employee) => (
            <span key={employee.id} className="admin-notes-selected-tag">
              {employee.name}
              <button
                type="button"
                className="admin-notes-selected-tag__remove"
                onClick={() => toggleEmployee(employee.id)}
                aria-label={`Remove ${employee.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {open && !disabled && !loading ? (
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
              <p className="px-3 py-3 text-sm text-slate-500">
                {employees.length === 0
                  ? 'No employees are allotted to this project yet'
                  : 'No matching employees'}
              </p>
            ) : (
              filtered.map((employee) => (
                <label key={employee.id} className="admin-notes-select-option admin-notes-select-option--checkbox">
                  <input
                    type="checkbox"
                    checked={value.includes(employee.id)}
                    onChange={() => toggleEmployee(employee.id)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{employee.name}</span>
                    <span className="text-xs text-slate-500">{employee.employeeId}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
