import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { getDB } from '../config/db';
import { ProjectModel } from '../models/Project';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
import { ArchivedProjectModel } from '../models/ArchivedProject';
import { syncAssignedTasksForProject } from '../utils/assignedTaskSync';
import { updateProjectCompletionStatus } from '../utils/syncProject';
import { normalizeProjectDescription, validateProjectDescription } from '../utils/textLimits';

export interface ProjectImportRow {
  rowNumber: number;
  employeeId?: string;
  employeeName?: string;
  projectName: string;
  client: string;
  technologyNode: string;
  teamLead?: string;
  accessType: 'public' | 'private';
  description?: string;
  resolvedMemberName?: string;
}

export type ProjectImportFormat = 'assignments' | 'timesheet_matrix';

export interface ProjectImportResult {
  archivedCount: number;
  createdCount: number;
  assignmentRows: number;
  skippedRows: number;
  timesheetEntries: number;
  importFormat: ProjectImportFormat;
  warnings: string[];
  projects: Array<{
    id: string;
    name: string;
    client: string;
    technologyNode: string;
    memberCount: number;
    teamLead?: string;
  }>;
}

interface TaskCellEntry {
  project: string;
  task?: string;
  start?: string;
  end?: string;
  timestamp?: string;
}

interface MatrixTimesheetRecord {
  rowNumber: number;
  empId: string;
  date: string;
  entry: TaskCellEntry;
}

interface ExistingProjectMeta {
  clientName: string;
  technologyNode: string;
  teamLead?: string;
  description: string;
  accessType: 'public' | 'private';
}

const EMP_ID_HEADERS = new Set(['emp_id', 'emp id', 'employee id', 'employee_id', 'eid', 'empid']);
const DEFAULT_IMPORTED_CLIENT = 'Imported';
const DEFAULT_IMPORTED_TECH_NODE = '28nm';

const HEADER_ALIASES: Record<string, keyof Omit<ProjectImportRow, 'rowNumber' | 'resolvedMemberName'>> = {
  'employee id': 'employeeId',
  empid: 'employeeId',
  'emp id': 'employeeId',
  epl: 'employeeId',
  'employee name': 'employeeName',
  name: 'employeeName',
  'project name': 'projectName',
  project: 'projectName',
  client: 'client',
  'client name': 'client',
  'technology node': 'technologyNode',
  'tech node': 'technologyNode',
  node: 'technologyNode',
  'team lead': 'teamLead',
  lead: 'teamLead',
  'access type': 'accessType',
  access: 'accessType',
  description: 'description',
  scope: 'description',
};

function normalizeHeader(value: ExcelJS.CellValue): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value && value.text) {
    return String(value.text).trim();
  }
  if (typeof value === 'object' && 'result' in value && value.result != null) {
    return String(value.result).trim();
  }
  return String(value).trim();
}

function projectGroupKey(row: Pick<ProjectImportRow, 'projectName' | 'client' | 'technologyNode'>): string {
  return [row.projectName, row.client, row.technologyNode]
    .map((v) => v.trim().toLowerCase())
    .join('||');
}

function parseAccessType(raw: string | undefined): 'public' | 'private' {
  const value = (raw || 'private').trim().toLowerCase();
  return value === 'public' ? 'public' : 'private';
}

type EmployeeNameFields = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
};

function buildDisplayName(employee: EmployeeNameFields): string {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim();
}

async function resolveEmployeeDisplayName(
  employeeId?: string,
  employeeName?: string,
): Promise<string | null> {
  const col = getDB().collection('employees');
  const idTrimmed = employeeId?.trim();
  const nameTrimmed = employeeName?.trim();

  if (idTrimmed) {
    const byHrId = await col.findOne(
      {
        $or: [
          { employeeId: idTrimmed.toUpperCase() },
          { employeeId: idTrimmed },
          { id: idTrimmed },
        ],
      },
      { projection: { firstName: 1, middleName: 1, lastName: 1, employeeId: 1 } },
    );
    if (byHrId) return buildDisplayName(byHrId as EmployeeNameFields) || nameTrimmed || idTrimmed;
  }

  if (nameTrimmed) {
    const parts = nameTrimmed.split(/\s+/).filter(Boolean);
    const query =
      parts.length >= 2
        ? {
            $or: [
              {
                $expr: {
                  $eq: [
                    {
                      $trim: {
                        input: {
                          $concat: [
                            { $ifNull: ['$firstName', ''] },
                            ' ',
                            { $ifNull: ['$lastName', ''] },
                          ],
                        },
                      },
                    },
                    nameTrimmed,
                  ],
                },
              },
              { firstName: parts[0], lastName: parts.slice(1).join(' ') },
            ],
          }
        : { firstName: nameTrimmed };

    const byName = await col.findOne(query, {
      projection: { firstName: 1, middleName: 1, lastName: 1 },
    });
    if (byName) return buildDisplayName(byName as EmployeeNameFields) || nameTrimmed;
    return nameTrimmed;
  }

  return null;
}

