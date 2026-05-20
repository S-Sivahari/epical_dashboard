import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

export function StepIndicator({
  steps,
  currentStep,
}: {
  steps: string[]
  currentStep: number
}) {
  return (
    <ol className="flex flex-wrap gap-3">
      {steps.map((label, idx) => {
        const state = idx < currentStep ? 'done' : idx === currentStep ? 'active' : 'todo'
        return (
          <li
            key={label}
            className={cn(
              'flex min-w-[140px] flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm',
              state === 'done' && 'border-primary/30 bg-emerald-50 text-emerald-900',
              state === 'active' && 'border-primary bg-white shadow-sm ring-2 ring-primary/20',
              state === 'todo' && 'border-border bg-surface text-muted',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                state === 'done' && 'bg-primary text-white',
                state === 'active' && 'bg-primary text-white',
                state === 'todo' && 'bg-white text-muted ring-1 ring-border',
              )}
            >
              {state === 'done' ? <Check className="h-4 w-4" /> : idx + 1}
            </span>
            <span className="font-medium">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
