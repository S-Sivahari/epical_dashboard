import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { toast } from 'sonner'
import { overrideTimesheetLog } from '@/services/projectSyncService'

export interface TimesheetLogEntry {
  id: string
  projectId?: string
  project: string
  client?: string
  technologyNode?: string
  employeeName: string
  employeeId?: string
  task: string
  loginTime: string
  logoutTime?: string
  billable?: boolean
  adminNotes?: string
}

const toDatetimeLocal = (isoString?: string): string => {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TimesheetLogOverrideModal({
  isOpen,
  onClose,
  entry,
  defaultProjectId,
  projectName,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  entry: TimesheetLogEntry
  defaultProjectId: string
  projectName: string
  onSaved?: () => void | Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employeeKey: '',
    projectId: '',
    loginTime: '',
    logoutTime: '',
    completeSession: true,
    billable: true,
    taskNotes: '',
  })

  useEffect(() => {
    if (!isOpen) return
    setForm({
      employeeKey: entry.employeeId || entry.employeeName,
      projectId: entry.projectId || defaultProjectId,
      loginTime: toDatetimeLocal(entry.loginTime),
      logoutTime: toDatetimeLocal(entry.logoutTime),
      completeSession: !!entry.logoutTime,
      billable: entry.billable !== false,
      taskNotes: entry.adminNotes?.trim() ? `${entry.task}\n\n${entry.adminNotes}` : entry.task || '',
    })
  }, [entry, isOpen, defaultProjectId])

  const employeeOptions = useMemo(() => {
    const value = entry.employeeId || entry.employeeName || entry.id
    const label = entry.employeeName || 'Unknown employee'
    return [{ value, label }]
  }, [entry])

  const projectLabel = useMemo(() => {
    const parts = [entry.project || projectName]
    if (entry.client) parts.push(entry.client)
    if (entry.technologyNode) parts.push(entry.technologyNode)
    if (parts.length === 1) return parts[0]
    if (parts.length === 3) return `${parts[0]} (${parts[1]} - ${parts[2]})`
    return parts.join(' · ')
  }, [entry, projectName])

  const projectOptions = useMemo(
    () => [{ value: entry.projectId || defaultProjectId, label: projectLabel }],
    [entry, defaultProjectId, projectLabel]
  )

  const handleSubmit = async () => {
    if (!form.loginTime) {
      toast.error('Login time is required.')
      return
    }
    if (form.completeSession && !form.logoutTime) {
      toast.error('Logout time is required when complete session is checked.')
      return
    }

    const loginISO = new Date(form.loginTime).toISOString()
    const logoutISO = form.completeSession && form.logoutTime ? new Date(form.logoutTime).toISOString() : null

    if (logoutISO && logoutISO < loginISO) {
      toast.error('Logout time cannot be earlier than login time.')
      return
    }

    setSaving(true)
    try {
      await overrideTimesheetLog(entry.id, {
        loginTime: loginISO,
        logoutTime: logoutISO,
        task: form.taskNotes.trim(),
        billable: form.billable,
        adminNotes: null,
      })
      toast.success('Log override saved')
      await onSaved?.()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Failed to save log override')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close override dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-log-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="override-log-title" className="font-display text-lg font-semibold text-ink">
            Override Time Log
          </h2>
          <button
            type="button"
            className="rounded-lg p-1 text-muted hover:bg-surface hover:text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      <div className="space-y-4">
        <SelectField
          label="Log Employee"
          value={form.employeeKey}
          onChange={(e) => setForm((f) => ({ ...f, employeeKey: e.target.value }))}
          options={employeeOptions}
          disabled
        />

        <SelectField
          label="Assigned Project"
          value={form.projectId}
          onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
          options={projectOptions}
          disabled
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="datetime-local"
            label="Login Time"
            required
            value={form.loginTime}
            onChange={(e) => setForm((f) => ({ ...f, loginTime: e.target.value }))}
          />
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={form.completeSession}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    completeSession: e.target.checked,
                    logoutTime: e.target.checked ? f.logoutTime : '',
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Complete Session
              </span>
            </label>
            <Input
              type="datetime-local"
              label="Logout Time"
              value={form.logoutTime}
              disabled={!form.completeSession}
              onChange={(e) => setForm((f) => ({ ...f, logoutTime: e.target.value }))}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={form.billable}
            onChange={(e) => setForm((f) => ({ ...f, billable: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
          />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Billable to Client
          </span>
        </label>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
            Task Work Description / Override Notes
          </label>
          <textarea
            rows={4}
            value={form.taskNotes}
            onChange={(e) => setForm((f) => ({ ...f, taskNotes: e.target.value }))}
            placeholder="Describe tasks and details logged by override..."
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="primary" loading={saving} onClick={() => void handleSubmit()}>
            Log Override
          </Button>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  )
}
