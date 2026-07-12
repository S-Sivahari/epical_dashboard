import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

const TIMEZONE_STORAGE_KEY = 'secret-sidebar-timezone'

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function readStoredTimeZone(): string {
  try {
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY)
    if (stored) return stored
  } catch {
    /* ignore */
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function getTimeZoneOptions(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('timeZone')
  }
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
  ]
}

function formatClock(date: Date, timeZone: string) {
  try {
    return {
      time: new Intl.DateTimeFormat(undefined, {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(date),
      date: new Intl.DateTimeFormat(undefined, {
        timeZone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date),
      zoneLabel: timeZone.replace(/_/g, ' '),
    }
  } catch {
    if (timeZone === 'UTC') {
      return { time: '--:--:--', date: 'Invalid timezone', zoneLabel: timeZone }
    }
    return formatClock(date, 'UTC')
  }
}

function formatZoneLabel(zone: string) {
  return zone.replace(/_/g, ' ')
}

function zoneMatches(zone: string, query: string) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true
  const normalized = trimmed.replace(/\s+/g, '_')
  return (
    zone.toLowerCase().includes(normalized) ||
    formatZoneLabel(zone).toLowerCase().includes(trimmed)
  )
}

function resolveTimeZone(query: string, options: string[], fallback: string) {
  const trimmed = query.trim()
  if (!trimmed) return fallback

  const exact = options.find(
    (zone) =>
      zone.toLowerCase() === trimmed.toLowerCase().replace(/\s+/g, '_') ||
      formatZoneLabel(zone).toLowerCase() === trimmed.toLowerCase(),
  )
  if (exact) return exact

  const match = options.find((zone) => zoneMatches(zone, trimmed))
  return match ?? fallback
}

export function SecretQuickSidebar() {
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const [now, setNow] = useState(() => new Date())
  const [timeZone, setTimeZone] = useState(readStoredTimeZone)
  const [timeZoneQuery, setTimeZoneQuery] = useState(() => formatZoneLabel(readStoredTimeZone()))
  const [timeZoneOpen, setTimeZoneOpen] = useState(false)
  const [showAllTimeZones, setShowAllTimeZones] = useState(false)
  const timeZoneFieldRef = useRef<HTMLDivElement>(null)

  openRef.current = open

  const timeZoneOptions = useMemo(() => getTimeZoneOptions(), [])
  const filteredTimeZones = useMemo(() => {
    if (showAllTimeZones) return timeZoneOptions
    return timeZoneOptions.filter((zone) => zoneMatches(zone, timeZoneQuery))
  }, [showAllTimeZones, timeZoneOptions, timeZoneQuery])
  const clock = useMemo(() => formatClock(now, timeZone), [now, timeZone])

  const close = useCallback(() => {
    setOpen(false)
    openRef.current = false
  }, [])

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      openRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      if (!event.ctrlKey || event.altKey || event.metaKey) return
      if (event.key !== 'ArrowLeft') return

      event.preventDefault()
      event.stopPropagation()
      toggle()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [toggle])

  useEffect(() => {
    if (!open) return undefined
    const tick = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(tick)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const handleTimeZoneChange = (value: string) => {
    setTimeZone(value)
    setTimeZoneQuery(formatZoneLabel(value))
    try {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, value)
    } catch {
      /* ignore */
    }
  }

  const commitTimeZoneQuery = useCallback(() => {
    const resolved = resolveTimeZone(timeZoneQuery, timeZoneOptions, timeZone)
    handleTimeZoneChange(resolved)
    setTimeZoneOpen(false)
  }, [timeZone, timeZoneOptions, timeZoneQuery])

  useEffect(() => {
    if (!open) return
    setTimeZoneQuery(formatZoneLabel(timeZone))
  }, [open, timeZone])

  useEffect(() => {
    if (!timeZoneOpen) return undefined

    function handlePointerDown(event: MouseEvent) {
      if (!timeZoneFieldRef.current?.contains(event.target as Node)) {
        setTimeZoneOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [timeZoneOpen])

  return (
    <>
      <div
        className={cn('secret-quick-sidebar__backdrop', open && 'is-visible')}
        aria-hidden={!open}
        onClick={close}
      />

      <aside
        className={cn('secret-quick-sidebar', open && 'is-open')}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="World clock"
      >
        <header className="secret-quick-sidebar__header">
          <button
            type="button"
            className="secret-quick-sidebar__close"
            onClick={close}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <section className="secret-quick-sidebar__section secret-quick-sidebar__clock">
          <p className="secret-quick-sidebar__clock-time" aria-live="polite">
            {clock.time}
          </p>
          <p className="secret-quick-sidebar__clock-date">{clock.date}</p>
          <label className="secret-quick-sidebar__field">
            <span className="secret-quick-sidebar__field-label">Timezone</span>
            <div className="secret-quick-sidebar__timezone" ref={timeZoneFieldRef}>
              <input
                type="text"
                className="secret-quick-sidebar__timezone-input"
                value={timeZoneQuery}
                onChange={(e) => {
                  setTimeZoneQuery(e.target.value)
                  setShowAllTimeZones(false)
                  setTimeZoneOpen(true)
                }}
                onFocus={(e) => {
                  setTimeZoneOpen(true)
                  setShowAllTimeZones(true)
                  e.target.select()
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    commitTimeZoneQuery()
                    setShowAllTimeZones(false)
                  }, 120)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const pick = filteredTimeZones[0]
                    if (pick) handleTimeZoneChange(pick)
                    setTimeZoneOpen(false)
                    setShowAllTimeZones(false)
                  }
                  if (e.key === 'Escape') {
                    setTimeZoneOpen(false)
                    setShowAllTimeZones(false)
                    setTimeZoneQuery(formatZoneLabel(timeZone))
                  }
                }}
                placeholder="Type city or region…"
                role="combobox"
                aria-expanded={timeZoneOpen}
                aria-controls="secret-sidebar-timezone-list"
                aria-autocomplete="list"
              />
              {timeZoneOpen ? (
                <ul
                  id="secret-sidebar-timezone-list"
                  className="secret-quick-sidebar__timezone-list"
                  role="listbox"
                  aria-label="Timezone suggestions"
                >
                  {filteredTimeZones.length > 0 ? (
                    filteredTimeZones.map((zone) => (
                      <li key={zone}>
                        <button
                          type="button"
                          className={cn(
                            'secret-quick-sidebar__timezone-option',
                            zone === timeZone && 'is-active',
                          )}
                          role="option"
                          aria-selected={zone === timeZone}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            handleTimeZoneChange(zone)
                            setTimeZoneOpen(false)
                            setShowAllTimeZones(false)
                          }}
                        >
                          {formatZoneLabel(zone)}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="secret-quick-sidebar__timezone-empty">No matching timezones</li>
                  )}
                </ul>
              ) : null}
            </div>
          </label>
          <p className="secret-quick-sidebar__clock-zone">{clock.zoneLabel}</p>
        </section>
      </aside>
    </>
  )
}
