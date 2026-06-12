import { LineChart } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'

type ProjectAnalysisLaunchButtonProps = {
  className?: string
}

export function ProjectAnalysisLaunchButton({ className }: ProjectAnalysisLaunchButtonProps) {
  const { pathname } = useLocation()

  if (pathname.startsWith(ROUTES.PROJECT_ANALYSIS)) {
    return null
  }

  return (
    <a
      href={`${ROUTES.PROJECT_ANALYSIS}/projects`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('project-analysis-launch-btn', className)}
      aria-label="Open Project Analysis in a new tab"
    >
      <LineChart className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span>Project Analysis</span>
    </a>
  )
}
