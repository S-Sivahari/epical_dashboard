import { PageWrapper } from '@components/layout/PageWrapper'
import { CompanyAchievementsExperience } from '@components/company-achievements/CompanyAchievementsExperience'

export function CompanyAchievements() {
  return (
    <PageWrapper className="py-4">
      <CompanyAchievementsExperience editable />
    </PageWrapper>
  )
}
