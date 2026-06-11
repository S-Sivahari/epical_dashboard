import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Layers } from 'lucide-react'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import { MetalRoutingCellRoutingProjectTable } from '@components/pdk/MetalRoutingCellRoutingProjectTable'
import { showPortalError } from '@/utils/portalNotice'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import { fetchDashboardProjects } from '@services/pdkMetalRoutingService'

export function SignalAnalysisProjectsPage({ basePath }: { basePath: string }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [notice, setNotice] = useState<TopNotice | null>(null)
  const dismissNotice = useCallback(() => setNotice(null), [])

  useEffect(() => {
    void (async () => {
      try {
        setProjects(await fetchDashboardProjects())
      } catch {
        showPortalError(setNotice, 'Failed to load projects', 'Refresh the page or try again later.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <MetalRoutingPageShell fill bleed>
      <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
      <div className="metal-routing-dashboard metal-routing-pdk-modules-page metal-routing-signal-projects-page">
        <header className="metal-routing-signal-projects-header">
          <div className="metal-routing-signal-projects-header__panel metal-routing-signal-projects-header__panel--compact">
            <div className="metal-routing-signal-projects-header__brand">
              <span className="metal-routing-signal-projects-header__icon" aria-hidden>
                <Activity className="h-5 w-5" />
              </span>
              <h1 className="metal-routing-signal-projects-header__title">Signal Analysis</h1>
            </div>
            <Link
              to={`${basePath}/pdk-modules`}
              className="metal-routing-signal-projects-header__cta metal-routing-pdk-modules-cta"
            >
              <Layers className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              PDK Modules
            </Link>
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
            navigate(`${basePath}/projects/${projectId}/pdk-selection`)
          }
        />
      </div>
    </MetalRoutingPageShell>
  )
}
