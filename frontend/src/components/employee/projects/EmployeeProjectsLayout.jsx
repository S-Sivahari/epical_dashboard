import { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { EmployeeProjectsSidebar } from './EmployeeProjectsSidebar'
import { fetchMyAssignedProjects, fetchMyProjectWorkspace, fetchMyRequestedReviews } from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import './employeeProjectWorkflow.css'

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
        const results = await Promise.all(
          projects.map((project) =>
            fetchMyProjectWorkspace(project.id).catch(() => null),
          ),
        )
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
    ],
  )

  return (
    <div className="emp-wf-page emp-wf-page--hub" data-page-scrollable data-employee-project-hub>
      <div className="emp-wf-projects-shell">
        <EmployeeProjectsSidebar pendingReviewCount={pendingReviewCount} />
        <div className="emp-wf-projects-main">
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  )
}
