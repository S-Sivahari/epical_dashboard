import type { WorkflowStageStatus } from '@/types/projectWorkspace'

export const SCHEMATIC_WORKFLOW_STAGE_KEYS = [
  'design',
  'simulation',
  'data_collection',
  'schematic_review',
] as const

export type SchematicWorkflowStageKey = (typeof SCHEMATIC_WORKFLOW_STAGE_KEYS)[number]

export const SCHEMATIC_WORKFLOW_STAGES: { key: SchematicWorkflowStageKey; label: string }[] = [
  { key: 'design', label: 'Design' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'data_collection', label: 'Data Collection' },
  { key: 'schematic_review', label: 'Review' },
]

export interface SchematicWorkflowStage {
  stageKey: SchematicWorkflowStageKey
  stageLabel: string
  status: WorkflowStageStatus
  updatedAt?: string
}

export function isSchematicReviewStageKey(stageKey: string): stageKey is 'schematic_review' {
  return stageKey === 'schematic_review'
}

export function defaultSchematicWorkflow(): SchematicWorkflowStage[] {
  return SCHEMATIC_WORKFLOW_STAGES.map((stage) => ({
    stageKey: stage.key,
    stageLabel: stage.label,
    status: stage.key === 'design' ? 'in_progress' : 'not_started',
  }))
}

export function normalizeSchematicWorkflow(raw: unknown): SchematicWorkflowStage[] {
  const defaults = defaultSchematicWorkflow()
  if (!Array.isArray(raw) || raw.length === 0) return defaults

  const byKey = new Map<SchematicWorkflowStageKey, SchematicWorkflowStage>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const stageKey = String((item as SchematicWorkflowStage).stageKey || '')
    if (!(SCHEMATIC_WORKFLOW_STAGE_KEYS as readonly string[]).includes(stageKey)) continue
    const key = stageKey as SchematicWorkflowStageKey
    const label = SCHEMATIC_WORKFLOW_STAGES.find((s) => s.key === key)?.label || key
    byKey.set(key, {
      stageKey: key,
      stageLabel: label,
      status: normalizeSchematicStageStatus(String((item as SchematicWorkflowStage).status || 'not_started')),
      updatedAt: (item as SchematicWorkflowStage).updatedAt,
    })
  }

  return defaults.map((stage) => byKey.get(stage.stageKey) || stage)
}

function normalizeSchematicStageStatus(value: string): WorkflowStageStatus {
  const allowed: WorkflowStageStatus[] = [
    'not_started', 'in_progress', 'completed', 'pending_review', 'approved', 'rejected',
  ]
  return allowed.includes(value as WorkflowStageStatus) ? (value as WorkflowStageStatus) : 'not_started'
}

function stageStatus(workflow: SchematicWorkflowStage[], key: SchematicWorkflowStageKey): WorkflowStageStatus {
  return workflow.find((s) => s.stageKey === key)?.status ?? 'not_started'
}

export function isSchematicStageLocked(workflow: SchematicWorkflowStage[], stageKey: SchematicWorkflowStageKey): boolean {
  if (isSchematicReviewStageKey(stageKey)) return false
  const stage = workflow.find((s) => s.stageKey === stageKey)
  if (!stage || stage.status !== 'not_started') return false
  switch (stageKey) {
    case 'design':
      return false
    case 'simulation':
      return stageStatus(workflow, 'design') !== 'completed'
    case 'data_collection':
      return stageStatus(workflow, 'simulation') !== 'completed'
    default:
      return true
  }
}

export function schematicWorkflowProgressPercent(cell: { schematicWorkflow?: unknown }): number {
  const workflow = normalizeSchematicWorkflow(cell.schematicWorkflow)
  const done = workflow.filter((stage) =>
    isSchematicReviewStageKey(stage.stageKey)
      ? stage.status === 'approved'
      : stage.status === 'completed',
  ).length
  return Math.round((done / workflow.length) * 100)
}
