import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { parseISO } from 'date-fns'
import { NotebookPen, Plus } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { DailyNotesEmailModal } from '@components/notes/DailyNotesEmailModal'
import { DailyNotesNotepad } from '@components/notes/DailyNotesNotepad'
import { NotesDashboardToolbar } from '@components/notes/NotesDashboardToolbar'
import { NotesSearchResults } from '@components/notes/NotesSearchPanel'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import { ROUTES } from '@/constants/routes'
import {
  getOrCreateDailyBlock,
  listDailyBlocksInRange,
  searchNotes,
} from '@/services/notesService'
import type { DailyNoteBlock, NoteProjectOption, NoteSearchResult } from '@/types/notes'
import type { Employee } from '@/types'
import {
  loadNotesProjectContext,
  needsPerEmployeeNormalization,
  normalizePerEmployeeEntries,
} from '@/utils/notesBootstrap'
import {
  EMPTY_NOTES_SEARCH,
  hasActiveNotesSearch,
  readNotesSearchFromParams,
  readWeekViewFromParams,
  writeNotesSearchToParams,
  type NotesSearchFilters,
} from '@/utils/notesSearchParams'
import {
  buildWeekDays,
  formatWeekRangeLabel,
  getMondayOfWeek,
  getWorkingWeekdays,
  isCurrentWorkingWeek,
  shiftWeek,
  toDateKey,
} from '@/utils/notesWeek'
import './admin-notes.css'

