import { useState, useEffect } from 'react';
import { Plus, Search, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@components/ui/Button';
import { Spinner } from '@components/ui/Spinner';
import { Modal } from '@components/ui/Modal';
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
  completionPercentage?: number;
  assignedPDK?: {
    _id: string;
    name: string;
    version?: string;
    technologyNode?: string;
  };
}

interface PDKModule {
  _id: string;
  name: string;
  version?: string;
  technologyNode?: string;
  notes?: string;
  metals: any[];
  createdAt: string;
}

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pdkModules, setPdkModules] = useState<PDKModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedPDK, setSelectedPDK] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch projects and PDK modules
      const [projectsRes, pdkRes] = await Promise.all([
        api.get('/api/projects'),
        api.get('/api/metal-routing/pdk-modules'),
      ]);

      console.log('Projects loaded:', projectsRes.data);

      // Get all projects
      const allProjects = projectsRes.data;

      // Fetch PDK assignments for all projects
      const projectsWithPDK = await Promise.all(
        allProjects.map(async (project: Project) => {
          const projectId = project._id || project.id;
          try {
            const assignmentRes = await api.get(
              `/api/metal-routing/projects/${projectId}/pdk-assignment`
            );
            console.log(`PDK assignment for ${project.projectName || project.name}:`, assignmentRes.data);
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
            console.log(`No PDK assigned to ${project.projectName || project.name}`);
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

      console.log('Projects with PDK:', projectsWithPDK);
      setProjects(projectsWithPDK);
      setPdkModules(pdkRes.data.modules || pdkRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = (project: Project) => {
    setSelectedProject(project);
    setSelectedPDK(project.assignedPDK?._id || '');
    setAssignModalOpen(true);
  };

  const handleAssignPDK = async () => {
    if (!selectedProject || !selectedPDK) {
      toast.error('Please select a PDK module');
      return;
    }

    try {
      setAssigning(true);
      await api.post(`/api/metal-routing/projects/${selectedProject._id}/assign-pdk`, {
        pdkModuleId: selectedPDK,
      });

      toast.success('PDK assigned to project successfully');
      setAssignModalOpen(false);
      await loadData();
    } catch (error: any) {
      console.error('Failed to assign PDK:', error);
      toast.error(error.response?.data?.error || 'Failed to assign PDK');
    } finally {
      setAssigning(false);
    }
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
            <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
            <p className="text-sm text-muted mt-1">Manage project PDK assignments</p>
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

      {/* Projects Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Project Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Technology Node
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Team Lead
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Assigned PDK
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                    No projects found
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr key={project._id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-ink">{project.projectName}</td>
                    <td className="px-4 py-3 text-sm text-ink">{project.clientName}</td>
                    <td className="px-4 py-3 text-sm text-ink">{project.technologyNode}</td>
                    <td className="px-4 py-3 text-sm text-ink">{project.teamLead || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      {project.assignedPDK ? (
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="text-ink font-medium">{project.assignedPDK.name}</span>
                          {project.assignedPDK.version && (
                            <span className="text-xs text-muted">v{project.assignedPDK.version}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted italic">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => openAssignModal(project)}
                      >
                        {project.assignedPDK ? 'Change' : 'Assign'} PDK
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign PDK Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign PDK Module"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Project</label>
            <input
              type="text"
              value={selectedProject?.projectName || ''}
              disabled
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-sm text-muted"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Select PDK Module <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPDK}
              onChange={(e) => setSelectedPDK(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">-- Select PDK --</option>
              {pdkModules.map((pdk) => (
                <option key={pdk._id} value={pdk._id}>
                  {pdk.name}
                  {pdk.version && ` (v${pdk.version})`}
                  {pdk.technologyNode && ` - ${pdk.technologyNode}`}
                </option>
              ))}
            </select>
            {pdkModules.length === 0 && (
              <p className="text-xs text-muted mt-1">
                No PDK modules available. Create one in the PDK Module tab.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignPDK} loading={assigning} disabled={!selectedPDK}>
              Assign PDK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
