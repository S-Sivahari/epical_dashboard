import {
  normalizeWorkflowStageStatus,
  type WorkflowStageStatus,
} from './cellWorkflow';

export const SCHEMATIC_WORKFLOW_STAGE_KEYS = [
  'design',
  'simulation',
  'data_collection',
  'schematic_review',
] as const;

export type SchematicWorkflowStageKey = (typeof SCHEMATIC_WORKFLOW_STAGE_KEYS)[number];

export const SCHEMATIC_VIEW_STAGES = ['design', 'simulation', 'data_collection', 'review'] as const;
export type SchematicViewStage = (typeof SCHEMATIC_VIEW_STAGES)[number];

export const SCHEMATIC_WORKFLOW_STAGES: { key: SchematicWorkflowStageKey; label: string }[] = [
  { key: 'design', label: 'Design' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'data_collection', label: 'Data Collection' },
  { key: 'schematic_review', label: 'Review' },
];

export interface SchematicWorkflowStage {
  stageKey: SchematicWorkflowStageKey;
  stageLabel: string;
  status: WorkflowStageStatus;
  updatedAt?: Date;
}

export interface SchematicViewState {
  stage: SchematicViewStage;
  status: 'not_started' | 'in_progress' | 'completed';
  pendingReview: boolean;
}

export function isSchematicReviewStageKey(stageKey: string): stageKey is 'schematic_review' {
  return stageKey === 'schematic_review';
}

export function isValidSchematicStageKey(value: string): value is SchematicWorkflowStageKey {
  return (SCHEMATIC_WORKFLOW_STAGE_KEYS as readonly string[]).includes(value);
}

export function defaultSchematicWorkflow(): SchematicWorkflowStage[] {
  return SCHEMATIC_WORKFLOW_STAGES.map((stage) => ({
    stageKey: stage.key,
    stageLabel: stage.label,
    status: stage.key === 'design' ? 'in_progress' : 'not_started',
  }));
}

export function defaultSchematicViewState(): SchematicViewState {
  return { stage: 'design', status: 'not_started', pendingReview: false };
}

export function normalizeSchematicWorkflow(raw: unknown): SchematicWorkflowStage[] {
  const defaults = defaultSchematicWorkflow();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const byKey = new Map<SchematicWorkflowStageKey, SchematicWorkflowStage>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const stageKey = String((item as SchematicWorkflowStage).stageKey || '');
    if (!isValidSchematicStageKey(stageKey)) continue;
    const label = SCHEMATIC_WORKFLOW_STAGES.find((s) => s.key === stageKey)?.label || stageKey;
    byKey.set(stageKey, {
      stageKey,
      stageLabel: label,
      status: normalizeWorkflowStageStatus(String((item as SchematicWorkflowStage).status || 'not_started')),
      updatedAt: (item as SchematicWorkflowStage).updatedAt,
    });
  }

  return defaults.map((stage) => byKey.get(stage.stageKey) || stage);
}

function normalizeSchematicViewStage(value: unknown): SchematicViewStage {
  if (typeof value === 'string' && (SCHEMATIC_VIEW_STAGES as readonly string[]).includes(value)) {
    return value as SchematicViewStage;
  }
  return 'design';
}

function normalizeViewProgressStatus(value: unknown): SchematicViewState['status'] {
  if (value === 'in_progress' || value === 'completed') return value;
  return 'not_started';
}

export function normalizeSchematicViewState(raw: unknown, legacyStyleStatus?: string): SchematicViewState {
  if (raw && typeof raw === 'object' && 'stage' in (raw as object)) {
    const data = raw as Partial<SchematicViewState>;
    return {
      stage: normalizeSchematicViewStage(data.stage),
      status: normalizeViewProgressStatus(data.status),
      pendingReview: Boolean(data.pendingReview),
    };
  }

  if (legacyStyleStatus) {
    const status = normalizeViewProgressStatus(legacyStyleStatus);
    return { stage: 'design', status, pendingReview: false };
  }

  return defaultSchematicViewState();
}

function stageStatus(workflow: SchematicWorkflowStage[], key: SchematicWorkflowStageKey): WorkflowStageStatus {
  return workflow.find((s) => s.stageKey === key)?.status ?? 'not_started';
}

function setStageStatus(
  workflow: SchematicWorkflowStage[],
  key: SchematicWorkflowStageKey,
  status: WorkflowStageStatus,
): SchematicWorkflowStage[] {
  return workflow.map((stage) =>
    stage.stageKey === key ? { ...stage, status, updatedAt: new Date() } : stage,
  );
}

function prerequisitesMet(workflow: SchematicWorkflowStage[], stageKey: SchematicWorkflowStageKey): boolean {
  switch (stageKey) {
    case 'design':
      return true;
    case 'simulation':
      return stageStatus(workflow, 'design') === 'completed';
    case 'data_collection':
      return stageStatus(workflow, 'simulation') === 'completed';
    case 'schematic_review':
      return stageStatus(workflow, 'data_collection') === 'completed';
    default:
      return false;
  }
}

