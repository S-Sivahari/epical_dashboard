import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  danger,
  onClose,
  onConfirm,
  theme = 'light',
}: {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  theme?: 'light' | 'dark'
}) {
  const isDark = theme === 'dark'
  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose} size="sm" theme={theme}>
      <p className={cn("text-sm", isDark ? "text-slate-300" : "text-muted")}>{description}</p>
      <div className={cn("mt-6 flex justify-end gap-2 border-t pt-4", isDark ? "border-white/5" : "border-slate-100")}>
        <Button 
          variant="secondary" 
          onClick={onClose}
          className={cn(isDark && "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white")}
        >
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => void onConfirm()}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
