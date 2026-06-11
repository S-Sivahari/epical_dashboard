import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/projectManagement/Breadcrumbs';
import { PageWrapper } from '@components/layout/PageWrapper';
import { Spinner } from '@components/ui/Spinner';
import { FolderOpen, Layers, CheckCircle2, Clock, Users, TrendingUp } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

interface ProjectData {
  project: {
    id: string;
    name: string;
    description: string;
    teamLead: string;
    status: string;
  };
  metrics: {
    totalLibraries: number;
    totalCells: number;
    completedCells: number;
    inProgressCells: number;
    pendingReviewCells: number;
    assignedEmployees: number;
    pendingReviews: number;
    overallProgress: number;
  };
  libraries: Array<{
    id: string;
    name: string;
    description: string;
    progress: number;
    status: string;
    cellsCount: number;
  }>;
}

export function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProjectData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'libraries' | 'cells' | 'reviews' | 'audit'>('overview');

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/project-management/projects/${projectId}/details`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch project details:', err);
      toast.error('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex h-96 items-center justify-center">
          <Spinner size="lg" />
          <span className="ml-3 text-sm font-semibold text-slate-600">Loading project details...</span>
        </div>
      </PageWrapper>
    );
  }

  if (!data) {
    return (
      <PageWrapper>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Project not found</p>
          <button
            onClick={() => navigate('/admin/project-management')}
            className="mt-4 rounded-lg bg-[var(--emerald-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--green-600)]"
          >
            Back to Projects
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper fillViewport>
      <div className="flex h-full flex-col">
        {/* Breadcrumbs */}
        <div className="mb-4">
          <Breadcrumbs
            items={[
              { label: 'Projects', href: '/admin/project-management' },
              { label: data.project.name },
            ]}
          />
        </div>

        {/* Project Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">{data.project.name}</h1>
          <p className="mt-2 text-sm text-slate-600">{data.project.description || 'No description'}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="font-semibold text-slate-600">
              Team Lead: <span className="text-slate-900">{data.project.teamLead || 'Not assigned'}</span>
            </span>
            <span className="font-semibold text-slate-600">
              Status: <span className="text-slate-900">{data.project.status}</span>
            </span>
            <span className="font-semibold text-slate-600">
              Employees: <span className="text-slate-900">{data.metrics.assignedEmployees}</span>
            </span>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard 
            icon={FolderOpen} 
            label="Libraries" 
            value={data.metrics.totalLibraries} 
            color="blue"
          />
          <MetricCard 
            icon={Layers} 
            label="Total Cells" 
            value={data.metrics.totalCells} 
            color="purple"
          />
          <MetricCard 
            icon={CheckCircle2} 
            label="Completed" 
            value={data.metrics.completedCells} 
            color="green"
          />
          <MetricCard 
            icon={TrendingUp} 
            label="Progress" 
            value={`${data.metrics.overallProgress}%`} 
            color="emerald"
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard 
            icon={Clock} 
            label="In Progress" 
            value={data.metrics.inProgressCells} 
            color="amber"
          />
          <MetricCard 
            icon={Users} 
            label="Pending Review" 
            value={data.metrics.pendingReviewCells} 
            color="orange"
          />
          <MetricCard 
            icon={CheckCircle2} 
            label="Pending Reviews" 
            value={data.metrics.pendingReviews} 
            color="yellow"
          />
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 flex gap-2 border-b border-border">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'libraries', label: 'Libraries' },
            { id: 'cells', label: 'All Cells' },
            { id: 'reviews', label: 'Reviews' },
            { id: 'audit', label: 'Audit' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'border-b-2 border-[var(--emerald-dark)] text-[var(--emerald-dark)]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-lg font-bold text-slate-900">Project Summary</h2>
                <div className="rounded-xl border border-border bg-white p-5">
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-sm font-semibold text-slate-600">Total Libraries</dt>
                      <dd className="text-sm font-bold text-slate-900">{data.metrics.totalLibraries}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-semibold text-slate-600">Total Cells</dt>
                      <dd className="text-sm font-bold text-slate-900">{data.metrics.totalCells}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-semibold text-slate-600">Completed Cells</dt>
                      <dd className="text-sm font-bold text-slate-900">{data.metrics.completedCells}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-semibold text-slate-600">Overall Progress</dt>
                      <dd className="text-sm font-bold text-slate-900">{data.metrics.overallProgress}%</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'libraries' && (
            <div className="space-y-3">
              {data.libraries.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-white">
                  <p className="text-sm font-semibold text-slate-600">No libraries in this project</p>
                </div>
              ) : (
                data.libraries.map((lib) => (
                  <div
                    key={lib.id}
                    onClick={() => navigate(`/admin/project-management/projects/${projectId}/libraries/${lib.id}`)}
                    className="cursor-pointer rounded-xl border border-border bg-white p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900">{lib.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{lib.description || 'No description'}</p>
                      </div>
                      <span className={`rounded-lg px-3 py-1 text-xs font-bold ${
                        lib.status === 'Completed' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {lib.status}
                      </span>
                    </div>
                    <div className="mt-4 flex gap-6 text-xs font-semibold text-slate-600">
                      <span>Cells: <span className="text-slate-900">{lib.cellsCount}</span></span>
                      <span>Progress: <span className="text-slate-900">{lib.progress}%</span></span>
                    </div>
                    <div className="mt-3">
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-[var(--emerald-dark)]"
                          style={{ width: `${lib.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'cells' && (
            <div className="text-center text-sm text-slate-600">
              Cell list view coming soon
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="text-center text-sm text-slate-600">
              Reviews view coming soon
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="text-center text-sm text-slate-600">
              Audit log view coming soon
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'green' | 'emerald' | 'amber' | 'orange' | 'yellow';
}

function MetricCard({ icon: Icon, label, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg border p-2.5 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default ProjectDetails;