function isEmpIdHeader(value: ExcelJS.CellValue): boolean {
  return EMP_ID_HEADERS.has(normalizeHeader(value));
}

function excelSerialToDate(serial: number): Date | null {
  if (serial < 1 || serial > 100000) return null;
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
}

function headerToDateString(value: ExcelJS.CellValue): string | null {
  const text = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'number') {
    const d = excelSerialToDate(value);
    return d ? d.toISOString().split('T')[0] : null;
  }
  if (text && !Number.isNaN(Date.parse(text))) {
    return new Date(text).toISOString().split('T')[0];
  }
  return null;
}

function isDateColumnHeader(value: ExcelJS.CellValue): boolean {
  return headerToDateString(value) !== null;
}

function normalizeTaskEntry(raw: Record<string, unknown>): TaskCellEntry | null {
  const project = String(raw.project ?? '').trim();
  if (!project) return null;
  return {
    project,
    task: String(raw.task ?? '').trim() || undefined,
    start: String(raw.start ?? '').trim() || undefined,
    end: String(raw.end ?? '').trim() || undefined,
    timestamp: String(raw.timestamp ?? '').trim() || undefined,
  };
}

function parseTaskCellJson(raw: string): TaskCellEntry[] {
  const text = raw.trim();
  if (!text) return [];

  const collected: TaskCellEntry[] = [];
  const pushParsed = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          const entry = normalizeTaskEntry(item as Record<string, unknown>);
          if (entry) collected.push(entry);
        }
      }
      return;
    }
    if (value && typeof value === 'object') {
      const entry = normalizeTaskEntry(value as Record<string, unknown>);
      if (entry) collected.push(entry);
    }
  };

  try {
    pushParsed(JSON.parse(text));
    if (collected.length) return collected;
  } catch {
    /* try chunked parse below */
  }

  const arrayChunks = text.match(/\[[\s\S]*?\]/g) ?? [];
  for (const chunk of arrayChunks) {
    try {
      pushParsed(JSON.parse(chunk));
    } catch {
      /* skip invalid chunk */
    }
  }
  if (collected.length) return collected;

  const objectChunks = text.match(/\{[\s\S]*?\}/g) ?? [];
  for (const chunk of objectChunks) {
    try {
      pushParsed(JSON.parse(chunk));
    } catch {
      /* skip invalid chunk */
    }
  }

  return collected;
}

function normalizeTimeFragment(time: string): string {
  const trimmed = time.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const normalized = normalizeTimeFragment(timeStr);
  const iso = `${dateStr}T${normalized}`;
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date(`${dateStr}T09:00:00`);
}

function buildSessionTimes(
  dateStr: string,
  entry: TaskCellEntry,
): { loginTime: Date; logoutTime?: Date } {
  // Matrix JSON: `start` = task check-in, `end` = task checkout for that project.
  // `timestamp` is optional metadata — only used as login fallback when `start` is absent.
  const loginTime = entry.start
    ? combineDateAndTime(dateStr, entry.start)
    : entry.timestamp
      ? (() => {
          const ts = new Date(entry.timestamp);
          return !Number.isNaN(ts.getTime()) ? ts : new Date(`${dateStr}T09:00:00`);
        })()
      : new Date(`${dateStr}T09:00:00`);

  const logoutTime = entry.end ? combineDateAndTime(dateStr, entry.end) : undefined;

  return { loginTime, logoutTime };
}

function computeTotalHours(loginTime: Date, logoutTime?: Date): number {
  if (!logoutTime) return 0;
  const diffMs = logoutTime.getTime() - loginTime.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook;
}

