import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Trash2, UserPlus } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { DateInput } from '@components/shared/DateInput'
import { SelectField } from '@components/forms/SelectField'
import {
  createNotesDelegation,
  deleteNotesDelegation,
  listNotesDelegations,
  listTimesheetEmployees,
} from '@/services/notesService'
import { employeeDisplayName } from '@/services/analyticsService'
import type { NotesDelegation } from '@/types/notes'
import type { Employee } from '@/types'

type Props = {
  weekFrom: string
  weekTo: string
}

function formatDelegationDate(dateKey: string) {
  try {
    return format(parseISO(dateKey), 'EEE dd MMM yyyy')
  } catch {
    return dateKey
  }
}

export function NotesDelegationPanel({ weekFrom, weekTo }: Props) {
  const [delegations, setDelegations] = useState<NotesDelegation[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignDate, setAssignDate] = useState('')
  const [assignEmployeeId, setAssignEmployeeId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [items, employeeList] = await Promise.all([
        listNotesDelegations({ from: weekFrom, to: weekTo }),
        listTimesheetEmployees(),
      ])
      setDelegations(items)
      setEmployees(employeeList)
      setError(null)
    } catch {
      setError('Could not load notes assignments for this week.')
    } finally {
      setLoading(false)
    }
  }, [weekFrom, weekTo])

  useEffect(() => {
    void load()
  }, [load])

  const employeeOptions = useMemo(
    () =>
      [...employees]
        .map((employee) => ({
          value: employee.id,
          label: employeeDisplayName(employee),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [employees],
  )

  const handleAssign = async () => {
    if (!assignDate || !assignEmployeeId) {
      setError('Choose a date and employee to assign notes duty.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await createNotesDelegation(assignDate, assignEmployeeId)
      setAssignEmployeeId('')
      await load()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error || 'Could not assign notes delegate.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await deleteNotesDelegation(id)
      await load()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error || 'Could not remove assignment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="notes-delegation-panel" aria-label="Notes substitute assignments">
      <div className="notes-delegation-panel__head">
        <div>
          <h2 className="notes-delegation-panel__title">Assign notes substitute</h2>
          <p className="notes-delegation-panel__hint">
            Pick a date and employee when you are away. Only that employee can manage Daily Notes on
            that date.
          </p>
        </div>
      </div>

      <div className="notes-delegation-panel__form">
        <label className="notes-delegation-panel__field">
          <span className="notes-delegation-panel__label">Date</span>
          <DateInput value={assignDate} onChange={setAssignDate} disabled={busy} />
        </label>
        <SelectField
          label="Employee"
          value={assignEmployeeId}
          onChange={(event) => setAssignEmployeeId(event.target.value)}
          options={[{ value: '', label: 'Select employee…' }, ...employeeOptions]}
          disabled={busy || employeeOptions.length === 0}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<UserPlus className="h-3.5 w-3.5" />}
          disabled={busy || !assignDate || !assignEmployeeId}
          onClick={handleAssign}
        >
          Assign
        </Button>
      </div>

      {error ? <p className="notes-delegation-panel__error">{error}</p> : null}

      <div className="notes-delegation-panel__list-wrap">
        {loading ? (
          <p className="notes-delegation-panel__empty">Loading assignments…</p>
        ) : delegations.length === 0 ? (
          <p className="notes-delegation-panel__empty">No substitute assigned for this week.</p>
        ) : (
          <ul className="notes-delegation-panel__list">
            {delegations.map((item) => (
              <li key={item._id} className="notes-delegation-panel__item">
                <div className="notes-delegation-panel__item-main">
                  <span className="notes-delegation-panel__item-date">
                    {formatDelegationDate(item.date)}
                  </span>
                  <span className="notes-delegation-panel__item-employee">{item.employeeName}</span>
                </div>
                <button
                  type="button"
                  className="notes-delegation-panel__remove"
                  disabled={busy}
                  onClick={() => void handleRemove(item._id)}
                  aria-label={`Remove assignment for ${item.employeeName} on ${item.date}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
