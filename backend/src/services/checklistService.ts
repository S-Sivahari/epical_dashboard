import { Types } from 'mongoose';
import { ChecklistModel, ProjectChecklistModel, CellChecklistMappingModel } from '../models/Checklist';
import { ProjectCellModel } from '../models/ProjectCell';
import { ProjectModel } from '../models/Project';
import type { CellChecklistStatus, ProjectChecklistStatus } from '../models/Checklist';
import type { ChecklistDocument, ProjectChecklistDocument } from '../models/Checklist';

function resolveSelectedItems(
  checklist: ChecklistDocument | { items: { _id: Types.ObjectId; itemName: string }[] },
  selectedItemIds?: Types.ObjectId[],
) {
  const allItems = checklist.items ?? [];
  if (!selectedItemIds?.length) return allItems;
  const idSet = new Set(selectedItemIds.map((id) => id.toString()));
  return allItems.filter((item) => idSet.has(item._id.toString()));
}

export function actorName(req: { user?: { name?: string; email?: string } }): string {
  return req.user?.name || req.user?.email || 'Admin';
}

function mapResponseToStatus(response: 'yes' | 'no' | 'not_applicable'): CellChecklistStatus {
  return response === 'yes' ? 'Applied' : 'Pending';
}

function deriveCellStatusFromEntries(
  entries: Array<{ response?: string | null; status?: string }>,
): 'Applied' | 'Pending' | 'Not Assigned' {
  if (!entries.length) return 'Not Assigned';
  const allAnswered = entries.every((e) => e.response);
  const allYes = entries.every((e) => e.response === 'yes');
  if (allYes) return 'Applied';
  if (allAnswered) return 'Pending';
  if (entries.some((e) => e.response)) return 'Pending';
  return 'Not Assigned';
}

export async function updateCellChecklistItemResponse(
  projectId: string,
  cellId: string,
  mappingId: string,
  payload: { response: 'yes' | 'no' | 'not_applicable'; comment?: string },
  actorId: string,
  actorNameStr: string,
) {
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(cellId) || !Types.ObjectId.isValid(mappingId)) {
    throw new Error('Invalid id');
  }

  const { response, comment } = payload;
  if (!['yes', 'no', 'not_applicable'].includes(response)) {
    throw new Error('Invalid response');
  }

  if ((response === 'no' || response === 'not_applicable') && !comment?.trim()) {
    throw new Error('A comment is required for No and Not Applicable');
  }

  const entry = await CellChecklistMappingModel.findOne({
    _id: mappingId,
    projectId,
    cellId,
  });
  if (!entry) throw new Error('Checklist item not found');

  entry.response = response;
  entry.comment = response === 'yes' ? '' : (comment?.trim() || '');
  entry.status = mapResponseToStatus(response);
  entry.appliedBy = actorId;
  entry.appliedByName = actorNameStr;
  entry.appliedDate = new Date();
  await entry.save();

  await recalcProjectChecklistProgress(new Types.ObjectId(projectId));
  return entry;
}

export async function recalcProjectChecklistProgress(projectId: Types.ObjectId): Promise<void> {
  const assignment = await ProjectChecklistModel.findOne({ projectId });
  if (!assignment) return;

  const cells = await ProjectCellModel.find({ projectId });
  const totalCells = cells.length;
  assignment.totalCells = totalCells;

  const checklist = await ChecklistModel.findById(assignment.checklistId);
  const selectedItems = checklist
    ? resolveSelectedItems(checklist, assignment.selectedItemIds)
    : [];
  const itemCount = selectedItems.length;

  if (totalCells === 0) {
    assignment.appliedCells = 0;
    if (itemCount === 0) {
      assignment.completionPercentage = 0;
      assignment.status = 'Not Applied';
    } else {
      const appliedMappings = await CellChecklistMappingModel.countDocuments({
        projectId,
        checklistId: assignment.checklistId,
        status: 'Applied',
      });
      if (appliedMappings > 0) {
        assignment.completionPercentage = 100;
        assignment.status = 'Applied';
      } else {
        assignment.completionPercentage = 0;
        assignment.status = 'Not Applied';
      }
    }
    await assignment.save();
    return;
  }

  let appliedCells = 0;
  for (const cell of cells) {
    const entries = await CellChecklistMappingModel.find({
      projectId,
      cellId: cell._id,
      checklistId: assignment.checklistId,
    });
    if (itemCount === 0) continue;
    const allAnswered =
      entries.length >= itemCount && entries.every((e) => Boolean(e.response));
    const allYes =
      entries.length >= itemCount && entries.every((e) => e.response === 'yes');
    if (allYes || allAnswered) appliedCells += 1;
  }

  assignment.appliedCells = appliedCells;
  assignment.completionPercentage = Math.round((appliedCells / totalCells) * 100);

  let status: ProjectChecklistStatus = 'Not Applied';
  if (assignment.completionPercentage >= 100) status = 'Applied';
  else if (assignment.completionPercentage > 0) status = 'Partial';
  assignment.status = status;

  await assignment.save();
}

