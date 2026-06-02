import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Search, User } from 'lucide-react'
import type { Employee } from '@/types'
import { employeeDisplayName } from '@/services/analyticsService'
import { cn } from '@/utils/cn'

type Props = {
  employees: Employee[]
  value: string | 'all'
  onChange: (value: string | 'all') => void
  loading?: boolean
  id?: string
}

export function SearchableEmployeeSelect({
  employees,
  value,
  onChange,
  loading = false,
  id = 'analytics-employee',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedLabel = useMemo(() => {
    if (value === 'all') return 'All employees'
    const emp = employees.find((e) => e.id === value)
    if (!emp) return 'Select employee'
    return `${employeeDisplayName(emp)} (${emp.employeeId})`
  }, [employees, value])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => {
      const name = employeeDisplayName(e).toLowerCase()
      return name.includes(q) || e.employeeId.toLowerCase().includes(q)
    })
  }, [employees, search])

  return (
    <div className="admin-analytics-filter-field" ref={ref}>
      <label htmlFor={id} className="admin-analytics-filter-label">
        Employee
      </label>
      <button
        id={id}
        type="button"
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className="admin-analytics-filter-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <User className="h-4 w-4 shrink-0 text-[#2f6b4f]" />
        <span className="truncate text-left">{loading ? 'Loading employees…' : selectedLabel}</span>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
        ) : (
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && !loading && (
        <div className="admin-analytics-filter-dropdown" role="listbox">
          <div className="admin-analytics-filter-search">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>
          <div className="admin-analytics-filter-options">
            <button
              type="button"
              role="option"
              aria-selected={value === 'all'}
              onClick={() => {
                onChange('all')
                setOpen(false)
                setSearch('')
              }}
              className={cn('admin-analytics-filter-option', value === 'all' && 'is-selected')}
            >
              <span className="font-semibold">All employees</span>
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">No employees found</p>
            ) : (
              filtered.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  role="option"
                  aria-selected={value === emp.id}
                  onClick={() => {
                    onChange(emp.id)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={cn('admin-analytics-filter-option', value === emp.id && 'is-selected')}
                >
                  <span className="font-medium">{employeeDisplayName(emp)}</span>
                  <span className="text-xs text-slate-500">{emp.employeeId}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
