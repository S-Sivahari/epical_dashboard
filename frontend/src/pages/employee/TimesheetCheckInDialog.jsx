import { useEffect, useState } from 'react'
import { LogIn } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/employee/ui/dialog'
import { fetchStartableCells } from '@services/employeeTimesheetService'

const NO_CELL_VALUE = '__none__'

export function TimesheetCheckInDialog({
  open,
  onOpenChange,
  selectedTaskId,
  onTaskChange,
  selectedCellId,
  onCellChange,
  description,
  onDescriptionChange,
  descriptionError,
  taskError,
  startableTasks,
  selectedTask,
  submitting,
  onCheckIn,
}) {
  const [startableCells, setStartableCells] = useState([])
  const [cellsLoading, setCellsLoading] = useState(false)

  useEffect(() => {
    if (!open || !selectedTaskId) {
      setStartableCells([])
      return undefined
    }

    let active = true
    setCellsLoading(true)
    void fetchStartableCells(selectedTaskId)
      .then((data) => {
        if (!active) return
        setStartableCells(Array.isArray(data?.cells) ? data.cells : [])
      })
      .catch(() => {
        if (!active) return
        setStartableCells([])
      })
      .finally(() => {
        if (active) setCellsLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, selectedTaskId])

  useEffect(() => {
    if (!selectedCellId || selectedCellId === NO_CELL_VALUE) return
    if (!startableCells.some((cell) => cell.id === selectedCellId)) {
      onCellChange(NO_CELL_VALUE)
    }
  }, [selectedCellId, startableCells, onCellChange])

  const cellSelectValue = selectedCellId || NO_CELL_VALUE

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="emp-timesheet-checkin-dialog max-w-xl gap-5 p-6 sm:p-7">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-xl">Check in</DialogTitle>
          <DialogDescription className="text-sm">
            Select your assigned project and optionally start cell work at the same time. Project check-in and cell
            timers run independently.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-800">Assigned Project *</Label>
            <Select
              value={selectedTaskId}
              onValueChange={onTaskChange}
              disabled={submitting || startableTasks.length === 0}
            >
              <SelectTrigger className="h-11 text-sm">
                <SelectValue
                  placeholder={
                    startableTasks.length === 0
                      ? 'No projects assigned — contact admin'
                      : 'Select assigned project'
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-[240px] overflow-y-auto">
                {startableTasks.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-sm">
                    {t.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {taskError ? <p className="text-sm text-danger">{taskError}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-800">Cell (optional)</Label>
            <Select
              value={cellSelectValue}
              onValueChange={onCellChange}
              disabled={submitting || !selectedTaskId || cellsLoading}
            >
              <SelectTrigger className="h-11 text-sm">
                <SelectValue
                  placeholder={
                    cellsLoading
                      ? 'Loading your cells…'
                      : startableCells.length === 0
                        ? 'No startable cells for this project'
                        : 'Start project only (no cell)'
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-[240px] overflow-y-auto">
                <SelectItem value={NO_CELL_VALUE} className="text-sm">
                  Project check-in only
                </SelectItem>
                {startableCells.map((cell) => (
                  <SelectItem key={cell.id} value={cell.id} className="text-sm">
                    {cell.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted">
              Choose a cell to begin productive cell time together with project check-in, or leave as project-only and
              start a cell later from Projects.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-800">Work Description</Label>
            <Textarea
              className="min-h-[7rem] resize-y text-sm leading-relaxed"
              rows={4}
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Describe what you're working on..."
              disabled={submitting}
            />
            {descriptionError ? <p className="text-sm text-danger">{descriptionError}</p> : null}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-10 px-5 text-sm"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCheckIn}
              disabled={submitting || startableTasks.length === 0}
              className="emp-ts-btn-primary h-10 gap-2 px-5 text-sm"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              {cellSelectValue !== NO_CELL_VALUE ? 'Check In & Start Cell' : 'Check In'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
