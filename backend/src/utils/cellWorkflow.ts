export const CELL_WORKFLOW_STAGE_KEYS = [
  'floor_plan',
  'drc_review_1',
  'routing',
  'drc',
  'lvs_review_2',
] as const;

export type CellWorkflowStageKey = (typeof CELL_WORKFLOW_STAGE_KEYS)[number];

export const WORKFLOW_STAGE_STATUSES = ['not_started', 'in_progress', 'completed'] as const;

export type WorkflowStageStatus = (typeof WORKFLOW_STAGE_STATUSES)[number];

export const CELL_WORKFLOW_STAGES: { key: CellWorkflowStageKey; label: string }[] = [
  { key: 'floor_plan', label: 'Floor Plan' },
  { key: 'drc_review_1', label: 'DRC' },
  { key: 'routing', label: 'Routing' },
  { key: 'drc', label: 'DRC' },
  { key: 'lvs_review_2', label: 'LVS' },
];

export interface CellWorkflowStage {
  stageKey: CellWorkflowStageKey;
  stageLabel: string;
  status: WorkflowStageStatus;
  updatedAt?: Date;
}

export function defaultCellWorkflow(): CellWorkflowStage[] {
  return CELL_WORKFLOW_STAGES.map((stage) => ({
    stageKey: stage.key,
    stageLabel: stage.label,
    status: 'not_started',
  }));
}

export function isValidStageKey(value: string): value is CellWorkflowStageKey {
  return (CELL_WORKFLOW_STAGE_KEYS as readonly string[]).includes(value);
}

export function normalizeWorkflowStageStatus(value: string): WorkflowStageStatus {
  if ((WORKFLOW_STAGE_STATUSES as readonly string[]).includes(value)) {
    return value as WorkflowStageStatus;
  }
  return 'not_started';
}

export function normalizeCellWorkflow(raw: unknown): CellWorkflowStage[] {
  const defaults = defaultCellWorkflow();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const byKey = new Map<string, CellWorkflowStage>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const stageKey = String((item as CellWorkflowStage).stageKey || '');
    if (!isValidStageKey(stageKey)) continue;
    const label = CELL_WORKFLOW_STAGES.find((s) => s.key === stageKey)?.label || stageKey;
    byKey.set(stageKey, {
      stageKey,
      stageLabel: label,
      status: normalizeWorkflowStageStatus(String((item as CellWorkflowStage).status || 'not_started')),
      updatedAt: (item as CellWorkflowStage).updatedAt,
    });
  }

  return defaults.map((stage) => byKey.get(stage.stageKey) || stage);
}

export function workflowCompletedCount(workflow: CellWorkflowStage[]): number {
  return workflow.filter((s) => s.status === 'completed').length;
}

export function currentWorkflowStageLabel(workflow: CellWorkflowStage[]): string {
  const inProgress = workflow.find((s) => s.status === 'in_progress');
  if (inProgress) return inProgress.stageLabel;
  const next = workflow.find((s) => s.status === 'not_started');
  if (next) return next.stageLabel;
  return workflow[workflow.length - 1]?.stageLabel || '—';
}
