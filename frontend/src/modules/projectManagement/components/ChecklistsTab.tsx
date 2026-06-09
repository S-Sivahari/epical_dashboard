import { useEffect, useState, useCallback } from 'react'
import api from '@/services/api'
import { Spinner } from '@components/ui/Spinner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { toast } from 'sonner'
import {
  FileSpreadsheet,
  Plus,
  Upload,
  RefreshCw,
  Eye,
  GitCompare
} from 'lucide-react'

interface TemplateVersion {
  id: string
  version: number
  fileName: string
  itemsCount: number
  uploadedBy: string
  createdAt: string
}

interface Template {
  id: string
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP'
  latestVersion: number
  versions: TemplateVersion[]
}

interface Cell {
  _id: string
  name: string
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP'
  progress: number
  status: string
}

interface ChecklistItem {
  itemId: string
  text: string
  category: string
  isMandatory: boolean
  order: number
}

export function ChecklistsTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [cells, setCells] = useState<Cell[]>([])
  const [loading, setLoading] = useState(true)

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadType, setUploadType] = useState<'Block' | 'IO' | 'ESD' | 'TOP'>('Block')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Migration state
  const [migrateOpen, setMigrateOpen] = useState(false)
  const [selectedCellId, setSelectedCellId] = useState('')
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [migrating, setMigrating] = useState(false)

  // Compare state
  const [compareOpen, setCompareOpen] = useState(false)
  const [versionAId, setVersionAId] = useState('')
  const [versionBId, setVersionBId] = useState('')
  const [compareResult, setCompareResult] = useState<any>(null)
  const [comparing, setComparing] = useState(false)

  // View items modal
  const [itemsOpen, setItemsOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null)
  const [versionItems, setVersionItems] = useState<ChecklistItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [tplRes, cellRes] = await Promise.all([
        api.get('/project-management/checklists/templates'),
        api.get('/project-management/cells?archived=false')
      ])
      setTemplates(tplRes.data)
      setCells(cellRes.data)
    } catch {
      toast.error('Failed to load checklist configurations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an Excel file to upload')
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('checklistType', uploadType)

      await api.post('/project-management/checklists/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      toast.success('Checklist template version uploaded and parsed successfully')
      setUploadOpen(false)
      setSelectedFile(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload checklist template')
    } finally {
      setUploading(false)
    }
  }

  const handleMigrate = async () => {
    if (!selectedCellId || !selectedVersionId) {
      toast.error('Please select both a cell and a target version')
      return
    }

    try {
      setMigrating(true)
      const res = await api.post('/project-management/checklists/migrate-cell', {
        cellId: selectedCellId,
        versionId: selectedVersionId
      })
      toast.success(res.data.message || 'Checklist successfully migrated')
      setMigrateOpen(false)
      setSelectedCellId('')
      setSelectedVersionId('')
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  const handleCompare = async () => {
    if (!versionAId || !versionBId) {
      toast.error('Please select both versions to compare')
      return
    }

    try {
      setComparing(true)
      const res = await api.get(`/project-management/checklists/templates/compare?versionAId=${versionAId}&versionBId=${versionBId}`)
      
      const itemsA = res.data.versionA.items
      const itemsB = res.data.versionB.items
      
      // Calculate differences
      const mapA = new Map(itemsA.map((item: any) => [item.text, item]))
      const mapB = new Map(itemsB.map((item: any) => [item.text, item]))
      
      const added = itemsB.filter((item: any) => !mapA.has(item.text))
      const removed = itemsA.filter((item: any) => !mapB.has(item.text))
      const matching = itemsB.filter((item: any) => mapA.has(item.text))
      
      setCompareResult({
        versionA: res.data.versionA,
        versionB: res.data.versionB,
        added,
        removed,
        matching
      })
    } catch {
      toast.error('Comparison failed')
    } finally {
      setComparing(false)
    }
  }

  const viewItems = async (version: TemplateVersion) => {
    try {
      setSelectedVersion(version)
      setItemsOpen(true)
      setLoadingItems(true)
      const res = await api.get(`/project-management/checklists/templates/${version.id}`)
      setVersionItems(res.data)
    } catch {
      toast.error('Failed to load checklist version items')
    } finally {
      setLoadingItems(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Actions Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-indigo-500 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-slate-800 leading-tight">Checklist Templates</h4>
            <p className="text-[10px] text-slate-400 font-medium">Manage and audit verification templates</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setCompareOpen(true)}
            className="h-9 px-3.5 border border-slate-200 hover:bg-slate-50 text-slate-650 flex items-center gap-1.5 rounded-lg text-xs font-bold bg-white"
          >
            <GitCompare className="h-3.5 w-3.5" /> Compare Versions
          </Button>

          <Button
            onClick={() => setMigrateOpen(true)}
            className="h-9 px-3.5 border border-slate-200 hover:bg-slate-50 text-slate-655 flex items-center gap-1.5 rounded-lg text-xs font-bold bg-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Migrate Cell Version
          </Button>

          <Button
            onClick={() => setUploadOpen(true)}
            className="bg-[var(--emerald-dark)] hover:bg-emerald-800 text-white font-bold h-9 px-4 text-xs flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Upload Template
          </Button>
        </div>
      </div>

      {/* Templates Lists */}
      {templates.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-bold text-xs">
          No templates uploaded yet. Upload one to start!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between gap-5">
              <div className="flex flex-col gap-1 pb-3 border-b border-slate-100">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-800 text-sm">{tpl.checklistType} Checklist Template</h4>
                  <Badge variant="success">Latest: v{tpl.latestVersion}</Badge>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Contains rules for verification items</span>
              </div>

              {/* Version List */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {tpl.versions.map(v => (
                  <div key={v.id} className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100/50 flex justify-between items-center text-xs text-slate-600 font-semibold">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-800">Version v{v.version}</span>
                      <span className="text-[10px] text-slate-400 leading-none truncate max-w-[180px] block" title={v.fileName}>{v.fileName}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-bold text-slate-500 font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">{v.itemsCount} items</span>
                      <Button
                        onClick={() => viewItems(v)}
                        className="h-7 w-7 p-0 border border-slate-200 hover:bg-slate-100/50 text-slate-500 flex items-center justify-center rounded"
                        title="View template items"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* UPLOAD TEMPLATE MODAL */}
      <Modal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Checklist Template">
        <div className="space-y-4 p-4 text-xs font-semibold">
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Checklist Template Type</label>
            <select
              value={uploadType}
              onChange={e => setUploadType(e.target.value as any)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
            >
              <option value="Block">Block Checklist</option>
              <option value="IO">IO Checklist</option>
              <option value="ESD">ESD Checklist</option>
              <option value="TOP">TOP Checklist</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-bold text-slate-500 uppercase">Select Excel Spreadsheet</label>
            <div className="border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-100/50 transition-colors relative">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="h-8 w-8 text-indigo-500" />
              <div className="text-center">
                <span className="font-bold text-slate-700 block mb-0.5">
                  {selectedFile ? selectedFile.name : 'Select file (Drag & Drop)'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Spreadsheet must have columns: Item Text, Category, Mandatory (Yes/No)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-[var(--emerald-dark)] text-white hover:bg-emerald-800"
            >
              {uploading ? 'Parsing Excel...' : 'Upload & Parse'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* VERSION MIGRATION MODAL */}
      <Modal isOpen={migrateOpen} onClose={() => setMigrateOpen(false)} title="Migrate Cell Checklist Version">
        <div className="space-y-4 p-4 text-xs font-semibold">
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Select Cell Workspace</label>
            <select
              value={selectedCellId}
              onChange={e => setSelectedCellId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
            >
              <option value="">-- Select Cell --</option>
              {cells.map(c => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.checklistType} - current progress {c.progress}%)
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Select Target Version</label>
            <select
              value={selectedVersionId}
              onChange={e => setSelectedVersionId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
            >
              <option value="">-- Select Target Version --</option>
              {templates.map(tpl => (
                <optgroup key={tpl.id} label={`${tpl.checklistType} versions`}>
                  {tpl.versions.map(v => (
                    <option key={v.id} value={v.id}>
                      v{v.version} ({v.itemsCount} items) - {v.fileName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <p className="text-[10px] text-amber-500 font-bold leading-normal">
            Note: Migrating checklist version will keep all existing completion ticks where item texts match. Items not matching will be added as uncompleted, and deleted items will be archived.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setMigrateOpen(false)} disabled={migrating}>Cancel</Button>
            <Button
              onClick={handleMigrate}
              disabled={migrating}
              className="bg-[var(--emerald-dark)] text-white hover:bg-emerald-800"
            >
              {migrating ? 'Migrating...' : 'Run Migration'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* VERSION DIFF COMPARE MODAL */}
      <Modal isOpen={compareOpen} onClose={() => { setCompareOpen(false); setCompareResult(null); }} title="Compare Checklist Template Versions">
        <div className="space-y-4 p-4 text-xs font-semibold max-h-[600px] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-bold text-slate-500 uppercase">Version A</label>
              <select
                value={versionAId}
                onChange={e => setVersionAId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
              >
                <option value="">-- Select Version A --</option>
                {templates.map(tpl => (
                  <optgroup key={tpl.id} label={`${tpl.checklistType} versions`}>
                    {tpl.versions.map(v => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({v.itemsCount} items)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-slate-500 uppercase">Version B</label>
              <select
                value={versionBId}
                onChange={e => setVersionBId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full"
              >
                <option value="">-- Select Version B --</option>
                {templates.map(tpl => (
                  <optgroup key={tpl.id} label={`${tpl.checklistType} versions`}>
                    {tpl.versions.map(v => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({v.itemsCount} items)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCompareOpen(false); setCompareResult(null); }}>Close</Button>
            <Button
              onClick={handleCompare}
              disabled={comparing}
              className="bg-[var(--emerald-dark)] text-white hover:bg-emerald-800 font-bold"
            >
              {comparing ? 'Comparing...' : 'Compare Diffs'}
            </Button>
          </div>

          {compareResult && (
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <h5 className="font-bold text-slate-800 text-sm">Comparison Results (v{compareResult.versionA.version} vs v{compareResult.versionB.version})</h5>
              
              {/* Added Items (Green) */}
              {compareResult.added.length > 0 && (
                <div className="space-y-2">
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded text-[10px] uppercase">Added in v{compareResult.versionB.version} ({compareResult.added.length})</span>
                  <div className="space-y-1.5">
                    {compareResult.added.map((item: any) => (
                      <div key={item.itemId} className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/20 text-emerald-950 font-medium leading-normal">
                        {item.text} <span className="text-[9px] text-emerald-600 block uppercase font-bold mt-0.5">{item.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Removed Items (Red) */}
              {compareResult.removed.length > 0 && (
                <div className="space-y-2">
                  <span className="text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded text-[10px] uppercase">Removed in v{compareResult.versionB.version} ({compareResult.removed.length})</span>
                  <div className="space-y-1.5">
                    {compareResult.removed.map((item: any) => (
                      <div key={item.itemId} className="p-2.5 rounded-lg border border-rose-100 bg-rose-50/20 text-rose-950 font-medium leading-normal">
                        {item.text} <span className="text-[9px] text-rose-600 block uppercase font-bold mt-0.5">{item.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Items */}
              {compareResult.matching.length > 0 && (
                <div className="space-y-2">
                  <span className="text-slate-650 font-bold bg-slate-50 px-2.5 py-1 rounded text-[10px] uppercase">Unchanged Items ({compareResult.matching.length})</span>
                  <div className="max-h-[150px] overflow-y-auto space-y-1.5 border border-slate-100 rounded-lg p-2 bg-slate-50/30 font-semibold">
                    {compareResult.matching.map((item: any) => (
                      <div key={item.itemId} className="p-2 rounded bg-white border border-slate-100 text-slate-700 font-medium text-[11px] leading-relaxed">
                        {item.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {compareResult.added.length === 0 && compareResult.removed.length === 0 && (
                <p className="text-slate-500 font-bold text-center py-4">Both template versions have identical checklist requirements.</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* VIEW ITEMS DETAIL MODAL */}
      <Modal isOpen={itemsOpen} onClose={() => setItemsOpen(false)} title={`Checklist Items: v${selectedVersion?.version}`}>
        <div className="p-4 space-y-4 max-h-[450px] overflow-y-auto text-xs font-semibold">
          {loadingItems ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner className="h-6 w-6 text-emerald-600" />
            </div>
          ) : (
            <div className="space-y-2.5">
              {versionItems.map((item, index) => (
                <div key={item.itemId} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex justify-between items-center gap-3">
                  <div className="space-y-1">
                    <p className="text-slate-800 font-semibold leading-normal">
                      <span className="text-slate-400 font-bold font-mono mr-1.5">{index + 1}.</span>
                      {item.text}
                    </p>
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Category: {item.category}</span>
                  </div>
                  {item.isMandatory && (
                    <Badge variant="danger" className="shrink-0 text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5">Mandatory</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
export default ChecklistsTab
