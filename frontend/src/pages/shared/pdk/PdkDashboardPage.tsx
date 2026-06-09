import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import type { DashboardProject, PdkModule } from '@/types/pdkMetalRouting'
import { assignPdkToProject, fetchDashboardProjects, fetchPdkModules } from '@services/pdkMetalRoutingService'

export function PdkDashboardPage({ basePath }: { basePath: string }) {
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [pdkModules, setPdkModules] = useState<PdkModule[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projs, modules] = await Promise.all([fetchDashboardProjects(), fetchPdkModules()])
      setProjects(projs)
      setPdkModules(modules)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleAssign = async (projectId: string, pdkModuleId: string) => {
    setSavingId(projectId)
    try {
      await assignPdkToProject(projectId, pdkModuleId || null)
      await load()
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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Assign a PDK module to each project. All cells in that project use the assigned PDK for metal calculations.
        </p>
      </div>

      {pdkModules.length === 0 ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No PDK modules yet.{' '}
          <Link to={`${basePath}/pdk-modules`} className="font-medium text-primary underline">
            Create a PDK module
          </Link>{' '}
          before assigning to projects.
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-white py-12 text-center text-sm text-muted">
          No projects found.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Project</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Tech Node</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Assigned PDK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-surface/40">
                  <td className="px-4 py-3 font-medium text-ink">{project.projectName}</td>
                  <td className="px-4 py-3 text-muted">{project.clientName}</td>
                  <td className="px-4 py-3">{project.technologyNode}</td>
                  <td className="px-4 py-3">{project.status}</td>
                  <td className="px-4 py-3">
                    <select
                      className="h-9 min-w-[200px] rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                      value={project.pdkModuleId ?? ''}
                      disabled={savingId === project.id || pdkModules.length === 0}
                      onChange={(e) => void handleAssign(project.id, e.target.value)}
                    >
                      <option value="">— Not assigned —</option>
                      {pdkModules.map((mod) => (
                        <option key={mod._id} value={mod._id}>
                          {mod.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MetalRoutingPageShell>
  )
}
