import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FolderKanban, Grid3x3, Search } from 'lucide-react'
import { toast } from 'sonner'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { MetalRoutingDashboardStats } from '@components/pdk/MetalRoutingDashboardStats'
import {
  CellRoutingStatusFilter,
  MetalRoutingCellRoutingProjectTable,
} from '@components/pdk/MetalRoutingCellRoutingProjectTable'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import { fetchDashboardProjects } from '@services/pdkMetalRoutingService'

export function CellRoutingProjectsPage({ basePath }: { basePath: string }) {
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
    const unassigned = total - assigned
    return { total, assigned, unassigned }
  }, [projects])

  const statCards = useMemo(
    () => [
      {
        label: 'Total Projects',
        value: stats.total,
        hint: 'Available for routing',
        icon: FolderKanban,
        tone: 'green' as const,
      },
      {
        label: 'Assigned PDK',
        value: stats.assigned,
        hint: 'Ready for cell routing',
        icon: CheckCircle2,
        tone: 'emerald' as const,
      },
      {
        label: 'Unassigned',
        value: stats.unassigned,
        hint: 'Needs PDK assignment',
        icon: AlertTriangle,
        tone: 'orange' as const,
      },
    ],
    [stats],
  )

  return (
    <MetalRoutingPageShell>
      <div className="metal-routing-dashboard">
        <header className="metal-routing-cell-routing-header">
          <div className="flex min-w-0 items-start gap-3">
            <span className="metal-routing-cell-routing-header__icon" aria-hidden>
              <Grid3x3 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="metal-routing-page-title">Cell Routing</h1>
            </div>
          </div>
          <div className="metal-routing-cell-routing-header__tools">
            <label className="metal-routing-search-field metal-routing-cell-routing-search">
              <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <input
                type="search"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <CellRoutingStatusFilter
              value={statusFilter}
              onChange={setStatusFilter}
              projects={projects}
            />
          </div>
        </header>

        <MetalRoutingDashboardStats
          cards={statCards}
          loading={loading}
          className="metal-routing-stats-grid--three"
        />

        <MetalRoutingCellRoutingProjectTable
          projects={projects}
          loading={loading}
          search={search}
          statusFilter={statusFilter}
          onOpenRouting={(projectId) => navigate(`${basePath}/cell-routing/${projectId}`)}
        />
      </div>
    </MetalRoutingPageShell>
  )
}
