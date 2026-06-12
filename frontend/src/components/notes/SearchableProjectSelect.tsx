import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/utils/cn'

export type NoteProjectOption = {
  id: string
  name: string
  client?: string
  technologyNode?: string
}

type Props = {
  label?: string
  value: string
  onChange: (projectId: string, project: NoteProjectOption | null) => void
  projects: NoteProjectOption[]
  loading?: boolean
  disabled?: boolean
  id?: string
}

export function SearchableProjectSelect({
  label = 'Project',
  value,
  onChange,
  projects,
  loading = false,
  disabled = false,
  id = 'notes-project-select',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => projects.find((project) => project.id === value) ?? null,
    [projects, value],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return projects
    return projects.filter((project) => {
      const haystack = `${project.name} ${project.client || ''} ${project.technologyNode || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [projects, search])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectProject = (project: NoteProjectOption) => {
    onChange(project.id, project)
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
        <span className="truncate text-left">
          {loading ? 'Loading projects…' : selected?.name || 'Select project'}
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
              placeholder="Search projects…"
              className="flex-1 bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>
          <div className="admin-notes-select-options">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">No matching projects</p>
            ) : (
              filtered.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  role="option"
                  aria-selected={value === project.id}
                  onClick={() => selectProject(project)}
                  className={cn(
                    'admin-notes-select-option',
                    value === project.id && 'admin-notes-select-option--selected',
                  )}
                >
                  <span className="font-medium">{project.name}</span>
                  {project.client || project.technologyNode ? (
                    <span className="text-xs text-slate-500">
                      {[project.client, project.technologyNode].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
