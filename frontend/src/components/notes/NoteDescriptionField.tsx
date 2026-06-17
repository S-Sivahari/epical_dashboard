import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'

export type NoteDescriptionMode = 'paragraph' | 'points'

type Props = {
  mode: NoteDescriptionMode
  onModeChange: (mode: NoteDescriptionMode) => void
  paragraphValue: string
  onParagraphChange: (value: string) => void
  points: string[]
  onPointsChange: (points: string[]) => void
}

export function NoteDescriptionField({
  mode,
  onModeChange,
  paragraphValue,
  onParagraphChange,
  points,
  onPointsChange,
}: Props) {
  const updatePoint = (index: number, value: string) => {
    onPointsChange(points.map((point, i) => (i === index ? value : point)))
  }

  const addPoint = () => {
    onPointsChange([...points, ''])
  }

  const removePoint = (index: number) => {
    onPointsChange(points.filter((_, i) => i !== index))
  }

  return (
    <div className="add-note-modal__description note-description-field">
      <div className="note-description-field__head">
        <span className="admin-notes-field__label">Description</span>
        <div className="note-description-field__toggle" role="group" aria-label="Description format">
          <button
            type="button"
            className={cn(
              'note-description-field__toggle-btn',
              mode === 'paragraph' && 'note-description-field__toggle-btn--active',
            )}
            onClick={() => onModeChange('paragraph')}
          >
            Paragraph
          </button>
          <button
            type="button"
            className={cn(
              'note-description-field__toggle-btn',
              mode === 'points' && 'note-description-field__toggle-btn--active',
            )}
            onClick={() => onModeChange('points')}
          >
            Points
          </button>
        </div>
      </div>

      {mode === 'paragraph' ? (
        <textarea
          value={paragraphValue}
          onChange={(e) => onParagraphChange(e.target.value)}
          placeholder="Enter work updates as a paragraph…"
          rows={5}
          className="add-note-modal__textarea"
        />
      ) : (
        <div className="note-description-field__points">
          {points.length === 0 ? (
            <p className="note-description-field__points-empty">No points yet. Add the first point below.</p>
          ) : (
            <ul className="note-description-field__points-list">
              {points.map((point, index) => (
                <li key={index} className="note-description-field__point-row">
                  <span className="note-description-field__point-index" aria-hidden>{index + 1}.</span>
                  <input
                    type="text"
                    value={point}
                    onChange={(e) => updatePoint(index, e.target.value)}
                    placeholder="Enter a point…"
                    className="note-description-field__point-input"
                  />
                  <button
                    type="button"
                    className="note-description-field__point-remove"
                    onClick={() => removePoint(index)}
                    aria-label={`Remove point ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={addPoint}
          >
            Add point
          </Button>
        </div>
      )}
    </div>
  )
}
