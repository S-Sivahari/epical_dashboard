import { Modal } from '@components/ui/Modal'

export function DocumentPreviewModal({
  isOpen,
  title,
  onClose,
}: {
  isOpen: boolean
  title: string
  onClose: () => void
}) {
  return (
    <Modal isOpen={isOpen} title={`Preview: ${title}`} onClose={onClose} size="xl">
      <div className="h-[60vh] rounded-lg border border-border bg-surface">
        <iframe title="preview" className="h-full w-full rounded-lg" src="about:blank" />
      </div>
    </Modal>
  )
}
