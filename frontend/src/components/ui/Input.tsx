import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  theme?: 'light' | 'dark'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, theme = 'light', ...props }, ref) => {
    const inputId = id ?? props.name
    const isDark = theme === 'dark'
    return (
      <label className="block w-full space-y-1.5" htmlFor={inputId}>
        {label ? (
          <span className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-ink")}>
            {label}
            {props.required ? <span className="text-danger"> *</span> : null}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-lg border px-3 text-sm shadow-sm outline-none transition-ui',
            isDark
              ? 'border-white/10 bg-[#111319] text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
              : 'border-border bg-white text-ink placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20',
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
