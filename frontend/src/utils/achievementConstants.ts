export const ACHIEVEMENT_CATEGORIES = [
  'Innovation',
  'Excellence',
  'Teamwork',
  'Leadership',
  'Milestone',
  'Recognition',
  'Best Employee',
  'General',
] as const

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number]

const CATEGORY_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  Innovation: { bg: 'bg-violet-100', text: 'text-violet-800', ring: 'ring-violet-200' },
  Excellence: { bg: 'bg-amber-100', text: 'text-amber-900', ring: 'ring-amber-200' },
  Teamwork: { bg: 'bg-sky-100', text: 'text-sky-900', ring: 'ring-sky-200' },
  Leadership: { bg: 'bg-indigo-100', text: 'text-indigo-900', ring: 'ring-indigo-200' },
  Milestone: { bg: 'bg-emerald-100', text: 'text-emerald-900', ring: 'ring-emerald-200' },
  Recognition: { bg: 'bg-rose-100', text: 'text-rose-900', ring: 'ring-rose-200' },
  'Best Employee': { bg: 'bg-[#e6f9ec]', text: 'text-[#047a24]', ring: 'ring-[#06C033]/30' },
  General: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
}

const FALLBACK_PALETTE = [
  { bg: 'bg-teal-100', text: 'text-teal-900', ring: 'ring-teal-200' },
  { bg: 'bg-orange-100', text: 'text-orange-900', ring: 'ring-orange-200' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-900', ring: 'ring-fuchsia-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-900', ring: 'ring-cyan-200' },
]

export function getCategoryStyle(category: string) {
  const known = CATEGORY_STYLES[category]
  if (known) return known
  const hash = category.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]
}

export const ACHIEVEMENTS_PAGE_SIZE = 12
