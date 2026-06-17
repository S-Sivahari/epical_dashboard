import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import { MetalRoutingCellRoutingProjectTable } from '@components/pdk/MetalRoutingCellRoutingProjectTable'
import { showPortalError } from '@/utils/portalNotice'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import { fetchDashboardProjects } from '@services/pdkMetalRoutingService'

export function SignalAnalysisProjectsPage({
  basePath,
  hidePageHeader = false,
}: {
  basePath: string
  hidePageHeader?: boolean
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

  return (
    <MetalRoutingPageShell fill bleed>
      <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
      <div className="metal-routing-dashboard metal-routing-pdk-modules-page metal-routing-signal-projects-page">
        <MetalRoutingCellRoutingProjectTable
          projects={projects}
          loading={loading}
          search={search}
          statusFilter={statusFilter}
          hideTechnology
          hideToolbarTitle={hidePageHeader}
          pdkModulesHref={hidePageHeader ? `${basePath}/pdk-modules` : undefined}
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
