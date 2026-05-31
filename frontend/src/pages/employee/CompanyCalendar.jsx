import { useState, useMemo, useEffect } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
} from 'date-fns'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useLeaves } from '@hooks/useLeaves'
import { useAuthStore } from '@store/authStore'
import { formatDate } from '@/utils/formatDate'
import * as leaveService from '@services/leaveService'
import { portalCardClass } from '@components/employee/shared/interactiveCard'

export default function CompanyCalendar() {
  const { leaves, holidays, companyCalendarEvents } = useLeaves()
  const user = useAuthStore((s) => s.user)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDateStr, setSelectedDateStr] = useState(null)
  const [isDateModalOpen, setIsDateModalOpen] = useState(false)

  // Team leaves — all colleagues' approved leaves for this month
  const [teamLeaves, setTeamLeaves] = useState([])
  useEffect(() => {
    leaveService.getTeamLeaves().then(setTeamLeaves).catch(() => {})
  }, [])

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const goToToday = () => setCurrentDate(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const leadingEmptyCells = monthStart.getDay()

  const currentMonthIdx = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  // Only show the logged-in employee's own approved leaves
  const myApprovedLeaves = useMemo(() => {
    return leaves.filter(
      (l) =>
        l.status === 'Approved' &&
        (l.employeeId === user?.id || l.employeeId === user?.employeeId),
    )
  }, [leaves, user])

  const companyEvents = useMemo(() => {
    const fromApi = companyCalendarEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.time,
    }))
    const fromHolidayType = holidays
      .filter((h) => !h.skipped && h.type === 'Company Event')
      .map((h) => ({
        id: h.id,
        title: h.title,
        date: h.date,
      }))
    return [...fromApi, ...fromHolidayType]
  }, [companyCalendarEvents, holidays])

  const getHolidaysForDay = (dateStr) =>
    holidays.filter((h) => !h.skipped && h.type !== 'Company Event' && h.date === dateStr)
  const getEventsForDay = (dateStr) => companyEvents.filter((e) => e.date === dateStr)
  const getMyLeavesForDay = (dateStr) =>
    myApprovedLeaves.filter((l) => dateStr >= l.from && dateStr <= l.to)
  const getTeamLeavesForDay = (dateStr) =>
    teamLeaves.filter((l) => l.employeeId !== user?.id && dateStr >= l.from && dateStr <= l.to)

  const currentMonthHolidays = useMemo(() => {
    return holidays
      .filter((h) => {
        if (h.skipped || h.type === 'Company Event') return false
        const d = new Date(h.date)
        return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [holidays, currentMonthIdx, currentYear])

  const currentMonthEvents = useMemo(() => {
    return companyEvents
      .filter((e) => {
        const d = new Date(e.date)
        return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [companyEvents, currentMonthIdx, currentYear])

  // Team colleagues on leave this month (excluding myself)
  const currentMonthTeamLeaves = useMemo(() => {
    return teamLeaves
      .filter((l) => {
        if (l.employeeId === user?.id) return false
        const from = new Date(l.from)
        const to = new Date(l.to)
        const mStart = new Date(currentYear, currentMonthIdx, 1)
        const mEnd = new Date(currentYear, currentMonthIdx + 1, 0)
        return from <= mEnd && to >= mStart
      })
      .sort((a, b) => new Date(a.from) - new Date(b.from))
  }, [teamLeaves, currentMonthIdx, currentYear, user])

  const currentMonthMyLeaves = useMemo(() => {
    return myApprovedLeaves.filter((l) => {
      const fromDate = new Date(l.from)
      const toDate = new Date(l.to)
      return (
        (fromDate.getMonth() === currentMonthIdx && fromDate.getFullYear() === currentYear) ||
        (toDate.getMonth() === currentMonthIdx && toDate.getFullYear() === currentYear) ||
        (fromDate < monthStart && toDate > monthEnd)
      )
    })
  }, [myApprovedLeaves, currentMonthIdx, currentYear, monthStart, monthEnd])

  const itemsOnSelectedDate = useMemo(() => {
    if (!selectedDateStr) return { leaves: [], holidays: [], events: [], team: [] }
    return {
      leaves: myApprovedLeaves.filter((l) => selectedDateStr >= l.from && selectedDateStr <= l.to),
      holidays: holidays.filter((h) => !h.skipped && h.type !== 'Company Event' && h.date === selectedDateStr),
      events: companyEvents.filter((e) => e.date === selectedDateStr),
      team: teamLeaves.filter((l) => l.employeeId !== user?.id && selectedDateStr >= l.from && selectedDateStr <= l.to),
    }
  }, [selectedDateStr, myApprovedLeaves, holidays, companyEvents, teamLeaves, user])

  const handleDateClick = (dateStr) => {
    setSelectedDateStr(dateStr)
    setIsDateModalOpen(true)
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">

        {/* ── Calendar Card ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 xl:col-span-3 flex flex-col w-full">
          <div
            data-portal-card=""
            className={portalCardClass({ className: 'flex w-full flex-col overflow-hidden bg-white shadow-sm' })}
          >
            {/* Header */}
            <div className="p-3 border-b border-border flex items-center justify-between bg-surface/30">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-0.5">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[7.5rem] px-2 text-center text-sm font-semibold text-ink">
                    {format(currentDate, 'MMMM yyyy')}
                  </span>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button size="sm" variant="secondary" className="h-8 px-3 text-xs" onClick={goToToday}>
                  Today
                </Button>
              </div>
            </div>

            {/* Legend */}
            <div className="px-3 py-1.5 border-b border-border bg-gray-50 flex flex-wrap gap-3 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-lime-400 border border-lime-500"></div>
                <span className="text-muted">My Leave</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="text-muted">Public Holiday</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                <span className="text-muted">Company Holiday</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <span className="text-muted">Company Event</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400"></div>
                <span className="text-muted">Team Away</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-2.5 flex-1">
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-muted py-1 uppercase tracking-wider">
                    {day}
                  </div>
                ))}

                {Array.from({ length: leadingEmptyCells }).map((_, index) => (
                  <div
                    key={`pad-${index}`}
                    className="min-h-[5rem] xl:min-h-[5.5rem] rounded-xl border border-transparent bg-transparent"
                    aria-hidden
                  />
                ))}

                {monthDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const dayHolidays = getHolidaysForDay(dateStr)
                  const dayEvents = getEventsForDay(dateStr)
                  const dayLeaves = getMyLeavesForDay(dateStr)
                  const dayTeamLeaves = getTeamLeavesForDay(dateStr)
                  const isTodayDate = isToday(day)

                  return (
                    <Tooltip.Root key={dateStr}>
                      <Tooltip.Trigger asChild>
                        <div
                          onClick={() => handleDateClick(dateStr)}
                          className={`min-h-[5rem] xl:min-h-[5.5rem] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-0.5 hover:shadow-sm overflow-hidden bg-white border-border hover:border-primary/50
                            ${isTodayDate ? 'ring-2 ring-primary/20 border-primary/40 bg-primary/5' : ''}
                            ${dayTeamLeaves.length > 0 ? 'bg-purple-50/30' : ''}
                          `}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`text-sm font-semibold ${isTodayDate ? 'text-primary' : 'text-ink'}`}>
                              {format(day, 'd')}
                            </span>
                            <div className="flex gap-0.5">
                              {dayHolidays.map((h, i) => (
                                <div
                                  key={i}
                                  className={`h-2 w-2 rounded-full ${
                                    h.type === 'National'
                                      ? 'bg-green-500'
                                      : h.type === 'Company'
                                      ? 'bg-blue-500'
                                      : 'bg-orange-500'
                                  }`}
                                />
                              ))}
                              {dayEvents.map((_, i) => (
                                <div key={`evt-${i}`} className="h-2 w-2 rounded-full bg-amber-500" />
                              ))}
                              {dayTeamLeaves.length > 0 && (
                                <div className="h-2 w-2 rounded-full bg-purple-400" />
                              )}
                            </div>
                          </div>

                          <div className="flex-1 overflow-hidden flex flex-col gap-1 mt-1">
                            {dayHolidays.slice(0, 2).map((h) => (
                              <div key={h.id} className={`text-[10px] font-semibold leading-tight truncate px-1.5 py-0.5 rounded border ${
                                h.type === 'National'
                                  ? 'bg-green-50 text-green-700 border-green-100'
                                  : h.type === 'Company'
                                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                                  : 'bg-orange-50 text-orange-700 border-orange-100'
                              }`}>
                                {h.title}
                              </div>
                            ))}
                            {dayEvents.slice(0, 1).map((e) => (
                              <div key={e.id} className="text-[10px] font-medium leading-tight truncate px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                                {e.title}
                              </div>
                            ))}
                            {dayLeaves.slice(0, 1).map((l) => (
                              <div key={l.id} className="text-[10px] leading-tight truncate px-1.5 py-0.5 rounded bg-lime-100 text-lime-800 border border-lime-200/50">
                                My {l.type.split(' ')[0]}
                              </div>
                            ))}
                            {dayTeamLeaves.length > 0 && (
                              <div className="text-[10px] leading-tight truncate px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                                {dayTeamLeaves.length} away
                              </div>
                            )}
                          </div>
                        </div>
                      </Tooltip.Trigger>

                      {(dayHolidays.length > 0 || dayLeaves.length > 0 || dayEvents.length > 0 || dayTeamLeaves.length > 0) && (
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="z-[100] max-w-sm rounded-xl bg-white p-3 text-sm shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95"
                            sideOffset={5}
                          >
                            <div className="space-y-3">
                              <p className="font-semibold text-ink border-b border-border pb-1.5">
                                {format(day, 'EEEE, MMMM d, yyyy')}
                              </p>
                              {dayHolidays.length > 0 && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">Holidays</p>
                                  {dayHolidays.map((h) => (
                                    <div key={h.id} className="flex items-center gap-2">
                                      <div className={`h-1.5 w-1.5 rounded-full ${h.type === 'National' ? 'bg-green-500' : h.type === 'Company' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                                      <span className="text-ink text-xs font-medium">{h.title}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {dayEvents.length > 0 && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">Events</p>
                                  {dayEvents.map((e) => (
                                    <div key={e.id} className="flex items-center gap-2">
                                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                      <span className="text-ink text-xs font-medium">{e.title}</span>
                                      {e.time && <span className="text-muted text-[10px]">{e.time}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {dayLeaves.length > 0 && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">My Leave</p>
                                  {dayLeaves.map((l) => (
                                    <div key={l.id} className="flex items-center gap-2">
                                      <div className="h-1.5 w-1.5 rounded-full bg-lime-500" />
                                      <span className="text-ink text-xs font-medium">{l.type}</span>
                                      <span className="text-muted text-[10px]">{l.days}d</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {dayTeamLeaves.length > 0 && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">Team on Leave</p>
                                  {dayTeamLeaves.map((l) => (
                                    <div key={l.id} className="flex items-center gap-2">
                                      <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                                      <span className="text-ink text-xs font-medium">{l.employeeName}</span>
                                      <span className="text-muted text-[10px]">{l.type.split(' ')[0]}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Tooltip.Arrow className="fill-white" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      )}
                    </Tooltip.Root>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          {/* Holidays */}
          <div
            data-portal-card=""
            className={portalCardClass({ className: 'flex h-[220px] flex-col bg-white p-3 shadow-sm' })}
          >
            <div className="mb-2 flex items-center gap-2 flex-shrink-0">
              <h3 className="font-display text-sm font-semibold text-ink">
                {format(currentDate, 'MMM yyyy')} Holidays
              </h3>
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                {currentMonthHolidays.length}
              </span>
            </div>
            {currentMonthHolidays.length > 0 ? (
              <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">
                {currentMonthHolidays.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md text-xs text-white flex-shrink-0 ${
                      h.type === 'National' ? 'bg-green-500' : h.type === 'Company' ? 'bg-blue-500' : 'bg-orange-500'
                    }`}>🎉</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-ink text-xs truncate">{h.title}</h4>
                      <p className="text-[10px] text-muted mt-0.5">{formatDate(h.date)}</p>
                    </div>
                    <Badge
                      variant={h.type === 'National' ? 'success' : h.type === 'Company' ? 'info' : 'warning'}
                      className="text-[9px] px-1.5 py-0.5 shrink-0"
                    >
                      {h.type === 'National' ? 'Public' : h.type === 'Company' ? 'Company' : 'Event'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <span className="text-2xl mb-1 opacity-50">📅</span>
                <p className="text-muted text-xs">No holidays this month</p>
              </div>
            )}
          </div>

          {/* Company Events */}
          <div
            data-portal-card=""
            className={portalCardClass({ className: 'flex h-[220px] flex-col bg-white p-3 shadow-sm' })}
          >
            <div className="mb-2 flex items-center gap-2 flex-shrink-0">
              <h3 className="font-display text-sm font-semibold text-ink">Company Events</h3>
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                {currentMonthEvents.length}
              </span>
            </div>
            {currentMonthEvents.length > 0 ? (
              <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">
                {currentMonthEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 flex-shrink-0 text-sm text-amber-700">
                      📢
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-ink text-xs truncate">{e.title}</h4>
                      <p className="text-[10px] text-muted mt-0.5">{e.time || 'All day'} • {formatDate(e.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <span className="text-2xl mb-1 opacity-50">📢</span>
                <p className="text-muted text-xs">No events this month</p>
              </div>
            )}
          </div>

          {/* My Approved Leaves */}
          <div
            data-portal-card=""
            className={portalCardClass({ className: 'flex h-[220px] flex-col bg-white p-3 shadow-sm' })}
          >
            <div className="mb-2 flex items-center gap-2 flex-shrink-0">
              <h3 className="font-display text-sm font-semibold text-ink">My Leaves</h3>
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold bg-lime-100 text-lime-700">
                {currentMonthMyLeaves.length}
              </span>
            </div>
            {currentMonthMyLeaves.length > 0 ? (
              <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">
                {currentMonthMyLeaves
                  .sort((a, b) => new Date(a.from) - new Date(b.from))
                  .map((l) => (
                    <div key={l.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-lime-100 flex-shrink-0 text-sm text-lime-700">
                        ✈️
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-ink text-xs truncate">{l.type}</h4>
                        <p className="text-[10px] text-muted mt-0.5">{l.days}d • {formatDate(l.from)}</p>
                      </div>
                      <Badge variant="success" className="text-[9px] px-1.5 py-0.5 shrink-0">Approved</Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <span className="text-2xl mb-1 opacity-50">🏖️</span>
                <p className="text-muted text-xs">No approved leaves</p>
              </div>
            )}
          </div>
          {/* Team Availability */}
          <div
            data-portal-card=""
            className={portalCardClass({ className: 'flex h-[220px] flex-col bg-white p-3 shadow-sm' })}
          >
            <div className="mb-2 flex items-center gap-2 flex-shrink-0">
              <h3 className="font-display text-sm font-semibold text-ink">Team on Leave</h3>
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                {currentMonthTeamLeaves.length}
              </span>
            </div>
            {currentMonthTeamLeaves.length > 0 ? (
              <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">
                {currentMonthTeamLeaves.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 flex-shrink-0 text-sm text-purple-700">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-ink text-xs truncate">{l.employeeName}</h4>
                      <p className="text-[10px] text-muted mt-0.5">{l.type} • {formatDate(l.from)}</p>
                    </div>
                    <span className="text-[9px] font-medium text-purple-700 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 shrink-0">
                      {l.days}d
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <span className="text-2xl mb-1 opacity-50">👥</span>
                <p className="text-muted text-xs">Everyone present this month</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date click modal */}
      {isDateModalOpen && selectedDateStr && (
        <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Day Details">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-ink">
              {format(new Date(selectedDateStr), 'EEEE, MMMM d, yyyy')}
            </p>

            {itemsOnSelectedDate.holidays.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2">Holidays</h4>
                {itemsOnSelectedDate.holidays.map((h) => (
                  <div key={h.id} className="flex justify-between items-center p-3 rounded-lg bg-green-50 border border-green-100 mb-1">
                    <span className="font-medium text-green-900 text-sm">{h.title}</span>
                    <Badge variant={h.type === 'National' ? 'success' : h.type === 'Company' ? 'info' : 'warning'}>
                      {h.type === 'Company' ? 'Company Holiday' : h.type === 'Company Event' ? 'Company Event' : 'Public Holiday'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {itemsOnSelectedDate.events.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2">Events</h4>
                {itemsOnSelectedDate.events.map((e) => (
                  <div key={e.id} className="p-3 rounded-lg bg-amber-50 border border-amber-100 mb-1">
                    <p className="font-medium text-amber-900 text-sm">{e.title}</p>
                    {e.time && <p className="text-amber-700 text-xs mt-1">{e.time}</p>}
                  </div>
                ))}
              </div>
            )}

            {itemsOnSelectedDate.leaves.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2">My Leave</h4>
                {itemsOnSelectedDate.leaves.map((l) => (
                  <div key={l.id} className="flex justify-between items-center p-3 rounded-lg bg-lime-50 border border-lime-100 mb-1">
                    <div>
                      <p className="font-medium text-lime-900 text-sm">{l.type}</p>
                      <p className="text-xs text-lime-700 mt-0.5">{l.days} days</p>
                    </div>
                    <Badge variant="success">Approved</Badge>
                  </div>
                ))}
              </div>
            )}

            {itemsOnSelectedDate.team.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple-500" />
                  Team on Leave
                </h4>
                {itemsOnSelectedDate.team.map((l) => (
                  <div key={l.id} className="flex justify-between items-center p-3 rounded-lg bg-purple-50 border border-purple-100 mb-1">
                    <div>
                      <p className="font-medium text-purple-900 text-sm">{l.employeeName}</p>
                      <p className="text-xs text-purple-700 mt-0.5">{l.type} • {l.days} day{l.days !== 1 ? 's' : ''}</p>
                    </div>
                    <Badge variant="info" className="text-[10px]">Away</Badge>
                  </div>
                ))}
              </div>
            )}

            {itemsOnSelectedDate.holidays.length === 0 &&
              itemsOnSelectedDate.events.length === 0 &&
              itemsOnSelectedDate.leaves.length === 0 &&
              itemsOnSelectedDate.team.length === 0 && (
                <div className="py-8 text-center text-muted">
                  <p className="text-sm">No events on this date</p>
                </div>
              )}
          </div>
        </Modal>
      )}
    </Tooltip.Provider>
  )
}
