import { useState, useEffect } from 'react';
import { Search, Grid3x3, Eye, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@components/ui/Button';
import { Spinner } from '@components/ui/Spinner';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

interface Project {
  _id: string;
  id?: string;
  projectName: string;
  name?: string;
  clientName: string;
  client?: string;
  technologyNode: string;
  teamLead?: string;
  description: string;
  status: string;
  completionPercentage: number;
  assignedPDK?: {
    _id: string;
    name: string;
    version?: string;
    technologyNode?: string;
  };
}

export function CellRouting() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsRes = await api.get('/api/projects');
      console.log('Projects loaded in Cell Routing:', projectsRes.data);
      
      const allProjects = projectsRes.data;

      // Fetch PDK assignments for all projects
      const projectsWithPDK = await Promise.all(
        allProjects.map(async (project: Project) => {
          const projectId = project._id || project.id;
          try {
            const assignmentRes = await api.get(
              `/api/metal-routing/projects/${projectId}/pdk-assignment`
            );
            return {
              _id: projectId,
              projectName: project.projectName || project.name || '',
              clientName: project.clientName || project.client || '',
              technologyNode: project.technologyNode || '',
              teamLead: project.teamLead || '',
              description: project.description || '',
              status: project.status || '',
              completionPercentage: project.completionPercentage || 0,
              assignedPDK: assignmentRes.data.assignment?.pdkModuleId || null,
            };
          } catch (error) {
            // No PDK assigned to this project
            return {
              _id: projectId,
              projectName: project.projectName || project.name || '',
              clientName: project.clientName || project.client || '',
              technologyNode: project.technologyNode || '',
              teamLead: project.teamLead || '',
              description: project.description || '',
              status: project.status || '',
              completionPercentage: project.completionPercentage || 0,
              assignedPDK: null,
            };
          }
        })
      );

      console.log('Projects with PDK in Cell Routing:', projectsWithPDK);
      setProjects(projectsWithPDK);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleViewRouting = (project: Project) => {
    if (!project.assignedPDK) {
      toast.error('Please assign a PDK module to this project first');
      return;
    }
    // Navigate to the routing analysis page for this project
    navigate(`/admin/metal-routing/analysis/${project._id}`);
  };

  const filteredProjects = projects.filter((p) =>
    (p.projectName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink">Cell Routing</h1>
            <p className="text-sm text-muted mt-1">View routing analysis for projects</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 bg-white border-b border-border px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Projects Card View */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-border">
            <Grid3x3 className="h-12 w-12 text-muted mb-3" />
            <p className="text-sm text-muted">No projects found</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProjects.map((project) => (
              <div
                key={project._id}
                className="bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
              >
                {/* Card Header */}
                <div className="p-4 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Grid3x3 className="h-5 w-5 text-primary flex-shrink-0" />
                      <h3 className="font-semibold text-ink line-clamp-1">{project.projectName}</h3>
                    </div>
                    <span
                      className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${
                        project.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : project.status === 'Completed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }
                    `}
                    >
                      {project.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted line-clamp-2">{project.description}</p>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">Client:</span>
                      <span className="text-ink font-medium">{project.clientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Tech Node:</span>
                      <span className="text-ink font-medium">{project.technologyNode}</span>
                    </div>
                    {project.teamLead && (
                      <div className="flex justify-between">
                        <span className="text-muted">Team Lead:</span>
                        <span className="text-ink font-medium">{project.teamLead}</span>
                      </div>
                    )}
                  </div>

                  {/* PDK Info */}
                  <div className="pt-3 border-t border-border">
                    {project.assignedPDK ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-ink truncate">{project.assignedPDK.name}</p>
                          {project.assignedPDK.version && (
                            <p className="text-xs text-muted">Version {project.assignedPDK.version}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>No PDK assigned</span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted mb-1">
                      <span>Progress</span>
                      <span>{project.completionPercentage}%</span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary-hover transition-all duration-300"
                        style={{ width: `${project.completionPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="p-4 bg-surface border-t border-border">
                  <Button
                    size="sm"
                    variant={project.assignedPDK ? 'primary' : 'secondary'}
                    icon={<Eye className="h-3.5 w-3.5" />}
                    onClick={() => handleViewRouting(project)}
                    className="w-full"
                    disabled={!project.assignedPDK}
                  >
                    View Routing Analysis
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
