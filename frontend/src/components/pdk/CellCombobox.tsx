import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

type CellComboboxProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  id?: string
}

export function CellCombobox({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select or type cell name',
  id,
}: CellComboboxProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  const filteredOptions = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options
    return options.filter((cell) => cell.toLowerCase().includes(q))
  }, [options, value])

  useEffect(() => {
    if (!open) return

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  const selectOption = (cell: string) => {
    onChange(cell)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="w-full space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-listbox`}
          className="h-10 w-full rounded-lg border border-border bg-white px-3 pr-9 text-sm shadow-sm outline-none transition-ui placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Show ${label} options`}
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open ? (
        <ul
          id={`${inputId}-listbox`}
          role="listbox"
          className="max-h-40 overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-sm"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No project cells — type a name above</li>
          ) : filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No matching cells — type a name above</li>
          ) : (
            filteredOptions.map((cell) => (
              <li key={cell} role="option" aria-selected={value === cell}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(cell)}
                  className={cn(
                    'flex w-full px-3 py-2 text-left text-sm text-ink hover:bg-primary/5',
                    value === cell && 'bg-primary/10 font-medium',
                  )}
                >
                  {cell}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
