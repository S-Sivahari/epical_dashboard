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

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
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
    heroTitle: normalizeHexColor(stored?.heroTitle, d.heroTitle),
    heroSubtitle: normalizeHexColor(stored?.heroSubtitle, d.heroSubtitle),
    sectionTitle: normalizeHexColor(stored?.sectionTitle, d.sectionTitle),
    sectionSubtitle: normalizeHexColor(stored?.sectionSubtitle, d.sectionSubtitle),
    itemTitle: normalizeHexColor(stored?.itemTitle, d.itemTitle),
    itemDescription: normalizeHexColor(stored?.itemDescription, d.itemDescription),
  }
}

export function parsePageColorsFromBody(body: Record<string, unknown>): AchievementPageColors {
  const d = DEFAULT_ACHIEVEMENT_PAGE_COLORS
  return {
    heroTitle: normalizeHexColor(body.heroTitleColor, d.heroTitle),
    heroSubtitle: normalizeHexColor(body.heroSubtitleColor, d.heroSubtitle),
    sectionTitle: normalizeHexColor(body.sectionTitleColor, d.sectionTitle),
    sectionSubtitle: normalizeHexColor(body.sectionSubtitleColor, d.sectionSubtitle),
    itemTitle: normalizeHexColor(body.itemTitleColor, d.itemTitle),
    itemDescription: normalizeHexColor(body.itemDescriptionColor, d.itemDescription),
  }
}
