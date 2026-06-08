export const CELL_WORKFLOW_STAGE_KEYS = [
  'floor_plan',
  'drc_first',
  'review_1',
  'routing',
  'drc_final',
  'lvs',
  'review_2',
] as const;

export type CellWorkflowStageKey = (typeof CELL_WORKFLOW_STAGE_KEYS)[number];

export const REVIEW_STAGE_KEYS = ['review_1', 'review_2'] as const;
export type ReviewStageKey = (typeof REVIEW_STAGE_KEYS)[number];

export const WORK_STAGE_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export const REVIEW_STAGE_STATUSES = ['not_started', 'pending_review', 'approved', 'rejected'] as const;
export const WORKFLOW_STAGE_STATUSES = [
  ...WORK_STAGE_STATUSES,
  ...REVIEW_STAGE_STATUSES,
] as const;

export type WorkStageStatus = (typeof WORK_STAGE_STATUSES)[number];
export type ReviewStageStatus = (typeof REVIEW_STAGE_STATUSES)[number];
export type WorkflowStageStatus = (typeof WORKFLOW_STAGE_STATUSES)[number];

export const CELL_WORKFLOW_STAGES: { key: CellWorkflowStageKey; label: string }[] = [
  { key: 'floor_plan', label: 'Floor Plan' },
  { key: 'drc_first', label: 'DRC' },
  { key: 'review_1', label: 'Review 1' },
  { key: 'routing', label: 'Routing' },
  { key: 'drc_final', label: 'DRC' },
  { key: 'lvs', label: 'LVS' },
  { key: 'review_2', label: 'Review 2' },
];

const LEGACY_STAGE_KEY_MAP: Record<string, CellWorkflowStageKey> = {
  drc_review_1: 'drc_first',
  drc: 'drc_final',
  lvs_review_2: 'lvs',
};

export interface CellWorkflowStage {
  stageKey: CellWorkflowStageKey;
  stageLabel: string;
  status: WorkflowStageStatus;
  updatedAt?: Date;
}

