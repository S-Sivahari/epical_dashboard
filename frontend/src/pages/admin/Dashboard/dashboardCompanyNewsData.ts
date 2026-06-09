export type CompanyNewsCategory = 'Policy' | 'Event' | 'Announcement'

export type DashboardCompanyNewsItem = {
  id: string
  category: CompanyNewsCategory
  headline: string
  summary: string
  date: string
}