async function resolveEmployeeByHrId(empId: string): Promise<{
  displayName: string;
  employeeId: string;
} | null> {
  const idTrimmed = empId.trim();
  if (!idTrimmed) return null;

  const col = getDB().collection('employees');
  const employee = await col.findOne(
    {
      $or: [
        { employeeId: idTrimmed.toUpperCase() },
        { employeeId: idTrimmed },
        { id: idTrimmed },
      ],
    },
    { projection: { firstName: 1, middleName: 1, lastName: 1, employeeId: 1, id: 1 } },
  );

  if (!employee) return null;

  const displayName = buildDisplayName(employee as EmployeeNameFields) || idTrimmed;
  const employeeId = String(employee.employeeId || employee.id || idTrimmed);
  return { displayName, employeeId };
}

async function snapshotProjectMetadataByName(): Promise<Map<string, ExistingProjectMeta>> {
  const projects = await ProjectModel.find(
    {},
    {
      projectName: 1,
      clientName: 1,
      technologyNode: 1,
      teamLead: 1,
      description: 1,
      accessType: 1,
    },
  ).lean();

  const map = new Map<string, ExistingProjectMeta>();
  for (const project of projects) {
    const key = project.projectName.trim().toLowerCase();
    if (!key || map.has(key)) continue;
    map.set(key, {
      clientName: project.clientName,
      technologyNode: project.technologyNode,
      teamLead: project.teamLead,
      description: project.description,
      accessType: project.accessType as 'public' | 'private',
    });
  }
  return map;
}

export async function detectImportFormat(buffer: Buffer): Promise<ProjectImportFormat> {
  const workbook = await loadWorkbook(buffer);
  const sheet =
    workbook.worksheets.find((ws) => ws.name.toLowerCase() === 'assignments') ??
    workbook.worksheets.find((ws) => ws.name.toLowerCase() !== 'readme') ??
    workbook.worksheets[0];

  if (!sheet) {
    throw new Error('Excel file has no worksheets.');
  }

  const firstHeader = sheet.getRow(1).getCell(1).value;
  if (!isEmpIdHeader(firstHeader)) {
    return 'assignments';
  }

  let dateColumns = 0;
  sheet.getRow(1).eachCell((cell, colNumber) => {
    if (colNumber > 1 && isDateColumnHeader(cell.value)) {
      dateColumns += 1;
    }
  });

  return dateColumns > 0 ? 'timesheet_matrix' : 'assignments';
}

export async function parseTimesheetMatrixExcel(buffer: Buffer): Promise<MatrixTimesheetRecord[]> {
  const workbook = await loadWorkbook(buffer);
  const sheet =
    workbook.worksheets.find((ws) => ws.name.toLowerCase() !== 'readme') ?? workbook.worksheets[0];

  if (!sheet) {
    throw new Error('Excel file has no worksheets.');
  }

  const headerRow = sheet.getRow(1);
  const firstHeader = headerRow.getCell(1).value;
  if (!isEmpIdHeader(firstHeader)) {
    throw new Error('Expected first column header EMP_ID for timesheet matrix import.');
  }

  const dateColumns = new Map<number, string>();
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber === 1) return;
    const dateStr = headerToDateString(cell.value);
    if (dateStr) dateColumns.set(colNumber, dateStr);
  });

  if (dateColumns.size === 0) {
    throw new Error('No date columns found in row 1 (expected YYYY-MM-DD headers).');
  }

  const records: MatrixTimesheetRecord[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const empId = cellText(row.getCell(1).value);
    if (!empId) continue;

    dateColumns.forEach((dateStr, colNumber) => {
      const cellRaw = cellText(row.getCell(colNumber).value);
      if (!cellRaw) return;

      const entries = parseTaskCellJson(cellRaw);
      for (const entry of entries) {
        records.push({ rowNumber: r, empId, date: dateStr, entry });
      }
    });
  }

  if (records.length === 0) {
    throw new Error('No project/task entries found in the timesheet matrix.');
  }

  return records;
}

