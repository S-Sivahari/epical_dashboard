import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { MetalRoutingDashboardVisuals } from '@components/pdk/MetalRoutingDashboardVisuals'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { MetalRoutingProjectOverview } from '@components/pdk/MetalRoutingProjectOverview'
import { Button } from '@components/ui/Button'
import { ROUTES } from '@constants/routes'
import type { DashboardProject, MetalRoutingDashboardMetrics, PdkModule } from '@/types/pdkMetalRouting'
import {
  assignPdkToProject,
  fetchDashboardMetrics,
  fetchDashboardProjects,
  fetchPdkModules,
} from '@services/pdkMetalRoutingService'

export function PdkDashboardPage({ basePath }: { basePath: string }) {
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [pdkModules, setPdkModules] = useState<PdkModule[]>([])
  const [metrics, setMetrics] = useState<MetalRoutingDashboardMetrics | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const isAdmin = basePath.startsWith('/admin')

  const loadMetrics = useCallback(async (projectId?: string | null) => {
    const nextMetrics = await fetchDashboardMetrics(projectId)
    setMetrics(nextMetrics)
    setSelectedProjectId(nextMetrics.selectedProjectId)
    return nextMetrics
  }, [])

  const load = useCallback(async (metricsProjectId?: string | null) => {
    setLoading(true)
    try {
      const [projs, modules] = await Promise.all([fetchDashboardProjects(), fetchPdkModules()])
      setProjects(projs)
      setPdkModules(modules)
      await loadMetrics(metricsProjectId)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [loadMetrics])

  useEffect(() => {
    void load()
  }, [load])

  const handleSelectProject = useCallback(
    (projectId: string) => {
      void loadMetrics(projectId).catch(() => {
        toast.error('Failed to load routing metrics')
      })
    },
    [loadMetrics],
  )

  const handleAssign = async (projectId: string, pdkModuleId: string) => {
    setSavingId(projectId)
    try {
      await assignPdkToProject(projectId, pdkModuleId || null)
      await load(selectedProjectId)
      toast.success('PDK module assigned to project')
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(message ?? 'Failed to assign PDK module')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <MetalRoutingPageShell>
      <div className="metal-routing-dashboard">
        <header className="metal-routing-dashboard-header">
          <div className="min-w-0 flex-1">
            <h1 className="metal-routing-page-title">Dashboard</h1>
          </div>
          {isAdmin ? (
            <Button
              asChild
              size="md"
              icon={<Plus className="h-4 w-4" />}
              className="shrink-0"
            >
              <Link to={ROUTES.PROJECTS}>Add Project</Link>
            </Button>
          ) : null}
        </header>

        {pdkModules.length === 0 ? (
          <div className="metal-routing-dashboard-alert">
            <AlertTriangle className="mr-1.5 inline h-4 w-4 shrink-0 align-text-bottom" aria-hidden />
            No PDK modules yet.{' '}
            <Link to={`${basePath}/pdk-modules`} className="font-medium text-primary underline">
              Create a PDK module
            </Link>{' '}
            before assigning to projects.
          </div>
        ) : null}

        <MetalRoutingDashboardVisuals metrics={metrics} loading={loading} />

        <MetalRoutingProjectOverview
          projects={projects}
          pdkModules={pdkModules}
          loading={loading}
          savingId={savingId}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
          onAssignPdk={(projectId, pdkModuleId) => void handleAssign(projectId, pdkModuleId)}
        />
      </div>
    </MetalRoutingPageShell>
  )
}