export function isReviewStageKey(stageKey: string): stageKey is ReviewStageKey {
  return (REVIEW_STAGE_KEYS as readonly string[]).includes(stageKey);
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

function remapLegacyStageKey(stageKey: string): CellWorkflowStageKey | null {
  if (isValidStageKey(stageKey)) return stageKey;
  return LEGACY_STAGE_KEY_MAP[stageKey] ?? null;
}

export function defaultCellWorkflow(): CellWorkflowStage[] {
  return CELL_WORKFLOW_STAGES.map((stage) => ({
    stageKey: stage.key,
    stageLabel: stage.label,
    status: stage.key === 'floor_plan' ? 'in_progress' : 'not_started',
  }));
}

export function normalizeCellWorkflow(raw: unknown): CellWorkflowStage[] {
  const defaults = defaultCellWorkflow();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const byKey = new Map<CellWorkflowStageKey, CellWorkflowStage>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rawKey = String((item as CellWorkflowStage).stageKey || '');
    const stageKey = remapLegacyStageKey(rawKey);
    if (!stageKey) continue;
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

function stageByKey(workflow: CellWorkflowStage[], key: CellWorkflowStageKey): CellWorkflowStage {
  return workflow.find((s) => s.stageKey === key)!;
}

function stageStatus(workflow: CellWorkflowStage[], key: CellWorkflowStageKey): WorkflowStageStatus {
  return stageByKey(workflow, key)?.status ?? 'not_started';
}

function setStageStatus(
  workflow: CellWorkflowStage[],
  key: CellWorkflowStageKey,
  status: WorkflowStageStatus,
): CellWorkflowStage[] {
  return workflow.map((stage) =>
    stage.stageKey === key
      ? { ...stage, status, updatedAt: new Date() }
      : stage,
  );
}

function prerequisitesMet(workflow: CellWorkflowStage[], stageKey: CellWorkflowStageKey): boolean {
  const normalized = normalizeCellWorkflow(workflow);
  switch (stageKey) {
    case 'floor_plan':
      return true;
    case 'drc_first':
      return stageStatus(normalized, 'floor_plan') === 'completed';
    case 'review_1':
      return stageStatus(normalized, 'drc_first') === 'completed';
    case 'routing':
      return stageStatus(normalized, 'review_1') === 'approved';
    case 'drc_final':
      return stageStatus(normalized, 'routing') === 'completed';
    case 'lvs':
      return stageStatus(normalized, 'drc_final') === 'completed';
    case 'review_2':
      return stageStatus(normalized, 'lvs') === 'completed';
    default:
      return false;
  }
}

/** Locked only for stages that have not started yet and lack prerequisites. */
export function isStageLocked(workflow: CellWorkflowStage[], stageKey: CellWorkflowStageKey): boolean {
  const normalized = normalizeCellWorkflow(workflow);
  const stage = normalized.find((s) => s.stageKey === stageKey);
  if (!stage || isReviewStageKey(stageKey)) return false;
  if (stage.status !== 'not_started') return false;
  return !prerequisitesMet(normalized, stageKey);
}

function isBackwardWorkTransition(current: WorkflowStageStatus, next: WorkflowStageStatus): boolean {
  if (current === 'completed' && (next === 'in_progress' || next === 'not_started')) return true;
  if (current === 'in_progress' && next === 'not_started') return true;
  return false;
}

function resetDownstreamStages(
  workflow: CellWorkflowStage[],
  stageKey: CellWorkflowStageKey,
): CellWorkflowStage[] {
  const index = CELL_WORKFLOW_STAGE_KEYS.indexOf(stageKey);
  if (index < 0) return workflow;

  return workflow.map((stage, i) => {
    if (i <= index) return stage;
    return { ...stage, status: 'not_started', updatedAt: new Date() };
  });
}

export function hasPendingOrRejectedReview(workflow: CellWorkflowStage[]): boolean {
  const normalized = normalizeCellWorkflow(workflow);
  return normalized.some(
    (stage) =>
      isReviewStageKey(stage.stageKey) &&
      (stage.status === 'pending_review' || stage.status === 'rejected'),
  );
}

function applyAutoTransitionsOnce(workflow: CellWorkflowStage[]): CellWorkflowStage[] {
  let next = [...workflow];

  if (stageStatus(next, 'floor_plan') === 'completed' && stageStatus(next, 'drc_first') === 'not_started') {
    next = setStageStatus(next, 'drc_first', 'in_progress');
  }

  if (stageStatus(next, 'drc_first') === 'completed' && stageStatus(next, 'review_1') === 'not_started') {
    next = setStageStatus(next, 'review_1', 'pending_review');
  }

  if (stageStatus(next, 'review_1') === 'approved' && stageStatus(next, 'routing') === 'not_started') {
    next = setStageStatus(next, 'routing', 'in_progress');
  }

  if (stageStatus(next, 'routing') === 'completed' && stageStatus(next, 'drc_final') === 'not_started') {
    next = setStageStatus(next, 'drc_final', 'in_progress');
  }

  if (stageStatus(next, 'drc_final') === 'completed' && stageStatus(next, 'lvs') === 'not_started') {
    next = setStageStatus(next, 'lvs', 'in_progress');
  }

  if (stageStatus(next, 'lvs') === 'completed' && stageStatus(next, 'review_2') === 'not_started') {
    next = setStageStatus(next, 'review_2', 'pending_review');
  }

  return next;
}

function applyAutoTransitions(workflow: CellWorkflowStage[]): CellWorkflowStage[] {
  let next = workflow;
  for (let i = 0; i < CELL_WORKFLOW_STAGE_KEYS.length; i += 1) {
    const updated = applyAutoTransitionsOnce(next);
    const unchanged = updated.every(
      (stage, index) => stage.status === next[index]?.status,
    );
    next = updated;
    if (unchanged) break;
  }
  return next;
}

export function canCompleteCell(workflow: CellWorkflowStage[]): boolean {
  const normalized = normalizeCellWorkflow(workflow);
  return (
    stageStatus(normalized, 'floor_plan') === 'completed' &&
    stageStatus(normalized, 'drc_first') === 'completed' &&
    stageStatus(normalized, 'review_1') === 'approved' &&
    stageStatus(normalized, 'routing') === 'completed' &&
    stageStatus(normalized, 'drc_final') === 'completed' &&
    stageStatus(normalized, 'lvs') === 'completed' &&
    stageStatus(normalized, 'review_2') === 'approved'
  );
}

export type WorkflowUpdateResult =
  | { ok: true; workflow: CellWorkflowStage[] }
  | { ok: false; error: string };

export function applyWorkflowStageUpdate(
  rawWorkflow: unknown,
  stageKey: CellWorkflowStageKey,
  nextStatus: WorkflowStageStatus,
  actorRole: 'Admin' | 'Employee',
): WorkflowUpdateResult {
  let workflow = normalizeCellWorkflow(rawWorkflow);
  const current = stageStatus(workflow, stageKey);

  const backward = isBackwardWorkTransition(current, nextStatus);

  if (!backward && isStageLocked(workflow, stageKey) && !isReviewStageKey(stageKey)) {
    return { ok: false, error: 'This stage is locked until prerequisite stages are completed and approved' };
  }

  if (isReviewStageKey(stageKey)) {
    if (actorRole !== 'Admin') {
      return { ok: false, error: 'Only admins can approve or reject reviews' };
    }
    if (nextStatus !== 'approved' && nextStatus !== 'rejected') {
      return { ok: false, error: 'Review stages can only be approved or rejected' };
    }
    if (stageKey === 'review_1' && current === 'not_started' && stageStatus(workflow, 'drc_first') === 'completed') {
      workflow = setStageStatus(workflow, 'review_1', 'pending_review');
    }
    if (stageKey === 'review_2' && current === 'not_started' && stageStatus(workflow, 'lvs') === 'completed') {
      workflow = setStageStatus(workflow, 'review_2', 'pending_review');
    }

    const reviewStatus = stageStatus(workflow, stageKey);
    if (reviewStatus !== 'pending_review') {
      return { ok: false, error: 'Review is not pending approval' };
    }

    workflow = setStageStatus(workflow, stageKey, nextStatus);

    if (stageKey === 'review_1') {
      if (nextStatus === 'approved') {
        workflow = setStageStatus(workflow, 'review_1', 'approved');
        if (stageStatus(workflow, 'routing') === 'not_started') {
          workflow = setStageStatus(workflow, 'routing', 'in_progress');
        }
      } else {
        workflow = setStageStatus(workflow, 'drc_first', 'in_progress');
        workflow = setStageStatus(workflow, 'review_1', 'not_started');
      }
    }

    if (stageKey === 'review_2') {
      if (nextStatus === 'approved') {
        workflow = setStageStatus(workflow, 'review_2', 'approved');
      } else {
        workflow = setStageStatus(workflow, 'lvs', 'in_progress');
        workflow = setStageStatus(workflow, 'review_2', 'not_started');
      }
    }

    return { ok: true, workflow: applyAutoTransitions(workflow) };
  }

  if (!(WORK_STAGE_STATUSES as readonly string[]).includes(nextStatus)) {
    return { ok: false, error: 'Invalid status for this workflow stage' };
  }

  if (!backward && hasPendingOrRejectedReview(workflow)) {
    return { ok: false, error: 'Cannot advance workflow while a review is pending' };
  }

  workflow = setStageStatus(workflow, stageKey, nextStatus);

  if (backward) {
    workflow = resetDownstreamStages(workflow, stageKey);
  } else {
    workflow = applyAutoTransitions(workflow);
  }

  return { ok: true, workflow };
}

export function workflowCompletedCount(workflow: CellWorkflowStage[]): number {
  const normalized = normalizeCellWorkflow(workflow);
  return normalized.filter((stage) => {
    if (isReviewStageKey(stage.stageKey)) return stage.status === 'approved';
    return stage.status === 'completed';
  }).length;
}

export function currentWorkflowStageLabel(workflow: CellWorkflowStage[]): string {
  const normalized = normalizeCellWorkflow(workflow);
  const inProgress = normalized.find((s) => s.status === 'in_progress');
  if (inProgress) return inProgress.stageLabel;
  const pendingReview = normalized.find((s) => s.status === 'pending_review');
  if (pendingReview) return pendingReview.stageLabel;
  const next = normalized.find((s) => s.status === 'not_started');
  if (next) return next.stageLabel;
  return normalized[normalized.length - 1]?.stageLabel || '—';
}
