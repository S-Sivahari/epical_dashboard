import { forwardRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@pages/employee/lib/utils'

/**
 * Consistent portal card surface: soft primary-tinted border, hover elevation, focus/selection ring.
 * Border width stays at 1px to avoid layout shift when active.
 */
export function portalCardClass({
  selected = false,
  className = '',
  interactive = true,
  subtle = false,
} = {}) {
  if (subtle) {
    return cn(
      'rounded-lg border border-primary/10 bg-background/60 outline-none transition-[border-color,box-shadow,ring] duration-200 ease-out',
      interactive && 'hover:border-primary/25 hover:shadow-sm hover:shadow-primary/[0.04]',
      interactive &&
        'focus-within:border-primary/35 focus-within:ring-2 focus-within:ring-primary/10',
      selected && interactive && 'border-primary/40 ring-2 ring-primary/15 shadow-sm',
      className,
    )
  }

  return cn(
    'rounded-xl border bg-card shadow-card outline-none transition-[border-color,box-shadow,ring] duration-200 ease-out',
    interactive ? 'border-primary/15' : 'border-border',
    interactive &&
      'hover:border-primary/30 hover:shadow-md hover:shadow-primary/[0.07] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15',
    selected &&
      interactive &&
      'border-primary/50 ring-2 ring-primary/20 shadow-md shadow-primary/[0.08]',
    className,
  )
}

function isInteractiveClickTarget(target) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, label, [role="button"], [role="combobox"], [data-no-card-select]',
    ),
  )
}

export const InteractiveCard = forwardRef(function InteractiveCard(
  {
    as: Tag = 'section',
    className,
    children,
    selectable = true,
    selected: selectedProp,
    defaultSelected = false,
    onSelectedChange,
    onClick,
    to,
    subtle = false,
    ...rest
  },
  ref,
) {
  const navigate = useNavigate()
  const [internalSelected, setInternalSelected] = useState(defaultSelected)
  const isControlled = selectedProp !== undefined
  const selected = isControlled ? selectedProp : internalSelected
  const isNavigable = Boolean(to)
  const effectiveSelectable = isNavigable ? false : selectable

  function toggleSelected() {
    const next = !selected
    if (!isControlled) setInternalSelected(next)
    onSelectedChange?.(next)
  }

  function handleClick(e) {
    onClick?.(e)
    if (e.defaultPrevented || isInteractiveClickTarget(e.target)) return
    if (isNavigable) {
      navigate(to)
      return
    }
    if (!effectiveSelectable) return
    toggleSelected()
  }

  function handleKeyDown(e) {
    if (e.defaultPrevented || isInteractiveClickTarget(e.target)) return
    if (isNavigable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      navigate(to)
      return
    }
    if (!effectiveSelectable) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleSelected()
    }
  }

  return (
    <Tag
      ref={ref}
      tabIndex={isNavigable || effectiveSelectable ? 0 : undefined}
      role={isNavigable ? 'link' : undefined}
      data-portal-card=""
      data-selected={effectiveSelectable && selected ? 'true' : undefined}
      onClick={handleClick}
      onKeyDown={isNavigable || effectiveSelectable ? handleKeyDown : undefined}
      className={portalCardClass({
        selected: effectiveSelectable && selected,
        className: cn(isNavigable && 'cursor-pointer', className),
        subtle,
      })}
      {...rest}
    >
      {children}
    </Tag>
  )
})

/** @deprecated Use portalCardClass — alias for existing CARD_CLASS imports */
export const CARD_CLASS = portalCardClass({ className: 'p-5 sm:p-6' })
