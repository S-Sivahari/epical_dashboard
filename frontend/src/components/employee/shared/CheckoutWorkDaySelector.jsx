import { cn } from '@pages/employee/lib/utils'

const OPTIONS = [
  {
    value: 'full_day',
    label: 'Full day',
    description: 'Deduct breaks you took, or 50 min if you took none.',
  },
  {
    value: 'half_day',
    label: 'Half day',
    description: 'Deduct only the breaks you actually took.',
  },
]

export function CheckoutWorkDaySelector({ value, onChange, disabled = false, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-bold text-slate-800">How long did you work today?</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left transition',
                selected
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/30'
                  : 'border-slate-200 bg-white hover:border-emerald-300',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <p className="text-sm font-bold text-slate-900">{option.label}</p>
              <p className="mt-0.5 text-xs text-slate-600">{option.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
