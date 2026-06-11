import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
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

  return (
    <MetalRoutingPageShell fill bleed>
      <div className="metal-routing-dashboard metal-routing-pdk-modules-page metal-routing-signal-projects-page">
        <header className="metal-routing-signal-projects-header">
          <div className="metal-routing-signal-projects-header__panel metal-routing-signal-projects-header__panel--compact">
            <div className="metal-routing-signal-projects-header__brand">
              <span className="metal-routing-signal-projects-header__icon" aria-hidden>
                <Activity className="h-5 w-5" />
              </span>
              <h1 className="metal-routing-signal-projects-header__title">Signal Analysis</h1>
            </div>
          </div>
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
