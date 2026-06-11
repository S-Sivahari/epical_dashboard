import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/projectManagement/Breadcrumbs';
import { PageWrapper } from '@components/layout/PageWrapper';
import { Spinner } from '@components/ui/Spinner';
import { User, Calendar, Activity } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

interface CellData {
  cell: {
    id: string;
    name: string;
    viewType: string;
    checklistType: string;
    progress: number;
    status: string;
    assignedEmployee?: string;
    createdAt: string;
    updatedAt: string;
  };
  library: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
  };
  assignment: {
    assignedTo: string;
    assignedBy: string;
    assignedAt: string;
  } | null;
  reviews: Array<{
    id: string;
    reviewType: string;
    status: string;
    submittedBy: string;
    submittedAt: string;
  }>;
  recentActivity: Array<{
    action: string;
    user: string;
    timestamp: string;
  }>;
}

export function CellDetails() {
  const { projectId, libraryId, cellId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CellData | null>(null);

  useEffect(() => {
    fetchCellDetails();
  }, [cellId]);

  const fetchCellDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/project-management/cells/${cellId}/details`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch cell details:', err);
      toast.error('Failed to load cell details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex h-96 items-center justify-center">
          <Spinner size="lg" />
          <span className="ml-3 text-sm font-semibold text-slate-600">Loading cell details...</span>
        </div>
      </PageWrapper>
    );
  }

  if (!data) {
    return (
      <PageWrapper>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Cell not found</p>
          <button
            onClick={() => navigate(`/admin/project-management/projects/${projectId}/libraries/${libraryId}`)}
            className="mt-4 rounded-lg bg-[var(--emerald-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--green-600)]"
          >
            Back to Library
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
              { label: data.library.name, href: `/admin/project-management/projects/${data.project.id}/libraries/${data.library.id}` },
              { label: data.cell.name },
            ]}
          />
        </div>

        {/* Cell Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{data.cell.name}</h1>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                Project: <span className="text-slate-900">{data.project.name}</span> → 
                Library: <span className="text-slate-900">{data.library.name}</span>
              </p>
            </div>
            <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              data.cell.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              data.cell.status === 'Submitted For Review' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
              data.cell.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
              'bg-slate-50 text-slate-700 border border-slate-200'
            }`}>
              {data.cell.status}
            </span>
          </div>
        </div>

        {/* Info Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <InfoCard
            icon={Activity}
            label="View Type"
            value={data.cell.viewType}
            sublabel={`Checklist: ${data.cell.checklistType}`}
            color="blue"
          />
          <InfoCard
            icon={User}
            label="Assigned Employee"
            value={data.cell.assignedEmployee || 'Unassigned'}
            sublabel={data.assignment ? `By ${data.assignment.assignedBy}` : 'Not assigned yet'}
            color="purple"
          />
          <InfoCard
            icon={Calendar}
            label="Last Updated"
            value={new Date(data.cell.updatedAt).toLocaleDateString()}
            sublabel={`Created ${new Date(data.cell.createdAt).toLocaleDateString()}`}
            color="green"
          />
        </div>

        {/* Progress Section */}
        <div className="mb-6 rounded-xl border border-border bg-white p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-600">Cell Progress</span>
            <span className="text-lg font-bold text-slate-900">{data.cell.progress}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-[var(--emerald-dark)]"
              style={{ width: `${data.cell.progress}%` }}
            />
          </div>
        </div>

        {/* Tabs or Sections */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Reviews Section */}
            <div>
              <h2 className="mb-3 text-lg font-bold text-slate-900">Reviews ({data.reviews.length})</h2>
              <div className="rounded-xl border border-border bg-white p-4">
                {data.reviews.length === 0 ? (
                  <p className="text-sm text-slate-600">No reviews yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.reviews.map((review) => (
                      <div key={review.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900">{review.reviewType}</span>
                          <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                            review.status === 'Approved' ? 'bg-green-50 text-green-700' :
                            review.status === 'Rejected' ? 'bg-red-50 text-red-700' :
                            'bg-yellow-50 text-yellow-700'
                          }`}>
                            {review.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          By {review.submittedBy} • {new Date(review.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Section */}
            <div>
              <h2 className="mb-3 text-lg font-bold text-slate-900">Recent Activity</h2>
              <div className="rounded-xl border border-border bg-white p-4">
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-slate-600">No recent activity</p>
                ) : (
                  <div className="space-y-3">
                    {data.recentActivity.map((activity, index) => (
                      <div key={index} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <p className="text-sm font-bold text-slate-900">{activity.action}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          By {activity.user} • {new Date(activity.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

interface InfoCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel: string;
  color: 'blue' | 'purple' | 'green';
}

function InfoCard({ icon: Icon, label, value, sublabel, color }: InfoCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50 text-green-700 border-green-200',
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg border p-2 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
          <p className="mt-0.5 text-xs text-slate-600">{sublabel}</p>
        </div>
      </div>
    </div>
  );
}

export default CellDetails;
