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
  return {
    style: { status: normalizeProgressStatus(data.style?.status) },
    symbol: { status: normalizeProgressStatus(data.symbol?.status) },
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
