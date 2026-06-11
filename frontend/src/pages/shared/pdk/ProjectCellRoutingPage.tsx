import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { showPortalError, showPortalSuccess } from '@/utils/portalNotice'
import { Button } from '@components/ui/Button'
import { MetalRoutingTable } from '@components/pdk/MetalRoutingTable'
import { AddMetalModal } from '@components/pdk/AddMetalModal'
import { RouteMetalExcelActions } from '@components/pdk/RouteMetalExcelActions'
import type {
  MetalConnectionType,
  MetalEntry,
  MetalRoutingRoute,
  ProjectRoutingContext,
} from '@/types/pdkMetalRouting'
import {
  addMetalToRoute,
  fetchProjectContext,
  lookupRoute,
  removeMetalFromRoute,
  resolveRoute,
  updateMetalInRoute,
} from '@services/pdkMetalRoutingService'

export function ProjectCellRoutingPage({ basePath }: { basePath: string }) {
  const { projectId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const signal = searchParams.get('signal') ?? searchParams.get('fromSignal') ?? ''
  const fromCell = searchParams.get('fromCell') ?? ''
  const toCell = searchParams.get('toCell') ?? ''

  const [context, setContext] = useState<ProjectRoutingContext | null>(null)
  const [route, setRoute] = useState<MetalRoutingRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [metalModalOpen, setMetalModalOpen] = useState(false)
  const [editingMetal, setEditingMetal] = useState<MetalEntry | null>(null)
  const [savingMetal, setSavingMetal] = useState(false)
  const [notice, setNotice] = useState<TopNotice | null>(null)
  const dismissNotice = useCallback(() => setNotice(null), [])

  const routingFilter = useMemo(
    () => ({
      projectId,
      signal,
      fromCell,
      toCell,
    }),
    [projectId, signal, fromCell, toCell],
  )

  const loadContext = useCallback(async () => {
    if (!projectId) return null
    try {
      const fresh = await fetchProjectContext(projectId)
      setContext(fresh)
      return fresh
    } catch {
      showPortalError(setNotice, 'Failed to load project', 'Refresh the page or try again later.')
      return null
    }
  }, [projectId])

  useEffect(() => {
    void loadContext()
  }, [loadContext])

  useEffect(() => {
    if (!projectId) return
    if (!signal || !fromCell || !toCell) {
      navigate(`${basePath}/projects/${projectId}/signal-analysis`)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const existing = await lookupRoute(routingFilter)
        const opened = existing ?? (await resolveRoute(routingFilter))
        if (!cancelled) {
          setRoute(opened)
          setLoadError(null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          setLoadError(message ?? 'Failed to open route')
          setRoute(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [basePath, fromCell, navigate, projectId, routingFilter, signal, toCell])

  const closeMetalModal = () => {
    setMetalModalOpen(false)
    setEditingMetal(null)
  }

  const handleAddMetal = async (payload: {
    metalType: string
    width: number
    length: number
    connectionType?: MetalConnectionType
  }) => {
    setSavingMetal(true)
    try {
      const result = await addMetalToRoute(routingFilter, payload)
      setRoute(result.route)
      closeMetalModal()
      showPortalSuccess(setNotice, 'Metal added', 'Metal row added and saved.')
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      showPortalError(setNotice, 'Add failed', message ?? 'Failed to add metal.')
    } finally {
      setSavingMetal(false)
    }
  }

  const handleUpdateMetal = async (
    metalId: string,
    payload: {
      metalType: string
      width: number
      length: number
      connectionType?: MetalConnectionType
    },
  ) => {
    setSavingMetal(true)
    try {
      setRoute(await updateMetalInRoute(routingFilter, metalId, payload))
      closeMetalModal()
      showPortalSuccess(setNotice, 'Metal updated', 'Metal row updated.')
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      showPortalError(setNotice, 'Update failed', message ?? 'Failed to update metal.')
    } finally {
      setSavingMetal(false)
    }
  }

  const handleRemoveMetal = async (metalId: string) => {
    if (!window.confirm('Remove this metal row?')) return
    try {
      setRoute(await removeMetalFromRoute(routingFilter, metalId))
      showPortalSuccess(setNotice, 'Metal removed', 'Metal row removed.')
    } catch {
      showPortalError(setNotice, 'Remove failed', 'Failed to remove metal.')
    }
  }

  if (loading && !route) {
    return (
      <MetalRoutingPageShell fill className="!p-0">
        <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">Loading route…</div>
      </MetalRoutingPageShell>
    )
  }

  if (!route) {
    return (
      <MetalRoutingPageShell fill className="!p-0">
        <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError ?? 'This signal route could not be opened.'}
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(`${basePath}/projects/${projectId}/signal-analysis`)}
          >
            Back to signals
          </Button>
        </div>
      </MetalRoutingPageShell>
    )
  }

  return (
    <MetalRoutingPageShell fill className="!p-0">
      <TopDismissNotice notice={notice} onDismiss={dismissNotice} />
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(`${basePath}/projects/${projectId}/signal-analysis`)}
          >
            Back to signals
          </Button>
          <RouteMetalExcelActions
            routeId={route._id}
            route={route}
            pdkAssigned={Boolean(context?.pdkModule)}
            exportFilename={`signal_${route.signal}_${route.fromCell}_${route.toCell}.xlsx`.replace(/\s+/g, '_')}
            onImported={(result) => setRoute(result.route)}
          />
        </div>
        <MetalRoutingTable
          fullScreen
          route={route}
          onAddMetal={() => {
            setEditingMetal(null)
            setMetalModalOpen(true)
          }}
          onEditMetal={(metal) => {
            setEditingMetal(metal)
            setMetalModalOpen(true)
          }}
          onRemoveMetal={(id) => void handleRemoveMetal(id)}
        />
      </div>
      <AddMetalModal
        isOpen={metalModalOpen}
        onClose={closeMetalModal}
        projectId={projectId}
        pdkModule={context?.pdkModule ?? null}
        routeSchematicCurrentDensity={route.schematicCurrentDensity}
        isFirstMetal={route.metals.length === 0 && !editingMetal}
        isEditingFirstMetal={
          editingMetal != null &&
          route.metals.length > 0 &&
          route.metals[0]._id === editingMetal._id
        }
        editingMetal={editingMetal}
        saving={savingMetal}
        onAdd={handleAddMetal}
        onUpdate={handleUpdateMetal}
      />
    </MetalRoutingPageShell>
  )
}
