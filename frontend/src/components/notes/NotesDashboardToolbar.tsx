import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@components/ui/Button'
import type { NotesSearchFilters } from '@/utils/notesSearchParams'

type Props = {
  weekLabel: string
  isCurrentWeek: boolean
  filters: NotesSearchFilters
  onWeekPrevious: () => void
  onWeekNext: () => void
  onWeekCurrent: () => void
  onFiltersChange: (filters: NotesSearchFilters) => void
  onQueryChange: (q: string) => void
  hideSearch?: boolean
  hideWeekNav?: boolean
  trailingAction?: ReactNode
}

export function NotesDashboardToolbar({
  weekLabel,
  isCurrentWeek,
  filters,
  onWeekPrevious,
  onWeekNext,
  onWeekCurrent,
  onFiltersChange,
  onQueryChange,
  hideSearch = false,
  hideWeekNav = false,
  trailingAction,
}: Props) {
  const [queryDraft, setQueryDraft] = useState(filters.q)

  useEffect(() => {
    setQueryDraft(filters.q)
  }, [filters.q])

  useEffect(() => {
    const timer = window.setTimeout(() => onQueryChange(queryDraft), 300)
    return () => window.clearTimeout(timer)
  }, [queryDraft, onQueryChange])

  const updateFilter = <K extends keyof NotesSearchFilters>(key: K, value: NotesSearchFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="notes-toolbar" role="toolbar" aria-label="Notes filters and navigation">
      {!hideSearch ? (
        <div className="notes-toolbar__search">
          <Search className="notes-toolbar__search-icon" aria-hidden />
          <input
            type="search"
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            placeholder="Search notes…"
            className="notes-toolbar__search-input"
            aria-label="Search notes"
          />
        </div>
      ) : null}

      {!hideWeekNav ? (
        <div className="notes-toolbar__week">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<ChevronLeft className="h-4 w-4" />}
            onClick={onWeekPrevious}
            aria-label="Previous week"
          />
          <div className="notes-toolbar__week-label">
            <span>{weekLabel}</span>
            {isCurrentWeek ? <span className="notes-toolbar__week-pill">Current</span> : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<ChevronRight className="h-4 w-4" />}
            disabled={isCurrentWeek}
            onClick={onWeekNext}
            aria-label="Next week"
          />
          {!isCurrentWeek ? (
            <Button type="button" size="sm" variant="secondary" onClick={onWeekCurrent}>
              Today
            </Button>
          ) : null}
        </div>
      ) : null}

      {!hideSearch ? (
        <div className="notes-toolbar__dates">
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter('from', e.target.value)}
            className="notes-toolbar__date"
            aria-label="From date"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter('to', e.target.value)}
            className="notes-toolbar__date"
            aria-label="To date"
          />
        </div>
      ) : null}

      {trailingAction ? (
        <div className="notes-toolbar__trailing">{trailingAction}</div>
      ) : null}
    </div>
  )
}
