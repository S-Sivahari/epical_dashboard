import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  /** Renders a chevron on the right (use with `appearance-none` via className). */
  showChevron?: boolean
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, options, id, className, showChevron, ...props }, ref) => {
    const sid = id ?? props.name
    return (
      <label className="block w-full space-y-1.5" htmlFor={sid}>
        {label ? (
          <span className="text-sm font-medium text-ink">
            {label}
            {props.required ? <span className="text-danger"> *</span> : null}
          </span>
        ) : null}
        <div className={cn(showChevron && 'relative')}>
          <select
            ref={ref}
            id={sid}
            className={cn(
              'h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm outline-none transition-ui focus:border-primary focus:ring-2 focus:ring-primary/20',
              showChevron && 'appearance-none pr-9',
              error && 'border-danger',
              className,
            )}
            {...props}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {showChevron ? (
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700/80"
              aria-hidden
            />
          ) : null}
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </label>
    )
  },
)
SelectField.displayName = 'SelectField'