export async function assignChecklistToProject(
  projectId: string,
  checklistId: string,
  options?: {
    actor?: string;
    actorId?: string;
    selectedItemIds?: string[];
    applyToAll?: boolean;
  },
): Promise<void> {
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(checklistId)) {
    throw new Error('Invalid project or checklist id');
  }

  const projectOid = new Types.ObjectId(projectId);
  const checklistOid = new Types.ObjectId(checklistId);
  const actor = options?.actor;

  const project = await ProjectModel.findById(projectOid);
  const checklist = await ChecklistModel.findById(checklistOid);
  if (!project) throw new Error('Project not found');
  if (!checklist) throw new Error('Checklist not found');

  const validItemIdSet = new Set(checklist.items.map((item) => item._id.toString()));
  let selectedIds: Types.ObjectId[];

  if (options?.selectedItemIds?.length) {
    selectedIds = options.selectedItemIds
      .filter((id) => Types.ObjectId.isValid(id) && validItemIdSet.has(id))
      .map((id) => new Types.ObjectId(id));
    if (!selectedIds.length) {
      throw new Error('Select at least one checklist question for this project');
    }
  } else {
    selectedIds = checklist.items.map((item) => item._id);
  }

  if (!selectedIds.length) {
    throw new Error('Checklist has no questions to assign');
  }

  await CellChecklistMappingModel.deleteMany({ projectId: projectOid });

  await ProjectChecklistModel.findOneAndUpdate(
    { projectId: projectOid },
    {
      projectId: projectOid,
      checklistId: checklistOid,
      selectedItemIds: selectedIds,
      status: 'Not Applied',
      completionPercentage: 0,
      totalCells: 0,
      appliedCells: 0,
    },
    { upsert: true, new: true },
  );

  const selectedItems = resolveSelectedItems(checklist, selectedIds);
  const cells = await ProjectCellModel.find({ projectId: projectOid });
  const applyToAll = options?.applyToAll ?? false;
  const now = new Date();
  const bulk: {
    projectId: Types.ObjectId;
    cellId: Types.ObjectId;
    checklistId: Types.ObjectId;
    checklistItemId: Types.ObjectId;
    itemName: string;
    status: CellChecklistStatus;
    appliedBy?: string;
    appliedByName?: string;
    appliedDate?: Date;
  }[] = [];

  for (const cell of cells) {
    for (const item of selectedItems) {
      bulk.push({
        projectId: projectOid,
        cellId: cell._id,
        checklistId: checklistOid,
        checklistItemId: item._id,
        itemName: item.itemName,
        status: applyToAll ? ('Applied' as CellChecklistStatus) : ('Pending' as CellChecklistStatus),
        response: applyToAll ? ('yes' as const) : null,
        comment: '',
        appliedBy: applyToAll ? options?.actorId || actor : actor,
        appliedByName: actor,
        appliedDate: applyToAll ? now : undefined,
      });
    }
  }

  if (bulk.length > 0) {
    await CellChecklistMappingModel.insertMany(bulk, { ordered: false });
  }

  await recalcProjectChecklistProgress(projectOid);

  if (applyToAll && cells.length === 0) {
    await ProjectChecklistModel.findOneAndUpdate(
      { projectId: projectOid },
      {
        status: 'Applied',
        completionPercentage: 100,
        totalCells: 0,
        appliedCells: 0,
      },
    );
  }
}

