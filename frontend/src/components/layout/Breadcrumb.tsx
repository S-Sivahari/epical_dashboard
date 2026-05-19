import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/utils/cn'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumb({ className }: { items?: Crumb[]; className?: string }) {
  const navigate = useNavigate()
  
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center text-sm text-muted', className)}>
      <button 
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 hover:text-ink transition-ui bg-surface/50 px-3 py-1.5 rounded-lg border border-border"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
    </nav>
  )
}
