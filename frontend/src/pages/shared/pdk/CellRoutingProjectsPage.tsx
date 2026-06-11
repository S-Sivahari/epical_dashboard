import { useEffect, useMemo, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { AlertTriangle, CheckCircle2, FolderKanban, Grid3x3 } from 'lucide-react'

import { toast } from 'sonner'

import { CellRoutingAnalyticsChart } from '@components/pdk/CellRoutingAnalyticsChart'

import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'

import { MetalRoutingInsightsPanel } from '@components/pdk/MetalRoutingInsightsPanel'

import {

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



  const insightCards = useMemo(

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

    <MetalRoutingPageShell fill bleed>

      <div className="metal-routing-pdk-workspace">

        <div className="metal-routing-pdk-workspace-main metal-routing-page-shell">

          <div className="metal-routing-dashboard metal-routing-cell-routing-page metal-routing-pdk-modules-page">

            <header className="metal-routing-cell-routing-header metal-routing-pdk-modules-topbar">

              <div className="flex min-w-0 items-start gap-3">

                <span className="metal-routing-cell-routing-header__icon" aria-hidden>

                  <Grid3x3 className="h-5 w-5" />

                </span>

                <div className="min-w-0">

                  <h1 className="metal-routing-page-title">Cell Routing</h1>

                </div>

              </div>

            </header>



            <MetalRoutingCellRoutingProjectTable

              projects={projects}

              loading={loading}

              search={search}

              statusFilter={statusFilter}

              onSearchChange={setSearch}

              onStatusFilterChange={setStatusFilter}

              onOpenRouting={(projectId) => navigate(`${basePath}/cell-routing/${projectId}`)}

            />

          </div>

        </div>

        <aside className="metal-routing-pdk-modules-sidebar" aria-label="Cell routing insights">

          <MetalRoutingInsightsPanel

            cards={insightCards}

            loading={loading}

            embedded

            compact

          />

          <CellRoutingAnalyticsChart projects={projects} loading={loading} sidebar fill />

        </aside>

      </div>

    </MetalRoutingPageShell>

  )

}

