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
  children,
}: {
  isOpen: boolean
  title: string
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Stack above another open modal (e.g. override form over project tasks). */
  elevated?: boolean
  children: ReactNode
}) {
  const z = elevated ? 'z-[60]' : 'z-50'
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={cn('fixed inset-0 bg-slate-900/40', z)} />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-md outline-none',
            z,
            sizes[size],
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-lg font-semibold text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close
              className="rounded-lg p-1 text-muted hover:bg-surface hover:text-ink"
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
