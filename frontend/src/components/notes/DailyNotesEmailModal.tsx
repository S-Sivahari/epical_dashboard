import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, Mail, Send, Users } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { previewDailyNotesEmail, sendDailyNotesEmail } from '@/services/notesService'
import type {
  DailyNoteBlock,
  DailyNotesEmailPreview,
  DailyNotesEmailSendResult,
  NoteEmailRecipient,
} from '@/types/notes'
import { formatDateTime } from '@/utils/formatDate'

const DELIVERY_LABELS = {
  sent: 'Sent',
  failed: 'Failed',
  partial: 'Partially sent',
} as const

type RecipientMode = 'all' | 'selected'

type Props = {
  block: DailyNoteBlock
  isOpen: boolean
  onClose: () => void
  onSent: (result: DailyNotesEmailSendResult) => void
  onError: (message: string) => void
}

function filterRecipients(
  allRecipients: NoteEmailRecipient[],
  mode: RecipientMode,
  selectedIds: string[],
): NoteEmailRecipient[] {
  if (mode === 'all') return allRecipients
  const idSet = new Set(selectedIds)
  return allRecipients.filter((recipient) => idSet.has(recipient.id))
}

export function DailyNotesEmailModal({ block, isOpen, onClose, onSent, onError }: Props) {
  const [step, setStep] = useState<'preview' | 'confirm'>('preview')
  const [preview, setPreview] = useState<DailyNotesEmailPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all')
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([])

  useEffect(() => {
    if (!isOpen) {
      setStep('preview')
      setPreview(null)
      setRecipientMode('all')
      setSelectedRecipientIds([])
      return
    }

    setLoadingPreview(true)
    previewDailyNotesEmail(block._id)
      .then(setPreview)
      .catch((err: unknown) => {
        const axiosErr = err as { response?: { data?: { error?: string } } }
        onError(axiosErr.response?.data?.error || 'Failed to load email preview')
        onClose()
      })
      .finally(() => setLoadingPreview(false))
  }, [isOpen, block._id, onClose, onError])

  const effectiveRecipients = useMemo(() => {
    if (!preview) return []
    return filterRecipients(preview.allRecipients, recipientMode, selectedRecipientIds)
  }, [preview, recipientMode, selectedRecipientIds])

  const canSend = useMemo(() => {
    if (!preview || preview.projectGroups.length === 0) return false
    if (recipientMode === 'all') return preview.allRecipients.length > 0
    return selectedRecipientIds.length > 0 && effectiveRecipients.length > 0
  }, [preview, recipientMode, selectedRecipientIds, effectiveRecipients])

  const recipientWarnings = useMemo(() => {
    if (!preview) return []
    const warnings = [...preview.warnings.filter((warning) => !warning.includes('selected employee'))]
    if (recipientMode === 'selected' && selectedRecipientIds.length === 0) {
      warnings.push('Select at least one employee to send the email.')
    } else if (recipientMode === 'selected' && selectedRecipientIds.length > 0 && effectiveRecipients.length === 0) {
      warnings.push('No selected employees have a valid email address on file.')
    } else if (
      recipientMode === 'selected' &&
      selectedRecipientIds.length > effectiveRecipients.length
    ) {
      const missingCount = selectedRecipientIds.length - effectiveRecipients.length
      warnings.push(`${missingCount} selected employee(s) have no email on file and will be skipped.`)
    }
    return warnings
  }, [preview, recipientMode, selectedRecipientIds, effectiveRecipients])

  const toggleRecipient = (recipientId: string) => {
    setSelectedRecipientIds((current) =>
      current.includes(recipientId)
        ? current.filter((id) => id !== recipientId)
        : [...current, recipientId],
    )
  }

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    try {
      const result = await sendDailyNotesEmail(block._id, {
        recipientEmployeeIds: recipientMode === 'selected' ? selectedRecipientIds : undefined,
      })
      onSent(result)
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      onError(axiosErr.response?.data?.error || 'Failed to send daily notes email')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen && step === 'preview'}
        title="Preview daily notes email"
        onClose={onClose}
        size="xl"
        modal
      >
        {loadingPreview ? (
          <div className="admin-notes-email-loading">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Building email preview…</span>
          </div>
        ) : preview ? (
          <div className="admin-notes-email-preview">
            <div className="admin-notes-email-preview__summary">
              <div>
                <p className="admin-notes-email-preview__label">Subject</p>
                <p className="admin-notes-email-preview__value">{preview.subject}</p>
              </div>
              <div>
                <p className="admin-notes-email-preview__label">Recipients</p>
                <p className="admin-notes-email-preview__value">
                  <Users className="mr-1 inline h-4 w-4" />
                  {recipientMode === 'all'
                    ? `All working employees (${effectiveRecipients.length} email${effectiveRecipients.length === 1 ? '' : 's'})`
                    : `${selectedRecipientIds.length} selected · ${effectiveRecipients.length} email${effectiveRecipients.length === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>

            <div className="admin-notes-email-preview__recipient-mode">
              <p className="admin-notes-email-preview__section-title">Send to</p>
              <div className="admin-notes-email-preview__mode-options">
                <label className="admin-notes-email-preview__mode-option">
                  <input
                    type="radio"
                    name="recipient-mode"
                    checked={recipientMode === 'all'}
                    onChange={() => setRecipientMode('all')}
                  />
                  <span>All employees</span>
                </label>
                <label className="admin-notes-email-preview__mode-option">
                  <input
                    type="radio"
                    name="recipient-mode"
                    checked={recipientMode === 'selected'}
                    onChange={() => setRecipientMode('selected')}
                  />
                  <span>Selected employees</span>
                </label>
              </div>
            </div>

            {recipientMode === 'selected' ? (
              <div className="admin-notes-email-preview__recipient-picker">
                <div className="admin-notes-email-preview__recipient-picker-head">
                  <p className="admin-notes-email-preview__section-title">Choose employees</p>
                  <div className="admin-notes-email-preview__recipient-picker-actions">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRecipientIds(preview.allRecipients.map((recipient) => recipient.id))
                      }
                    >
                      Select all
                    </button>
                    <button type="button" onClick={() => setSelectedRecipientIds([])}>
                      Clear
                    </button>
                  </div>
                </div>
                <ul className="admin-notes-email-preview__recipient-checklist">
                  {preview.allRecipients.map((recipient) => (
                    <li key={recipient.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedRecipientIds.includes(recipient.id)}
                          onChange={() => toggleRecipient(recipient.id)}
                        />
                        <span className="admin-notes-email-preview__recipient-checklist-name">
                          {recipient.name}
                        </span>
                        <span className="admin-notes-email-preview__recipient-checklist-email">
                          {recipient.email}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="admin-notes-email-preview__recipients">
                <p className="admin-notes-email-preview__section-title">
                  All working employees ({preview.allRecipients.length})
                </p>
                <ul>
                  {preview.allRecipients.map((recipient) => (
                    <li key={recipient.email}>
                      <strong>{recipient.name}</strong>
                      <span>{recipient.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recipientWarnings.length > 0 ? (
              <div className="admin-notes-email-preview__warnings">
                {recipientWarnings.map((warning) => (
                  <p key={warning}>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="admin-notes-email-preview__content">
              <p className="admin-notes-email-preview__section-title">Email content preview</p>
              <div className="admin-notes-email-preview__letter">
                <p>Dear Team,</p>
                <p>
                  Please find below the daily project updates for{' '}
                  <strong>{preview.dailyBlockName}</strong>.
                </p>
                <p className="admin-notes-email-preview__projects-heading">Projects:</p>
                {preview.projectGroups.length === 0 ? (
                  <p className="admin-notes-empty-inline">No work descriptions are included in this email.</p>
                ) : (
                  preview.projectGroups.map((group) => (
                    <section key={group.projectId} className="admin-notes-email-preview__project">
                      <h3>{group.projectName.toUpperCase()}:</h3>
                      {group.employees.map((employee) => (
                        <div key={employee.childBlockId} className="admin-notes-email-preview__employee">
                          <p className="admin-notes-email-preview__employee-name">{employee.employeeName}</p>
                          {employee.lines.length > 0 ? (
                            <ul>
                              {employee.lines.map((line) => (
                                <li key={line}>{line}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="admin-notes-email-preview__no-updates">No updates recorded.</p>
                          )}
                        </div>
                      ))}
                    </section>
                  ))
                )}
                <p className="admin-notes-email-preview__signoff">
                  Regards,
                  <br />
                  <strong>Epical Admin</strong>
                </p>
              </div>
            </div>

            <div className="admin-notes-email-preview__actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                icon={<Send className="h-4 w-4" />}
                disabled={!canSend}
                onClick={() => setStep('confirm')}
              >
                Continue to send
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={isOpen && step === 'confirm'}
        title="Confirm send daily notes"
        onClose={() => setStep('preview')}
        size="md"
        modal
        elevated
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            Send <strong>{preview?.subject}</strong> to{' '}
            {recipientMode === 'all' ? (
              <>
                all <strong>{effectiveRecipients.length}</strong> working employee email
                {effectiveRecipients.length === 1 ? '' : 's'}
              </>
            ) : (
              <>
                <strong>{selectedRecipientIds.length}</strong> selected employee
                {selectedRecipientIds.length === 1 ? '' : 's'} (
                <strong>{effectiveRecipients.length}</strong> email
                {effectiveRecipients.length === 1 ? '' : 's'})
              </>
            )}
            ?
          </p>
          <p>
            After a successful send, this day will be marked as <strong>Email sent</strong>.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setStep('preview')} disabled={sending}>
            Back
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            disabled={sending || !canSend}
            onClick={handleSend}
          >
            {sending ? 'Sending…' : 'Confirm send'}
          </Button>
        </div>
      </Modal>
    </>
  )
}

export function EmailDeliveryBadge({ delivery }: { delivery: DailyNoteBlock['lastEmailDelivery'] }) {
  if (!delivery) return null

  return (
    <div className={`admin-notes-delivery admin-notes-delivery--${delivery.deliveryStatus}`}>
      <Mail className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="admin-notes-delivery__title">
          {DELIVERY_LABELS[delivery.deliveryStatus]} · {delivery.recipientCount} recipient
          {delivery.recipientCount === 1 ? '' : 's'}
        </p>
        <p className="admin-notes-delivery__meta">
          {formatDateTime(delivery.sentAt)} by {delivery.sentBy.name}
        </p>
        {delivery.errorMessage ? (
          <p className="admin-notes-delivery__error">{delivery.errorMessage}</p>
        ) : null}
      </div>
    </div>
  )
}
