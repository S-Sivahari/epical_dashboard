import { useEffect, type RefObject } from 'react'

/** Diagonal mint edge: top-right 100% → bottom-right 86% of band width. */
const MINT_SLANT = 0.14
const NAME_END_PAD_PX = 60

/**
 * Size the angled mint slash band so the diagonal right edge meets the name
 * at the text baseline (wider at top by design, no extra flat overhang).
 */
export function useEmployeeCmdBarSlashBand(
  headerRef: RefObject<HTMLElement | null>,
  brandRef: RefObject<HTMLElement | null>,
  deps: ReadonlyArray<unknown> = [],
) {
  useEffect(() => {
    const header = headerRef.current
    const brand = brandRef.current
    if (!header || !brand) return

    const sync = () => {
      const headerRect = header.getBoundingClientRect()
      const nameEl = brand.querySelector<HTMLElement>('.employee-cmd-bar__name')
      const targetRect = nameEl?.getBoundingClientRect() ?? brand.getBoundingClientRect()

      const nameEndFromLeft = targetRect.right - headerRect.left
      const yRatio = Math.min(
        1,
        Math.max(0, (targetRect.top + targetRect.height / 2 - headerRect.top) / headerRect.height),
      )

      // Diagonal x at the name's vertical centre: W × (1 − slant × yRatio)
      const band = Math.ceil((nameEndFromLeft + NAME_END_PAD_PX) / (1 - MINT_SLANT * yRatio))
      header.style.setProperty('--cmd-slash-band', `${band}px`)
      header.style.setProperty('--cmd-name-y-ratio', String(yRatio))
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(brand)
    const nameEl = brand.querySelector('.employee-cmd-bar__name')
    if (nameEl) observer.observe(nameEl)
    window.addEventListener('resize', sync)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, deps)
}
