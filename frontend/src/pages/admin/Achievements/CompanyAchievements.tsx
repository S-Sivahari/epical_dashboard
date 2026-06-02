import { PageWrapper } from '@components/layout/PageWrapper'
import { CompanyAchievementsExperience } from '@components/company-achievements/CompanyAchievementsExperience'

export function CompanyAchievements() {
  return (
    <PageWrapper className="admin-hub-page-wrap relative z-10 py-3 font-body">
      <div className="crewiq-dashboard admin-achievements-view relative">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-achievements-shell relative z-10">
          <header className="admin-achievements-hub-header">
            <div className="admin-achievements-hero-top">
              <h1 className="admin-achievements-hero-title font-display">Company Achievements Hub</h1>
            </div>
          </header>

          <div className="admin-achievements-content">
            <CompanyAchievementsExperience editable adminHub />
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
