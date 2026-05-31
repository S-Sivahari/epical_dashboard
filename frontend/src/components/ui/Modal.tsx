import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

const sizes: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-3xl',
}

export function Modal({
  isOpen,
  title,
  onClose,
  size = 'md',
  elevated = false,
  className,
  children,
  theme = 'light',
}: {
  isOpen: boolean
  title: string
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Stack above another open modal (e.g. override form over project tasks). */
  elevated?: boolean
  className?: string
  children: ReactNode
  theme?: 'light' | 'dark'
}) {
  const z = elevated ? 'z-[60]' : 'z-50'
  const isDark = theme === 'dark'
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={cn('fixed inset-0 bg-slate-950/60 backdrop-blur-sm', z)} />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border p-6 shadow-2xl outline-none',
            isDark 
              ? 'border-white/10 bg-[#161922] text-slate-100' 
              : 'border-border bg-white text-ink',
            z,
            sizes[size],
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className={cn(
              "font-display text-lg font-bold tracking-tight",
              isDark ? "text-white" : "text-ink"
            )}>
              {title}
            </Dialog.Title>
            <Dialog.Close
              className={cn(
                "rounded-lg p-1 transition-colors",
                isDark 
                  ? "text-slate-400 hover:bg-white/5 hover:text-white" 
                  : "text-muted hover:bg-surface hover:text-ink"
              )}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
