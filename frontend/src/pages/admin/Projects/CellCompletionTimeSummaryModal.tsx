import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ProjectCell } from '@/types/projectWorkspace'
import { CellCompletionTimeSummary } from './CellCompletionTimeSummary'
import {
  preventModalCloseOnTabSwitch,
  preventModalCloseWhileHidden,
} from '@/utils/modalDismissGuards'

type CellCompletionTimeSummaryModalProps = {
  cell: ProjectCell
  isOpen: boolean
  onClose: () => void
}

export function CellCompletionTimeSummaryModal({
  cell,
  isOpen,
  onClose,
}: CellCompletionTimeSummaryModalProps) {
  if (cell.status !== 'completed') return null

  return (
    <Dialog.Root
      open={isOpen}
      modal
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="admin-projects-cell-completion-time-modal-overlay" />
        <Dialog.Content
          className="admin-projects-cell-completion-time-modal"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={preventModalCloseOnTabSwitch}
          onInteractOutside={preventModalCloseWhileHidden}
          onPointerDownOutside={preventModalCloseWhileHidden}
        >
          <header className="admin-projects-cell-completion-time-modal-head">
            <div className="admin-projects-cell-completion-time-modal-head-pattern" aria-hidden />
            <Dialog.Title className="admin-projects-cell-completion-time-modal-title">
              Time Summary
            </Dialog.Title>
            <Dialog.Close
              type="button"
              className="admin-projects-cell-completion-time-modal-close"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </header>

          <div className="admin-projects-cell-completion-time-modal-body">
            <CellCompletionTimeSummary cell={cell} variant="modal" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
