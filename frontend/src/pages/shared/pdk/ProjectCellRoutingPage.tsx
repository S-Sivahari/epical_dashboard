import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { Button } from '@components/ui/Button'
import { MetalRoutingTable } from '@components/pdk/MetalRoutingTable'
import { AddMetalModal } from '@components/pdk/AddMetalModal'
import { MetalRoutingExcelActions } from '@components/pdk/MetalRoutingExcelActions'
import type { MetalEntry, MetalRoutingRoute, ProjectRoutingContext } from '@/types/pdkMetalRouting'
import type { MetalRoutingImportResult } from '@services/pdkMetalRoutingService'
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
  const [metalModalOpen, setMetalModalOpen] = useState(false)
  const [editingMetal, setEditingMetal] = useState<MetalEntry | null>(null)
  const [savingMetal, setSavingMetal] = useState(false)

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
      toast.error('Failed to load project')
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
      try {
        const existing = await lookupRoute(routingFilter)
        const opened = existing ?? (await resolveRoute(routingFilter))
        if (!cancelled) setRoute(opened)
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          toast.error(message ?? 'Failed to open route')
          navigate(`${basePath}/projects/${projectId}/signal-analysis`)
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
    connectionType: 'series' | 'parallel'
  }) => {
    setSavingMetal(true)
    try {
      const result = await addMetalToRoute(routingFilter, payload)
      setRoute(result.route)
      closeMetalModal()
      toast.success('Metal row added and saved')
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(message ?? 'Failed to add metal')
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
      connectionType: 'series' | 'parallel'
    },
  ) => {
    setSavingMetal(true)
    try {
      setRoute(await updateMetalInRoute(routingFilter, metalId, payload))
      closeMetalModal()
      toast.success('Metal row updated')
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(message ?? 'Failed to update metal')
    } finally {
      setSavingMetal(false)
    }
  }

  const handleRemoveMetal = async (metalId: string) => {
    if (!window.confirm('Remove this metal row?')) return
    try {
      setRoute(await removeMetalFromRoute(routingFilter, metalId))
      toast.success('Metal removed')
    } catch {
      toast.error('Failed to remove metal')
    }
  }

  const pdkAssigned = Boolean(context?.pdkModule)

  const refreshAfterImport = async (importedRoute?: MetalRoutingRoute) => {
    await loadContext()
    if (!importedRoute) return
    try {
      const refreshed = await lookupRoute({
        projectId,
        signal: importedRoute.signal,
        fromCell: importedRoute.fromCell,
        toCell: importedRoute.toCell,
      })
      setRoute(refreshed ?? importedRoute)
    } catch {
      setRoute(importedRoute)
    }
  }

  if (loading && !route) {
    return (
      <MetalRoutingPageShell fill className="!p-0">
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">Loading route…</div>
      </MetalRoutingPageShell>
    )
  }

  if (!route) return null

  return (
    <MetalRoutingPageShell fill className="!p-0">
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(`${basePath}/projects/${projectId}/signal-analysis`)}
          >
            Back to signals
          </Button>
          <MetalRoutingExcelActions
            projectId={projectId}
            routeId={route._id}
            pdkAssigned={pdkAssigned}
            exportFilename={`signal_${route.signal}_${route.fromCell}_${route.toCell}.xlsx`.replace(/\s+/g, '_')}
            onImported={(result: MetalRoutingImportResult) => {
              const match = result.routes.find(
                (r) =>
                  r.signal === route.signal &&
                  r.fromCell === route.fromCell &&
                  r.toCell === route.toCell,
              )
              void refreshAfterImport(match ?? result.routes[0])
            }}
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