export async function applyChecklistToAllCells(
  projectId: string,
  actorId: string,
  actorNameStr: string,
): Promise<{ updated: number }> {
  if (!Types.ObjectId.isValid(projectId)) throw new Error('Invalid project id');
  const projectOid = new Types.ObjectId(projectId);

  const assignment = await ProjectChecklistModel.findOne({ projectId: projectOid });
  if (!assignment) throw new Error('No checklist assigned to this project');

  const cells = await ProjectCellModel.find({ projectId: projectOid });
  const now = new Date();

  if (cells.length === 0) {
    await ProjectChecklistModel.findOneAndUpdate(
      { projectId: projectOid },
      {
        status: 'Applied',
        completionPercentage: 100,
        totalCells: 0,
        appliedCells: 0,
      },
    );
    return { updated: 0 };
  }

  const result = await CellChecklistMappingModel.updateMany(
    { projectId: projectOid, checklistId: assignment.checklistId },
    {
      $set: {
        status: 'Applied',
        response: 'yes',
        comment: '',
        appliedBy: actorId,
        appliedByName: actorNameStr,
        appliedDate: now,
      },
    },
  );

  await recalcProjectChecklistProgress(projectOid);
  return { updated: result.modifiedCount };
}

export async function getProjectChecklistSummary(projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) return null;
  const projectOid = new Types.ObjectId(projectId);
  const assignment = await ProjectChecklistModel.findOne({ projectId: projectOid }).lean();
  if (!assignment) return null;

  const checklist = await ChecklistModel.findById(assignment.checklistId).lean();
  if (!checklist) return null;

  const selectedItems = resolveSelectedItems(
    checklist as { items: { _id: Types.ObjectId; itemName: string }[] },
    assignment.selectedItemIds,
  );

  return {
    checklistId: String(assignment.checklistId),
    checklistName: checklist.name,
    checklistDescription: checklist.description,
    status: assignment.status,
    completionPercentage: assignment.completionPercentage,
    totalCells: assignment.totalCells,
    appliedCells: assignment.appliedCells,
    lastUpdated: assignment.updatedAt,
    itemCount: selectedItems.length,
    selectedItemIds: selectedItems.map((item) => item._id.toString()),
    selectedItems: selectedItems.map((item) => ({
      id: item._id.toString(),
      itemName: item.itemName,
    })),
  };
}

export async function getProjectCellsChecklist(projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) {
    return { checklistId: null, checklistName: '', cells: [] as CellChecklistRowSummary[] };
  }

  const projectOid = new Types.ObjectId(projectId);
  const assignment = await ProjectChecklistModel.findOne({ projectId: projectOid }).lean();
  const checklist = assignment
    ? await ChecklistModel.findById(assignment.checklistId).lean()
    : null;

  const checklistName = checklist?.name ?? '';
  const checklistId = assignment ? String(assignment.checklistId) : null;

  const cells = await ProjectCellModel.find({ projectId: projectOid }).lean();

  if (assignment && cells.length > 0) {
    const existingCellIds = new Set(
      (await CellChecklistMappingModel.distinct('cellId', {
        projectId: projectOid,
        checklistId: assignment.checklistId,
      })).map(String),
    );
    for (const cell of cells) {
      if (!existingCellIds.has(String(cell._id))) {
        await syncChecklistMappingsForCell(projectOid, cell._id);
      }
    }
  }

  const entries = assignment
    ? await CellChecklistMappingModel.find({
        projectId: projectOid,
        checklistId: assignment.checklistId,
      }).lean()
    : [];

  const entriesByCell = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = String(entry.cellId);
    const list = entriesByCell.get(key) ?? [];
    list.push(entry);
    entriesByCell.set(key, list);
  }

  type CellChecklistRowSummary = {
    cellId: string;
    checklistName: string;
    cellStatus: 'Applied' | 'Pending' | 'Not Assigned';
    appliedCount: number;
    answeredCount: number;
    totalCount: number;
    items: Array<{
      id: string;
      checklistItemId: string;
      itemName: string;
      status: string;
      response: string | null;
      comment: string;
      appliedBy: string;
      appliedDate?: Date;
    }>;
  };

  const mapEntryItems = (cellEntries: typeof entries) =>
    cellEntries.map((e) => ({
      id: String(e._id),
      checklistItemId: String(e.checklistItemId),
      itemName: e.itemName,
      status: e.status,
      response: e.response ?? null,
      comment: e.comment ?? '',
      appliedBy: e.appliedByName || e.appliedBy || '',
      appliedDate: e.appliedDate,
    }));

  const cellSummaries: CellChecklistRowSummary[] = cells.map((cell) => {
    const cellId = String(cell._id);
    const cellEntries = entriesByCell.get(cellId) ?? [];

    if (!assignment || !checklistName) {
      return {
        cellId,
        checklistName: '',
        cellStatus: 'Not Assigned' as const,
        appliedCount: 0,
        answeredCount: 0,
        totalCount: 0,
        items: [],
      };
    }

    if (cellEntries.length === 0) {
      return {
        cellId,
        checklistName,
        cellStatus: 'Pending' as const,
        appliedCount: 0,
        answeredCount: 0,
        totalCount: 0,
        items: [],
      };
    }

    const appliedCount = cellEntries.filter((e) => e.response === 'yes').length;
    const answeredCount = cellEntries.filter((e) => e.response).length;
    const totalCount = cellEntries.length;
    const cellStatus = deriveCellStatusFromEntries(cellEntries);

    return {
      cellId,
      checklistName,
      cellStatus,
      appliedCount,
      answeredCount,
      totalCount,
      items: mapEntryItems(cellEntries),
    };
  });

  return { checklistId, checklistName, cells: cellSummaries };
}

