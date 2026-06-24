import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

const sizes: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-3xl',
}

function isDateInputPopoverTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-date-input-popover]'))
}

function isCellComboboxDropdownTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-cell-combobox-dropdown]'))
}

function isModalPopoverTarget(target: EventTarget | null): boolean {
  return isDateInputPopoverTarget(target) || isCellComboboxDropdownTarget(target)
}

export function Modal({
  isOpen,
  title,
  onClose,
  size = 'md',
  elevated = false,
  modal = false,
  className,
  children,
  theme = 'light',
  headerActions,
}: {
  isOpen: boolean
  title: string
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Rendered to the left of the close button in the modal header. */
  headerActions?: ReactNode
  /** Stack above another open modal (e.g. override form over project tasks). */
  elevated?: boolean
  /** Trap focus and block background interaction (recommended for forms). */
  modal?: boolean
  className?: string
  children: ReactNode
  theme?: 'light' | 'dark'
}) {
  const overlayZ = elevated ? 'z-[60]' : modal ? 'z-[200]' : 'z-50'
  const contentZ = elevated ? 'z-[61]' : modal ? 'z-[201]' : 'z-50'
  const isDark = theme === 'dark'
  const openedAtRef = useRef(0)

  useEffect(() => {
    if (isOpen) openedAtRef.current = performance.now()
  }, [isOpen])

  const openedRecently = () => performance.now() - openedAtRef.current < 250

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (openedRecently()) return
    onClose()
  }

  const guardRecentOpen = (event: { preventDefault: () => void }) => {
    if (openedRecently()) event.preventDefault()
  }

  return (
    <Dialog.Root
      open={isOpen}
      modal={modal}
      onOpenChange={(open) => {
        if (!open && !openedRecently()) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 bg-slate-950/60 backdrop-blur-sm',
            overlayZ,
            !modal && 'pointer-events-auto',
          )}
          onClick={modal ? undefined : handleOverlayClick}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border p-6 shadow-2xl outline-none',
            modal && 'pointer-events-auto',
            isDark 
              ? 'border-white/10 bg-[#161922] text-slate-100' 
              : 'border-border bg-white text-ink',
            contentZ,
            sizes[size],
            className,
          )}
          onPointerDownOutside={(e) => {
            if (isModalPopoverTarget(e.target)) e.preventDefault()
            guardRecentOpen(e)
          }}
          onInteractOutside={(e) => {
            if (isModalPopoverTarget(e.target)) e.preventDefault()
            guardRecentOpen(e)
          }}
          onFocusOutside={(e) => {
            if (isModalPopoverTarget(e.target)) e.preventDefault()
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
            <Dialog.Title className={cn(
              "font-display text-lg font-bold tracking-tight",
              isDark ? "text-white" : "text-ink"
            )}>
              {title}
            </Dialog.Title>
            <div className="flex items-center gap-2">
              {headerActions}
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
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
