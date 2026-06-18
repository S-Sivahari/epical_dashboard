import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isEmployeeNavActive } from '@constants/employeeNavigation'
import { useEmployeeNavItems } from '@hooks/useEmployeeNavItems'
import { cn } from '@/utils/cn'

const VIEW_SIZE = 400
const CENTER = VIEW_SIZE / 2
const INNER_RADIUS = 72
const OUTER_RADIUS = 168
const ICON_RADIUS = 128
const LABEL_RADIUS = 196

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

function describeDonutSegment(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
) {
  const startOuter = polarToCartesian(cx, cy, outerR, startAngle)
  const endOuter = polarToCartesian(cx, cy, outerR, endAngle)
  const startInner = polarToCartesian(cx, cy, innerR, endAngle)
  const endInner = polarToCartesian(cx, cy, innerR, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT'
    || tag === 'TEXTAREA'
    || tag === 'SELECT'
    || target.isContentEditable
  )
}

function isNextWheelKey(event: KeyboardEvent) {
  return event.key === '>' || (event.code === 'Period' && event.shiftKey)
}

function isPrevWheelKey(event: KeyboardEvent) {
  return event.key === '<' || (event.code === 'Comma' && event.shiftKey)
}

export function EmployeeNavWheel() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const items = useEmployeeNavItems()
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedIndexRef = useRef(0)
  const openRef = useRef(false)
  const itemsRef = useRef(items)

  selectedIndexRef.current = selectedIndex
  openRef.current = open
  itemsRef.current = items

  const currentIndex = useMemo(() => {
    const idx = items.findIndex((item) => isEmployeeNavActive(pathname, item.to, item.end))
    return idx >= 0 ? idx : 0
  }, [items, pathname])

  const closeAndNavigate = useCallback(() => {
    const index = selectedIndexRef.current
    const target = itemsRef.current[index]
    setOpen(false)
    openRef.current = false
    if (target) {
      navigate(target.to)
    }
  }, [navigate])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return

      if (!openRef.current) {
        setOpen(true)
        openRef.current = true
        const startIndex = currentIndex
        setSelectedIndex(startIndex)
        selectedIndexRef.current = startIndex
      }

      if (isNextWheelKey(event)) {
        event.preventDefault()
        event.stopPropagation()
        setSelectedIndex((prev) => {
          const next = (prev + 1) % itemsRef.current.length
          selectedIndexRef.current = next
          return next
        })
        return
      }

      if (isPrevWheelKey(event)) {
        event.preventDefault()
        event.stopPropagation()
        setSelectedIndex((prev) => {
          const next = (prev - 1 + itemsRef.current.length) % itemsRef.current.length
          selectedIndexRef.current = next
          return next
        })
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (!openRef.current) return
      if (event.key !== 'Control' && event.key !== 'Shift') return
      event.preventDefault()
      closeAndNavigate()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [closeAndNavigate, currentIndex])

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open || items.length === 0) return null

  const count = items.length
  const segmentSweep = 360 / count
  const selected = items[selectedIndex]
  const SelectedIcon = selected.icon

  return (
    <div
      className="emp-nav-wheel-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Quick navigation wheel"
    >
      <p className="emp-nav-wheel__hint">
        Hold Ctrl+Shift · press &gt; to cycle · release to open
      </p>

      <div className="emp-nav-wheel">
        <svg
          className="emp-nav-wheel__svg"
          viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
          aria-hidden
        >
          {items.map((item, index) => {
            const start = -90 + index * segmentSweep
            const end = start + segmentSweep
            return (
              <path
                key={item.to}
                d={describeDonutSegment(CENTER, CENTER, INNER_RADIUS, OUTER_RADIUS, start, end)}
                className={cn('emp-nav-wheel__segment', index === selectedIndex && 'is-selected')}
              />
            )
          })}
          <circle
            className="emp-nav-wheel__hub"
            cx={CENTER}
            cy={CENTER}
            r={INNER_RADIUS - 2}
          />
        </svg>

        {items.map((item, index) => {
          const angle = -90 + (index + 0.5) * segmentSweep
          const iconPos = polarToCartesian(CENTER, CENTER, ICON_RADIUS, angle)
          const labelPos = polarToCartesian(CENTER, CENTER, LABEL_RADIUS, angle)
          const Icon = item.icon
          const label = item.navLabel ?? item.label
          const iconLeft = (iconPos.x / VIEW_SIZE) * 100
          const iconTop = (iconPos.y / VIEW_SIZE) * 100
          const labelLeft = (labelPos.x / VIEW_SIZE) * 100
          const labelTop = (labelPos.y / VIEW_SIZE) * 100

          return (
            <div key={`${item.to}-markers`}>
              <div
                className={cn('emp-nav-wheel__slot', index === selectedIndex && 'is-selected')}
                style={{ left: `${iconLeft}%`, top: `${iconTop}%` }}
              >
                <Icon className="emp-nav-wheel__slot-icon" aria-hidden />
              </div>
              <span
                className="emp-nav-wheel__label"
                style={{ left: `${labelLeft}%`, top: `${labelTop}%` }}
              >
                {label}
              </span>
            </div>
          )
        })}

        <div className="emp-nav-wheel__center">
          <SelectedIcon className="emp-nav-wheel__center-icon" aria-hidden />
          <span className="emp-nav-wheel__center-label">
            {selected.navLabel ?? selected.label}
          </span>
        </div>
      </div>
    </div>
  )
}