export function AdminNotesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const legacyDateKey = searchParams.get('focus')

  const [weekMonday, setWeekMonday] = useState(
    () => readWeekViewFromParams(searchParams) ?? getMondayOfWeek(new Date()),
  )
  const [blocksByDate, setBlocksByDate] = useState<Record<string, DailyNoteBlock>>({})
  const [projects, setProjects] = useState<NoteProjectOption[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<TopNotice | null>(null)
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null)
  const [highlightDateKey, setHighlightDateKey] = useState<string | null>(null)
  const [emailBlock, setEmailBlock] = useState<DailyNoteBlock | null>(null)

  const [searchFilters, setSearchFilters] = useState<NotesSearchFilters>(() =>
    readNotesSearchFromParams(searchParams),
  )
  const [searchResults, setSearchResults] = useState<NoteSearchResult[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchPage, setSearchPage] = useState(1)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [normalizingBlocks, setNormalizingBlocks] = useState(false)
  const normalizedBlockSignatures = useRef<Set<string>>(new Set())

  const showSearchResults = hasActiveNotesSearch(searchFilters)
  const weekdays = useMemo(() => getWorkingWeekdays(weekMonday), [weekMonday])
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekMonday), [weekMonday])
  const isCurrentWeek = useMemo(() => isCurrentWorkingWeek(weekMonday), [weekMonday])

  const syncUrl = useCallback(
    (filters: NotesSearchFilters, weekView: Date) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        writeNotesSearchToParams(next, filters, weekView)
        return next.toString() === current.toString() ? current : next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const loadWeek = useCallback(async () => {
    const from = toDateKey(weekdays[0])
    const to = toDateKey(weekdays[weekdays.length - 1])
    setLoading(true)
    try {
      const items = await listDailyBlocksInRange(from, to)
      const map: Record<string, DailyNoteBlock> = {}
      items.forEach((item) => {
        map[item.date] = item
      })
      setBlocksByDate(map)
    } catch {
      setNotice({
        kind: 'error',
        title: 'Failed to load notes',
        details: ['Could not load notes for this week.'],
      })
    } finally {
      setLoading(false)
    }
  }, [weekdays])

  const runSearch = useCallback(async (filters: NotesSearchFilters, page: number) => {
    if (!hasActiveNotesSearch(filters)) {
      setSearchResults([])
      setSearchTotal(0)
      setSearchHasMore(false)
      return
    }

    setSearchLoading(true)
    try {
      const response = await searchNotes({
        q: filters.q.trim() || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page,
        limit: 25,
      })
      setSearchResults(response.results)
      setSearchTotal(response.total)
      setSearchPage(response.page)
      setSearchHasMore(response.hasMore)
    } catch {
      setNotice({ kind: 'error', title: 'Search failed', details: ['Could not search notes.'] })
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadWeek()
  }, [loadWeek])

  useEffect(() => {
    if (loading || normalizingBlocks) return

    const blocksToFix = Object.values(blocksByDate).filter((block) => {
      if (!needsPerEmployeeNormalization(block)) return false
      const signature = `${block._id}:${block.updatedAt}`
      return !normalizedBlockSignatures.current.has(signature)
    })
    if (blocksToFix.length === 0) return

    setNormalizingBlocks(true)
    void (async () => {
      try {
        const updates: Record<string, DailyNoteBlock> = {}
        for (const block of blocksToFix) {
          const signature = `${block._id}:${block.updatedAt}`
          normalizedBlockSignatures.current.add(signature)
          updates[block.date] = await normalizePerEmployeeEntries(block)
        }
        setBlocksByDate((prev) => ({ ...prev, ...updates }))
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string } } }
        const message =
          axiosErr.response?.data?.error || 'Could not split project entries into per-employee boxes.'
        setNotice({ kind: 'error', title: 'Notes layout update failed', details: [message] })
      } finally {
        setNormalizingBlocks(false)
      }
    })()
  }, [blocksByDate, loading, normalizingBlocks])

  useEffect(() => {
    syncUrl(searchFilters, weekMonday)
  }, [searchFilters, weekMonday, syncUrl])

  useEffect(() => {
    void runSearch(searchFilters, searchPage)
  }, [searchFilters, searchPage, runSearch])

  useEffect(() => {
    void loadNotesProjectContext()
      .then(({ projects: projectList, employees: employeeList }) => {
        setProjects(projectList)
        setEmployees(employeeList)
      })
      .catch(() => {
        setNotice({
          kind: 'error',
          title: 'Projects failed to load',
          details: ['Could not load projects and employees from the timesheet workspace.'],
        })
      })
  }, [])

  useEffect(() => {
    if (!legacyDateKey) return
    setHighlightDateKey(legacyDateKey)
    const timer = window.setTimeout(() => {
      document.getElementById(`notes-day-${legacyDateKey}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [legacyDateKey, loading])

  const handleFiltersChange = useCallback((filters: NotesSearchFilters) => {
    setSearchFilters(filters)
    setSearchPage(1)
  }, [])

  const handleQueryChange = useCallback((q: string) => {
    setSearchFilters((current) => (current.q === q ? current : { ...current, q }))
    setSearchPage(1)
  }, [])

  const handleWeekChange = (nextMonday: Date) => {
    setWeekMonday(nextMonday)
    setEditingDateKey(null)
  }

  const handleOpenSearchResult = (result: NoteSearchResult) => {
    const monday = getMondayOfWeek(new Date(result.date))
    setWeekMonday(monday)
    setHighlightDateKey(result.date)
    setSearchFilters(EMPTY_NOTES_SEARCH)
    setSearchPage(1)
    window.setTimeout(() => {
      document.getElementById(`notes-day-${result.date}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 350)
  }

  const handleBlockChange = (dateKey: string, block: DailyNoteBlock) => {
    setBlocksByDate((prev) => ({ ...prev, [dateKey]: block }))
    if (emailBlock?._id === block._id) setEmailBlock(block)
  }

  const handleAddTodayNotes = async () => {
    setBusy(true)
    try {
      const today = new Date()
      const todayDateKey = toDateKey(today)
      setWeekMonday(getMondayOfWeek(today))

      const block = await getOrCreateDailyBlock(todayDateKey)
      setBlocksByDate((prev) => ({ ...prev, [todayDateKey]: block }))
      setEditingDateKey(todayDateKey)
      setHighlightDateKey(todayDateKey)
      setNotice({
        kind: 'success',
        title: "Today's notepad ready",
        details: [
          block.childBlocks.filter((child) => !child.archived).length > 0
            ? "Today's notepad is open. Use Add note to record more updates."
            : 'A blank notepad is ready. Use Add note to record project updates.',
        ],
      })
      window.setTimeout(() => {
        document.getElementById(`notes-day-${todayDateKey}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 120)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      const message = axiosErr.response?.data?.error || 'Failed to prepare today\'s notes'
      setNotice({ kind: 'error', title: 'Could not add notes', details: [message] })
    } finally {
      setBusy(false)
    }
  }

  const weekDays = useMemo(
    () => buildWeekDays(weekMonday, blocksByDate),
    [weekMonday, blocksByDate],
  )

  const canAddToday = isCurrentWeek && !busy

  return (
    <PageWrapper
      fillViewport
      className="admin-hub-page-wrap admin-notes-page-wrap relative z-10 max-w-none !px-0 !py-0 font-body"
    >
      <div className="crewiq-dashboard admin-notes-page relative flex min-h-0 flex-1 flex-col overflow-hidden" data-admin-notes>
        <div className="dashboard-page-bg pointer-events-none" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-notes-shell relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="admin-notes-header admin-notes-header--single shrink-0">
            <div className="admin-notes-header__title-wrap">
              <span className="admin-notes-header__icon" aria-hidden>
                <NotebookPen className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h1 className="admin-notes-header__title">Daily Notes</h1>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              disabled={!canAddToday}
              onClick={handleAddTodayNotes}
            >
              Add today&apos;s notes
            </Button>
          </header>

          <NotesDashboardToolbar
            weekLabel={weekLabel}
            isCurrentWeek={isCurrentWeek}
            filters={searchFilters}
            onWeekPrevious={() => handleWeekChange(shiftWeek(weekMonday, -1))}
            onWeekNext={() => handleWeekChange(shiftWeek(weekMonday, 1))}
            onWeekCurrent={() => handleWeekChange(getMondayOfWeek(new Date()))}
            onFiltersChange={handleFiltersChange}
            onQueryChange={handleQueryChange}
          />

          <div className="admin-notes-scroll-body timesheet-panel-scroll">
            {showSearchResults ? (
              <NotesSearchResults
                filters={searchFilters}
                results={searchResults}
                total={searchTotal}
                page={searchPage}
                hasMore={searchHasMore}
                loading={searchLoading}
                onPageChange={setSearchPage}
                onOpenResult={handleOpenSearchResult}
              />
            ) : null}

            <section className="notes-week-board" aria-label={`Notes for ${weekLabel}`}>
              {loading ? (
                <div className="notes-week-feed__loading" aria-busy="true">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="admin-notes-skeleton admin-notes-skeleton--panel notes-notepad-skeleton" />
                  ))}
                </div>
              ) : (
                <div className="notes-week-feed">
                  {weekDays.map(({ date, dateKey, block }) => (
                  <DailyNotesNotepad
                    key={dateKey}
                    date={date}
                    dateKey={dateKey}
                    block={block}
                    projects={projects}
                    employees={employees}
                    highlighted={highlightDateKey === dateKey}
                    busy={busy}
                    defaultExpanded={editingDateKey === dateKey || highlightDateKey === dateKey}
                    onBlockChange={(updated) => handleBlockChange(dateKey, updated)}
                    onSendEmail={setEmailBlock}
                    onError={(message) => {
                      setNotice({ kind: 'error', title: 'Could not save note', details: [message] })
                    }}
                  />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <TopDismissNotice notice={notice} onDismiss={() => setNotice(null)} />

      {emailBlock ? (
        <DailyNotesEmailModal
          block={emailBlock}
          isOpen
          onClose={() => setEmailBlock(null)}
          onSent={(result) => {
            handleBlockChange(result.block.date, result.block)
            setEmailBlock(null)
            const detail =
              result.delivery.deliveryStatus === 'partial'
                ? `Delivered to ${result.delivery.successCount} of ${result.delivery.recipientCount} recipients.`
                : `Delivered to ${result.delivery.recipientCount} recipient${result.delivery.recipientCount === 1 ? '' : 's'}.`
            setNotice({
              kind: result.delivery.deliveryStatus === 'failed' ? 'error' : 'success',
              title:
                result.delivery.deliveryStatus === 'failed'
                  ? 'Email delivery failed'
                  : 'Daily notes email sent',
              details: [detail],
            })
          }}
          onError={(message) => {
            setNotice({ kind: 'error', title: 'Email failed', details: [message] })
          }}
        />
      ) : null}
    </PageWrapper>
  )
}

export function AdminNotesDayRedirect() {
  const { dateKey = '' } = useParams<{ dateKey: string }>()
  if (!dateKey) return <Navigate to={ROUTES.NOTES} replace />
  try {
    const monday = toDateKey(getMondayOfWeek(parseISO(dateKey)))
    return <Navigate to={`${ROUTES.NOTES}?week=${monday}&focus=${dateKey}`} replace />
  } catch {
    return <Navigate to={ROUTES.NOTES} replace />
  }
}

export default AdminNotesPage