export async function parseProjectImportExcel(buffer: Buffer): Promise<ProjectImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet =
    workbook.getWorksheet('assignments') ??
    workbook.worksheets.find((ws) => ws.name.toLowerCase() !== 'readme') ??
    workbook.worksheets[0];

  if (!sheet) {
    throw new Error('Excel file has no worksheets.');
  }

  const headerRow = sheet.getRow(1);
  const columnMap = new Map<number, keyof Omit<ProjectImportRow, 'rowNumber' | 'resolvedMemberName'>>();

  headerRow.eachCell((cell, colNumber) => {
    const alias = HEADER_ALIASES[normalizeHeader(cell.value)];
    if (alias) columnMap.set(colNumber, alias);
  });

  const required = ['projectName', 'client', 'technologyNode'] as const;
  const mappedFields = new Set(columnMap.values());
  for (const field of required) {
    if (!mappedFields.has(field)) {
      throw new Error(
        `Missing required column "${field}". Expected headers like Project Name, Client, Technology Node.`,
      );
    }
  }

  if (!mappedFields.has('employeeId') && !mappedFields.has('employeeName')) {
    throw new Error('Sheet must include Employee ID and/or Employee Name column.');
  }

  const rows: ProjectImportRow[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const draft: Partial<ProjectImportRow> = { rowNumber: r };

    columnMap.forEach((field, colNumber) => {
      draft[field] = cellText(row.getCell(colNumber).value) as never;
    });

    const projectName = String(draft.projectName || '').trim();
    const client = String(draft.client || '').trim();
    const technologyNode = String(draft.technologyNode || '').trim();
    const employeeId = String(draft.employeeId || '').trim() || undefined;
    const employeeName = String(draft.employeeName || '').trim() || undefined;

    if (!projectName && !client && !technologyNode && !employeeId && !employeeName) {
      continue;
    }

    if (!projectName || !client || !technologyNode) {
      throw new Error(`Row ${r}: Project Name, Client, and Technology Node are required.`);
    }

    if (!/\d+nm/i.test(technologyNode)) {
      throw new Error(`Row ${r}: Technology Node must include a process size with nm (e.g. 7nm, 28nm).`);
    }

    rows.push({
      rowNumber: r,
      employeeId,
      employeeName,
      projectName,
      client,
      technologyNode,
      teamLead: String(draft.teamLead || '').trim() || undefined,
      accessType: parseAccessType(draft.accessType),
      description: String(draft.description || '').trim() || undefined,
    });
  }

  if (rows.length === 0) {
    throw new Error('No assignment rows found below the header row.');
  }

  return rows;
}

async function archiveProjectById(projectId: mongoose.Types.ObjectId): Promise<void> {
  const project = await ProjectModel.findById(projectId);
  if (!project) return;

  const timesheets = await TimesheetModel.find({
    $or: [{ projectId: project._id }, { project: project.projectName }],
  });
  const assignedTasks = await AssignedTaskModel.find({ projectId: project._id });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const archivedProject = new ArchivedProjectModel({
        originalProjectId: project._id,
        projectName: project.projectName,
        clientName: project.clientName,
        technologyNode: project.technologyNode,
        accessType: project.accessType,
        allowedUsers: project.allowedUsers || [],
        teamLead: project.teamLead,
        description: project.description,
        status: project.status,
        completedTasks: project.completedTasks,
        totalTasks: project.totalTasks,
        completionPercentage: project.completionPercentage,
        createdBy: project.createdBy,
        originalCreatedAt: project.createdAt,
        originalUpdatedAt: project.updatedAt,
        archivedAt: new Date(),
        assignedTasks,
        timesheets,
      });
      await archivedProject.save({ session });

      await TimesheetModel.deleteMany(
        { $or: [{ projectId: project._id }, { project: project.projectName }] },
        { session },
      );
      await AssignedTaskModel.deleteMany({ projectId: project._id }, { session });
      await ProjectModel.findByIdAndDelete(project._id, { session });
    });
  } finally {
    session.endSession();
  }
}

export async function archiveAllActiveProjects(): Promise<number> {
  const projects = await ProjectModel.find({}, { _id: 1 });
  for (const project of projects) {
    await archiveProjectById(project._id);
  }
  return projects.length;
}

