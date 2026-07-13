import { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { fetchMyAssignedProjects, fetchMyProjectWorkspace, fetchMyRequestedReviews } from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import '@pages/admin/Projects/adminProjects.css'
import './employeeProjectWorkflow.css'
import './employeeProjectsAdminTheme.css'

export function EmployeeProjectsLayout() {
  const [projects, setProjects] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [reviews, setReviews] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const [loadingReviews, setLoadingReviews] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      setLoadingProjects(true)
      try {
        const data = await fetchMyAssignedProjects()
        setProjects(Array.isArray(data) ? data : [])
      } catch {
        toast({ title: 'Error', description: 'Failed to load projects' })
        setProjects([])
      } finally {
        setLoadingProjects(false)
      }
    }
    void load()
  }, [toast])

  useEffect(() => {
    if (!projects.length) {
      setWorkspaces([])
      return
    }
    const loadWorkspaces = async () => {
      setLoadingWorkspaces(true)
      try {
        // Limit concurrency so opening the hub doesn’t stampede the workspace API.
        const CONCURRENCY = 3
        const results = []
        for (let i = 0; i < projects.length; i += CONCURRENCY) {
          const chunk = projects.slice(i, i + CONCURRENCY)
          const chunkResults = await Promise.all(
            chunk.map((project) => fetchMyProjectWorkspace(project.id).catch(() => null)),
          )
          results.push(...chunkResults)
        }
        setWorkspaces(results.filter(Boolean))
      } catch {
        setWorkspaces([])
      } finally {
        setLoadingWorkspaces(false)
      }
    }
    void loadWorkspaces()
  }, [projects])

  useEffect(() => {
    const loadReviews = async () => {
      setLoadingReviews(true)
      try {
        const data = await fetchMyRequestedReviews()
        setReviews(Array.isArray(data) ? data : [])
      } catch {
        setReviews([])
      } finally {
        setLoadingReviews(false)
      }
    }
    void loadReviews()
  }, [])

  const workspacesById = useMemo(() => {
    const map = {}
    for (const ws of workspaces) {
      if (ws?.project?.id) map[ws.project.id] = ws
    }
    return map
  }, [workspaces])

  const pendingReviewCount = useMemo(
    () => reviews.filter((review) => review.status === 'open').length,
    [reviews],
  )

  const outletContext = useMemo(
    () => ({
      projects,
      workspaces,
      workspacesById,
      reviews,
      loadingProjects,
      loadingWorkspaces,
      loadingReviews,
      pendingReviewCount,
      loading: loadingProjects || loadingWorkspaces,
      refreshReviews: async () => {
        try {
          const data = await fetchMyRequestedReviews()
          setReviews(Array.isArray(data) ? data : [])
        } catch {
          setReviews([])
        }
      },
    }),
    [
      projects,
      workspaces,
      workspacesById,
      reviews,
      loadingProjects,
      loadingWorkspaces,
      loadingReviews,
      pendingReviewCount,
    ],
  )

  return (
    <div
      className="admin-projects-view admin-projects-page admin-projects-directory-view relative flex min-h-0 flex-1 flex-col"
      data-employee-project-hub
    >
      <div className="admin-projects-workspace-shell relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet context={outletContext} />
      </div>
    </div>
  )
}

export default EmployeeProjectsLayout
