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
  embedded?: boolean
}

function formatDelegationDate(dateKey: string) {
  try {
    return format(parseISO(dateKey), 'EEE d MMM')
  } catch {
    return dateKey
  }
}

export function NotesDelegationPanel({ weekFrom, weekTo, embedded = false }: Props) {
  const [delegations, setDelegations] = useState<NotesDelegation[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignFrom, setAssignFrom] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [assignEmployeeId, setAssignEmployeeId] = useState('')

  const handleRangeChange = (from: string, to: string) => {
    setAssignFrom(from)
    setAssignTo(to)
  }

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
    if (!assignFrom || !assignEmployeeId) {
      setError('Choose a date range and employee to assign notes duty.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const to = assignTo && assignTo !== assignFrom ? assignTo : undefined
      await createNotesDelegation(assignFrom, assignEmployeeId, to)
      setAssignFrom('')
      setAssignTo('')
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

  const assignForm = (
    <>
      <label className="notes-delegation-panel__field notes-delegation-panel__field--dates">
        {!embedded ? <span className="notes-delegation-panel__label">Dates</span> : null}
        <DateInput
          selectionMode="range"
          rangeFrom={assignFrom}
          rangeTo={assignTo}
          onRangeChange={handleRangeChange}
          disabled={busy}
          placeholder={embedded ? 'Dates…' : undefined}
          className={embedded ? 'notes-delegation-panel__compact-input' : undefined}
          aria-label="Substitute dates"
        />
      </label>
      <div className="notes-delegation-panel__field notes-delegation-panel__field--employee">
        <SelectField
          label={embedded ? undefined : 'Employee'}
          value={assignEmployeeId}
          onChange={(event) => setAssignEmployeeId(event.target.value)}
          options={[{ value: '', label: 'Select employee…' }, ...employeeOptions]}
          disabled={busy || employeeOptions.length === 0}
          showChevron
          className={embedded ? 'notes-delegation-panel__compact-input' : undefined}
          aria-label="Substitute employee"
        />
      </div>
      <div className="notes-delegation-panel__assign">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<UserPlus className="h-3.5 w-3.5" />}
          disabled={busy || !assignFrom || !assignEmployeeId}
          onClick={handleAssign}
        >
          Assign
        </Button>
      </div>
    </>
  )

  const assignMeta = (
    <>
      {error ? <p className="notes-delegation-panel__error">{error}</p> : null}
      {loading ? (
        <span className="notes-delegation-panel__empty">…</span>
      ) : delegations.length > 0 ? (
        <ul className="notes-delegation-panel__list">
          {delegations.map((item) => (
            <li key={item._id} className="notes-delegation-panel__item">
              <span className="notes-delegation-panel__item-date">
                {formatDelegationDate(item.date)}
              </span>
              <span className="notes-delegation-panel__item-sep" aria-hidden>
                ·
              </span>
              <span className="notes-delegation-panel__item-employee">{item.employeeName}</span>
              <button
                type="button"
                className="notes-delegation-panel__remove"
                disabled={busy}
                onClick={() => void handleRemove(item._id)}
                aria-label={`Remove assignment for ${item.employeeName} on ${item.date}`}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : embedded ? null : (
        <p className="notes-delegation-panel__empty">No substitute assigned for this week.</p>
      )}
    </>
  )

  if (embedded) {
    const showMeta = Boolean(error) || loading || delegations.length > 0

    return (
      <section
        className="notes-delegation-panel notes-delegation-panel--embedded"
        aria-label="Notes substitute assignments"
      >
        <div className="notes-delegation-panel__controls-row">
          <span
            className="notes-delegation-panel__inline-label"
            title="Assign notes substitute. Shift+click the calendar to select a date range."
          >
            Substitute
          </span>
          <div className="notes-delegation-panel__form">{assignForm}</div>
        </div>
        {showMeta ? <div className="notes-delegation-panel__meta">{assignMeta}</div> : null}
      </section>
    )
  }

  return (
    <section className="notes-delegation-panel" aria-label="Notes substitute assignments">
      <div className="notes-delegation-panel__body">
        <div className="notes-delegation-panel__head">
          <h2 className="notes-delegation-panel__title">Assign notes substitute</h2>
          <p className="notes-delegation-panel__hint">
            Choose dates and an employee. Shift+click the calendar to select a range.
          </p>
        </div>
        <div className="notes-delegation-panel__form">{assignForm}</div>
      </div>
      <div className="notes-delegation-panel__meta">{assignMeta}</div>
    </section>
  )
}
