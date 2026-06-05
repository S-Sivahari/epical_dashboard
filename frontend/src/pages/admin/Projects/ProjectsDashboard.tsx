import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Briefcase, Globe, Lock, Search } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { ROUTES } from '@constants/routes'
import api from '@/services/api'
import { cn } from '@/utils/cn'
import type { AdminProjectRow } from '@/types/projectWorkspace'
import './adminProjects.css'

export function ProjectsDashboard() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const [projects, setProjects] = useState<AdminProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<AdminProjectRow[]>('/projects?syncCompletion=true')
      setProjects(Array.isArray(data) ? data : [])
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        (p.teamLead || '').toLowerCase().includes(q),
    )
  }, [projects, search])

  if (tab) {
    return <Navigate to={`${ROUTES.TIMESHEET}?${searchParams.toString()}`} replace />
  }

  return (
    <PageWrapper
      fillViewport
      className="admin-hub-page-wrap admin-projects-page relative z-10 max-w-none !px-0 !py-0 font-body"
    >
      <div className="crewiq-dashboard admin-projects-view relative flex h-full min-h-0 flex-1 flex-col">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-projects-shell relative z-10">
          <header className="admin-projects-head">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                <Briefcase className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h1 className="admin-projects-head-title">Projects</h1>
                <p className="admin-projects-head-sub">Open a project to manage libraries, cells, and dependencies.</p>
              </div>
            </div>
          </header>

          <div className="admin-projects-toolbar">
            <div className="admin-projects-search-wrap">
              <Search className="h-4 w-4" aria-hidden />
              <input
                type="search"
                placeholder="Search by project, client, or team lead…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search projects"
              />
            </div>
          </div>

          <div className="admin-projects-table-wrap">
            <table className="admin-projects-table">
              <thead>
                <tr>
                  <th>Project name</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Team lead</th>
                  <th style={{ textAlign: 'right' }}>Progress</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Loading projects…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No projects found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                      <td>{p.client}</td>
                      <td>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                            p.accessType === 'public' ? 'bg-sky-50 text-sky-800' : 'bg-violet-50 text-violet-800',
                          )}
                        >
                          {p.accessType === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {p.accessType === 'public' ? 'Public' : 'Private'}
                        </span>
                      </td>
                      <td>{p.teamLead || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontWeight: 700, color: '#065f46' }}>
                        {p.completionPercentage ?? 0}%
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={ROUTES.PROJECT_WORKSPACE(p.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          Open workspace <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
