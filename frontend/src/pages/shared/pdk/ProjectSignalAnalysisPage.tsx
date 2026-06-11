import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, Pencil, Plus, Search } from 'lucide-react'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import { AddSignalModal } from '@components/pdk/AddSignalModal'
import { showPortalError, showPortalSuccess } from '@/utils/portalNotice'
import { EditSignalModal } from '@components/pdk/EditSignalModal'
import { MetalRoutingColumnUnit } from '@components/pdk/MetalRoutingColumnHeader'
import { MetalRoutingExcelActions } from '@components/pdk/MetalRoutingExcelActions'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { Button } from '@components/ui/Button'
import type { ProjectCellsByType, ProjectRoutingContext, SignalRouteSummary } from '@/types/pdkMetalRouting'
import { fetchProjectContext, updateRouteIdentity } from '@services/pdkMetalRoutingService'

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(4) : '—'
}

const EMPTY_CELLS: ProjectCellsByType = { BLOCK: [], IO: [], ESD: [], TOP: [] }

export function ProjectSignalAnalysisPage({ basePath }: { basePath: string }) {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [context, setContext] = useState<ProjectRoutingContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SignalRouteSummary | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [fromCellFilter, setFromCellFilter] = useState('all')
  const [toCellFilter, setToCellFilter] = useState('all')
  const [notice, setNotice] = useState<TopNotice | null>(null)
  const dismissNotice = useCallback(() => setNotice(null), [])
  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      setContext(await fetchProjectContext(projectId))
    } catch {
      showPortalError(setNotice, 'Failed to load signals', 'Refresh the page or try again later.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const signals: SignalRouteSummary[] = context?.signals ?? []

  const fromCellOptions = useMemo(
    () => Array.from(new Set(signals.map((s) => s.fromCell).filter(Boolean))).sort(),
    [signals],
  )
  const toCellOptions = useMemo(
    () => Array.from(new Set(signals.map((s) => s.toCell).filter(Boolean))).sort(),
    [signals],
  )

  const filteredSignals = useMemo(() => {
    const q = search.trim().toLowerCase()
    return signals.filter((row) => {
      if (fromCellFilter !== 'all' && row.fromCell !== fromCellFilter) return false
      if (toCellFilter !== 'all' && row.toCell !== toCellFilter) return false
      if (!q) return true
      return (
        row.signal.toLowerCase().includes(q)
        || row.fromCell.toLowerCase().includes(q)
        || row.toCell.toLowerCase().includes(q)
      )
    })
  }, [signals, search, fromCellFilter, toCellFilter])

  const openRoute = (row: SignalRouteSummary) => {
    const params = new URLSearchParams({
      signal: row.signal,
      fromCell: row.fromCell,
      toCell: row.toCell,
    })
    navigate(`${basePath}/projects/${projectId}/signal-analysis/route?${params.toString()}`)
  }

  const handleEditSignal = async (payload: {
    signal: string
    fromCell: string
    toCell: string
    schematicCurrentDensity?: number
  }) => {
    if (!editingRow) return
    setSubmitting(true)
    try {
      await updateRouteIdentity(editingRow._id, payload)
      showPortalSuccess(setNotice, 'Signal updated', 'Signal route updated.')
      setEditOpen(false)
      setEditingRow(null)
      await load()
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : err instanceof Error
            ? err.message
            : undefined
      showPortalError(setNotice, 'Update failed', message ?? 'Failed to update signal route.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MetalRoutingPageShell>
      <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
      <div className="metal-routing-dashboard metal-routing-cell-project-page">
        <header className="metal-routing-cell-project-top">
          <div className="metal-routing-cell-project-top__main">
            <div className="metal-routing-cell-project-hero">
              <span className="metal-routing-cell-project-hero__icon" aria-hidden>
                <Activity className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="metal-routing-cell-project-hero__title">
                  {context?.project.projectName ?? 'Signal Analysis'}
                </h1>
                <p className="metal-routing-cell-project-panel__desc">
                  Signals for this project — click a row to open the metal routing table.
                </p>
              </div>
            </div>
          </div>
          <div className="metal-routing-cell-project-actions flex flex-wrap items-start gap-2">
            <MetalRoutingExcelActions
              projectId={projectId}
              pdkAssigned={Boolean(context?.pdkModule)}
              exportFilename={`${(context?.project.projectName ?? 'project').replace(/\s+/g, '_')}_metal-routing.xlsx`}
              onImported={() => void load()}
            />
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
              Add signal
            </Button>
          </div>
        </header>

        <section className="metal-routing-overview-card metal-routing-cell-project-panel">
          <div className="metal-routing-overview-toolbar metal-routing-pdk-modules-toolbar border-b border-border px-3 py-3">
            <h2 className="metal-routing-section-title">Signals</h2>
            <div className="metal-routing-overview-controls metal-routing-pdk-modules-toolbar__controls">
              <label className="metal-routing-search-field metal-routing-pdk-modules-toolbar__search">
                <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <input
                  type="search"
                  placeholder="Search signals or cells…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                className="metal-routing-toolbar-select"
                value={fromCellFilter}
                onChange={(e) => setFromCellFilter(e.target.value)}
                aria-label="Filter by from cell"
              >
                <option value="all">All from cells</option>
                {fromCellOptions.map((cell) => (
                  <option key={cell} value={cell}>{cell}</option>
                ))}
              </select>
              <select
                className="metal-routing-toolbar-select"
                value={toCellFilter}
                onChange={(e) => setToCellFilter(e.target.value)}
                aria-label="Filter by to cell"
              >
                <option value="all">All to cells</option>
                {toCellOptions.map((cell) => (
                  <option key={cell} value={cell}>{cell}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <p className="p-4 text-sm text-muted">Loading signals…</p>
            ) : filteredSignals.length === 0 ? (
              <p className="p-4 text-sm text-muted">
                {signals.length === 0
                  ? 'No signals yet. Click Add signal to create one.'
                  : 'No signals match your search or filters.'}
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-yellow-300 text-[11px] font-bold text-black">
                  <tr className="metal-routing-metal-table__head">
                    <th className="border border-yellow-400 px-3 py-2">
                      <span className="metal-routing-col-label">Signal</span>
                    </th>
                    <th className="border border-yellow-400 px-3 py-2">
                      <span className="metal-routing-col-label">From</span>
                    </th>
                    <th className="border border-yellow-400 px-3 py-2">
                      <span className="metal-routing-col-label">To</span>
                    </th>
                    <th className="border border-yellow-400 px-3 py-2">
                      <span className="metal-routing-col-label">Total impedance</span>
                      <span className="metal-routing-col-unit">
                        <MetalRoutingColumnUnit text="(mΩ)" />
                      </span>
                    </th>
                    <th className="border border-yellow-400 px-3 py-2">
                      <span className="metal-routing-col-label">Minimum current capability</span>
                      <span className="metal-routing-col-unit">
                        <MetalRoutingColumnUnit text="(mA)" />
                      </span>
                    </th>
                    <th className="border border-yellow-400 w-14 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredSignals.map((row) => (
                    <tr
                      key={row._id}
                      className="cursor-pointer bg-lime-400/70 font-medium text-black hover:bg-lime-400/90"
                      onClick={() => openRoute(row)}
                    >
                      <td className="border border-lime-500 px-3 py-2 font-semibold">{row.signal}</td>
                      <td className="border border-lime-500 px-3 py-2">{row.fromCell}</td>
                      <td className="border border-lime-500 px-3 py-2">{row.toCell}</td>
                      <td className="border border-lime-500 px-3 py-2">{fmt(row.totalImpedance)}</td>
                      <td className="border border-lime-500 px-3 py-2">{fmt(row.minimumMetalCurrentCapacity)}</td>
                      <td className="border border-lime-500 px-2 py-2 text-center">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-800 hover:bg-lime-300/80"
                          aria-label={`Edit ${row.signal}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingRow(row)
                            setEditOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <AddSignalModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        projectId={projectId}
        basePath={basePath}
        cellsByType={context?.cellsByType ?? EMPTY_CELLS}
        onCreated={load}
      />

      <EditSignalModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false)
          setEditingRow(null)
        }}
        signalRow={editingRow}
        cellNames={context?.cellNames ?? []}
        cellsByType={context?.cellsByType}
        onSave={handleEditSignal}
        saving={submitting}
      />
    </MetalRoutingPageShell>
  )
}
