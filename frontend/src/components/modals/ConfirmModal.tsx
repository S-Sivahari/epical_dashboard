import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  danger,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-muted">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => void onConfirm()}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
