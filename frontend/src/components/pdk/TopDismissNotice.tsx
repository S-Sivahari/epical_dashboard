import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export type TopNotice = {
  kind: 'loading' | 'success' | 'error'
  title: string
  details: string[]
}

export function TopDismissNotice({
  notice,
  onDismiss,
  successDurationMs = 5000,
  errorDurationMs = 8000,
}: {
  notice: TopNotice | null
  onDismiss: () => void
  successDurationMs?: number
  errorDurationMs?: number
}) {
  useEffect(() => {
    if (!notice || notice.kind === 'loading') return
    const duration = notice.kind === 'error' ? errorDurationMs : successDurationMs
    const timer = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [notice, onDismiss, successDurationMs, errorDurationMs])

  if (!notice || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[300] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto w-full max-w-lg rounded-lg border px-4 py-3 text-sm shadow-lg',
          notice.kind === 'loading' && 'border-blue-200 bg-blue-50 text-blue-900',
          notice.kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
          notice.kind === 'error' && 'border-red-200 bg-red-50 text-red-900',
        )}
      >
        <div className="flex items-start gap-3">
          {notice.kind === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : notice.kind === 'error' ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold">{notice.title}</p>
            {notice.details.map((line) => (
              <p key={line} className="text-xs leading-relaxed">
                {line}
              </p>
            ))}
          </div>
          {notice.kind !== 'loading' ? (
            <button
              type="button"
              className="shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
              onClick={onDismiss}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
