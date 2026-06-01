import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import {
  formatDigitsAsDdMmYyyy,
  isoToDdMmYyyy,
  parseDdMmYyyy,
  validateIsoInRange,
} from '@/utils/dateValidation'

export interface DateInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  onChange: (iso: string) => void
  minDate?: string
  maxDate?: string
  error?: string
  onValidationError?: (message: string) => void
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      value,
      onChange,
      minDate,
      maxDate,
      error,
      onValidationError,
      className,
      disabled,
      placeholder = 'dd/mm/yyyy',
      onBlur,
      ...props
    },
    ref,
  ) => {
    const [display, setDisplay] = useState(() => isoToDdMmYyyy(value))
    const [localError, setLocalError] = useState('')

    useEffect(() => {
      setDisplay(isoToDdMmYyyy(value))
    }, [value])

    const commitValue = (raw: string) => {
      if (!raw.trim()) {
        setLocalError('')
        onChange('')
        return
      }

      const parsed = parseDdMmYyyy(raw)
      if (!parsed.valid) {
        setLocalError(parsed.error)
        onValidationError?.(parsed.error)
        onChange('')
        return
      }

      const ranged = validateIsoInRange(parsed.iso, minDate, maxDate)
      if (!ranged.valid) {
        setLocalError(ranged.error)
        onValidationError?.(ranged.error)
        onChange('')
        return
      }

      setLocalError('')
      onChange(parsed.iso)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDigitsAsDdMmYyyy(e.target.value)
      setDisplay(formatted)
      setLocalError('')

      if (formatted.length === 10) {
        commitValue(formatted)
      } else if (!formatted) {
        onChange('')
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (display.trim()) {
        commitValue(display)
      }
      onBlur?.(e)
    }

    const shownError = error || localError

    return (
      <div className="w-full">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          maxLength={10}
          aria-invalid={shownError ? true : undefined}
          className={cn(
            'h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm outline-none transition-ui placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
            shownError && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...props}
        />
        {shownError ? <p className="mt-1 text-xs text-danger">{shownError}</p> : null}
      </div>
    )
  },
)
DateInput.displayName = 'DateInput'
