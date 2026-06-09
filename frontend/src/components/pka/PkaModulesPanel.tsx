import { useEffect, useState } from 'react'
import { ArrowLeft, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import type { PkaModule } from '@/types/pkaMetalRouting'
import { fetchPkaModule, fetchPkaModules } from '@services/pkaMetalRoutingService'
import { cn } from '@/utils/cn'

export function PkaModulesPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [modules, setModules] = useState<PkaModule[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedModule, setSelectedModule] = useState<PkaModule | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadModules = async () => {
    setLoading(true)
    try {
      const data = await fetchPkaModules()
      setModules(data)
    } catch {
      toast.error('Failed to load PKA modules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedId(null)
      setSelectedModule(null)
      void loadModules()
    }
  }, [isOpen])

  const openModule = async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const mod = await fetchPkaModule(id)
      setSelectedModule(mod)
    } catch {
      toast.error('Failed to load module details')
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="PKA Modules" size="xl">
      {selectedId ? (
        <div className="space-y-4">
          <Button
            size="sm"
            variant="ghost"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => {
              setSelectedId(null)
              setSelectedModule(null)
            }}
          >
            All modules
          </Button>

          {detailLoading || !selectedModule ? (
            <p className="py-10 text-center text-sm text-muted">Loading module…</p>
          ) : (
            <>
              <div>
                <h3 className="text-lg font-semibold text-ink">{selectedModule.name}</h3>
                <p className="text-sm text-muted">
                  {selectedModule.technologyNode || '—'}
                  {selectedModule.notes ? ` · ${selectedModule.notes}` : ''}
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-yellow-300 text-xs font-bold uppercase text-black">
                      <th className="border border-yellow-400 px-3 py-2">Metal Type</th>
                      <th className="border border-yellow-400 px-3 py-2">Current Density @ 110° (mA)</th>
                      <th className="border border-yellow-400 px-3 py-2">Sheet Resistance (Ω/sq)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedModule.metals.map((metal) => (
                      <tr key={metal._id ?? metal.metalType} className="bg-lime-400/70 font-medium text-black">
                        <td className="border border-lime-500 px-3 py-2">{metal.metalType}</td>
                        <td className="border border-lime-500 px-3 py-2">{metal.currentDensityAt110}</td>
                        <td className="border border-lime-500 px-3 py-2">{metal.sheetResistance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Each card is one PKA module (Sheet 2). Select a module to view its metal table — the same metal name can appear in different modules with different values.
          </p>

          {loading ? (
            <p className="py-10 text-center text-sm text-muted">Loading modules…</p>
          ) : modules.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted">
              No PKA modules configured yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((mod) => (
                <button
                  key={mod._id}
                  type="button"
                  onClick={() => void openModule(mod._id)}
                  className={cn(
                    'rounded-xl border border-border bg-white p-4 text-left shadow-sm transition-ui',
                    'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Layers className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-ink">{mod.name}</p>
                      <p className="text-xs text-muted">{mod.technologyNode || 'Technology node N/A'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted">{mod.metals.length} metal type(s)</p>
                  <p className="mt-2 line-clamp-2 text-xs text-muted">{mod.notes || 'No notes'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
