export interface AchievementPageColors {
  heroTitle: string
  heroSubtitle: string
  sectionTitle: string
  sectionSubtitle: string
  itemTitle: string
  itemDescription: string
}

export const DEFAULT_ACHIEVEMENT_PAGE_COLORS: AchievementPageColors = {
  heroTitle: '#ffffff',
  heroSubtitle: '#f4f4f5',
  sectionTitle: '#006400',
  sectionSubtitle: '#52525b',
  itemTitle: '#006400',
  itemDescription: '#52525b',
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim())
}

export function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('#') && /^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return `#${trimmed}`.toLowerCase()
  }
  if (isValidHexColor(trimmed)) return trimmed.toLowerCase()
  return fallback
}

export function resolvePageColors(
  stored?: Partial<AchievementPageColors> | null
): AchievementPageColors {
  const d = DEFAULT_ACHIEVEMENT_PAGE_COLORS
  return {
    heroTitle: normalizeHexColor(stored?.heroTitle ?? d.heroTitle, d.heroTitle),
    heroSubtitle: normalizeHexColor(stored?.heroSubtitle ?? d.heroSubtitle, d.heroSubtitle),
    sectionTitle: normalizeHexColor(stored?.sectionTitle ?? d.sectionTitle, d.sectionTitle),
    sectionSubtitle: normalizeHexColor(
      stored?.sectionSubtitle ?? d.sectionSubtitle,
      d.sectionSubtitle
    ),
    itemTitle: normalizeHexColor(stored?.itemTitle ?? d.itemTitle, d.itemTitle),
    itemDescription: normalizeHexColor(
      stored?.itemDescription ?? d.itemDescription,
      d.itemDescription
    ),
  }
}
