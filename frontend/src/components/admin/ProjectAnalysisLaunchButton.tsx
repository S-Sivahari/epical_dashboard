import { LineChart } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '@constants/routes'
import { openProjectAnalysisTab } from '@/utils/projectAnalysisAccess'
import { cn } from '@/utils/cn'

type ProjectAnalysisLaunchButtonProps = {
  className?: string
}

export function ProjectAnalysisLaunchButton({ className }: ProjectAnalysisLaunchButtonProps) {
  const { pathname } = useLocation()

  if (pathname.startsWith(ROUTES.PROJECT_ANALYSIS)) {
    return null
  }

  const openProjectAnalysis = () => {
    openProjectAnalysisTab(`${ROUTES.PROJECT_ANALYSIS}/projects`)
  }

  return (
    <button
      type="button"
      onClick={openProjectAnalysis}
      className={cn('project-analysis-launch-btn', className)}
      aria-label="Open Project Management in a new tab"
    >
      <LineChart className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span>Project Management</span>
    </button>
  )
}
