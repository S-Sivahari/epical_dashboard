import { useState, useEffect } from 'react';
import { Plus, Upload, Trash2, Edit2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@components/ui/Button';
import { Spinner } from '@components/ui/Spinner';
import { Modal } from '@components/ui/Modal';
import api from '@/services/api';
import * as XLSX from 'xlsx';

interface PDKModule {
  _id: string;
  name: string;
  version?: string;
  technologyNode?: string;
  notes?: string;
  metals: MetalLayer[];
  createdAt: string;
  updatedAt: string;
}

interface MetalLayer {
  _id?: string;
  metalType: string; // Name (MET1, MET2, AP, etc.)
  currentDensity: number; // J_DC(mA/μm)
  currentDensityAt110: number; // J_DC(mA/μm) at 110° C
  sheetResistance: number; // mOhm/Sq at 110° C
}

export function PDKModule() {
  const [pdkModules, setPdkModules] = useState<PDKModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPDK, setSelectedPDK] = useState<PDKModule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    version: '',
    technologyNode: '',
    notes: '',
  });

  const [metals, setMetals] = useState<MetalLayer[]>([
    { metalType: 'MET1', currentDensity: 1, currentDensityAt110: 0, sheetResistance: 0 },
  ]);

  useEffect(() => {
    loadPDKModules();
  }, []);

  const loadPDKModules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/metal-routing/pdk-modules');
      setPdkModules(response.data.modules || response.data);
    } catch (error) {
      console.error('Failed to load PDK modules:', error);
      toast.error('Failed to load PDK modules');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', version: '', technologyNode: '', notes: '' });
    setMetals([{ metalType: 'MET1', currentDensity: 1, currentDensityAt110: 0, sheetResistance: 0 }]);
  };

  const openCreateModal = () => {
    resetForm();
    setCreateModalOpen(true);
  };

  const openEditModal = (pdk: PDKModule) => {
    setSelectedPDK(pdk);
    setFormData({
      name: pdk.name,
      version: pdk.version || '',
      technologyNode: pdk.technologyNode || '',
      notes: pdk.notes || '',
    });
    setMetals(pdk.metals.length > 0 ? pdk.metals : [{ metalType: 'MET1', currentDensity: 1, currentDensityAt110: 0, sheetResistance: 0 }]);
    setEditModalOpen(true);
  };

  const addMetalRow = () => {
    const nextNum = metals.length + 1;
    const metalName = nextNum <= 6 ? `MET${nextNum}` : 'AP';
    setMetals([...metals, { metalType: metalName, currentDensity: 1, currentDensityAt110: 0, sheetResistance: 0 }]);
  };

  const updateMetalRow = (index: number, field: keyof MetalLayer, value: any) => {
    const updated = [...metals];
    updated[index] = { ...updated[index], [field]: value };
    setMetals(updated);
  };

  const removeMetalRow = (index: number) => {
    if (metals.length === 1) {
      toast.error('At least one metal layer is required');
      return;
    }
    setMetals(metals.filter((_, i) => i !== index));
  };

  const handleCreatePDK = async () => {
    if (!formData.name.trim()) {
      toast.error('PDK name is required');
      return;
    }

    if (metals.some((m) => !m.metalType.trim())) {
      toast.error('All metal layers must have a type');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/api/metal-routing/pdk-modules', {
        ...formData,
        metals,
      });

      toast.success('PDK module created successfully');
      setCreateModalOpen(false);
      resetForm();
      await loadPDKModules();
    } catch (error: any) {
      console.error('Failed to create PDK:', error);
      toast.error(error.response?.data?.error || 'Failed to create PDK module');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePDK = async () => {
    if (!selectedPDK || !formData.name.trim()) {
      toast.error('PDK name is required');
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/api/metal-routing/pdk-modules/${selectedPDK._id}`, {
        ...formData,
        metals,
      });

      toast.success('PDK module updated successfully');
      setEditModalOpen(false);
      await loadPDKModules();
    } catch (error: any) {
      console.error('Failed to update PDK:', error);
      toast.error(error.response?.data?.error || 'Failed to update PDK module');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePDK = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete PDK module "${name}"?`)) return;

    try {
      await api.delete(`/api/metal-routing/pdk-modules/${id}`);
      toast.success('PDK module deleted');
      await loadPDKModules();
    } catch (error: any) {
      console.error('Failed to delete PDK:', error);
      toast.error(error.response?.data?.error || 'Failed to delete PDK module');
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        toast.error('Excel file is empty');
        return;
      }

      // Expected columns: Name, J_DC(mA/μm), J_DC(mA/μm) at 110° C, mOhm/Sq at 110° C
      const firstRow = rows[0];
      const pdkName = firstRow['PDK Name'] || firstRow['Name'] || 'Imported PDK';
      const version = firstRow['Version'];
      const technologyNode = firstRow['Technology Node'];

      const importedMetals: MetalLayer[] = rows.map((row) => ({
        metalType: row['Name'] || row['Metal Type'] || row['Metal'] || 'MET1',
        currentDensity: parseFloat(row['J_DC(mA/μm)'] || row['Current Density']) || 1,
        currentDensityAt110: parseFloat(row['J_DC(mA/μm) at 110° C'] || row['Current Density at 110']) || 0,
        sheetResistance: parseFloat(row['mOhm/Sq at 110° C'] || row['Sheet Resistance']) || 0,
      }));

      setFormData({
        name: pdkName || '',
        version: version || '',
        technologyNode: technologyNode || '',
        notes: 'Imported from Excel',
      });
      setMetals(importedMetals);
      setImportModalOpen(false);
      setCreateModalOpen(true);
      toast.success('Excel data imported. Review and save.');
    } catch (error) {
      console.error('Failed to import Excel:', error);
      toast.error('Failed to import Excel file');
    }

    // Reset file input
    e.target.value = '';
  };

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
            <h1 className="text-xl font-semibold text-ink">PDK Modules</h1>
            <p className="text-sm text-muted mt-1">Create and manage PDK modules</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImportModalOpen(true)}>
              Import Excel
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
              Create PDK
            </Button>
          </div>
        </div>
      </div>

      {/* PDK Modules List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {pdkModules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-border">
            <Package className="h-12 w-12 text-muted mb-3" />
            <p className="text-sm text-muted">No PDK modules created yet</p>
            <p className="text-xs text-muted mt-1">Create a new module or import from Excel</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {pdkModules.map((pdk) => (
              <div key={pdk._id} className="bg-white rounded-xl border border-border shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-ink">{pdk.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(pdk)}
                      className="p-1.5 text-muted hover:text-primary hover:bg-surface rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePDK(pdk._id, pdk.name)}
                      className="p-1.5 text-muted hover:text-red-500 hover:bg-surface rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {pdk.version && (
                    <div className="flex justify-between">
                      <span className="text-muted">Version:</span>
                      <span className="text-ink font-medium">{pdk.version}</span>
                    </div>
                  )}
                  {pdk.technologyNode && (
                    <div className="flex justify-between">
                      <span className="text-muted">Tech Node:</span>
                      <span className="text-ink font-medium">{pdk.technologyNode}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted">Metal Layers:</span>
                    <span className="text-ink font-medium">{pdk.metals.length}</span>
                  </div>
                  {pdk.notes && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted line-clamp-2">{pdk.notes}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-border text-xs text-muted">
                  Created: {new Date(pdk.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Import PDK from Excel" size="md">
        <div className="space-y-4">
          <div className="bg-surface rounded-lg p-4 text-sm">
            <h4 className="font-medium text-ink mb-2">Excel Format Requirements:</h4>
            <ul className="space-y-1 text-muted list-disc list-inside">
              <li>
                <strong>Column headers:</strong> Name, J_DC(mA/μm), J_DC(mA/μm) at 110° C, mOhm/Sq at 110° C
              </li>
              <li>
                <strong>Name column:</strong> Metal layer name (MET1, MET2, MET3, MET4, MET5, MET6, AP)
              </li>
              <li>
                <strong>Current Density:</strong> J_DC(mA/μm) - Current density value
              </li>
              <li>
                <strong>Current Density at 110°C:</strong> J_DC(mA/μm) at 110° C
              </li>
              <li>
                <strong>Sheet Resistance:</strong> mOhm/Sq at 110° C
              </li>
              <li>Each row represents one metal layer</li>
              <li>First row should contain column headers</li>
            </ul>
          </div>

          <div>
            <label className="block">
              <span className="sr-only">Choose Excel file</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                className="block w-full text-sm text-muted
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-white
                  hover:file:bg-primary-hover
                  file:cursor-pointer cursor-pointer"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit PDK Modal */}
      <Modal
        isOpen={createModalOpen || editModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditModalOpen(false);
        }}
        title={editModalOpen ? 'Edit PDK Module' : 'Create PDK Module'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                PDK Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g., TSMC 65nm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Version</label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g., 1.0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Technology Node</label>
            <input
              type="text"
              value={formData.technologyNode}
              onChange={(e) => setFormData({ ...formData, technologyNode: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="e.g., 65nm, 28nm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Additional notes..."
            />
          </div>

          {/* Metal Layers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ink">
                Metal Layers <span className="text-red-500">*</span>
              </label>
              <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={addMetalRow}>
                Add Layer
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {/* Header Row */}
              <div className="grid grid-cols-[120px_1fr_1fr_1fr_40px] gap-2 p-2 bg-surface rounded-lg text-xs font-semibold text-muted">
                <div>Name</div>
                <div>J_DC(mA/μm)</div>
                <div>J_DC at 110° C</div>
                <div>mOhm/Sq at 110° C</div>
                <div></div>
              </div>

              {/* Data Rows */}
              {metals.map((metal, index) => (
                <div key={index} className="grid grid-cols-[120px_1fr_1fr_1fr_40px] gap-2 p-2 bg-white border border-border rounded-lg items-center">
                  <input
                    type="text"
                    value={metal.metalType}
                    onChange={(e) => updateMetalRow(index, 'metalType', e.target.value)}
                    className="px-2 py-1.5 border border-border rounded text-sm"
                    placeholder="MET1"
                  />
                  <input
                    type="number"
                    value={metal.currentDensity}
                    onChange={(e) => updateMetalRow(index, 'currentDensity', parseFloat(e.target.value) || 0)}
                    className="px-2 py-1.5 border border-border rounded text-sm"
                    placeholder="1"
                    step="0.1"
                  />
                  <input
                    type="number"
                    value={metal.currentDensityAt110}
                    onChange={(e) => updateMetalRow(index, 'currentDensityAt110', parseFloat(e.target.value) || 0)}
                    className="px-2 py-1.5 border border-border rounded text-sm"
                    placeholder="0"
                    step="0.001"
                  />
                  <input
                    type="number"
                    value={metal.sheetResistance}
                    onChange={(e) => updateMetalRow(index, 'sheetResistance', parseFloat(e.target.value) || 0)}
                    className="px-2 py-1.5 border border-border rounded text-sm"
                    placeholder="0"
                    step="0.001"
                  />
                  <button
                    onClick={() => removeMetalRow(index)}
                    className="p-1.5 text-muted hover:text-red-500 transition-colors"
                    title="Remove layer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              variant="secondary"
              onClick={() => {
                setCreateModalOpen(false);
                setEditModalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={editModalOpen ? handleUpdatePDK : handleCreatePDK} loading={submitting}>
              {editModalOpen ? 'Update' : 'Create'} PDK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
