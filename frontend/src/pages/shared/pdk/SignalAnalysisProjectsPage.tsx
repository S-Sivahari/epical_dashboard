import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Briefcase, FolderKanban, Layers } from 'lucide-react'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import { MetalRoutingCellRoutingProjectTable } from '@components/pdk/MetalRoutingCellRoutingProjectTable'
import { showPortalError } from '@/utils/portalNotice'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import { fetchDashboardProjects } from '@services/pdkMetalRoutingService'
import { isProjectPdkAssigned } from '@/utils/metalRoutingProjectDisplay'

export function SignalAnalysisProjectsPage({
  basePath,
  hidePageHeader = false,
  premiumLayout = false,
}: {
  basePath: string
  hidePageHeader?: boolean
  premiumLayout?: boolean
}) {
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

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status?.toLowerCase() === 'active').length
    const assigned = projects.filter((p) => isProjectPdkAssigned(p)).length
    return {
      total: projects.length,
      active,
      assigned,
      unassigned: projects.length - assigned,
    }
  }, [projects])

  const usePremium = premiumLayout || hidePageHeader

  const content = (
    <MetalRoutingCellRoutingProjectTable
      projects={projects}
      loading={loading}
      search={search}
      statusFilter={statusFilter}
      hideTechnology
      hideToolbarTitle={hidePageHeader}
      layoutVariant={usePremium ? 'premium' : 'default'}
      pdkModulesHref={usePremium ? `${basePath}/pdk-modules` : undefined}
      onSearchChange={setSearch}
      onStatusFilterChange={setStatusFilter}
      onOpenRouting={(projectId) =>
        navigate(`${basePath}/projects/${projectId}/pdk-selection`)
      }
    />
  )

  return (
    <MetalRoutingPageShell fill bleed>
      <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
      {usePremium ? (
        <div className="signal-analysis-landing metal-routing-dashboard metal-routing-signal-projects-page">
          <div className="signal-analysis-landing__ambient" aria-hidden />
          <div className="signal-analysis-landing__grid-overlay" aria-hidden />
          <div className="signal-analysis-landing__inner">
            <div className="signal-analysis-landing__stats" aria-label="Project overview">
              <div className="signal-analysis-landing__stat signal-analysis-landing__stat--forest">
                <span className="signal-analysis-landing__stat-icon" aria-hidden>
                  <Briefcase className="h-4 w-4" />
                </span>
                <div>
                  <p className="signal-analysis-landing__stat-label">Total projects</p>
                  <p className="signal-analysis-landing__stat-value">
                    {loading ? '—' : stats.total}
                  </p>
                </div>
              </div>
              <div className="signal-analysis-landing__stat signal-analysis-landing__stat--teal">
                <span className="signal-analysis-landing__stat-icon" aria-hidden>
                  <Activity className="h-4 w-4" />
                </span>
                <div>
                  <p className="signal-analysis-landing__stat-label">Active</p>
                  <p className="signal-analysis-landing__stat-value">
                    {loading ? '—' : stats.active}
                  </p>
                </div>
              </div>
              <div className="signal-analysis-landing__stat signal-analysis-landing__stat--violet">
                <span className="signal-analysis-landing__stat-icon" aria-hidden>
                  <Layers className="h-4 w-4" />
                </span>
                <div>
                  <p className="signal-analysis-landing__stat-label">PDK assigned</p>
                  <p className="signal-analysis-landing__stat-value">
                    {loading ? '—' : stats.assigned}
                  </p>
                </div>
              </div>
              <div className="signal-analysis-landing__stat signal-analysis-landing__stat--amber">
                <span className="signal-analysis-landing__stat-icon" aria-hidden>
                  <FolderKanban className="h-4 w-4" />
                </span>
                <div>
                  <p className="signal-analysis-landing__stat-label">Unassigned</p>
                  <p className="signal-analysis-landing__stat-value">
                    {loading ? '—' : stats.unassigned}
                  </p>
                </div>
              </div>
            </div>
            {content}
          </div>
        </div>
      ) : (
        <div className="metal-routing-dashboard metal-routing-pdk-modules-page metal-routing-signal-projects-page">
          {content}
        </div>
      )}
    </MetalRoutingPageShell>
  )
}
