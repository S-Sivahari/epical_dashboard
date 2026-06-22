import {
  defaultSchematicViewState,
  normalizeSchematicViewState,
  schematicViewSummary,
  syncSchematicViewFromWorkflow,
  syncSchematicWorkflowFromView,
} from './schematicWorkflow';

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

/** Prefer persisted layout workflow; fall back to view workflow only when missing. */
export function resolveStoredCellWorkflow(cell: {
  workflow?: unknown;
  viewWorkflow?: unknown;
}): CellWorkflowStage[] {
  if (cell.workflow != null) {
    const normalized = normalizeCellWorkflow(cell.workflow);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return syncCellWorkflowFromViewWorkflow(normalizeViewWorkflow(cell.viewWorkflow));
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

export function applyAutoTransitions(workflow: CellWorkflowStage[]): CellWorkflowStage[] {
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

export type ReviewRejectReturnTo = 'floor_plan' | 'routing';

export type WorkflowActorRole = 'Admin' | 'Employee' | 'TeamLead';

function normalizeReviewStageTarget(nextStatus: WorkflowStageStatus): WorkflowStageStatus {
  if (nextStatus === 'in_progress') return 'pending_review';
  if (nextStatus === 'completed') return 'approved';
  return nextStatus;
}

function canManageReviewStages(actorRole: WorkflowActorRole): boolean {
  return actorRole === 'Admin' || actorRole === 'TeamLead';
}

export function applyWorkflowStageUpdate(
  rawWorkflow: unknown,
  stageKey: CellWorkflowStageKey,
  nextStatus: WorkflowStageStatus,
  actorRole: WorkflowActorRole,
  options?: { rejectReturnTo?: ReviewRejectReturnTo },
): WorkflowUpdateResult {
  let workflow = normalizeCellWorkflow(rawWorkflow);
  const current = stageStatus(workflow, stageKey);

  const backward = isBackwardWorkTransition(current, nextStatus);

  if (!backward && isStageLocked(workflow, stageKey) && !isReviewStageKey(stageKey)) {
    return { ok: false, error: 'This stage is locked until prerequisite stages are completed and approved' };
  }

  if (isReviewStageKey(stageKey)) {
    if (!canManageReviewStages(actorRole)) {
      return { ok: false, error: 'Only admins or team leads can update review stages' };
    }

    const target = normalizeReviewStageTarget(nextStatus);
    if (
      target !== 'not_started' &&
      target !== 'pending_review' &&
      target !== 'approved' &&
      target !== 'rejected'
    ) {
      return { ok: false, error: 'Invalid status for review stage' };
    }

    if (target === 'not_started') {
      workflow = setStageStatus(workflow, stageKey, 'not_started');
      if (current === 'approved' || current === 'rejected' || current === 'pending_review') {
        workflow = resetDownstreamStages(workflow, stageKey);
      }
      return { ok: true, workflow: applyAutoTransitions(workflow) };
    }

    if (target === 'pending_review') {
      if (stageKey === 'review_1' && stageStatus(workflow, 'drc_first') !== 'completed') {
        return { ok: false, error: 'Complete DRC before Review 1' };
      }
      if (stageKey === 'review_2' && stageStatus(workflow, 'lvs') !== 'completed') {
        return { ok: false, error: 'Complete LVS before Review 2' };
      }
      workflow = setStageStatus(workflow, stageKey, 'pending_review');
      return { ok: true, workflow: applyAutoTransitions(workflow) };
    }

    if (stageKey === 'review_1' && current === 'not_started' && stageStatus(workflow, 'drc_first') === 'completed') {
      workflow = setStageStatus(workflow, 'review_1', 'pending_review');
    }
    if (stageKey === 'review_2' && current === 'not_started' && stageStatus(workflow, 'lvs') === 'completed') {
      workflow = setStageStatus(workflow, 'review_2', 'pending_review');
    }

    const reviewStatus = stageStatus(workflow, stageKey);
    const canActOnReview =
      reviewStatus === 'pending_review' ||
      (reviewStatus === 'approved' && target === 'rejected');

    if (target === 'approved' || target === 'rejected') {
      if (!canActOnReview) {
        return { ok: false, error: 'Review is not pending approval' };
      }
    }

    if (stageKey === 'review_1') {
      if (target === 'approved') {
        workflow = setStageStatus(workflow, 'review_1', 'approved');
      } else if (target === 'rejected') {
        workflow = setStageStatus(workflow, 'floor_plan', 'not_started');
        workflow = setStageStatus(workflow, 'drc_first', 'not_started');
        workflow = setStageStatus(workflow, 'review_1', 'not_started');
        workflow = resetDownstreamStages(workflow, 'review_1');
      }
    } else if (stageKey === 'review_2') {
      if (target === 'approved') {
        workflow = setStageStatus(workflow, 'review_2', 'approved');
      } else if (target === 'rejected') {
        const returnTo = options?.rejectReturnTo;
        if (returnTo !== 'floor_plan' && returnTo !== 'routing') {
          return { ok: false, error: 'Select return stage: floor_plan or routing' };
        }

        if (returnTo === 'floor_plan') {
          workflow = setStageStatus(workflow, 'floor_plan', 'not_started');
          workflow = setStageStatus(workflow, 'drc_first', 'not_started');
          workflow = setStageStatus(workflow, 'review_1', 'not_started');
          workflow = setStageStatus(workflow, 'routing', 'not_started');
          workflow = setStageStatus(workflow, 'drc_final', 'not_started');
          workflow = setStageStatus(workflow, 'lvs', 'not_started');
          workflow = setStageStatus(workflow, 'review_2', 'not_started');
        } else {
          workflow = setStageStatus(workflow, 'routing', 'not_started');
          workflow = setStageStatus(workflow, 'drc_final', 'not_started');
          workflow = setStageStatus(workflow, 'lvs', 'not_started');
          workflow = setStageStatus(workflow, 'review_2', 'not_started');
        }
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

export const VIEW_PROGRESS_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export type ViewProgressStatus = (typeof VIEW_PROGRESS_STATUSES)[number];

export const LAYOUT_STAGES = ['floor_plan', 'drc_r1', 'routing', 'drc', 'lvs_r2'] as const;
export type LayoutStage = (typeof LAYOUT_STAGES)[number];

export const REVIEW_POINTS = ['r1', 'r2'] as const;
export type ReviewPoint = (typeof REVIEW_POINTS)[number];

export interface SimpleViewState {
  status: ViewProgressStatus;
}

export interface LayoutViewState {
  stage: LayoutStage;
  status: ViewProgressStatus;
  pendingReview: ReviewPoint | null;
}

export interface CellViewWorkflow {
  style: SimpleViewState;
  symbol: SimpleViewState;
  schematic: import('./schematicWorkflow').SchematicViewState;
  layout: LayoutViewState;
}

export const LAYOUT_STAGE_LABELS: Record<LayoutStage, string> = {
  floor_plan: 'Floor Plan',
  drc_r1: 'DRC (R1)',
  routing: 'Routing',
  drc: 'DRC',
  lvs_r2: 'LVS (R2)',
};

export const VIEW_PROGRESS_LABELS: Record<ViewProgressStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const REVIEW_STAGE_BY_POINT: Record<ReviewPoint, LayoutStage> = {
  r1: 'drc_r1',
  r2: 'lvs_r2',
};

const RETURN_OPTIONS_BY_REVIEW: Record<ReviewPoint, LayoutStage[]> = {
  r1: ['floor_plan'],
  r2: ['routing', 'floor_plan'],
};

const NEXT_STAGE_AFTER: Partial<Record<LayoutStage, LayoutStage>> = {
  floor_plan: 'drc_r1',
  drc_r1: 'routing',
  routing: 'drc',
  drc: 'lvs_r2',
};

export function defaultViewWorkflow(): CellViewWorkflow {
  return {
    style: { status: 'not_started' },
    symbol: { status: 'not_started' },
    schematic: defaultSchematicViewState(),
    layout: { stage: 'floor_plan', status: 'not_started', pendingReview: null },
  };
}

function normalizeProgressStatus(value: unknown): ViewProgressStatus {
  if (value === 'in_progress' || value === 'completed') return value;
  return 'not_started';
}

function normalizeLayoutStage(value: unknown): LayoutStage {
  if (typeof value === 'string' && (LAYOUT_STAGES as readonly string[]).includes(value)) {
    return value as LayoutStage;
  }
  return 'floor_plan';
}

function normalizeReviewPoint(value: unknown): ReviewPoint | null {
  if (value === 'r1' || value === 'r2') return value;
  return null;
}

export function normalizeViewWorkflow(raw: unknown): CellViewWorkflow {
  if (!raw || typeof raw !== 'object') return defaultViewWorkflow();
  const data = raw as Partial<CellViewWorkflow>;
  const legacyStyleStatus = data.style?.status;
  return {
    style: { status: normalizeProgressStatus(data.style?.status) },
    symbol: { status: normalizeProgressStatus(data.symbol?.status) },
    schematic: normalizeSchematicViewState(data.schematic, legacyStyleStatus),
    layout: {
      stage: normalizeLayoutStage(data.layout?.stage),
      status: normalizeProgressStatus(data.layout?.status),
      pendingReview: normalizeReviewPoint(data.layout?.pendingReview),
    },
  };
}

export function reviewPointForStage(stage: LayoutStage): ReviewPoint | null {
  if (stage === 'drc_r1') return 'r1';
  if (stage === 'lvs_r2') return 'r2';
  return null;
}

export function returnOptionsForReview(reviewPoint: ReviewPoint): LayoutStage[] {
  return RETURN_OPTIONS_BY_REVIEW[reviewPoint];
}

export function canRequestReview(workflow: CellViewWorkflow): ReviewPoint | null {
  const { layout } = workflow;
  if (layout.pendingReview) return null;
  const point = reviewPointForStage(layout.stage);
  if (!point) return null;
  if (layout.status !== 'completed') return null;
  return point;
}

export function advanceSimpleViewStatus(current: ViewProgressStatus): ViewProgressStatus | null {
  if (current === 'not_started') return 'in_progress';
  if (current === 'in_progress') return 'completed';
  return null;
}

/** Layout/style/symbol status may only move one step forward per update. */
export function validateStatusStepForward(current: ViewProgressStatus, next: ViewProgressStatus): void {
  const allowed = advanceSimpleViewStatus(current);
  if (!allowed || next !== allowed) {
    throw new Error('Complete each step in order: Not Started → In Progress → Completed');
  }
}

export function canAdvanceLayoutStage(workflow: CellViewWorkflow): boolean {
  const { layout } = workflow;
  if (layout.pendingReview) return false;
  if (layout.status !== 'completed') return false;
  const point = reviewPointForStage(layout.stage);
  if (point) return false;
  return Boolean(NEXT_STAGE_AFTER[layout.stage]);
}

export function advanceLayoutStage(workflow: CellViewWorkflow): CellViewWorkflow {
  const { layout } = workflow;
  const next = NEXT_STAGE_AFTER[layout.stage];
  if (!next || layout.pendingReview || layout.status !== 'completed') {
    throw new Error('Cannot advance layout stage');
  }
  return {
    ...workflow,
    layout: { stage: next, status: 'not_started', pendingReview: null },
  };
}

export function applyReviewApproval(workflow: CellViewWorkflow, reviewPoint: ReviewPoint): CellViewWorkflow {
  const expectedStage = REVIEW_STAGE_BY_POINT[reviewPoint];
  if (workflow.layout.stage !== expectedStage) {
    throw new Error('Review point does not match current layout stage');
  }

  if (reviewPoint === 'r2') {
    return {
      ...workflow,
      layout: { stage: 'lvs_r2', status: 'completed', pendingReview: null },
    };
  }

  const next = NEXT_STAGE_AFTER[expectedStage];
  if (!next) throw new Error('No next stage after review approval');
  return {
    ...workflow,
    layout: { stage: next, status: 'not_started', pendingReview: null },
  };
}

export function applyReviewRejection(
  workflow: CellViewWorkflow,
  reviewPoint: ReviewPoint,
  returnToStage: LayoutStage,
): CellViewWorkflow {
  const options = returnOptionsForReview(reviewPoint);
  if (!options.includes(returnToStage)) {
    throw new Error('Invalid return stage for this review');
  }
  return {
    ...workflow,
    layout: { stage: returnToStage, status: 'not_started', pendingReview: null },
  };
}

export function markReviewPending(workflow: CellViewWorkflow, reviewPoint: ReviewPoint): CellViewWorkflow {
  const expectedStage = REVIEW_STAGE_BY_POINT[reviewPoint];
  if (workflow.layout.stage !== expectedStage || workflow.layout.status !== 'completed') {
    throw new Error('Review can only be requested at completed review stages');
  }
  if (workflow.layout.pendingReview) {
    throw new Error('A review is already pending');
  }
  return {
    ...workflow,
    layout: { ...workflow.layout, pendingReview: reviewPoint },
  };
}

export function isLayoutWorkflowComplete(workflow: CellViewWorkflow): boolean {
  return workflow.layout.stage === 'lvs_r2' && workflow.layout.status === 'completed' && !workflow.layout.pendingReview;
}

export const FINAL_LAYOUT_STAGE: LayoutStage = 'lvs_r2';

/** Checklist + final cell details are required only when completing the final layout stage or requesting R2 review. */
export function viewWorkflowActionRequiresChecklist(
  workflow: CellViewWorkflow,
  params: {
    view?: 'style' | 'symbol' | 'layout';
    action?: 'set_status' | 'advance_stage';
    status?: ViewProgressStatus;
    reviewRequest?: boolean;
  },
): boolean {
  if (params.reviewRequest) {
    return canRequestReview(workflow) === 'r2';
  }

  if (params.view !== 'layout') {
    return false;
  }

  if (params.action === 'set_status' && params.status === 'completed') {
    return workflow.layout.stage === FINAL_LAYOUT_STAGE;
  }

  return false;
}

function mapViewProgressToWorkStatus(status: ViewProgressStatus): WorkStageStatus {
  return status;
}

type LayoutSegment = {
  layoutStage: LayoutStage;
  workKey: CellWorkflowStageKey;
  reviewKey?: ReviewStageKey;
};

const LAYOUT_SEGMENTS: LayoutSegment[] = [
  { layoutStage: 'floor_plan', workKey: 'floor_plan' },
  { layoutStage: 'drc_r1', workKey: 'drc_first', reviewKey: 'review_1' },
  { layoutStage: 'routing', workKey: 'routing' },
  { layoutStage: 'drc', workKey: 'drc_final' },
  { layoutStage: 'lvs_r2', workKey: 'lvs', reviewKey: 'review_2' },
];

/** Derive admin workflow stages from the employee kanban view workflow. */
export function syncCellWorkflowFromViewWorkflow(viewWorkflow: CellViewWorkflow): CellWorkflowStage[] {
  const vw = normalizeViewWorkflow(viewWorkflow);
  const { layout } = vw;
  let workflow = defaultCellWorkflow();
  const currentIndex = LAYOUT_STAGES.indexOf(layout.stage);

  const completeBefore = (index: number) => {
    if (index >= 1) {
      workflow = setStageStatus(workflow, 'floor_plan', 'completed');
    }
    if (index >= 2) {
      workflow = setStageStatus(workflow, 'drc_first', 'completed');
      workflow = setStageStatus(workflow, 'review_1', 'approved');
    }
    if (index >= 3) {
      workflow = setStageStatus(workflow, 'routing', 'completed');
    }
    if (index >= 4) {
      workflow = setStageStatus(workflow, 'drc_final', 'completed');
    }
    if (index >= 5) {
      workflow = setStageStatus(workflow, 'lvs', 'completed');
      workflow = setStageStatus(workflow, 'review_2', 'approved');
    }
  };

  completeBefore(currentIndex);

  switch (layout.stage) {
    case 'floor_plan':
      workflow = setStageStatus(workflow, 'floor_plan', mapViewProgressToWorkStatus(layout.status));
      break;
    case 'drc_r1':
      workflow = setStageStatus(workflow, 'floor_plan', 'completed');
      if (layout.pendingReview === 'r1') {
        workflow = setStageStatus(workflow, 'drc_first', 'completed');
        workflow = setStageStatus(workflow, 'review_1', 'pending_review');
      } else {
        workflow = setStageStatus(workflow, 'drc_first', mapViewProgressToWorkStatus(layout.status));
      }
      break;
    case 'routing':
      workflow = setStageStatus(workflow, 'floor_plan', 'completed');
      workflow = setStageStatus(workflow, 'drc_first', 'completed');
      workflow = setStageStatus(workflow, 'review_1', 'approved');
      workflow = setStageStatus(workflow, 'routing', mapViewProgressToWorkStatus(layout.status));
      break;
    case 'drc':
      workflow = setStageStatus(workflow, 'floor_plan', 'completed');
      workflow = setStageStatus(workflow, 'drc_first', 'completed');
      workflow = setStageStatus(workflow, 'review_1', 'approved');
      workflow = setStageStatus(workflow, 'routing', 'completed');
      workflow = setStageStatus(workflow, 'drc_final', mapViewProgressToWorkStatus(layout.status));
      break;
    case 'lvs_r2':
      workflow = setStageStatus(workflow, 'floor_plan', 'completed');
      workflow = setStageStatus(workflow, 'drc_first', 'completed');
      workflow = setStageStatus(workflow, 'review_1', 'approved');
      workflow = setStageStatus(workflow, 'routing', 'completed');
      workflow = setStageStatus(workflow, 'drc_final', 'completed');
      if (layout.pendingReview === 'r2') {
        workflow = setStageStatus(workflow, 'lvs', 'completed');
        workflow = setStageStatus(workflow, 'review_2', 'pending_review');
      } else if (layout.status === 'completed') {
        workflow = setStageStatus(workflow, 'lvs', 'completed');
        workflow = setStageStatus(workflow, 'review_2', 'approved');
      } else {
        workflow = setStageStatus(workflow, 'lvs', mapViewProgressToWorkStatus(layout.status));
      }
      break;
    default:
      break;
  }

  return workflow;
}

/** Derive employee kanban view workflow from admin workflow stages. */
export function syncViewWorkflowFromCellWorkflow(
  cellWorkflow: unknown,
  existing?: CellViewWorkflow,
): CellViewWorkflow {
  const base = normalizeViewWorkflow(existing);
  const wf = normalizeCellWorkflow(cellWorkflow);

  const r1 = stageStatus(wf, 'review_1');
  const r2 = stageStatus(wf, 'review_2');

  if (r2 === 'pending_review') {
    return {
      ...base,
      layout: { stage: 'lvs_r2', status: 'completed', pendingReview: 'r2' },
    };
  }

  if (r1 === 'pending_review') {
    return {
      ...base,
      layout: { stage: 'drc_r1', status: 'completed', pendingReview: 'r1' },
    };
  }

  if (r2 === 'approved') {
    return {
      ...base,
      layout: { stage: 'lvs_r2', status: 'completed', pendingReview: null },
    };
  }

  for (const segment of LAYOUT_SEGMENTS) {
    const workStatus = stageStatus(wf, segment.workKey);
    const reviewStatus = segment.reviewKey ? stageStatus(wf, segment.reviewKey) : 'approved';

    if (reviewStatus === 'rejected') {
      return {
        ...base,
        layout: { stage: segment.layoutStage, status: 'in_progress', pendingReview: null },
      };
    }

    const workComplete = workStatus === 'completed';
    const reviewComplete = !segment.reviewKey || reviewStatus === 'approved';

    if (!workComplete || !reviewComplete) {
      let status: ViewProgressStatus = 'not_started';
      if (workStatus === 'in_progress') {
        status = 'in_progress';
      } else if (workComplete && segment.reviewKey && reviewStatus === 'not_started') {
        status = 'completed';
      } else if (workStatus === 'completed' && !segment.reviewKey) {
        status = 'completed';
      }

      return {
        ...base,
        layout: { stage: segment.layoutStage, status, pendingReview: null },
      };
    }
  }

  return {
    ...base,
    layout: { stage: 'lvs_r2', status: 'completed', pendingReview: null },
  };
}

export function syncViewsFromViewWorkflow(cell: {
  views?: { layout?: string; symbol?: string; schematic?: string };
  viewWorkflow?: unknown;
}): void {
  const vw = normalizeViewWorkflow(cell.viewWorkflow);
  cell.views = {
    layout: cell.views?.layout || '',
    symbol: vw.symbol.status,
    schematic: schematicViewSummary(vw.schematic),
  };
  vw.style.status = vw.schematic.stage === 'review' && vw.schematic.status === 'completed'
    ? 'completed'
    : vw.schematic.status;
  cell.viewWorkflow = vw;
}

export function syncViewWorkflowSimpleViewsFromCellViews(cell: {
  views?: { layout?: string; symbol?: string; schematic?: string };
  viewWorkflow?: unknown;
}): void {
  const vw = normalizeViewWorkflow(cell.viewWorkflow);
  if (cell.views?.symbol) {
    vw.symbol.status = normalizeProgressStatus(cell.views.symbol);
  }
  if (cell.views?.schematic) {
    const status = normalizeProgressStatus(cell.views.schematic);
    vw.schematic = { stage: 'design', status, pendingReview: false };
    vw.style.status = status;
  }
  cell.viewWorkflow = vw;
}

/** Keep admin schematic workflow and employee view workflow aligned. */
export function applySchematicWorkflowSync(
  cell: {
    schematicWorkflow?: unknown;
    viewWorkflow?: unknown;
    views?: { layout?: string; symbol?: string; schematic?: string };
  },
  source: 'schematicWorkflow' | 'viewWorkflow',
): void {
  const vw = normalizeViewWorkflow(cell.viewWorkflow);
  if (source === 'viewWorkflow') {
    cell.schematicWorkflow = syncSchematicWorkflowFromView(vw.schematic);
    syncViewsFromViewWorkflow(cell);
    return;
  }
  vw.schematic = syncSchematicViewFromWorkflow(cell.schematicWorkflow, vw.schematic);
  cell.viewWorkflow = vw;
  syncViewsFromViewWorkflow(cell);
}

/** Keep admin workflow and employee view workflow aligned after either side changes. */
export function applyCellWorkflowSync(
  cell: {
    workflow?: unknown;
    viewWorkflow?: unknown;
    views?: { layout?: string; symbol?: string; schematic?: string };
  },
  source: 'workflow' | 'viewWorkflow',
): void {
  if (source === 'viewWorkflow') {
    cell.workflow = syncCellWorkflowFromViewWorkflow(normalizeViewWorkflow(cell.viewWorkflow));
    syncViewsFromViewWorkflow(cell);
    return;
  }

  cell.viewWorkflow = syncViewWorkflowFromCellWorkflow(cell.workflow, normalizeViewWorkflow(cell.viewWorkflow));
  syncViewsFromViewWorkflow(cell);
}
