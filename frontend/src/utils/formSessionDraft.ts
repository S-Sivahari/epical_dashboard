/** In-memory form drafts — survive SPA navigation, cleared on full page refresh. */
const drafts = new Map<string, unknown>()

export function readFormSessionDraft<T>(key: string): T | undefined {
  return drafts.get(key) as T | undefined
}

export function writeFormSessionDraft<T>(key: string, value: T): void {
  drafts.set(key, value)
}

export function clearFormSessionDraft(key: string): void {
  drafts.delete(key)
}

export function hasFormDraftContent(
  values: Record<string, unknown>,
  defaults: Record<string, unknown> = {},
): boolean {
  return Object.entries(values).some(([field, value]) => {
    const defaultValue = defaults[field]
    if (value === defaultValue) return false
    if (value == null) return false
    if (typeof value === 'string') return value.trim() !== ''
    if (typeof value === 'number') return value !== defaultValue
    if (typeof value === 'boolean') return value !== defaultValue
    return true
  })
}