export function isSchematicStageLocked(workflow: SchematicWorkflowStage[], stageKey: SchematicWorkflowStageKey): boolean {
  if (isSchematicReviewStageKey(stageKey)) return false;
  const stage = workflow.find((s) => s.stageKey === stageKey);
  if (!stage || stage.status !== 'not_started') return false;
  return !prerequisitesMet(workflow, stageKey);
}

function resetDownstreamStages(
  workflow: SchematicWorkflowStage[],
  stageKey: SchematicWorkflowStageKey,
): SchematicWorkflowStage[] {
  const index = SCHEMATIC_WORKFLOW_STAGE_KEYS.indexOf(stageKey);
  if (index < 0) return workflow;
  return workflow.map((stage, i) =>
    i <= index ? stage : { ...stage, status: 'not_started', updatedAt: new Date() },
  );
}

function applySchematicAutoTransitionsOnce(workflow: SchematicWorkflowStage[]): SchematicWorkflowStage[] {
  let next = [...workflow];

  if (stageStatus(next, 'design') === 'completed' && stageStatus(next, 'simulation') === 'not_started') {
    next = setStageStatus(next, 'simulation', 'in_progress');
  }
  if (stageStatus(next, 'simulation') === 'completed' && stageStatus(next, 'data_collection') === 'not_started') {
    next = setStageStatus(next, 'data_collection', 'in_progress');
  }
  if (
    stageStatus(next, 'data_collection') === 'completed'
    && stageStatus(next, 'schematic_review') === 'not_started'
  ) {
    next = setStageStatus(next, 'schematic_review', 'pending_review');
  }

  return next;
}

export function applySchematicAutoTransitions(workflow: SchematicWorkflowStage[]): SchematicWorkflowStage[] {
  let next = normalizeSchematicWorkflow(workflow);
  for (let i = 0; i < 4; i += 1) {
    const updated = applySchematicAutoTransitionsOnce(next);
    if (JSON.stringify(updated) === JSON.stringify(next)) break;
    next = updated;
  }
  return next;
}

export type SchematicWorkflowActorRole = 'Admin' | 'Employee' | 'TeamLead';

function canManageSchematicReview(actorRole: SchematicWorkflowActorRole): boolean {
  return actorRole === 'Admin' || actorRole === 'TeamLead';
}

export type SchematicWorkflowUpdateResult =
  | { ok: true; workflow: SchematicWorkflowStage[] }
  | { ok: false; error: string };

export function applySchematicWorkflowStageUpdate(
  rawWorkflow: unknown,
  stageKey: SchematicWorkflowStageKey,
  nextStatus: WorkflowStageStatus,
  actorRole: SchematicWorkflowActorRole,
  options?: { rejectReturnTo?: 'design' | 'simulation' | 'data_collection' },
): SchematicWorkflowUpdateResult {
  let workflow = applySchematicAutoTransitions(normalizeSchematicWorkflow(rawWorkflow));
  const current = stageStatus(workflow, stageKey);

  if (isSchematicReviewStageKey(stageKey)) {
    if (!canManageSchematicReview(actorRole)) {
      return { ok: false, error: 'Only admins or team leads can update schematic review' };
    }

    if (nextStatus === 'approved') {
      if (current !== 'pending_review') {
        return { ok: false, error: 'Schematic review is not pending approval' };
      }
      workflow = setStageStatus(workflow, 'schematic_review', 'approved');
      return { ok: true, workflow: applySchematicAutoTransitions(workflow) };
    }

    if (nextStatus === 'rejected') {
      if (current !== 'pending_review') {
        return { ok: false, error: 'Schematic review is not pending approval' };
      }
      const returnTo = options?.rejectReturnTo ?? 'design';
      if (!['design', 'simulation', 'data_collection'].includes(returnTo)) {
        return { ok: false, error: 'Invalid return stage for schematic rejection' };
      }
      workflow = setStageStatus(workflow, 'schematic_review', 'not_started');
      workflow = setStageStatus(workflow, returnTo, 'not_started');
      workflow = resetDownstreamStages(workflow, returnTo);
      if (returnTo === 'design') {
        workflow = setStageStatus(workflow, 'design', 'in_progress');
      }
      return { ok: true, workflow: applySchematicAutoTransitions(workflow) };
    }

    if (nextStatus === 'pending_review') {
      if (stageStatus(workflow, 'data_collection') !== 'completed') {
        return { ok: false, error: 'Complete data collection before requesting schematic review' };
      }
      workflow = setStageStatus(workflow, 'schematic_review', 'pending_review');
      return { ok: true, workflow };
    }

    return { ok: false, error: 'Invalid status for schematic review stage' };
  }

  if (isSchematicStageLocked(workflow, stageKey) && nextStatus !== 'not_started') {
    return { ok: false, error: 'This schematic stage is locked until prior stages are completed' };
  }

  if (!['not_started', 'in_progress', 'completed'].includes(nextStatus)) {
    return { ok: false, error: 'Invalid status for schematic work stage' };
  }

  workflow = setStageStatus(workflow, stageKey, nextStatus);
  return { ok: true, workflow: applySchematicAutoTransitions(workflow) };
}

