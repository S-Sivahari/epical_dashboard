import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { format, parseISO, subDays } from 'date-fns'
import { NotebookPen, Plus } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { DailyNotesEmailModal } from '@components/notes/DailyNotesEmailModal'
import { DailyNotesNotepad } from '@components/notes/DailyNotesNotepad'
import { NotesDashboardToolbar } from '@components/notes/NotesDashboardToolbar'
import { NotesSearchResults } from '@components/notes/NotesSearchPanel'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import { ROUTES } from '@/constants/routes'
import { isProjectAnalysisAdminPath } from '@pages/admin/Projects/projectPortal'
import { NotesDelegationPanel } from '@components/notes/NotesDelegationPanel'
import {
  deleteDailyBlock,
  getOrCreateDailyBlock,
  getNotesAccess,
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
  formatWeekRangeLabel,
  getMondayOfWeek,
  getWorkingWeekdays,
  isCurrentWorkingWeek,
  isPastNotesDay,
  shiftWeek,
  toDateKey,
} from '@/utils/notesWeek'
import { cn } from '@/utils/cn'
import './admin-notes.css'

type DailyNotesPageProps = {
  variant?: 'admin' | 'employee'
}

export function AdminNotesPage({ variant = 'admin' }: DailyNotesPageProps) {
  const { pathname } = useLocation()
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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
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
  const [delegatedDateKeys, setDelegatedDateKeys] = useState<ReadonlySet<string>>(new Set())
  const [autoOpenAddNoteFor, setAutoOpenAddNoteFor] = useState<string | null>(null)

  const isEmployeeView = variant === 'employee'
  const inProjectManagement = !isEmployeeView && isProjectAnalysisAdminPath(pathname)

  const showSearchResults = hasActiveNotesSearch(searchFilters)
  const weekdays = useMemo(() => getWorkingWeekdays(weekMonday), [weekMonday])
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekMonday), [weekMonday])
  const isCurrentWeek = useMemo(() => isCurrentWorkingWeek(weekMonday), [weekMonday])

  // Last 10 calendar days ending today (no future dates)
  const last10Days = useMemo(() => {
    const days: Date[] = []
    const today = new Date()
    for (let i = 9; i >= 0; i--) {
      days.push(subDays(today, i))
    }
    return days
  }, [])

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

  const loadDays = useCallback(async () => {
    const from = toDateKey(last10Days[0])
    const to = toDateKey(last10Days[last10Days.length - 1])
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
        details: ['Could not load notes for the past 10 days.'],
      })
    } finally {
      setLoading(false)
    }
  }, [last10Days])

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
    void loadDays()
  }, [loadDays])

  useEffect(() => {
    if (!isEmployeeView) return
    const from = toDateKey(last10Days[0])
    const to = toDateKey(last10Days[last10Days.length - 1])
    void getNotesAccess({ from, to })
      .then((access) => setDelegatedDateKeys(new Set(access.delegatedDates)))
      .catch(() => setDelegatedDateKeys(new Set()))
  }, [isEmployeeView, last10Days])

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
    setSelectedDateKey(null)
  }

  const canEditDate = useCallback(
    (dateKey: string) => !isEmployeeView || delegatedDateKeys.has(dateKey),
    [delegatedDateKeys, isEmployeeView],
  )

  const handleOpenSearchResult = (result: NoteSearchResult) => {
    const monday = getMondayOfWeek(new Date(result.date))
    setWeekMonday(monday)
    setSelectedDateKey(result.date)
    setHighlightDateKey(result.date)
    setSearchFilters(EMPTY_NOTES_SEARCH)
    setSearchPage(1)
  }

  const handleSelectDate = async (dateKey: string) => {
    setSelectedDateKey(dateKey)
    setHighlightDateKey(dateKey)
    if (blocksByDate[dateKey] || !canEditDate(dateKey) || isPastNotesDay(dateKey)) return
    try {
      const block = await getOrCreateDailyBlock(dateKey)
      setBlocksByDate((prev) => ({ ...prev, [dateKey]: block }))
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      const message = axiosErr.response?.data?.error || 'Failed to open notepad for this day'
      setNotice({ kind: 'error', title: 'Could not open notes', details: [message] })
    }
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
      setSelectedDateKey(todayDateKey)
      setHighlightDateKey(todayDateKey)
      setAutoOpenAddNoteFor(todayDateKey)
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

  useEffect(() => {
    const keys = last10Days.map((day) => toDateKey(day))
    if (selectedDateKey && keys.includes(selectedDateKey)) return

    const todayKey = toDateKey(new Date())
    if (highlightDateKey && keys.includes(highlightDateKey)) {
      setSelectedDateKey(highlightDateKey)
      return
    }
    // Default to today (always the last entry in last10Days)
    setSelectedDateKey(todayKey)
  }, [last10Days, selectedDateKey, highlightDateKey])

  const selectedDay = useMemo(() => {
    if (!selectedDateKey) return null
    return {
      date: last10Days.find((d) => toDateKey(d) === selectedDateKey) ?? new Date(selectedDateKey),
      dateKey: selectedDateKey,
      block: blocksByDate[selectedDateKey] ?? null,
    }
  }, [last10Days, selectedDateKey, blocksByDate])

  const todayDateKey = toDateKey(new Date())
  const canAddToday =
    !busy &&
    (!isEmployeeView || delegatedDateKeys.has(todayDateKey))

  const handleDeleteBlock = useCallback(async (dateKey: string, blockId: string) => {
    try {
      await deleteDailyBlock(blockId)
      setBlocksByDate((prev) => {
        const next = { ...prev }
        delete next[dateKey]
        return next
      })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      const message = axiosErr.response?.data?.error || 'Could not delete notes for this day'
      setNotice({ kind: 'error', title: 'Delete failed', details: [message] })
    }
  }, [])

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
          {!inProjectManagement ? (
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
          ) : null}

          <section className="notes-controls-panel" aria-label="Notes controls">
            <NotesDashboardToolbar
              weekLabel={weekLabel}
              isCurrentWeek={isCurrentWeek}
              filters={searchFilters}
              onWeekPrevious={() => handleWeekChange(shiftWeek(weekMonday, -1))}
              onWeekNext={() => handleWeekChange(shiftWeek(weekMonday, 1))}
              onWeekCurrent={() => handleWeekChange(getMondayOfWeek(new Date()))}
              onFiltersChange={handleFiltersChange}
              onQueryChange={handleQueryChange}
              trailingAction={
                inProjectManagement ? (
                  <Button
                    type="button"
                    variant="primary"
                    icon={<Plus className="h-4 w-4" />}
                    disabled={!canAddToday}
                    onClick={handleAddTodayNotes}
                  >
                    Add today&apos;s notes
                  </Button>
                ) : null
              }
            />

            {!isEmployeeView ? (
              <NotesDelegationPanel
                embedded
                weekFrom={toDateKey(weekdays[0])}
                weekTo={toDateKey(weekdays[weekdays.length - 1])}
              />
            ) : null}
          </section>

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
                  <div className="admin-notes-skeleton admin-notes-skeleton--panel notes-notepad-skeleton" />
                </div>
              ) : (
                <div className="notes-date-bar-layout">
                  <nav className="notes-date-bar" aria-label="Select day">
                    {last10Days.map((date) => {
                      const dateKey = toDateKey(date)
                      const block = blocksByDate[dateKey] ?? null
                      const noteCount = block?.childBlocks.filter((child) => !child.archived).length ?? 0
                      const isActive = selectedDateKey === dateKey
                      return (
                        <button
                          key={dateKey}
                          type="button"
                          className={cn('notes-date-bar__chip', isActive && 'is-active')}
                          aria-pressed={isActive}
                          onClick={() => void handleSelectDate(dateKey)}
                        >
                          <span className="notes-date-bar__weekday">{format(date, 'EEE')}</span>
                          <span className="notes-date-bar__date">{format(date, 'dd MMM')}</span>
                          <span className="notes-date-bar__status">
                            {noteCount > 0 ? `${noteCount} note${noteCount === 1 ? '' : 's'}` : 'No notes'}
                          </span>
                        </button>
                      )
                    })}
                  </nav>

                  <div className="notes-day-panel">
                    {selectedDay ? (
                      <DailyNotesNotepad
                        key={selectedDay.dateKey}
                        layout="panel"
                        date={selectedDay.date}
                        dateKey={selectedDay.dateKey}
                        block={selectedDay.block}
                        projects={projects}
                        employees={employees}
                        highlighted={highlightDateKey === selectedDay.dateKey}
                        busy={busy}
                        canEdit={canEditDate(selectedDay.dateKey)}
                        defaultExpanded
                        onBlockChange={(updated) => handleBlockChange(selectedDay.dateKey, updated)}
                        onSendEmail={setEmailBlock}
                        onDelete={
                          selectedDay.block
                            ? () => void handleDeleteBlock(selectedDay.dateKey, selectedDay.block!._id)
                            : undefined
                        }
                        onError={(message) => {
                          setNotice({ kind: 'error', title: 'Could not save note', details: [message] })
                        }}
                        autoOpenAddNote={autoOpenAddNoteFor === selectedDay.dateKey}
                        onAutoOpenAddNoteHandled={() => {
                          if (autoOpenAddNoteFor === selectedDay.dateKey) {
                            setAutoOpenAddNoteFor(null)
                          }
                        }}
                      />
                    ) : (
                      <p className="notes-notepad-pad__no-block">Select a day to view notes.</p>
                    )}
                  </div>
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
