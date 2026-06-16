import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@components/ui/Button'
import type { DailyNoteStatus, NoteSearchResult } from '@/types/notes'
import { highlightPlainText } from '@/utils/notesHighlight'
import type { NotesSearchFilters } from '@/utils/notesSearchParams'
import { formatDailyBlockTitle } from '@/utils/notesWeek'
import { parseISO } from 'date-fns'

function deliveryStatusLabel(status: DailyNoteStatus) {
  return status === 'email_sent' ? 'Email sent' : 'Not sent'
}

const MATCH_LABELS: Record<NoteSearchResult['matchedFields'][number], string> = {
  date: 'Date',
  title: 'Title',
  project: 'Project',
  employee: 'Employee',
  description: 'Description',
}

type ToolbarProps = {
  filters: NotesSearchFilters
  onFiltersChange: (filters: NotesSearchFilters) => void
  onQueryChange: (q: string) => void
}

export function NotesSearchToolbar({ filters, onFiltersChange, onQueryChange }: ToolbarProps) {
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
    <div className="admin-notes-search__toolbar">
      <div className="admin-notes-search__query-wrap">
        <Search className="admin-notes-search__query-icon" />
        <input
          type="search"
          value={queryDraft}
          onChange={(e) => setQueryDraft(e.target.value)}
          placeholder="Search date, title, project, employee, or description…"
          className="admin-notes-search__query"
          aria-label="Search notes"
        />
      </div>
      <label className="admin-notes-search__filter">
        <span className="admin-notes-search__filter-label">From</span>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => updateFilter('from', e.target.value)}
          className="admin-notes-search__filter-input"
        />
      </label>
      <label className="admin-notes-search__filter">
        <span className="admin-notes-search__filter-label">To</span>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => updateFilter('to', e.target.value)}
          className="admin-notes-search__filter-input"
        />
      </label>
    </div>
  )
}

type ResultsProps = {
  filters: NotesSearchFilters
  results: NoteSearchResult[]
  total: number
  page: number
  hasMore: boolean
  loading: boolean
  onPageChange: (page: number) => void
  onOpenResult: (result: NoteSearchResult) => void
}

export function NotesSearchResults({
  filters,
  results,
  total,
  page,
  hasMore,
  loading,
  onPageChange,
  onOpenResult,
}: ResultsProps) {
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 25)), [total])

  return (
    <section className="admin-notes-search admin-notes-search--results" aria-label="Search results">
      <div className="admin-notes-search__results">
        <div className="admin-notes-search__results-head">
          <h2 className="admin-notes-search__results-title">
            Search results
            <span className="admin-notes-search__results-count">{total} matches</span>
          </h2>
          {loading ? <span className="text-sm text-muted">Searching…</span> : null}
        </div>

        {results.length === 0 && !loading ? (
          <p className="admin-notes-search__empty">No notes matched your search or filters.</p>
        ) : (
          <ul className="admin-notes-search__results-list">
            {results.map((result) => (
              <li key={`${result.dailyBlockId}-${result.childBlockId}`}>
                <button
                  type="button"
                  className="admin-notes-search__result"
                  onClick={() => onOpenResult(result)}
                >
                  <div className="admin-notes-search__result-top">
                    <span className="admin-notes-search__result-date">
                      {highlightPlainText(formatDailyBlockTitle(parseISO(result.date)), filters.q)}
                    </span>
                    <span className={`admin-notes-status admin-notes-status--${result.dailyBlockStatus}`}>
                      {deliveryStatusLabel(result.dailyBlockStatus)}
                    </span>
                  </div>
                  <p className="admin-notes-search__result-title">
                    {highlightPlainText(result.childTitle, filters.q)}
                  </p>
                  <div className="admin-notes-search__result-meta">
                    {result.projectName ? (
                      <span>{highlightPlainText(result.projectName, filters.q)}</span>
                    ) : null}
                    {result.employeeNames.length > 0 ? (
                      <span>{highlightPlainText(result.employeeNames.join(', '), filters.q)}</span>
                    ) : null}
                  </div>
                  {result.descriptionSnippet ? (
                    <p className="admin-notes-search__result-snippet">
                      {highlightPlainText(result.descriptionSnippet, filters.q)}
                    </p>
                  ) : null}
                  {result.matchedFields.length > 0 ? (
                    <div className="admin-notes-search__result-tags">
                      {result.matchedFields.map((field) => (
                        <span key={field} className="admin-notes-search__result-tag">
                          {MATCH_LABELS[field]}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        {total > 25 ? (
          <div className="admin-notes-search__pagination">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="admin-notes-search__pagination-label">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!hasMore || loading}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

type Props = ToolbarProps & ResultsProps & { showResults: boolean }

export function NotesSearchPanel({
  filters,
  onFiltersChange,
  onQueryChange,
  results,
  total,
  page,
  hasMore,
  loading,
  showResults,
  onPageChange,
  onOpenResult,
}: Props) {
  return (
    <>
      <NotesSearchToolbar
        filters={filters}
        onFiltersChange={onFiltersChange}
        onQueryChange={onQueryChange}
      />
      {showResults ? (
        <NotesSearchResults
          filters={filters}
          results={results}
          total={total}
          page={page}
          hasMore={hasMore}
          loading={loading}
          onPageChange={onPageChange}
          onOpenResult={onOpenResult}
        />
      ) : null}
    </>
  )
}
