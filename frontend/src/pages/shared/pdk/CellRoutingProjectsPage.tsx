import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { PageWrapper } from '@components/layout/PageWrapper'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import { fetchDashboardProjects } from '@services/pdkMetalRoutingService'
import { cn } from '@/utils/cn'

export function CellRoutingProjectsPage({ basePath }: { basePath: string }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        setProjects(await fetchDashboardProjects())
      } catch {
        toast.error('Failed to load projects')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <PageWrapper scrollable>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Cell Routing</h1>
        <p className="mt-1 text-sm text-muted">Select a project to open cell routing analysis.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted">
          No projects available.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`${basePath}/cell-routing/${project.id}`)}
              className={cn(
                'rounded-xl border border-border bg-white p-5 text-left shadow-sm transition-ui',
                'hover:border-primary/40 hover:shadow-md',
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Briefcase className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-ink">{project.projectName}</p>
                  <p className="text-xs text-muted">{project.clientName}</p>
                </div>
              </div>
              <p className="text-xs text-muted">Tech: {project.technologyNode}</p>
              <p className="mt-1 text-xs font-medium text-primary">
                PDK: {project.pdkModuleName ?? 'Not assigned'}
              </p>
            </button>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
