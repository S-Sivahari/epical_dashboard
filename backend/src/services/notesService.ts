import { Types, type PipelineStage } from 'mongoose';
import { getDB } from '../config/db';
import { DailyNoteBlockModel, type DailyNoteStatus, type NoteActor } from '../models/DailyNoteBlock';
import { ProjectModel } from '../models/Project';
import { getUserById } from './authService';
import {
  buildSnippet,
  detectMatchedFields,
  escapeRegex,
  normalizeSearchQuery,
  stripHtml,
  type NoteSearchMatchField,
  type NotesSearchQuery,
} from '../utils/notesSearchUtils';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function employeeDisplayName(employee: { firstName?: string; lastName?: string }): string {
  return `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
}

function assertDateKey(date: string): string {
  const trimmed = date.trim();
  if (!DATE_KEY_PATTERN.test(trimmed)) {
    throw Object.assign(new Error('Invalid date format. Use yyyy-MM-dd.'), { status: 400 });
  }
  return trimmed;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDailyBlockName(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAY_LABELS[date.getDay()];
  const monthLabel = MONTH_LABELS[date.getMonth()];
  return `${weekday} ${String(day).padStart(2, '0')} ${monthLabel} ${year}`;
}

async function resolveActor(userId: string, email?: string): Promise<NoteActor> {
  const user = await getUserById(userId);
  const name = user?.name?.trim() || email?.trim() || userId;
  return { id: userId, name };
}

function normalizeChildEmployees(child: Record<string, unknown>) {
  const employeeIds = Array.isArray(child.employeeIds)
    ? child.employeeIds.map((id) => String(id)).filter(Boolean)
    : [];
  const employees = Array.isArray(child.employees)
    ? child.employees.map((entry) => {
        const actor = entry as NoteActor;
        return { id: String(actor.id), name: String(actor.name || '') };
      })
    : [];

  if (employeeIds.length > 0) {
    return { employeeIds, employees };
  }

  const legacyId = String(child.employeeId ?? '').trim();
  if (legacyId) {
    return {
      employeeIds: [legacyId],
      employees: [{ id: legacyId, name: String(child.employeeName ?? '').trim() }],
    };
  }

  return { employeeIds: [], employees: [] };
}

function serializeChildBlock(child: Record<string, unknown>) {
  const { employeeIds, employees } = normalizeChildEmployees(child);
  return {
    _id: String(child._id),
    title: child.title,
    projectId: child.projectId ?? '',
    projectName: child.projectName ?? '',
    employeeIds,
    employees,
    description: child.description ?? '',
    includeInEmail: Boolean(child.includeInEmail),
    sortOrder: Number(child.sortOrder ?? 0),
    archived: Boolean(child.archived),
    createdBy: child.createdBy,
    updatedBy: child.updatedBy,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
  };
}

/** Active projects for Daily Notes pickers — only current (Active) projects are shown. */
export async function listActiveProjects() {
  const projects = await ProjectModel.find({ status: 'Active' }).sort({ projectName: 1 }).lean();

  return projects.map((project) => ({
    id: project._id.toString(),
    name: project.projectName,
    client: project.clientName,
    technologyNode: project.technologyNode,
    status: project.status,
    accessType: project.accessType,
    visibleUsers: project.allowedUsers || [],
  }));
}

async function assertProject(projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) {
    throw Object.assign(new Error('Selected project is not available'), { status: 400 });
  }
  const project = await ProjectModel.findById(projectId).lean();
  if (!project) {
    throw Object.assign(new Error('Selected project is not available'), { status: 400 });
  }
  return project;
}

/** Employees allotted to a project — matches timesheet project member lists (`visibleUsers`). */
export async function listProjectAssignedEmployees(projectId: string) {
  const project = await assertProject(projectId);
  const allowedNames = new Set(
    (project.allowedUsers || []).map((name) => String(name).trim()).filter(Boolean),
  );

  const db = getDB();
  const employeeDocs = await db
    .collection('employees')
    .find({ status: 'Active', view: { $ne: 'Private' } })
    .project({ id: 1, firstName: 1, lastName: 1, employeeId: 1 })
    .toArray();

  const filtered =
    project.accessType === 'public' && allowedNames.size === 0
      ? employeeDocs
      : employeeDocs.filter((employee) => allowedNames.has(employeeDisplayName(employee)));

  return filtered
    .map((employee) => {
      const id = String(employee.id);
      const name = employeeDisplayName(employee) || id;
      return {
        id,
        employeeId: String(employee.employeeId || id),
        name,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Active public employees for Daily Notes pickers — private employees are hidden. */
export async function listActiveEmployeesForNotes() {
  const db = getDB();
  const employeeDocs = await db
    .collection('employees')
    .find({ status: 'Active', view: { $ne: 'Private' } })
    .project({
      id: 1,
      employeeId: 1,
      firstName: 1,
      middleName: 1,
      lastName: 1,
      email: 1,
      department: 1,
      designation: 1,
      role: 1,
      employmentType: 1,
      joinedAt: 1,
      status: 1,
    })
    .toArray();

  return employeeDocs
    .map((employee) => {
      const id = String(employee.id ?? employee.employeeId ?? '');
      return {
        id,
        employeeId: String(employee.employeeId ?? id),
        firstName: String(employee.firstName ?? ''),
        middleName: employee.middleName ? String(employee.middleName) : undefined,
        lastName: employee.lastName ? String(employee.lastName) : undefined,
        email: String(employee.email ?? ''),
        department: String(employee.department ?? ''),
        designation: String(employee.designation ?? ''),
        role: String(employee.role ?? 'Employee'),
        employmentType: employee.employmentType ?? 'Full-time',
        joinedAt: String(employee.joinedAt ?? ''),
        status: employee.status ?? 'Active',
      };
    })
    .filter((employee) => employee.id)
    .sort((a, b) => employeeDisplayName(a).localeCompare(employeeDisplayName(b)));
}

async function resolveEmployeesByIds(employeeIds: string[]): Promise<NoteActor[]> {
  if (employeeIds.length === 0) return [];

  const db = getDB();
  const employeeDocs = await db
    .collection('employees')
    .find({ id: { $in: employeeIds } })
    .project({ id: 1, firstName: 1, lastName: 1 })
    .toArray();

  const nameById = new Map(
    employeeDocs.map((employee) => [
      String(employee.id),
      employeeDisplayName(employee) || String(employee.id),
    ]),
  );

  return employeeIds.map((id) => ({ id, name: nameById.get(id) || id }));
}

async function resolveChildProjectAndEmployees(input: {
  projectId?: string;
  projectName?: string;
  employeeIds?: string[];
  employees?: NoteActor[];
}) {
  const projectId = input.projectId?.trim() ?? '';
  const employeeIds = Array.isArray(input.employeeIds)
    ? input.employeeIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (!projectId) {
    return {
      projectId: '',
      projectName: '',
      employeeIds: [],
      employees: [] as NoteActor[],
    };
  }

  const project = await assertProject(projectId);
  const employees = await resolveEmployeesByIds(employeeIds);

  return {
    projectId,
    projectName: project.projectName,
    employeeIds,
    employees,
  };
}

function activeChildCount(childBlocks: Array<{ archived?: boolean }>): number {
  return childBlocks.filter((child) => !child.archived).length;
}

function childEntryEmployeeIds(child: {
  archived?: boolean;
  employeeIds?: string[];
  employees?: NoteActor[];
  employeeId?: string;
  employeeName?: string;
}): string[] {
  if (child.archived) return [];
  const employeeIds = Array.isArray(child.employeeIds)
    ? child.employeeIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (employeeIds.length > 0) return employeeIds;
  const legacyId = String(child.employeeId ?? '').trim();
  return legacyId ? [legacyId] : [];
}

function employeeIdsOnProjectForDay(
  childBlocks: Array<{
    _id?: unknown;
    archived?: boolean;
    projectId?: string;
    employeeIds?: string[];
    employees?: NoteActor[];
    employeeId?: string;
  }>,
  projectId: string,
  excludeChildId?: string,
): Set<string> {
  const ids = new Set<string>();
  const normalizedProjectId = String(projectId).trim();
  for (const child of childBlocks) {
    if (child.archived || String(child.projectId ?? '').trim() !== normalizedProjectId) continue;
    if (excludeChildId && String(child._id) === excludeChildId) continue;
    for (const employeeId of childEntryEmployeeIds(child)) {
      ids.add(employeeId);
    }
  }
  return ids;
}

function assertEmployeesUniqueOnProject(
  childBlocks: Array<{
    _id?: unknown;
    archived?: boolean;
    projectId?: string;
    employeeIds?: string[];
    employees?: NoteActor[];
    employeeId?: string;
  }>,
  projectId: string,
  employeeIds: string[],
  excludeChildId?: string,
) {
  const existing = employeeIdsOnProjectForDay(childBlocks, projectId, excludeChildId);
  const duplicates = employeeIds.filter((id) => existing.has(id));
  if (duplicates.length > 0) {
    throw Object.assign(
      new Error('Each employee can only have one note per project per day.'),
      { status: 400 },
    );
  }
}

export function serializeDailyBlock(doc: Record<string, unknown>) {
  const childBlocks = Array.isArray(doc.childBlocks) ? doc.childBlocks : [];
  return {
    _id: String(doc._id),
    date: doc.date,
    name: doc.name,
    status: doc.status,
    archived: Boolean(doc.archived),
    childBlockCount: activeChildCount(childBlocks),
    childBlocks: childBlocks
      .map((child) => serializeChildBlock(child as Record<string, unknown>))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    lastEmailDelivery: doc.lastEmailDelivery
      ? {
          sentBy: (doc.lastEmailDelivery as { sentBy: NoteActor }).sentBy,
          sentAt: (() => {
            const sentAt = (doc.lastEmailDelivery as { sentAt: Date | string }).sentAt;
            return sentAt instanceof Date ? sentAt.toISOString() : String(sentAt);
          })(),
          recipientCount: Number((doc.lastEmailDelivery as { recipientCount: number }).recipientCount),
          deliveryStatus: (doc.lastEmailDelivery as { deliveryStatus: string }).deliveryStatus,
          errorMessage: (doc.lastEmailDelivery as { errorMessage?: string }).errorMessage,
        }
      : null,
    createdBy: doc.createdBy,
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listDailyBlocksInRange(from: string, to: string) {
  const fromDate = assertDateKey(from);
  const toDate = assertDateKey(to);
  const docs = await DailyNoteBlockModel.find({
    date: { $gte: fromDate, $lte: toDate },
  })
    .sort({ date: 1 })
    .lean();
  return docs.map((doc) => serializeDailyBlock(doc as Record<string, unknown>));
}

export async function getDailyBlockByDate(date: string) {
  const dateKey = assertDateKey(date);
  const doc = await DailyNoteBlockModel.findOne({ date: dateKey }).lean();
  if (!doc) return null;
  return serializeDailyBlock(doc as Record<string, unknown>);
}

/** Most recent daily block (strictly before `beforeDate`) that has at least one active note. */
export async function getLatestDailyBlockWithNotesBefore(beforeDate: string) {
  const beforeKey = assertDateKey(beforeDate);
  const doc = await DailyNoteBlockModel.findOne({
    date: { $lt: beforeKey },
    archived: { $ne: true },
    childBlocks: {
      $elemMatch: { archived: { $ne: true } },
    },
  })
    .sort({ date: -1 })
    .lean();
  if (!doc) return null;
  return serializeDailyBlock(doc as Record<string, unknown>);
}

export async function getDailyBlockById(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await DailyNoteBlockModel.findById(id).lean();
  if (!doc) return null;
  return serializeDailyBlock(doc as Record<string, unknown>);
}

export async function createDailyBlock(
  date: string,
  userId: string,
  email?: string,
  status: DailyNoteStatus = 'draft',
) {
  const dateKey = assertDateKey(date);
  const existing = await DailyNoteBlockModel.findOne({ date: dateKey }).lean();
  if (existing) {
    throw Object.assign(new Error('A daily block already exists for this date.'), { status: 409 });
  }

  const actor = await resolveActor(userId, email);
  const doc = await DailyNoteBlockModel.create({
    date: dateKey,
    name: formatDailyBlockName(dateKey),
    status,
    archived: false,
    childBlocks: [],
    createdBy: actor,
    updatedBy: actor,
  });

  return serializeDailyBlock(doc.toObject() as unknown as Record<string, unknown>);
}

export async function updateDailyBlock(
  id: string,
  userId: string,
  email: string | undefined,
  patch: { status?: DailyNoteStatus; archived?: boolean },
) {
  if (!Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error('Daily block not found'), { status: 404 });
  }

  const actor = await resolveActor(userId, email);
  const update: Record<string, unknown> = { updatedBy: actor };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.archived !== undefined) update.archived = patch.archived;

  const doc = await DailyNoteBlockModel.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!doc) throw Object.assign(new Error('Daily block not found'), { status: 404 });
  return serializeDailyBlock(doc as Record<string, unknown>);
}

export async function deleteDailyBlock(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error('Daily block not found'), { status: 404 });
  }
  const doc = await DailyNoteBlockModel.findByIdAndDelete(id).lean();
  if (!doc) throw Object.assign(new Error('Daily block not found'), { status: 404 });
  return serializeDailyBlock(doc as Record<string, unknown>);
}

type ChildBlockInput = {
  title: string;
  projectId?: string;
  projectName?: string;
  employeeIds?: string[];
  employees?: NoteActor[];
  description?: string;
  includeInEmail?: boolean;
};

export async function createChildBlock(
  dailyBlockId: string,
  userId: string,
  email: string | undefined,
  input: ChildBlockInput,
) {
  if (!Types.ObjectId.isValid(dailyBlockId)) {
    throw Object.assign(new Error('Daily block not found'), { status: 404 });
  }
  const title = input.title?.trim();
  if (!title) throw Object.assign(new Error('Title is required'), { status: 400 });

  const doc = await DailyNoteBlockModel.findById(dailyBlockId);
  if (!doc) throw Object.assign(new Error('Daily block not found'), { status: 404 });

  const actor = await resolveActor(userId, email);
  const nextOrder = doc.childBlocks.reduce((max, child) => Math.max(max, child.sortOrder ?? 0), -1) + 1;
  const relations = await resolveChildProjectAndEmployees(input);
  assertEmployeesUniqueOnProject(doc.childBlocks, relations.projectId, relations.employeeIds);

  doc.childBlocks.push({
    title,
    projectId: relations.projectId,
    projectName: relations.projectName,
    employeeIds: relations.employeeIds,
    employees: relations.employees,
    description: input.description ?? '',
    includeInEmail: Boolean(input.includeInEmail),
    sortOrder: nextOrder,
    archived: false,
    createdBy: actor,
    updatedBy: actor,
  });
  doc.updatedBy = actor;
  await doc.save();

  return serializeDailyBlock(doc.toObject() as unknown as Record<string, unknown>);
}

export async function updateChildBlock(
  dailyBlockId: string,
  childBlockId: string,
  userId: string,
  email: string | undefined,
  patch: Partial<ChildBlockInput> & { archived?: boolean },
) {
  if (!Types.ObjectId.isValid(dailyBlockId) || !Types.ObjectId.isValid(childBlockId)) {
    throw Object.assign(new Error('Work description not found'), { status: 404 });
  }

  const doc = await DailyNoteBlockModel.findById(dailyBlockId);
  if (!doc) throw Object.assign(new Error('Daily block not found'), { status: 404 });

  const child = doc.childBlocks.find((item) => String(item._id) === childBlockId);
  if (!child) throw Object.assign(new Error('Work description not found'), { status: 404 });

  const actor = await resolveActor(userId, email);
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw Object.assign(new Error('Title is required'), { status: 400 });
    child.title = title;
  }
  if (
    patch.projectId !== undefined ||
    patch.employeeIds !== undefined ||
    patch.projectName !== undefined ||
    patch.employees !== undefined
  ) {
    const relations = await resolveChildProjectAndEmployees({
      projectId: patch.projectId !== undefined ? patch.projectId : child.projectId,
      employeeIds: patch.employeeIds !== undefined ? patch.employeeIds : child.employeeIds,
    });
    assertEmployeesUniqueOnProject(
      doc.childBlocks,
      relations.projectId,
      relations.employeeIds,
      childBlockId,
    );
    child.projectId = relations.projectId;
    child.projectName = relations.projectName;
    child.employeeIds = relations.employeeIds;
    child.employees = relations.employees;
  }
  if (patch.description !== undefined) child.description = patch.description;
  if (patch.includeInEmail !== undefined) child.includeInEmail = Boolean(patch.includeInEmail);
  if (patch.archived !== undefined) child.archived = Boolean(patch.archived);
  child.updatedBy = actor;
  doc.updatedBy = actor;
  await doc.save();

  return serializeDailyBlock(doc.toObject() as unknown as Record<string, unknown>);
}

export async function deleteChildBlock(dailyBlockId: string, childBlockId: string, userId: string, email?: string) {
  if (!Types.ObjectId.isValid(dailyBlockId) || !Types.ObjectId.isValid(childBlockId)) {
    throw Object.assign(new Error('Work description not found'), { status: 404 });
  }

  const doc = await DailyNoteBlockModel.findById(dailyBlockId);
  if (!doc) throw Object.assign(new Error('Daily block not found'), { status: 404 });

  const childIndex = doc.childBlocks.findIndex((item) => String(item._id) === childBlockId);
  if (childIndex < 0) throw Object.assign(new Error('Work description not found'), { status: 404 });

  doc.childBlocks.splice(childIndex, 1);
  doc.updatedBy = await resolveActor(userId, email);
  await doc.save();

  return serializeDailyBlock(doc.toObject() as unknown as Record<string, unknown>);
}

export async function reorderChildBlocks(
  dailyBlockId: string,
  childBlockIds: string[],
  userId: string,
  email?: string,
) {
  if (!Types.ObjectId.isValid(dailyBlockId)) {
    throw Object.assign(new Error('Daily block not found'), { status: 404 });
  }
  if (!Array.isArray(childBlockIds) || childBlockIds.length === 0) {
    throw Object.assign(new Error('childBlockIds must be a non-empty array'), { status: 400 });
  }

  const doc = await DailyNoteBlockModel.findById(dailyBlockId);
  if (!doc) throw Object.assign(new Error('Daily block not found'), { status: 404 });

  const childMap = new Map(doc.childBlocks.map((child) => [String(child._id), child]));
  if (childBlockIds.some((id) => !childMap.has(id))) {
    throw Object.assign(new Error('One or more work descriptions were not found'), { status: 400 });
  }

  childBlockIds.forEach((id, index) => {
    const child = childMap.get(id);
    if (child) child.sortOrder = index;
  });
  doc.updatedBy = await resolveActor(userId, email);
  await doc.save();

  return serializeDailyBlock(doc.toObject() as unknown as Record<string, unknown>);
}

export type NoteSearchResult = {
  dailyBlockId: string;
  date: string;
  dailyBlockName: string;
  dailyBlockStatus: DailyNoteStatus;
  dailyBlockArchived: boolean;
  childBlockId: string;
  childTitle: string;
  projectId: string;
  projectName: string;
  employeeNames: string[];
  descriptionSnippet: string;
  matchedFields: NoteSearchMatchField[];
  childArchived: boolean;
};

function normalizeEmployeeNames(child: Record<string, unknown>): string[] {
  const { employees } = normalizeChildEmployees(child);
  return employees.map((employee) => employee.name).filter(Boolean);
}

export async function searchNotes(rawQuery: NotesSearchQuery) {
  const query = normalizeSearchQuery(rawQuery);
  const skip = (query.page - 1) * query.limit;

  const dailyMatch: Record<string, unknown> = {};
  if (query.from && query.to) dailyMatch.date = { $gte: query.from, $lte: query.to };
  else if (query.from) dailyMatch.date = { $gte: query.from };
  else if (query.to) dailyMatch.date = { $lte: query.to };
  if (query.status) dailyMatch.status = query.status;

  const childMatch: Record<string, unknown> = {};
  if (query.projectId) childMatch['childBlocks.projectId'] = query.projectId;
  if (query.employeeId) {
    childMatch.$or = [
      { 'childBlocks.employeeIds': query.employeeId },
      { 'childBlocks.employeeId': query.employeeId },
    ];
  }

  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    const textMatch = {
      $or: [
        { date: regex },
        { name: regex },
        { 'childBlocks.title': regex },
        { 'childBlocks.projectName': regex },
        { 'childBlocks.description': regex },
        { 'childBlocks.employees.name': regex },
        { 'childBlocks.employeeName': regex },
      ],
    };
    if (childMatch.$or) {
      childMatch.$and = [{ $or: childMatch.$or }, textMatch];
      delete childMatch.$or;
    } else {
      Object.assign(childMatch, textMatch);
    }
  }

  const pipeline: Record<string, unknown>[] = [];
  if (Object.keys(dailyMatch).length > 0) pipeline.push({ $match: dailyMatch });
  pipeline.push({ $unwind: '$childBlocks' });
  if (Object.keys(childMatch).length > 0) pipeline.push({ $match: childMatch });
  pipeline.push(
    { $sort: { date: -1, 'childBlocks.sortOrder': 1 } },
    {
      $facet: {
        total: [{ $count: 'count' }],
        results: [
          { $skip: skip },
          { $limit: query.limit },
          {
            $project: {
              dailyBlockId: { $toString: '$_id' },
              date: 1,
              dailyBlockName: '$name',
              dailyBlockStatus: '$status',
              dailyBlockArchived: '$archived',
              childBlockId: { $toString: '$childBlocks._id' },
              childTitle: '$childBlocks.title',
              projectId: '$childBlocks.projectId',
              projectName: '$childBlocks.projectName',
              employees: '$childBlocks.employees',
              employeeIds: '$childBlocks.employeeIds',
              employeeId: '$childBlocks.employeeId',
              employeeName: '$childBlocks.employeeName',
              description: '$childBlocks.description',
              childArchived: '$childBlocks.archived',
            },
          },
        ],
      },
    },
  );

  const [aggregateResult] = await DailyNoteBlockModel.aggregate(pipeline as unknown as PipelineStage[]);
  const total = Number(aggregateResult?.total?.[0]?.count ?? 0);
  const rows = Array.isArray(aggregateResult?.results) ? aggregateResult.results : [];

  const results: NoteSearchResult[] = rows.map((row: Record<string, unknown>) => {
    const employeeNames = normalizeEmployeeNames({
      employees: row.employees,
      employeeIds: row.employeeIds,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
    });
    const description = String(row.description ?? '');
    const plainDescription = stripHtml(description);
    const snippetSource = plainDescription || description;

    return {
      dailyBlockId: String(row.dailyBlockId),
      date: String(row.date),
      dailyBlockName: String(row.dailyBlockName),
      dailyBlockStatus: row.dailyBlockStatus as DailyNoteStatus,
      dailyBlockArchived: Boolean(row.dailyBlockArchived),
      childBlockId: String(row.childBlockId),
      childTitle: String(row.childTitle),
      projectId: String(row.projectId ?? ''),
      projectName: String(row.projectName ?? ''),
      employeeNames,
      descriptionSnippet: buildSnippet(snippetSource, query.q),
      matchedFields: detectMatchedFields({
        q: query.q,
        date: String(row.date),
        dailyBlockName: String(row.dailyBlockName),
        childTitle: String(row.childTitle),
        projectName: String(row.projectName ?? ''),
        employeeNames,
        description,
      }),
      childArchived: Boolean(row.childArchived),
    };
  });

  return {
    results,
    total,
    page: query.page,
    limit: query.limit,
    hasMore: skip + results.length < total,
  };
}

export async function listSearchFilterOptions() {
  const [projectRows, employeeRows] = await Promise.all([
    DailyNoteBlockModel.aggregate([
      { $unwind: '$childBlocks' },
      { $match: { 'childBlocks.projectId': { $nin: ['', null] } } },
      {
        $group: {
          _id: '$childBlocks.projectId',
          name: { $first: '$childBlocks.projectName' },
        },
      },
      { $sort: { name: 1 } },
      { $project: { _id: 0, id: '$_id', name: 1 } },
    ]),
    DailyNoteBlockModel.aggregate([
      { $unwind: '$childBlocks' },
      {
        $project: {
          employees: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$childBlocks.employees', []] } }, 0] },
              '$childBlocks.employees',
              [{ id: '$childBlocks.employeeId', name: '$childBlocks.employeeName' }],
            ],
          },
        },
      },
      { $unwind: '$employees' },
      { $match: { 'employees.id': { $nin: ['', null] } } },
      {
        $group: {
          _id: '$employees.id',
          name: { $first: '$employees.name' },
        },
      },
      { $sort: { name: 1 } },
      { $project: { _id: 0, id: '$_id', name: 1 } },
    ]),
  ]);

  return {
    projects: projectRows,
    employees: employeeRows,
  };
}