async function importFromAssignmentSheet(
  buffer: Buffer,
  createdBy: string,
): Promise<ProjectImportResult> {
  const parsedRows = await parseProjectImportExcel(buffer);
  const warnings: string[] = [];
  let skippedRows = 0;

  const resolvedRows: ProjectImportRow[] = [];
  for (const row of parsedRows) {
    const resolvedMemberName = await resolveEmployeeDisplayName(row.employeeId, row.employeeName);
    if (!resolvedMemberName) {
      skippedRows += 1;
      warnings.push(`Row ${row.rowNumber}: could not resolve employee — skipped.`);
      continue;
    }
    resolvedRows.push({ ...row, resolvedMemberName });
  }

  const grouped = new Map<string, ProjectImportRow[]>();
  for (const row of resolvedRows) {
    const key = projectGroupKey(row);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const archivedCount = await archiveAllActiveProjects();
  const createdProjects: ProjectImportResult['projects'] = [];

  for (const groupRows of grouped.values()) {
    const first = groupRows[0];
    const members = new Set<string>();
    for (const row of groupRows) {
      if (row.resolvedMemberName) members.add(row.resolvedMemberName);
    }

    const teamLead =
      groupRows.map((r) => r.teamLead).find((v) => v && v.trim())?.trim() ||
      [...members][0];
    const description =
      groupRows.map((r) => r.description).find((v) => v && v.trim())?.trim() ||
      `Imported assignments for ${first.projectName}.`;
    const accessType = groupRows.some((r) => r.accessType === 'public') ? 'public' : 'private';

    const descriptionError = validateProjectDescription(description);
    if (descriptionError) {
      throw new Error(`Project "${first.projectName}": ${descriptionError}`);
    }

    const allowedUsers = [...members];

    const project = new ProjectModel({
      projectName: first.projectName.trim(),
      clientName: first.client.trim(),
      technologyNode: first.technologyNode.trim(),
      accessType,
      status: 'Active',
      description: normalizeProjectDescription(description),
      allowedUsers: [...new Set(allowedUsers)],
      teamLead,
      createdBy,
      completedTasks: 0,
      totalTasks: 0,
      completionPercentage: 0,
    });

    await project.save();
    await syncAssignedTasksForProject(project);

    createdProjects.push({
      id: project._id.toString(),
      name: project.projectName,
      client: project.clientName,
      technologyNode: project.technologyNode,
      memberCount: members.size,
      teamLead: project.teamLead,
    });
  }

  return {
    archivedCount,
    createdCount: createdProjects.length,
    assignmentRows: parsedRows.length,
    skippedRows,
    timesheetEntries: 0,
    importFormat: 'assignments',
    warnings,
    projects: createdProjects,
  };
}

async function importFromTimesheetMatrix(
  buffer: Buffer,
  createdBy: string,
): Promise<ProjectImportResult> {
  const matrixRecords = await parseTimesheetMatrixExcel(buffer);
  const existingMeta = await snapshotProjectMetadataByName();
  const warnings: string[] = [];
  let skippedRows = 0;

  type ProjectBucket = {
    projectName: string;
    members: Map<string, { displayName: string; employeeId: string }>;
    teamLead?: string;
  };

  const projectBuckets = new Map<string, ProjectBucket>();
  const timesheetDrafts: Array<{
    rowNumber: number;
    empId: string;
    displayName: string;
    employeeId: string;
    date: string;
    entry: TaskCellEntry;
    projectName: string;
  }> = [];

  const employeeCache = new Map<string, { displayName: string; employeeId: string } | null>();

  for (const record of matrixRecords) {
    const cacheKey = record.empId.trim().toUpperCase();
    if (!employeeCache.has(cacheKey)) {
      employeeCache.set(cacheKey, await resolveEmployeeByHrId(record.empId));
    }
    const resolved = employeeCache.get(cacheKey);
    const displayName = resolved?.displayName ?? record.empId.trim();
    const employeeId = resolved?.employeeId ?? record.empId.trim();

    if (!resolved) {
      warnings.push(`Row ${record.rowNumber} (${record.empId}): employee not found in HR — using EMP_ID as name.`);
    }

    const projectName = record.entry.project.trim();
    const projectKey = projectName.toLowerCase();
    let bucket = projectBuckets.get(projectKey);
    if (!bucket) {
      bucket = { projectName, members: new Map(), teamLead: displayName };
      projectBuckets.set(projectKey, bucket);
    }
    bucket.members.set(displayName, { displayName, employeeId });
    if (!bucket.teamLead) bucket.teamLead = displayName;

    timesheetDrafts.push({
      rowNumber: record.rowNumber,
      empId: record.empId,
      displayName,
      employeeId,
      date: record.date,
      entry: record.entry,
      projectName,
    });
  }

  const archivedCount = await archiveAllActiveProjects();
  const createdProjects: ProjectImportResult['projects'] = [];
  const projectIdByName = new Map<string, mongoose.Types.ObjectId>();

  for (const [projectKey, bucket] of projectBuckets.entries()) {
    const projectName = bucket.projectName;
    const snapshot = existingMeta.get(projectKey);
    const allowedUsers = [...bucket.members.keys()];
    const description =
      snapshot?.description?.trim() ||
      `Imported from timesheet history for ${projectName}.`;

    const descriptionError = validateProjectDescription(description);
    if (descriptionError) {
      throw new Error(`Project "${projectName}": ${descriptionError}`);
    }

    const project = new ProjectModel({
      projectName,
      clientName: snapshot?.clientName?.trim() || DEFAULT_IMPORTED_CLIENT,
      technologyNode: snapshot?.technologyNode?.trim() || DEFAULT_IMPORTED_TECH_NODE,
      accessType: snapshot?.accessType ?? 'private',
      status: 'Active',
      description: normalizeProjectDescription(description),
      allowedUsers: [...new Set(allowedUsers)],
      teamLead: snapshot?.teamLead?.trim() || bucket.teamLead || allowedUsers[0],
      createdBy,
      completedTasks: 0,
      totalTasks: 0,
      completionPercentage: 0,
    });

    await project.save();
    await syncAssignedTasksForProject(project);
    projectIdByName.set(projectKey, project._id);

    createdProjects.push({
      id: project._id.toString(),
      name: project.projectName,
      client: project.clientName,
      technologyNode: project.technologyNode,
      memberCount: bucket.members.size,
      teamLead: project.teamLead,
    });
  }

  let timesheetEntries = 0;
  const timesheetDocs: Array<Record<string, unknown>> = [];

  for (const draft of timesheetDrafts) {
    const projectKey = draft.projectName.trim().toLowerCase();
    const projectId = projectIdByName.get(projectKey);
    if (!projectId) {
      skippedRows += 1;
      warnings.push(`Row ${draft.rowNumber}: project "${draft.projectName}" was not created — skipped.`);
      continue;
    }

    const snapshot = existingMeta.get(projectKey);
    const { loginTime, logoutTime } = buildSessionTimes(draft.date, draft.entry);
    const hasLogout = Boolean(logoutTime && logoutTime.getTime() > loginTime.getTime());

    timesheetDocs.push({
      employee: draft.displayName,
      employeeId: draft.employeeId,
      projectId,
      project: draft.projectName,
      client: snapshot?.clientName || DEFAULT_IMPORTED_CLIENT,
      technologyNode: snapshot?.technologyNode || DEFAULT_IMPORTED_TECH_NODE,
      loginTime,
      logoutTime: hasLogout ? logoutTime : undefined,
      totalHours: hasLogout ? computeTotalHours(loginTime, logoutTime) : 0,
      task: draft.entry.task || '',
      billable: true,
      status: 'Approved',
      approvalStatus: 'Approved',
      requestStatus: 'No Request',
      taskStatus: hasLogout ? 'Completed' : 'Session Incomplete',
      autoCheckedOut: false,
      totalPausedMs: 0,
    });
    timesheetEntries += 1;
  }

  if (timesheetDocs.length > 0) {
    await TimesheetModel.insertMany(timesheetDocs, { ordered: false });
  }

  for (const projectId of projectIdByName.values()) {
    await updateProjectCompletionStatus(projectId);
  }

  return {
    archivedCount,
    createdCount: createdProjects.length,
    assignmentRows: matrixRecords.length,
    skippedRows,
    timesheetEntries,
    importFormat: 'timesheet_matrix',
    warnings,
    projects: createdProjects,
  };
}

export async function importProjectsFromExcel(
  buffer: Buffer,
  createdBy: string,
): Promise<ProjectImportResult> {
  const format = await detectImportFormat(buffer);
  if (format === 'timesheet_matrix') {
    return importFromTimesheetMatrix(buffer, createdBy);
  }
  return importFromAssignmentSheet(buffer, createdBy);
}
