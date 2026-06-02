export type CompanyNewsCategory = 'Policy' | 'Event' | 'Announcement'

export type DashboardCompanyNewsItem = {
  id: string
  category: CompanyNewsCategory
  headline: string
  summary: string
  date: string
}

export const DASHBOARD_COMPANY_NEWS_FALLBACK: DashboardCompanyNewsItem[] = [
  {
    id: '1',
    category: 'Policy',
    headline: 'Q3 Health Insurance Open Enrollment Window Closes This Friday',
    summary:
      'Complete plan selection in the employee benefits portal before the enrollment window closes at end of day Friday.',
    date: 'Jun 1, 2026',
  },
  {
    id: '2',
    category: 'Announcement',
    headline: 'Scheduled System Maintenance: Portal Offline This Saturday Between 02:00 and 04:00 IST',
    summary:
      'HR self-service and timesheet modules will be unavailable during the maintenance window. Save work before Saturday 02:00 IST.',
    date: 'May 30, 2026',
  },
  {
    id: '3',
    category: 'Event',
    headline: 'Mandatory Compliance Training Due for All Managers by June 10',
    summary:
      'Managers must complete the annual workplace compliance module in the learning portal and acknowledge the policy attestation.',
    date: 'May 28, 2026',
  },
]
