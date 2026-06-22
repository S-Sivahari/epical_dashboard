import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

type CellDescriptionModalProps = {
  description: string
  isOpen: boolean
  onClose: () => void
}

export function CellDescriptionModal({
  description,
  isOpen,
  onClose,
}: CellDescriptionModalProps) {
  if (!description.trim()) return null

  return (
    <Dialog.Root
      open={isOpen}
      modal
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="admin-projects-cell-description-modal-overlay" />
        <Dialog.Content
          className="admin-projects-cell-description-modal"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <header className="admin-projects-cell-description-modal-head">
            <div className="admin-projects-cell-description-modal-head-pattern" aria-hidden />
            <Dialog.Title className="admin-projects-cell-description-modal-title">
              Description
            </Dialog.Title>
            <Dialog.Close
              type="button"
              className="admin-projects-cell-description-modal-close"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </header>

          <div className="admin-projects-cell-description-modal-body">
            <p className="admin-projects-cell-description-modal-text">{description}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
