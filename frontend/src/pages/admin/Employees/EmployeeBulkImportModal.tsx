import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import {
  bulkCreateEmployees,
  type EmployeeImportParseRow,
} from '@services/employeeService'
import { useEmployeeStore } from '@store/employeeStore'
import { formatDate } from '@/utils/formatDate'
import { cn } from '@/utils/cn'

export type EmployeeImportPreviewRow = EmployeeImportParseRow & { tempId: string }

type EmployeeBulkImportModalProps = {
  open: boolean
  onClose: () => void
  rows: EmployeeImportPreviewRow[]
  onRowsChange: (rows: EmployeeImportPreviewRow[]) => void
}

function PreviewField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium text-ink">{value || '—'}</p>
    </div>
  )
}

function displayValue(value: unknown): string | number | null | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' || typeof value === 'number') return value
  return String(value)
}

function displayDate(value: unknown): string {
  if (typeof value === 'string' || value instanceof Date) return formatDate(value)
  return ''
}

export function EmployeeBulkImportModal({
  open,
  onClose,
  rows,
  onRowsChange,
}: EmployeeBulkImportModalProps) {
  const fetchEmployees = useEmployeeStore((s) => s.fetchEmployees)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [importing, setImporting] = useState(false)

  const currentRow = rows[currentIndex]
  const invalidCount = rows.filter((row) => row.errors.length > 0).length

  const handleClose = () => {
    setCurrentIndex(0)
    setImporting(false)
    onClose()
  }

  const removeCurrentRow = () => {
    if (!currentRow) return
    const nextRows = rows.filter((row) => row.tempId !== currentRow.tempId)
    onRowsChange(nextRows)
    setCurrentIndex((index) => Math.max(0, Math.min(index, nextRows.length - 1)))
    toast.message('Employee removed from import list')
  }

  const goPrev = () => setCurrentIndex((index) => Math.max(0, index - 1))
  const goNext = () => setCurrentIndex((index) => Math.min(rows.length - 1, index + 1))

  const validRows = useMemo(
    () => rows.filter((row) => row.errors.length === 0),
    [rows],
  )

  const handleImport = async () => {
    if (!validRows.length) {
      toast.error('No valid employees left to import')
      return
    }
    if (invalidCount > 0) {
      toast.error(`Fix or remove ${invalidCount} employee${invalidCount === 1 ? '' : 's'} with validation errors`)
      return
    }

    try {
      setImporting(true)
      const result = await bulkCreateEmployees(validRows.map((row) => row.payload))
      if (result.created.length) {
        toast.success(`Added ${result.created.length} employee${result.created.length === 1 ? '' : 's'}`)
        await fetchEmployees()
      }
      if (result.failed.length) {
        toast.error(
          `${result.failed.length} employee${result.failed.length === 1 ? '' : 's'} failed to import`,
        )
      }
      if (result.created.length && !result.failed.length) {
        handleClose()
      } else if (result.failed.length) {
        const failedIds = new Set(result.failed.map((item) => item.employeeId))
        onRowsChange(
          rows.filter((row) => {
            const employeeId = displayValue(row.payload.employeeId)
            return (typeof employeeId === 'string' && failedIds.has(employeeId)) || row.errors.length > 0
          }),
        )
        setCurrentIndex(0)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bulk import failed'
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  const payload = currentRow?.payload
  const emergency = payload?.emergencyContact as
    | {
        name?: string
        phone?: string
        email?: string
        relation?: string
        address?: string
      }
    | undefined

  if (!rows.length) return null

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Review Imported Employees"
      size="xl"
      className="max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              {rows.length} employee{rows.length === 1 ? '' : 's'} ready for review
            </p>
            {invalidCount > 0 ? (
              <p className="text-xs font-medium text-amber-600">
                {invalidCount} row{invalidCount === 1 ? '' : 's'} have validation issues
              </p>
            ) : (
              <p className="text-xs text-muted">All rows look valid</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[5rem] text-center text-sm font-semibold text-ink">
              {currentIndex + 1} / {rows.length}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={goNext}
              disabled={currentIndex >= rows.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {currentRow?.errors.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">Validation issues</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {currentRow.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {payload ? (
          <div className="space-y-5 rounded-xl border border-border bg-white p-4">
            <div>
              <h3 className="font-semibold text-ink">Personal Information</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <PreviewField label="Employee ID" value={displayValue(payload.employeeId)} />
                <PreviewField
                  label="Full Name"
                  value={`${displayValue(payload.firstName) ?? ''} ${payload.middleName ? `${displayValue(payload.middleName)} ` : ''}${displayValue(payload.lastName) ?? ''}`.trim()}
                />
                <PreviewField label="Personal Email" value={displayValue(payload.personalEmail)} />
                <PreviewField label="Company Email" value={displayValue(payload.email)} />
                <PreviewField label="View" value={displayValue(payload.view) ?? 'Public'} />
                <PreviewField label="Phone" value={displayValue(payload.phone)} />
                <PreviewField label="Date of Birth" value={displayDate(payload.dob)} />
                <PreviewField label="Gender" value={displayValue(payload.gender)} />
                <PreviewField label="Role" value={displayValue(payload.role)} />
                <PreviewField label="Employment Type" value={displayValue(payload.employmentType)} />
                <PreviewField label="Joined At" value={displayDate(payload.joinedAt)} />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-ink">Address</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <PreviewField label="Permanent Address" value={displayValue(payload.permanentAddress)} />
                <PreviewField label="Communication Address" value={displayValue(payload.communicationAddress)} />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-ink">Account & ID</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <PreviewField label="PAN" value={displayValue(payload.pan)} />
                <PreviewField label="Aadhaar" value={displayValue(payload.aadhaar)} />
                <PreviewField label="Passport" value={displayValue(payload.passport)} />
                <PreviewField label="Bank Name" value={displayValue(payload.bankName)} />
                <PreviewField label="Account Number" value={displayValue(payload.accountNumber)} />
                <PreviewField label="IFSC" value={displayValue(payload.ifsc)} />
                <PreviewField label="UAN" value={displayValue(payload.uan)} />
                <PreviewField label="PF / ESI" value={displayValue(payload.pfEsi)} />
                <PreviewField label="CTC" value={displayValue(payload.ctc)} />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-ink">Emergency Contact</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <PreviewField label="Name" value={emergency?.name} />
                <PreviewField label="Phone" value={emergency?.phone} />
                <PreviewField label="Email" value={emergency?.email} />
                <PreviewField label="Relation" value={emergency?.relation} />
                <PreviewField label="Address" value={emergency?.address} />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            className={cn('text-red-700 hover:text-red-800')}
            onClick={removeCurrentRow}
            disabled={!currentRow}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove This Employee
          </Button>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={importing}
              disabled={!validRows.length || invalidCount > 0}
              onClick={() => void handleImport()}
            >
              Import {validRows.length} Employee{validRows.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