export async function enrichProjectsWithChecklist<T extends { id: string }>(
  projects: T[],
): Promise<
  (T & {
    checklistName?: string;
    checklistStatus?: ProjectChecklistStatus;
    checklistCompletionPercentage?: number;
    checklistLastUpdated?: Date;
    checklistTotalCells?: number;
    checklistAppliedCells?: number;
  })[]
> {
  if (!projects.length) return projects;

  const ids = projects.map((p) => new Types.ObjectId(p.id));
  const assignments = await ProjectChecklistModel.find({ projectId: { $in: ids } }).lean();
  const checklistIds = [...new Set(assignments.map((a) => String(a.checklistId)))];
  const checklists = await ChecklistModel.find({
    _id: { $in: checklistIds.map((id) => new Types.ObjectId(id)) },
  }).lean();
  const checklistMap = new Map(checklists.map((c) => [String(c._id), c]));
  const assignMap = new Map(assignments.map((a) => [String(a.projectId), a]));

  return projects.map((p) => {
    const a = assignMap.get(p.id);
    if (!a) {
      return {
        ...p,
        checklistName: '',
        checklistStatus: 'Not Applied' as ProjectChecklistStatus,
        checklistCompletionPercentage: 0,
      };
    }
    const cl = checklistMap.get(String(a.checklistId));
    return {
      ...p,
      checklistName: cl?.name ?? '',
      checklistStatus: a.status,
      checklistCompletionPercentage: a.completionPercentage,
      checklistLastUpdated: a.updatedAt,
      checklistTotalCells: a.totalCells,
      checklistAppliedCells: a.appliedCells,
    };
  });
}

export async function buildChecklistExportRows() {
  const projects = await ProjectModel.find().sort({ createdAt: -1 }).lean();
  const rows = [];

  for (const p of projects) {
    const summary = await getProjectChecklistSummary(String(p._id));
    rows.push({
      projectName: p.projectName,
      client: p.clientName,
      projectType: p.accessType,
      teamLead: p.teamLead || '',
      checklistName: summary?.checklistName ?? '',
      checklistStatus: summary?.status ?? 'Not Applied',
      completionPercentage: summary?.completionPercentage ?? 0,
      totalCells: summary?.totalCells ?? 0,
      appliedCells: summary?.appliedCells ?? 0,
      lastUpdated: summary?.lastUpdated
        ? new Date(summary.lastUpdated).toISOString()
        : '',
    });
  }

  return rows;
}

export async function syncChecklistMappingsForCell(
  projectId: Types.ObjectId,
  cellId: Types.ObjectId,
): Promise<void> {
  const assignment = await ProjectChecklistModel.findOne({ projectId });
  if (!assignment) return;

  const checklist = await ChecklistModel.findById(assignment.checklistId);
  if (!checklist) return;

  const selectedItems = resolveSelectedItems(checklist, assignment.selectedItemIds);

  for (const item of selectedItems) {
    await CellChecklistMappingModel.findOneAndUpdate(
      { cellId, checklistItemId: item._id },
      {
        projectId,
        cellId,
        checklistId: assignment.checklistId,
        checklistItemId: item._id,
        itemName: item.itemName,
        status: 'Pending',
      },
      { upsert: true },
    );
  }

  await recalcProjectChecklistProgress(projectId);
}

export async function removeChecklistMappingsForCell(cellId: Types.ObjectId): Promise<void> {
  const entry = await CellChecklistMappingModel.findOne({ cellId });
  if (!entry) return;
  const projectId = entry.projectId;
  await CellChecklistMappingModel.deleteMany({ cellId });
  await recalcProjectChecklistProgress(projectId);
}
