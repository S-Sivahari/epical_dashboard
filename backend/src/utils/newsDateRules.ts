export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function yesterdayLocalDateKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return toLocalDateKey(d);
}

export function normalizeNewsDateInput(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return trimmed;
}

/** News may use yesterday or any earlier calendar day (not today or future). */
export function isPastNewsDateKey(dateKey: string): boolean {
  const normalized = normalizeNewsDateInput(dateKey);
  if (!normalized) return false;
  return normalized <= yesterdayLocalDateKey();
}

export function assertPastNewsDateKey(dateKey: string): void {
  const normalized = normalizeNewsDateInput(dateKey);
  if (!normalized) {
    throw Object.assign(new Error('Invalid date format. Use YYYY-MM-DD.'), { status: 400 });
  }
  if (!isPastNewsDateKey(normalized)) {
    throw Object.assign(
      new Error('Only past dates are allowed. Choose yesterday or an earlier date.'),
      { status: 400 },
    );
  }
}

export function publishedAtFromDateKey(dateKey: string): string {
  assertPastNewsDateKey(dateKey);
  return new Date(`${normalizeNewsDateInput(dateKey)!}T12:00:00`).toISOString();
}
