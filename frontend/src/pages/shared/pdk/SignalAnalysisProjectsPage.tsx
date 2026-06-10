import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { MetalRoutingCellRoutingProjectTable } from '@components/pdk/MetalRoutingCellRoutingProjectTable'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import { fetchDashboardProjects } from '@services/pdkMetalRoutingService'

export function SignalAnalysisProjectsPage({ basePath }: { basePath: string }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const stats = useMemo(() => {
    const total = projects.length
    const assigned = projects.filter((p) => p.pdkModuleId).length
    return { total, assigned, unassigned: total - assigned }
  }, [projects])

  return (
    <MetalRoutingPageShell fill bleed>
      <div className="metal-routing-dashboard metal-routing-pdk-modules-page">
        <header className="metal-routing-cell-routing-header metal-routing-pdk-modules-topbar">
          <div className="flex min-w-0 items-start gap-3">
            <span className="metal-routing-cell-routing-header__icon" aria-hidden>
              <Activity className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="metal-routing-page-title">Signal Analysis</h1>
              <p className="metal-routing-page-desc">
                {stats.total} projects · {stats.assigned} with PDK assigned
              </p>
            </div>
          </div>
          <Link
            to={`${basePath}/pdk-modules`}
            className="metal-routing-pdk-modules-cta shrink-0"
          >
            <Layers className="h-5 w-5" aria-hidden />
            PDK Modules
          </Link>
        </header>

        <MetalRoutingCellRoutingProjectTable
          projects={projects}
          loading={loading}
          search={search}
          statusFilter={statusFilter}
          hideTechnology
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          onOpenRouting={(projectId) =>
            navigate(`${basePath}/projects/${projectId}/signal-analysis`)
          }
        />
      </div>
    </MetalRoutingPageShell>
  )
}
