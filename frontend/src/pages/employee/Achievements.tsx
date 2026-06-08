import { CompanyAchievementsExperience } from '@components/company-achievements/CompanyAchievementsExperience'

/** Read-only company achievements — full bleed within the employee main column. */
export default function EmployeeAchievementsPage() {
  return (
    <CompanyAchievementsExperience
      employeePresentation
      bleedClassName="-mx-4 w-[calc(100%+2rem)] shrink-0 md:-mx-6 md:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]"
    />
  )
}
