import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import { toast } from 'sonner'

type ViewMode = 'card' | 'list'

interface Project {
  id: string
  projectName: string
  description: string
  teamLead?: string
  assignedEmployeesCount: number
  totalLibraries: number
  totalCells: number
  completedCells: number
  pendingReviews: number
  progress: number
  status: 'Not Started' | 'In Progress' | 'Pending Review' | 'Completed'
}

export function ProjectsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('projectManagement.projects.viewMode')
    return (saved as ViewMode) || 'card'
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    localStorage.setItem('projectManagement.projects.viewMode', viewMode)
  }, [viewMode])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      // Fetch from dashboard endpoint which includes project cards
      const res = await api.get('/project-management/dashboard/metrics')
      setProjects(res.data.projectCards || [])
    } catch (err) {
      console.error('Failed to fetch projects:', err)
      toast.error('Failed to load projects')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.teamLead && p.teamLead.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Projects</h2>
          <p className="mt-1 text-sm text-slate-600">Manage and view all projects</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-[var(--emerald-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--green-600)]">
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[var(--emerald-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--emerald-dark)]/20"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-slate-900 focus:border-[var(--emerald-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--emerald-dark)]/20"
        >
          <option value="all">All Statuses</option>
          <option value="Not Started">Not Started</option>
          <option value="In Progress">In Progress</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Completed">Completed</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1">
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
              viewMode === 'card'
                ? 'bg-[var(--emerald-dark)] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Card View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
              viewMode === 'list'
                ? 'bg-[var(--emerald-dark)] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <List className="h-4 w-4" />
            List View
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <p className="text-sm font-semibold text-slate-600">No projects found</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <ProjectTable projects={filteredProjects} />
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const statusColors = {
    'Not Started': 'bg-slate-50 text-slate-700 border-slate-200',
    'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
    'Pending Review': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }

  return (
    <div 
      onClick={() => navigate(`/admin/project-management/projects/${project.id}`)}
      className="cursor-pointer rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-lg font-bold text-slate-900">{project.projectName}</h3>
        <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${statusColors[project.status]}`}>
          {project.status}
        </span>
      </div>
      
      <p className="mb-4 text-sm text-slate-600 line-clamp-2">{project.description || 'No description'}</p>
      
      <div className="mb-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Team Lead:</span>
          <span className="font-bold text-slate-900">{project.teamLead || 'Not assigned'}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Employees:</span>
          <span className="font-bold text-slate-900">{project.assignedEmployeesCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Libraries:</span>
          <span className="font-bold text-slate-900">{project.totalLibraries}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Cells:</span>
          <span className="font-bold text-slate-900">{project.totalCells}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Pending Reviews:</span>
          <span className="font-bold text-slate-900">{project.pendingReviews}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-semibold text-slate-600">Progress</span>
          <span className="font-bold text-slate-900">{project.progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-[var(--emerald-dark)]"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/project-management/projects/${project.id}`);
          }}
          className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
        >
          View Details
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open edit modal
          }}
          className="flex-1 rounded-lg bg-[var(--emerald-dark)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--green-600)]"
        >
          Edit
        </button>
      </div>
    </div>
  )
}

function ProjectTable({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();
  
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Project Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Team Lead
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Employees
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Libraries
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Cells
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projects.map((project) => (
              <tr 
                key={project.id} 
                onClick={() => navigate(`/admin/project-management/projects/${project.id}`)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-3 text-sm font-bold text-slate-900">{project.projectName}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{project.teamLead || '—'}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{project.assignedEmployeesCount}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{project.totalLibraries}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{project.totalCells}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{project.progress}%</td>
                <td className="px-4 py-3">
                  <span className={`rounded-lg px-2 py-1 text-xs font-bold ${
                    project.status === 'Not Started' ? 'bg-slate-50 text-slate-700' :
                    project.status === 'In Progress' ? 'bg-blue-50 text-blue-700' :
                    project.status === 'Pending Review' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-emerald-50 text-emerald-700'
                  }`}>
                    {project.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/project-management/projects/${project.id}`);
                      }}
                      className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                    >
                      View
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Open edit modal
                      }}
                      className="rounded-lg bg-[var(--emerald-dark)] px-3 py-1 text-xs font-bold text-white hover:bg-[var(--green-600)]"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