/** Derive employee schematic view state from admin schematic workflow. */
export function syncSchematicViewFromWorkflow(
  schematicWorkflow: unknown,
  existing?: SchematicViewState,
): SchematicViewState {
  const base = existing ?? defaultSchematicViewState();
  const wf = normalizeSchematicWorkflow(schematicWorkflow);
  const reviewStatus = stageStatus(wf, 'schematic_review');

  if (reviewStatus === 'pending_review') {
    return { stage: 'review', status: 'in_progress', pendingReview: true };
  }

  if (reviewStatus === 'approved') {
    return { stage: 'review', status: 'completed', pendingReview: false };
  }

  if (reviewStatus === 'rejected') {
    for (const key of ['data_collection', 'simulation', 'design'] as const) {
      const status = stageStatus(wf, key);
      if (status === 'in_progress' || status === 'not_started') {
        const viewStage: SchematicViewStage = key;
        return {
          stage: viewStage,
          status: status === 'in_progress' ? 'in_progress' : 'not_started',
          pendingReview: false,
        };
      }
    }
  }

  for (const key of ['design', 'simulation', 'data_collection'] as const) {
    const status = stageStatus(wf, key);
    if (status === 'completed') continue;
    const viewStage: SchematicViewStage = key;
    let viewStatus: SchematicViewState['status'] = 'not_started';
    if (status === 'in_progress') viewStatus = 'in_progress';
    if (status === 'completed') viewStatus = 'completed';
    return { stage: viewStage, status: viewStatus, pendingReview: false };
  }

  if (stageStatus(wf, 'data_collection') === 'completed') {
    return { stage: 'data_collection', status: 'completed', pendingReview: false };
  }

  return base;
}

/** Derive admin schematic workflow from employee view state. */
export function syncSchematicWorkflowFromView(view: SchematicViewState): SchematicWorkflowStage[] {
  let workflow = defaultSchematicWorkflow();
  const { stage, status, pendingReview } = view;

  const completeBefore = (target: SchematicViewStage) => {
    const order: SchematicViewStage[] = ['design', 'simulation', 'data_collection', 'review'];
    const index = order.indexOf(target);
    if (index >= 1) workflow = setStageStatus(workflow, 'design', 'completed');
    if (index >= 2) workflow = setStageStatus(workflow, 'simulation', 'completed');
    if (index >= 3) workflow = setStageStatus(workflow, 'data_collection', 'completed');
  };

  completeBefore(stage);

  if (stage === 'review' || pendingReview) {
    workflow = setStageStatus(workflow, 'design', 'completed');
    workflow = setStageStatus(workflow, 'simulation', 'completed');
    workflow = setStageStatus(workflow, 'data_collection', 'completed');
    if (pendingReview || status === 'in_progress') {
      workflow = setStageStatus(workflow, 'schematic_review', 'pending_review');
    } else if (status === 'completed') {
      workflow = setStageStatus(workflow, 'schematic_review', 'approved');
    }
    return workflow;
  }

  if (stage === 'design') {
    workflow = setStageStatus(workflow, 'design', status);
  } else if (stage === 'simulation') {
    workflow = setStageStatus(workflow, 'design', 'completed');
    workflow = setStageStatus(workflow, 'simulation', status);
  } else if (stage === 'data_collection') {
    workflow = setStageStatus(workflow, 'design', 'completed');
    workflow = setStageStatus(workflow, 'simulation', 'completed');
    workflow = setStageStatus(workflow, 'data_collection', status);
  }

  return applySchematicAutoTransitions(workflow);
}

export function canAdvanceSchematicView(view: SchematicViewState): boolean {
  if (view.pendingReview) return false;
  if (view.stage === 'review') return false;
  if (view.status !== 'completed') return false;
  if (view.stage === 'data_collection') return false;
  return true;
}

export function advanceSchematicView(view: SchematicViewState): SchematicViewState {
  if (!canAdvanceSchematicView(view)) {
    throw new Error('Cannot advance schematic stage');
  }
  const order: SchematicViewStage[] = ['design', 'simulation', 'data_collection'];
  const index = order.indexOf(view.stage as typeof order[number]);
  const next = order[index + 1];
  if (!next) throw new Error('No next schematic stage');
  return { stage: next, status: 'not_started', pendingReview: false };
}

export function canRequestSchematicReview(view: SchematicViewState): boolean {
  return view.stage === 'data_collection' && view.status === 'completed' && !view.pendingReview;
}

export function markSchematicReviewPending(view: SchematicViewState): SchematicViewState {
  if (!canRequestSchematicReview(view)) {
    throw new Error('Schematic review cannot be requested yet');
  }
  return { stage: 'review', status: 'in_progress', pendingReview: true };
}

export function schematicViewSummary(view: SchematicViewState): string {
  if (view.pendingReview) return 'pending_review';
  if (view.stage === 'review' && view.status === 'completed') return 'completed';
  return view.status;
}
