import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import api from '@services/api'
import { useAuthStore } from '@/store/authStore'
import {
  filterMajorCities,
  formatCityLabel,
  resolveWorldCity,
  type WorldCity,
} from '@/utils/worldCities'

const TIMEZONE_STORAGE_KEY = 'secret-sidebar-timezone'
const TIMEZONES_STORAGE_KEY = 'secret-sidebar-timezones'
const MAX_WORLD_CLOCKS = 12

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
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
    }
  } catch {
    if (timeZone === 'UTC') {
      return { time: '--:--:--', date: 'Invalid timezone' }
    }
    return formatClock(date, 'UTC')
  }
}

function readLocalTimezones(userId?: string | null): string[] | null {
  try {
    if (userId) {
      const keyed = localStorage.getItem(`${TIMEZONES_STORAGE_KEY}:${userId}`)
      if (keyed) {
        const parsed = JSON.parse(keyed)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((z) => String(z)).filter(Boolean)
        }
      }
    }
    const shared = localStorage.getItem(TIMEZONES_STORAGE_KEY)
    if (shared) {
      const parsed = JSON.parse(shared)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((z) => String(z)).filter(Boolean)
      }
    }
    const legacy = localStorage.getItem(TIMEZONE_STORAGE_KEY)
    if (legacy) return [legacy]
  } catch {
    /* ignore */
  }
  return null
}

function writeLocalTimezones(zones: string[], userId?: string | null) {
  try {
    const payload = JSON.stringify(zones)
    localStorage.setItem(TIMEZONES_STORAGE_KEY, payload)
    if (userId) {
      localStorage.setItem(`${TIMEZONES_STORAGE_KEY}:${userId}`, payload)
    }
    if (zones[0]) {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, zones[0])
    }
  } catch {
    /* ignore */
  }
}

function defaultCityIds(userId?: string | null, fromUser?: string[] | null): string[] {
  if (Array.isArray(fromUser) && fromUser.length > 0) {
    return fromUser
  }
  const local = readLocalTimezones(userId)
  if (local?.length) return local
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  return [resolveWorldCity(localZone).id]
}

