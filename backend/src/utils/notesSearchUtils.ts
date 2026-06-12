import type { DailyNoteStatus } from '../models/DailyNoteBlock';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES: DailyNoteStatus[] = ['draft', 'in_progress', 'completed', 'email_sent'];

export type NotesSearchQuery = {
  q?: string;
  from?: string;
  to?: string;
  week?: string;
  projectId?: string;
  employeeId?: string;
  status?: DailyNoteStatus;
  page?: number;
  limit?: number;
};

export type NoteSearchMatchField = 'date' | 'title' | 'project' | 'employee' | 'description';

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function assertDateKey(date: string, label: string): string {
  const trimmed = date.trim();
  if (!DATE_KEY_PATTERN.test(trimmed)) {
    throw Object.assign(new Error(`${label} must use yyyy-MM-dd format.`), { status: 400 });
  }
  return trimmed;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function resolveSearchDateRange(query: NotesSearchQuery): { from?: string; to?: string } {
  if (query.week?.trim()) {
    const monday = assertDateKey(query.week, 'week');
    const friday = addDaysToDateKey(monday, 4);
    return { from: monday, to: friday };
  }

  const from = query.from?.trim();
  const to = query.to?.trim();
  if (from && to) {
    return {
      from: assertDateKey(from, 'from'),
      to: assertDateKey(to, 'to'),
    };
  }
  if (from) return { from: assertDateKey(from, 'from') };
  if (to) return { to: assertDateKey(to, 'to') };
  return {};
}

export function normalizeSearchQuery(raw: NotesSearchQuery) {
  const q = raw.q?.trim() ?? '';
  const projectId = raw.projectId?.trim() ?? '';
  const employeeId = raw.employeeId?.trim() ?? '';
  const status = VALID_STATUSES.includes(raw.status as DailyNoteStatus)
    ? (raw.status as DailyNoteStatus)
    : undefined;
  const page = Math.max(1, Number(raw.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(raw.limit) || 25));
  const dateRange = resolveSearchDateRange(raw);

  return { q, projectId, employeeId, status, page, limit, ...dateRange };
}

export function buildSnippet(text: string, query: string, maxLength = 160): string {
  const clean = text.trim();
  if (!clean) return '';
  if (!query) return clean.length > maxLength ? `${clean.slice(0, maxLength)}…` : clean;

  const lower = clean.toLowerCase();
  const needle = query.toLowerCase();
  const index = lower.indexOf(needle);
  if (index < 0) return clean.length > maxLength ? `${clean.slice(0, maxLength)}…` : clean;

  const start = Math.max(0, index - 50);
  const end = Math.min(clean.length, index + query.length + 80);
  let snippet = clean.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < clean.length) snippet = `${snippet}…`;
  return snippet;
}

export function detectMatchedFields(input: {
  q: string;
  date: string;
  dailyBlockName: string;
  childTitle: string;
  projectName: string;
  employeeNames: string[];
  description: string;
}): NoteSearchMatchField[] {
  if (!input.q) return [];

  const regex = new RegExp(escapeRegex(input.q), 'i');
  const fields: NoteSearchMatchField[] = [];
  if (regex.test(input.date) || regex.test(input.dailyBlockName)) fields.push('date');
  if (regex.test(input.childTitle)) fields.push('title');
  if (regex.test(input.projectName)) fields.push('project');
  if (input.employeeNames.some((name) => regex.test(name))) fields.push('employee');
  if (regex.test(input.description) || regex.test(stripHtml(input.description))) fields.push('description');
  return fields;
}
