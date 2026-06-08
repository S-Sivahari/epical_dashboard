/**
 * Semantic typography class tokens (defined in src/styles/typography.css).
 * Use these constants in TSX to avoid scattering raw class strings.
 */
export const typography = {
  surface: 'dashboard-surface',
  pageTitle: 'type-page-title',
  sectionTitle: 'type-section-title',
  cardTitle: 'type-card-title',
  cardLabel: 'type-card-label',
  cardLabelCaps: 'type-card-label-caps',
  body: 'type-body',
  bodySm: 'type-body-sm',
  tableHead: 'type-table-head',
  tableCell: 'type-table-cell',
  metricXl: 'type-metric-xl',
  metricLg: 'type-metric-lg',
  metricMd: 'type-metric-md',
  metric: 'type-metric',
  metricInline: 'type-metric-inline',
  calendarMonth: 'type-calendar-month',
  calendarWeekday: 'type-calendar-weekday',
  calendarDay: 'type-calendar-day',
  dateRangePopover: 'date-range-popover',
} as const
