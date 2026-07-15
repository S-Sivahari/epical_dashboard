import { LineChart } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '@constants/routes'
import { openProjectAnalysisTab } from '@/utils/projectAnalysisAccess'
import { cn } from '@/utils/cn'

type ProjectAnalysisLaunchButtonProps = {
  className?: string
  audience?: 'admin' | 'employee'
}

export function ProjectAnalysisLaunchButton({
  className,
  audience = 'admin',
}: ProjectAnalysisLaunchButtonProps) {
  const { pathname } = useLocation()
  const base =
    audience === 'employee' ? ROUTES.EMPLOYEE_PROJECT_ANALYSIS : ROUTES.PROJECT_ANALYSIS
  const projectsUrl = `${base}/projects`

  if (pathname.startsWith(base)) {
    return null
  }

  const openProjectAnalysis = () => {
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
