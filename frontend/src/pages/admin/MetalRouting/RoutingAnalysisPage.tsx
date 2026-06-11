import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Download, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@components/ui/Button';
import { Spinner } from '@components/ui/Spinner';
import { AddMetalModal } from '@components/pka/AddMetalModal';
import { MetalRoutingTable } from '@components/pka/MetalRoutingTable';
import type { MetalRoutingRoute, PkaModule } from '@/types/pkaMetalRouting';
import {
  addMetalToRoute,
  downloadRouteExcel,
  fetchPkaModules,
  lookupRoute,
  removeMetalFromRoute,
  resolveRoute,
} from '@services/pkaMetalRoutingService';
import api from '@/services/api';

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
  technologyNode: string;
  description: string;
  assignedPDK?: {
    _id: string;
    name: string;
    version?: string;
    technologyNode?: string;
  };
}

export function RoutingAnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [pkaModules, setPkaModules] = useState<PkaModule[]>([]);
  const [filter, setFilter] = useState({
    fromCell: '',
    toCell: '',
    fromSignal: '',
    toSignal: '',
  });
  const [route, setRoute] = useState<MetalRoutingRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [addMetalOpen, setAddMetalOpen] = useState(false);
  const [addingMetal, setAddingMetal] = useState(false);

  // Cell and signal options (these would come from the project's cells/libraries)
  const [cellOptions] = useState<string[]>(['Cell1', 'Cell2', 'Cell3', 'Comparator', 'Opamp']);
  const [signalOptions] = useState<string[]>(['VDD', 'VSS', 'CLK', 'IN', 'OUT', 'Signal1', 'Signal2']);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const [projectRes, modulesRes] = await Promise.all([
        api.get(`/api/metal-routing/projects/${projectId}/routing`),
        fetchPkaModules(),
      ]);

      setProject(projectRes.data.project);
      setPkaModules(modulesRes);
    } catch (error: any) {
      console.error('Failed to load project data:', error);
      toast.error(error.response?.data?.error || 'Failed to load project data');
      navigate('/admin/metal-routing');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRoute = async () => {
    if (!filter.fromCell || !filter.toCell || !filter.fromSignal || !filter.toSignal) {
      toast.error('All four values are required as a unique set');
      return;
    }

    setRouteLoading(true);
    try {
      const existing = await lookupRoute(filter);
      const opened = existing ?? (await resolveRoute(filter));
      setRoute(opened);
      if (existing) {
        toast.success('Loaded existing route for this combination');
      } else {
        toast.success('Created new route for this unique combination');
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message ?? 'Failed to open route');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleAddMetal = async (payload: {
    metalType: string;
    width: number;
    length: number;
    pkaModuleId: string;
  }) => {
    if (!route) return;
    setAddingMetal(true);
    try {
      const result = await addMetalToRoute(filter, payload);
      setRoute(result.route);
      setAddMetalOpen(false);
      toast.success('Metal row added and saved');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message ?? 'Failed to add metal');
    } finally {
      setAddingMetal(false);
    }
  };

  const handleRemoveMetal = async (metalId: string) => {
    if (!route || !window.confirm('Remove this metal row?')) return;
    try {
      const updated = await removeMetalFromRoute(filter, metalId);
      setRoute(updated);
      toast.success('Metal row removed');
    } catch {
      toast.error('Failed to remove metal');
    }
  };

  const handleExport = async () => {
    if (!route) return;
    try {
      await downloadRouteExcel(
        route._id,
        `metal-routing_${route.fromCell}_${route.toCell}.xlsx`.replace(/\s+/g, '_')
      );
      toast.success('Excel exported');
    } catch {
      toast.error('Export failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted">Project not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-border px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate('/admin/metal-routing')}
            >
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-ink">{project.projectName}</h1>
              <p className="text-sm text-muted mt-1">Metal Routing Analysis</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted">
                <span>Client: {project.clientName}</span>
                <span>•</span>
                <span>Tech: {project.technologyNode}</span>
                {project.assignedPDK && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      <span>PDK: {project.assignedPDK.name}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {route && (
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              Export Excel
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Route Selection */}
        <section className="mb-6 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-ink">Open route (unique 4-value set)</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">From Cell</span>
              <input
                list="from-cells"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={filter.fromCell}
                onChange={(e) => setFilter((f) => ({ ...f, fromCell: e.target.value }))}
                placeholder="Select or type cell"
              />
              <datalist id="from-cells">
                {cellOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">To Cell</span>
              <input
                list="to-cells"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={filter.toCell}
                onChange={(e) => setFilter((f) => ({ ...f, toCell: e.target.value }))}
                placeholder="Select or type cell"
              />
              <datalist id="to-cells">
                {cellOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">From Signal</span>
              <input
                list="from-signals"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={filter.fromSignal}
                onChange={(e) => setFilter((f) => ({ ...f, fromSignal: e.target.value }))}
                placeholder="Select or type signal"
              />
              <datalist id="from-signals">
                {signalOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">To Signal</span>
              <input
                list="to-signals"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={filter.toSignal}
                onChange={(e) => setFilter((f) => ({ ...f, toSignal: e.target.value }))}
                placeholder="Select or type signal"
              />
              <datalist id="to-signals">
                {signalOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="mt-3">
            <Button loading={routeLoading} icon={<Search className="h-4 w-4" />} onClick={handleOpenRoute}>
              Open route
            </Button>
          </div>
        </section>

        {/* Routing Table */}
        {route && (
          <MetalRoutingTable
            route={route}
            onAddMetal={() => setAddMetalOpen(true)}
            onRemoveMetal={(id) => void handleRemoveMetal(id)}
          />
        )}
      </div>

      {/* Add Metal Modal */}
      <AddMetalModal
        isOpen={addMetalOpen}
        onClose={() => setAddMetalOpen(false)}
        pkaModules={pkaModules}
        adding={addingMetal}
        onAdd={handleAddMetal}
      />
    </div>
  );
}
