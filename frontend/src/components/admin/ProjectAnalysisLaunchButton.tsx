import { LineChart } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '@constants/routes'
import { ensureProjectAnalysisSession, openProjectAnalysisTab } from '@/utils/projectAnalysisAccess'
import { cn } from '@/utils/cn'

type ProjectAnalysisLaunchButtonProps = {
  className?: string
  audience?: 'admin' | 'employee'
}

export function ProjectAnalysisLaunchButton({
  className,
  audience = 'admin',
}: ProjectAnalysisLaunchButtonProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const base =
    audience === 'employee' ? ROUTES.EMPLOYEE_PROJECT_ANALYSIS : ROUTES.PROJECT_ANALYSIS
  const projectsUrl = `${base}/projects`

  if (pathname.startsWith(base)) {
    return null
  }

  const openProjectAnalysis = () => {
    // Employees open in the same tab so Projects always loads (no popup blocker).
    if (audience === 'employee') {
      ensureProjectAnalysisSession()
      navigate(projectsUrl)
      return
    }
    openProjectAnalysisTab(projectsUrl)
  }

  return (
    <button
      type="button"
      onClick={openProjectAnalysis}
      className={cn('project-analysis-launch-btn', className)}
      aria-label="Open Project Management"
    >
      <LineChart className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span>Project Management</span>
    </button>
  )
}
