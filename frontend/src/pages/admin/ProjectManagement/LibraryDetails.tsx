import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/projectManagement/Breadcrumbs';
import { PageWrapper } from '@components/layout/PageWrapper';
import { Spinner } from '@components/ui/Spinner';
import { Layers, CheckCircle2, Clock, Activity } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

interface LibraryData {
  library: {
    id: string;
    name: string;
    description: string;
    progress: number;
    status: string;
  };
  project: {
    id: string;
    name: string;
  };
  metrics: {
    totalCells: number;
    completedCells: number;
    inProgressCells: number;
    pendingReviewCells: number;
  };
  cells: Array<{
    id: string;
    name: string;
    viewType: string;
    progress: number;
    status: string;
    assignedEmployee?: string;
    updatedAt: string;
  }>;
}

export function LibraryDetails() {
  const { projectId, libraryId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LibraryData | null>(null);

  useEffect(() => {
    fetchLibraryDetails();
  }, [libraryId]);

  const fetchLibraryDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/project-management/libraries/${libraryId}/details`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch library details:', err);
      toast.error('Failed to load library details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex h-96 items-center justify-center">
          <Spinner size="lg" />
          <span className="ml-3 text-sm font-semibold text-slate-600">Loading library details...</span>
        </div>
      </PageWrapper>
    );
  }

  if (!data) {
    return (
      <PageWrapper>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Library not found</p>
          <button
            onClick={() => navigate(`/admin/project-management/projects/${projectId}`)}
            className="mt-4 rounded-lg bg-[var(--emerald-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--green-600)]"
          >
            Back to Project
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
              { label: data.project.name, href: `/admin/project-management/projects/${data.project.id}` },
              { label: data.library.name },
            ]}
          />
        </div>

        {/* Library Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{data.library.name}</h1>
              <p className="mt-2 text-sm text-slate-600">{data.library.description || 'No description'}</p>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                Project: <span className="text-slate-900">{data.project.name}</span>
              </p>
            </div>
            <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              data.library.status === 'Completed' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {data.library.status}
            </span>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard 
            icon={Layers} 
            label="Total Cells" 
            value={data.metrics.totalCells} 
            color="blue"
          />
          <MetricCard 
            icon={Activity} 
            label="In Progress" 
            value={data.metrics.inProgressCells} 
            color="amber"
          />
          <MetricCard 
            icon={Clock} 
            label="Pending Review" 
            value={data.metrics.pendingReviewCells} 
            color="orange"
          />
          <MetricCard 
            icon={CheckCircle2} 
            label="Completed" 
            value={data.metrics.completedCells} 
            color="green"
          />
        </div>

        {/* Progress Bar */}
        <div className="mb-6 rounded-xl border border-border bg-white p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-600">Library Progress</span>
            <span className="text-lg font-bold text-slate-900">{data.library.progress}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-[var(--emerald-dark)]"
              style={{ width: `${data.library.progress}%` }}
            />
          </div>
        </div>

        {/* Cells List */}
        <div className="flex-1 overflow-y-auto">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Cells ({data.cells.length})</h2>
          {data.cells.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-white">
              <p className="text-sm font-semibold text-slate-600">No cells in this library</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.cells.map((cell) => (
                <div
                  key={cell.id}
                  onClick={() => navigate(`/admin/project-management/projects/${projectId}/libraries/${libraryId}/cells/${cell.id}`)}
                  className="cursor-pointer rounded-xl border border-border bg-white p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900">{cell.name}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        View Type: <span className="text-slate-900">{cell.viewType}</span>
                      </p>
                    </div>
                    <span className={`rounded-lg px-3 py-1 text-xs font-bold ${
                      cell.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                      cell.status === 'Submitted For Review' ? 'bg-yellow-50 text-yellow-700' :
                      cell.status === 'In Progress' ? 'bg-blue-50 text-blue-700' :
                      'bg-slate-50 text-slate-700'
                    }`}>
                      {cell.status}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-6 text-xs font-semibold text-slate-600">
                    <span>Assigned: <span className="text-slate-900">{cell.assignedEmployee || 'Unassigned'}</span></span>
                    <span>Progress: <span className="text-slate-900">{cell.progress}%</span></span>
                    <span>Updated: <span className="text-slate-900">{new Date(cell.updatedAt).toLocaleDateString()}</span></span>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-[var(--emerald-dark)]"
                        style={{ width: `${cell.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
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
  color: 'blue' | 'green' | 'amber' | 'orange';
}

function MetricCard({ icon: Icon, label, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
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

export default LibraryDetails;
