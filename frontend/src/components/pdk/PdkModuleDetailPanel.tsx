import { useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import type { PdkModule, PdkModuleMetalSpec } from '@/types/pdkMetalRouting'
import { updatePdkModule } from '@services/pdkMetalRoutingService'

const EMPTY_METAL = { metalType: '', currentDensityAt110: '', sheetResistance: '' }

type MetalFormRow = typeof EMPTY_METAL

function moduleToForm(module: PdkModule) {
  return {
    name: module.name,
    technologyNode: module.technologyNode ?? '',
    notes: module.notes ?? '',
    metals:
      module.metals.length > 0
        ? module.metals.map((m) => ({
            metalType: m.metalType,
            currentDensityAt110: String(m.currentDensityAt110),
            sheetResistance: String(m.sheetResistance),
          }))
        : [{ ...EMPTY_METAL }],
  }
}

function parseMetals(rows: MetalFormRow[]) {
  return rows
    .filter((m) => m.metalType.trim())
    .map((m) => ({
      metalType: m.metalType.trim(),
      currentDensityAt110: Number(m.currentDensityAt110),
      sheetResistance: Number(m.sheetResistance),
    }))
}

export function PdkModuleDetailPanel({
  module,
  onBack,
  onSaved,
}: {
  module: PdkModule
  onBack: () => void
  onSaved: (updated: PdkModule) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => moduleToForm(module))

  useEffect(() => {
    setForm(moduleToForm(module))
    setEditing(false)
  }, [module])

  const handleCancel = () => {
    setForm(moduleToForm(module))
    setEditing(false)
  }

  const handleSave = async () => {
    const metals = parseMetals(form.metals)
    if (!form.name.trim()) {
      toast.error('Module name is required')
      return
    }
    if (metals.length === 0) {
      toast.error('Add at least one metal row')
      return
    }
    for (const metal of metals) {
      if (!Number.isFinite(metal.currentDensityAt110) || !Number.isFinite(metal.sheetResistance)) {
        toast.error('Enter valid numbers for all metal rows')
        return
      }
    }

    setSaving(true)
    try {
      const updated = await updatePdkModule(module._id, {
        name: form.name.trim(),
        technologyNode: form.technologyNode.trim(),
        notes: form.notes.trim(),
        metals,
      })
      toast.success('PDK module updated')
      setEditing(false)
      onSaved(updated)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update module')
    } finally {
      setSaving(false)
    }
  }

  const displayMetals: PdkModuleMetalSpec[] = editing
    ? form.metals.map((row, i) => ({
        _id: module.metals[i]?._id,
        metalType: row.metalType,
        currentDensityAt110: Number(row.currentDensityAt110) || 0,
        sheetResistance: Number(row.sheetResistance) || 0,
      }))
    : module.metals

  return (
    <div className="metal-routing-pdk-module-detail">
      <div className="metal-routing-pdk-module-detail__toolbar">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={onBack}
        >
          Back to all modules
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button type="button" size="sm" variant="secondary" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                loading={saving}
                icon={<Save className="h-4 w-4" />}
                onClick={() => void handleSave()}
              >
                Save changes
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => setEditing(true)}
            >
              Edit module
            </Button>
          )}
        </div>
      </div>

      <header className="metal-routing-pdk-module-detail__header">
        {editing ? (
          <div className="space-y-3">
            <Input
              label="Module name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Technology node"
                value={form.technologyNode}
                onChange={(e) => setForm((f) => ({ ...f, technologyNode: e.target.value }))}
              />
              <Input
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        ) : (
          <>
            <h1 className="metal-routing-pdk-module-detail__title">{module.name}</h1>
            <p className="metal-routing-pdk-module-detail__desc">
              {module.technologyNode?.trim() || 'N/A'}
              {module.notes?.trim() ? ` · ${module.notes.trim()}` : ''}
            </p>
          </>
        )}
      </header>

      <PdkModuleMetalTable
        metals={displayMetals}
        editing={editing}
        formMetals={form.metals}
        onFormMetalsChange={(metals) => setForm((f) => ({ ...f, metals }))}
      />
    </div>
  )
}

function PdkModuleMetalTable({
  metals,
  editing,
  formMetals,
  onFormMetalsChange,
}: {
  metals: PdkModuleMetalSpec[]
  editing: boolean
  formMetals: MetalFormRow[]
  onFormMetalsChange: (metals: MetalFormRow[]) => void
}) {
  const cellInputClass =
    'h-8 w-full min-w-0 rounded border border-lime-600/35 bg-white/95 px-2 text-sm text-black shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30'

  return (
    <div className="metal-routing-pdk-module-detail-table-wrap">
      <table className="metal-routing-pdk-module-detail-table">
        <thead>
          <tr>
            <th>Metal type</th>
            <th>Current density @ 110° (mA)</th>
            <th>Sheet resistance (Ω/sq)</th>
            {editing ? <th className="w-10" aria-label="Actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {editing
            ? formMetals.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className={cellInputClass}
                      value={row.metalType}
                      placeholder="MET1"
                      onChange={(e) => {
                        const next = [...formMetals]
                        next[i] = { ...next[i], metalType: e.target.value }
                        onFormMetalsChange(next)
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      className={cellInputClass}
                      value={row.currentDensityAt110}
                      onChange={(e) => {
                        const next = [...formMetals]
                        next[i] = { ...next[i], currentDensityAt110: e.target.value }
                        onFormMetalsChange(next)
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      className={cellInputClass}
                      value={row.sheetResistance}
                      onChange={(e) => {
                        const next = [...formMetals]
                        next[i] = { ...next[i], sheetResistance: e.target.value }
                        onFormMetalsChange(next)
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-red-800 hover:bg-red-50"
                      aria-label="Remove row"
                      onClick={() => {
                        if (formMetals.length <= 1) {
                          toast.error('At least one metal row is required')
                          return
                        }
                        onFormMetalsChange(formMetals.filter((_, idx) => idx !== i))
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            : metals.map((m) => (
                <tr key={m._id ?? m.metalType}>
                  <td>{m.metalType}</td>
                  <td>{m.currentDensityAt110}</td>
                  <td>{m.sheetResistance}</td>
                </tr>
              ))}
        </tbody>
      </table>
      {editing ? (
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => onFormMetalsChange([...formMetals, { ...EMPTY_METAL }])}
          >
            Add metal row
          </Button>
        </div>
      ) : null}
    </div>
  )
}
