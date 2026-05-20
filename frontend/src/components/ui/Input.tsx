import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name
    return (
      <label className="block w-full space-y-1.5" htmlFor={inputId}>
        {label ? (
          <span className="text-sm font-medium text-ink">
            {label}
            {props.required ? <span className="text-danger"> *</span> : null}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm outline-none transition-ui placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...props}
        />
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </label>
    )
  },
)
Input.displayName = 'Input'
