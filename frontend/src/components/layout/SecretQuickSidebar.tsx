import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Volume2, Upload, RotateCcw } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  deleteCustomNotificationSound,
  getCustomNotificationSound,
  playCustomNotificationSound,
  saveCustomNotificationSound,
} from '@utils/customNotificationSound'

const TIMEZONE_STORAGE_KEY = 'secret-sidebar-timezone'
const MAX_SOUND_FILE_BYTES = 1_5 * 1024 * 1024

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
}

export function SecretQuickSidebar() {
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const [now, setNow] = useState(() => new Date())
  const [timeZone, setTimeZone] = useState(readStoredTimeZone)
  const [customSoundName, setCustomSoundName] = useState<string | null>(
    () => getCustomNotificationSound()?.fileName ?? null,
  )
  const [soundError, setSoundError] = useState<string | null>(null)
  const [soundBusy, setSoundBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  openRef.current = open

  const timeZoneOptions = useMemo(() => getTimeZoneOptions(), [])
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
    try {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, value)
    } catch {
      /* ignore */
    }
  }

  const handleSoundFile = async (file: File | null) => {
    if (!file) return
    setSoundError(null)

    if (!file.type.startsWith('audio/')) {
      setSoundError('Please choose an audio file.')
      return
    }
    if (file.size > MAX_SOUND_FILE_BYTES) {
      setSoundError('File is too large. Use a sound under 1.5 MB.')
      return
    }

    setSoundBusy(true)
    try {
      await saveCustomNotificationSound(file)
      setCustomSoundName(file.name)
    } catch {
      setSoundError('Could not import that sound. Try another file.')
    } finally {
      setSoundBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleResetSound = () => {
    deleteCustomNotificationSound()
    setCustomSoundName(null)
    setSoundError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
        aria-label="Quick settings"
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
            <select
              className="secret-quick-sidebar__select"
              value={timeZone}
              onChange={(e) => handleTimeZoneChange(e.target.value)}
            >
              {timeZoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <p className="secret-quick-sidebar__clock-zone">{clock.zoneLabel}</p>
        </section>

        <section className="secret-quick-sidebar__section secret-quick-sidebar__sound">
          <h2 className="secret-quick-sidebar__section-title">Notification sound</h2>
          <p className="secret-quick-sidebar__section-desc">
            Import a sound from your device. It will play for your dashboard notifications.
          </p>

          <div className="secret-quick-sidebar__sound-card">
            <p className="secret-quick-sidebar__sound-name">
              {customSoundName ?? 'Default app sound'}
            </p>
            <p className="secret-quick-sidebar__sound-meta">
              {customSoundName ? 'Custom sound active' : 'Using /sounds/notification.mp3'}
            </p>
          </div>

          {soundError ? (
            <p className="secret-quick-sidebar__error" role="alert">
              {soundError}
            </p>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="secret-quick-sidebar__file-input"
            onChange={(e) => void handleSoundFile(e.target.files?.[0] ?? null)}
          />

          <div className="secret-quick-sidebar__actions">
            <button
              type="button"
              className="secret-quick-sidebar__btn secret-quick-sidebar__btn--primary"
              disabled={soundBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden />
              Import sound
            </button>
            <button
              type="button"
              className="secret-quick-sidebar__btn"
              onClick={() => void playCustomNotificationSound()}
            >
              <Volume2 className="h-4 w-4" aria-hidden />
              Test
            </button>
            {customSoundName ? (
              <button
                type="button"
                className="secret-quick-sidebar__btn secret-quick-sidebar__btn--ghost"
                onClick={handleResetSound}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reset
              </button>
            ) : null}
          </div>
        </section>
      </aside>
    </>
  )
}