export function SecretQuickSidebar() {
  const user = useAuthStore((s) => s.user)
  const patchUser = useAuthStore((s) => s.patchUser)
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const [now, setNow] = useState(() => new Date())
  const [cityIds, setCityIds] = useState<string[]>(() => defaultCityIds(null, null))
  const [cityQuery, setCityQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showAllCities, setShowAllCities] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const pickerFieldRef = useRef<HTMLDivElement>(null)
  const hydratedUserIdRef = useRef<string | null>(null)

  openRef.current = open

  const filteredCities = useMemo(() => {
    if (showAllCities && !cityQuery.trim()) {
      return filterMajorCities('', cityIds)
    }
    return filterMajorCities(cityQuery, cityIds)
  }, [showAllCities, cityQuery, cityIds])

  const clocks = useMemo(
    () =>
      cityIds.map((id) => {
        const city = resolveWorldCity(id)
        const clock = formatClock(now, city.timeZone)
        return {
          id: city.id,
          label: formatCityLabel(city),
          city: city.city,
          country: city.country,
          ...clock,
        }
      }),
    [now, cityIds],
  )

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

  useEffect(() => {
    const userId = user?.id ?? null
    if (!userId) return
    if (hydratedUserIdRef.current === userId) {
      if (Array.isArray(user.preferredTimezones) && user.preferredTimezones.length > 0) {
        setCityIds((prev) => {
          const next = user.preferredTimezones!
          if (prev.length === next.length && prev.every((z, i) => z === next[i])) return prev
          writeLocalTimezones(next, userId)
          return next
        })
      }
      return
    }
    hydratedUserIdRef.current = userId
    const fromDb = Array.isArray(user.preferredTimezones) ? user.preferredTimezones : null
    const next = defaultCityIds(userId, fromDb)
    setCityIds(next)
    writeLocalTimezones(next, userId)

    if ((!fromDb || fromDb.length === 0) && next.length > 0) {
      void api
        .patch<{ user: { preferredTimezones?: string[] } }>('/auth/me', {
          preferredTimezones: next,
        })
        .then(({ data }) => {
          if (Array.isArray(data.user?.preferredTimezones)) {
            patchUser({ preferredTimezones: data.user.preferredTimezones })
          } else {
            patchUser({ preferredTimezones: next })
          }
        })
        .catch(() => undefined)
    }
  }, [user?.id, user?.preferredTimezones, patchUser])

  const persistCities = useCallback(
    async (next: string[]) => {
      setCityIds(next)
      writeLocalTimezones(next, user?.id)
      patchUser({ preferredTimezones: next })
      setSaveError('')

      if (!user?.id) return

      setSaving(true)
      try {
        const { data } = await api.patch<{ user: { preferredTimezones?: string[] } }>(
          '/auth/me',
          { preferredTimezones: next },
        )
        if (Array.isArray(data.user?.preferredTimezones)) {
          patchUser({ preferredTimezones: data.user.preferredTimezones })
          writeLocalTimezones(data.user.preferredTimezones, user.id)
        }
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : undefined
        setSaveError(message || 'Could not save city preference')
      } finally {
        setSaving(false)
      }
    },
    [patchUser, user?.id],
  )

  const addCity = useCallback(
    (city: WorldCity) => {
      if (!city?.id || cityIds.includes(city.id)) return
      if (cityIds.length >= MAX_WORLD_CLOCKS) {
        setSaveError(`You can add at most ${MAX_WORLD_CLOCKS} clocks`)
        return
      }
      void persistCities([...cityIds, city.id])
      setCityQuery('')
      setPickerOpen(false)
      setShowAllCities(false)
    },
    [persistCities, cityIds],
  )

  const removeCity = useCallback(
    (id: string) => {
      if (cityIds.length <= 1) {
        setSaveError('Keep at least one clock')
        return
      }
      void persistCities(cityIds.filter((z) => z !== id))
    },
    [persistCities, cityIds],
  )

  useEffect(() => {
    if (!pickerOpen) return undefined

    function handlePointerDown(event: MouseEvent) {
      if (!pickerFieldRef.current?.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [pickerOpen])

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
        aria-label="World clocks"
      >
        <header className="secret-quick-sidebar__header">
          <div className="secret-quick-sidebar__header-copy">
            <p className="secret-quick-sidebar__header-title">World clocks</p>
            <p className="secret-quick-sidebar__header-meta">
              {saving ? 'Saving…' : `${cityIds.length} saved`}
            </p>
          </div>
          <button
            type="button"
            className="secret-quick-sidebar__close"
            onClick={close}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <section className="secret-quick-sidebar__section secret-quick-sidebar__clocks">
          <ul className="secret-quick-sidebar__clock-list">
            {clocks.map((clock) => (
              <li key={clock.id} className="secret-quick-sidebar__clock-card">
                <div className="secret-quick-sidebar__clock-card-main">
                  <p className="secret-quick-sidebar__clock-city">{clock.city}</p>
                  {clock.country ? (
                    <p className="secret-quick-sidebar__clock-country">{clock.country}</p>
                  ) : null}
                  <p className="secret-quick-sidebar__clock-time" aria-live="polite">
                    {clock.time}
                  </p>
                  <p className="secret-quick-sidebar__clock-date">{clock.date}</p>
                </div>
                <button
                  type="button"
                  className="secret-quick-sidebar__clock-remove"
                  onClick={() => removeCity(clock.id)}
                  disabled={cityIds.length <= 1}
                  aria-label={`Remove ${clock.label}`}
                  title={cityIds.length <= 1 ? 'Keep at least one clock' : 'Remove'}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="secret-quick-sidebar__section">
          <label className="secret-quick-sidebar__field">
            <span className="secret-quick-sidebar__field-label">Add city</span>
            <div className="secret-quick-sidebar__timezone" ref={pickerFieldRef}>
              <div className="secret-quick-sidebar__timezone-row">
                <input
                  type="text"
                  className="secret-quick-sidebar__timezone-input"
                  value={cityQuery}
                  onChange={(e) => {
                    setCityQuery(e.target.value)
                    setShowAllCities(false)
                    setPickerOpen(true)
                    setSaveError('')
                  }}
                  onFocus={(e) => {
                    setPickerOpen(true)
                    setShowAllCities(true)
                    e.target.select()
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setShowAllCities(false)
                    }, 120)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const pick = filteredCities[0]
                      if (pick) addCity(pick)
                    }
                    if (e.key === 'Escape') {
                      setPickerOpen(false)
                      setShowAllCities(false)
                      setCityQuery('')
                    }
                  }}
                  placeholder="Search city or country…"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  aria-controls="secret-sidebar-city-list"
                  aria-autocomplete="list"
                  disabled={cityIds.length >= MAX_WORLD_CLOCKS}
                />
                <button
                  type="button"
                  className="secret-quick-sidebar__add-btn"
                  onClick={() => {
                    const pick = filteredCities[0]
                    if (pick) addCity(pick)
                  }}
                  disabled={cityIds.length >= MAX_WORLD_CLOCKS}
                  aria-label="Add city"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {pickerOpen ? (
                <ul
                  id="secret-sidebar-city-list"
                  className="secret-quick-sidebar__timezone-list"
                  role="listbox"
                  aria-label="City suggestions"
                >
                  {filteredCities.length > 0 ? (
                    filteredCities.map((city) => (
                      <li key={city.id}>
                        <button
                          type="button"
                          className="secret-quick-sidebar__timezone-option"
                          role="option"
                          aria-selected={false}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addCity(city)}
                        >
                          <span className="secret-quick-sidebar__city-option-name">{city.city}</span>
                          <span className="secret-quick-sidebar__city-option-country">
                            {city.country}
                          </span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="secret-quick-sidebar__timezone-empty">
                      {cityIds.length >= MAX_WORLD_CLOCKS
                        ? `Maximum of ${MAX_WORLD_CLOCKS} clocks reached`
                        : 'No matching cities'}
                    </li>
                  )}
                </ul>
              ) : null}
            </div>
          </label>
          {saveError ? <p className="secret-quick-sidebar__error">{saveError}</p> : null}
          <p className="secret-quick-sidebar__hint">
            Search major cities or countries (e.g. Germany, Berlin, Tokyo). Saved to your account.
          </p>
        </section>
      </aside>
    </>
  )
}
