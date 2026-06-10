import { Types } from 'mongoose';
import { PdkModuleModel } from '../models/PdkModule';
import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import {
  MetalRoutingAnalysisModel,
  type MetalEntrySubdoc,
} from '../models/MetalRoutingAnalysis';
import { isAdminRole } from '../utils/generateToken';
import {
  buildEmployeeWorkspaceProjectsFilter,
  buildAssignmentIdentityTokens,
} from '../utils/assignedProjectsHelper';
import { getDB } from '../config/db';
import { buildPdkTemplateExcelBuffer, parsePdkExcelBuffer } from '../utils/pdkExcel';
import {
  buildMetalRoutingExcelBuffer,
  buildMetalRoutingTemplateExcelBuffer,
  parseMetalRoutingExcelWithDiagnostics,
  type RouteExcelRecord,
} from '../utils/metalRoutingExcel';

const IMPORT_LOG_PREFIX = '[metal-routing-import]';

export interface RoutingKey {
  projectId: string;
  fromCell: string;
  toCell: string;
  fromSignal: string;
  toSignal: string;
}

export interface MetalInput {
  projectId: string;
  metalType: string;
  width: number;
  length: number;
}

export interface ComputedMetalEntry {
  metalType: string;
  width: number;
  length: number;
  pdkModuleId: Types.ObjectId;
  pdkModuleName: string;
  givenCurrentDensity: number;
  sheetResistance: number;
  implementedCurrentMetalCapacity: number;
  routingMetalImpedance: number;
}

export interface AnalysisSummary {
  minimumMetalCurrentCapacity: number;
  totalImpedance: number;
  minCapacityMetalIndex: number;
  highestImpedanceMetalIndex: number;
}

function normalizeKey(key: RoutingKey): RoutingKey & { projectObjectId: Types.ObjectId } {
  const projectId = key.projectId.trim();
  if (!Types.ObjectId.isValid(projectId)) {
    throw new Error('Invalid project id');
  }
  return {
    projectId,
    projectObjectId: new Types.ObjectId(projectId),
    fromCell: key.fromCell.trim(),
    toCell: key.toCell.trim(),
    fromSignal: key.fromSignal.trim(),
    toSignal: key.toSignal.trim(),
  };
}

async function getProjectPdkModule(projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new Error('Invalid project id');
  }
  const project = await ProjectModel.findById(projectId).lean();
  if (!project) throw new Error('Project not found');
  if (!project.pdkModuleId) {
    throw new Error('No PDK module assigned to this project. Assign one from the Dashboard.');
  }
  const mod = await PdkModuleModel.findById(project.pdkModuleId).lean();
  if (!mod) throw new Error('Assigned PDK module not found');
  return { project, module: mod };
}

async function resolvePdkMetalSpec(projectId: string, metalType: string) {
  const { module } = await getProjectPdkModule(projectId);
  const type = metalType.trim();
  const spec = module.metals?.find((m) => m.metalType.toLowerCase() === type.toLowerCase());
  if (!spec) {
    const available = (module.metals ?? []).map((m) => m.metalType).join(', ') || 'none';
    throw new Error(
      `Metal "${type}" not found in assigned PDK module "${module.name}". Available metal types: ${available}.`,
    );
  }
  return { module, spec };
}

async function listAccessibleProjects(userId: string, userRole: string) {
  if (isAdminRole(userRole)) {
    return ProjectModel.find().sort({ projectName: 1 }).lean();
  }

  const db = getDB();
  const employeeOr: Record<string, unknown>[] = [{ userId }];
  if (Types.ObjectId.isValid(userId)) {
    employeeOr.push({ _id: new Types.ObjectId(userId) });
  }
  const employee = await db.collection('employees').findOne({ $or: employeeOr });
  const tokens = buildAssignmentIdentityTokens({ id: userId }, employee as never);
  const filter = await buildEmployeeWorkspaceProjectsFilter(tokens);
  return ProjectModel.find(filter).sort({ projectName: 1 }).lean();
}

function isMetalRowComplete(metal: MetalEntrySubdoc): boolean {
  const width = Number(metal.width);
  const length = Number(metal.length);
  return (
    Number.isFinite(width)
    && width > 0
    && Number.isFinite(length)
    && length > 0
    && Number.isFinite(metal.routingMetalImpedance)
    && Number.isFinite(metal.givenCurrentDensity)
    && Number.isFinite(metal.sheetResistance)
    && Number.isFinite(metal.implementedCurrentMetalCapacity)
  );
}

export function isRouteComplete(route: { metals?: MetalEntrySubdoc[] }): boolean {
  const metals = route.metals ?? [];
  if (metals.length === 0) return false;
  return metals.every(isMetalRowComplete);
}

export async function listDashboardProjects(userId: string, userRole: string) {
  const projects = await listAccessibleProjects(userId, userRole);

  const pdkIds = projects.map((p) => p.pdkModuleId).filter(Boolean) as Types.ObjectId[];
  const pdks = pdkIds.length
    ? await PdkModuleModel.find({ _id: { $in: pdkIds } }).lean()
    : [];
  const pdkMap = new Map(pdks.map((p) => [p._id.toString(), p]));

  return projects.map((p, index) => ({
    id: p._id.toString(),
    projectCode: `PRJ-${String(index + 1).padStart(3, '0')}`,
    projectName: p.projectName,
    clientName: p.clientName,
    technologyNode: p.technologyNode,
    status: p.status,
    pdkModuleId: p.pdkModuleId?.toString() ?? null,
    pdkModuleName: p.pdkModuleId ? pdkMap.get(p.pdkModuleId.toString())?.name ?? null : null,
    updatedAt: p.updatedAt?.toISOString?.() ?? null,
  }));
}

export interface MetalRoutingDashboardMetrics {
  totalRoutes: number;
  completedRoutes: number;
  pendingRoutes: number;
  totalRoutingImpedance: number;
  selectedProjectId: string | null;
  selectedProjectName: string | null;
}

export async function getDashboardMetrics(
  userId: string,
  userRole: string,
  selectedProjectId?: string | null,
): Promise<MetalRoutingDashboardMetrics> {
  const projects = await listAccessibleProjects(userId, userRole);
  const projectIds = projects.map((p) => p._id);

  const routes = projectIds.length
    ? await MetalRoutingAnalysisModel.find({ projectId: { $in: projectIds } }).lean()
    : [];

  const totalRoutes = routes.length;
  const completedRoutes = routes.filter((route) => isRouteComplete(route)).length;
  const pendingRoutes = totalRoutes - completedRoutes;

  let resolvedProjectId: string | null = null;
  let resolvedProjectName: string | null = null;

  if (selectedProjectId && Types.ObjectId.isValid(selectedProjectId)) {
    const match = projects.find((p) => p._id.toString() === selectedProjectId);
    if (match) {
      resolvedProjectId = match._id.toString();
      resolvedProjectName = match.projectName;
    }
  }

  if (!resolvedProjectId && projects.length > 0) {
    resolvedProjectId = projects[0]._id.toString();
    resolvedProjectName = projects[0].projectName;
  }

  let totalRoutingImpedance = 0;
  if (resolvedProjectId) {
    const projectOid = new Types.ObjectId(resolvedProjectId);
    totalRoutingImpedance = routes
      .filter((route) => route.projectId.toString() === projectOid.toString())
      .reduce((sum, route) => sum + Number(route.totalImpedance ?? 0), 0);
  }

  return {
    totalRoutes,
    completedRoutes,
    pendingRoutes,
    totalRoutingImpedance: Math.round(totalRoutingImpedance * 10000) / 10000,
    selectedProjectId: resolvedProjectId,
    selectedProjectName: resolvedProjectName,
  };
}

export async function assignPdkToProject(projectId: string, pdkModuleId: string | null) {
  if (!Types.ObjectId.isValid(projectId)) return null;
  if (pdkModuleId && !Types.ObjectId.isValid(pdkModuleId)) {
    throw new Error('Invalid PDK module id');
  }
  if (pdkModuleId) {
    const mod = await PdkModuleModel.findById(pdkModuleId).lean();
    if (!mod) throw new Error('PDK module not found');
  }
  return ProjectModel.findByIdAndUpdate(
    projectId,
    { pdkModuleId: pdkModuleId ? new Types.ObjectId(pdkModuleId) : null },
    { new: true },
  ).lean();
}

function serializeRouteSummaryForClient(route: Record<string, unknown>) {
  const metals = (route.metals as unknown[]) ?? [];
  return {
    _id: (route._id as Types.ObjectId)?.toString?.() ?? String(route._id ?? ''),
    projectId: (route.projectId as Types.ObjectId)?.toString?.() ?? String(route.projectId ?? ''),
    fromCell: String(route.fromCell ?? ''),
    toCell: String(route.toCell ?? ''),
    fromSignal: String(route.fromSignal ?? ''),
    toSignal: String(route.toSignal ?? ''),
    updatedAt: route.updatedAt,
    metalCount: metals.length,
  };
}

function listSavedRouteSummaries(routes: Record<string, unknown>[]) {
  return routes
    .filter((route) => ((route.metals as unknown[]) ?? []).length > 0)
    .map((route) => serializeRouteSummaryForClient(route));
}

async function fetchSavedRouteSummariesForProject(projectId: string) {
  const projectOid = new Types.ObjectId(projectId.trim());
  const routes = await MetalRoutingAnalysisModel.find({ projectId: projectOid })
    .sort({ updatedAt: -1 })
    .lean();
  return listSavedRouteSummaries(routes as Record<string, unknown>[]);
}

function serializePdkModuleForClient(
  module: Record<string, unknown> | null,
) {
  if (!module) return null;
  const metals = ((module.metals as Array<Record<string, unknown>>) ?? []).map((metal) => ({
    ...metal,
    _id: metal._id ? String(metal._id) : undefined,
  }));

  return {
    ...module,
    _id: (module._id as Types.ObjectId)?.toString?.() ?? String(module._id ?? ''),
    metals,
  };
}

export async function getProjectContext(projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new Error('Invalid project id');
  }
  const projectOid = new Types.ObjectId(projectId);

  const [project, cells, routes] = await Promise.all([
    ProjectModel.findById(projectId).lean(),
    ProjectCellModel.find({ projectId: projectOid }).select('name cellType views').sort({ name: 1 }).lean(),
    MetalRoutingAnalysisModel.find({ projectId: projectOid })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  if (!project) throw new Error('Project not found');

  const cellNames = cells.map((c) => c.name).filter(Boolean);
  let pdkModule = null;
  if (project.pdkModuleId) {
    pdkModule = await PdkModuleModel.findById(project.pdkModuleId).lean();
  }

  const savedRoutes = listSavedRouteSummaries(routes as Record<string, unknown>[]);

  console.log(
    IMPORT_LOG_PREFIX,
    'getProjectContext',
    { projectId, totalRoutesInDb: routes.length, savedRoutesVisible: savedRoutes.length },
  );

  return {
    project: {
      id: project._id.toString(),
      projectName: project.projectName,
      clientName: project.clientName,
      technologyNode: project.technologyNode,
      pdkModuleId: project.pdkModuleId?.toString() ?? null,
    },
    cellNames,
    pdkModule: serializePdkModuleForClient(pdkModule as Record<string, unknown> | null),
    routes: savedRoutes,
  };
}

export async function findRouteByKey(key: RoutingKey) {
  const k = normalizeKey(key);
  const route = await MetalRoutingAnalysisModel.findOne({
    projectId: k.projectObjectId,
    fromCell: k.fromCell,
    toCell: k.toCell,
    fromSignal: k.fromSignal,
    toSignal: k.toSignal,
  }).lean();
  if (!route) return null;
  return serializeRouteForClient(route as Record<string, unknown>);
}

export async function getOrCreateRoute(
  key: RoutingKey,
  createdBy?: string,
  createdByName?: string,
) {
  const k = normalizeKey(key);
  await getProjectPdkModule(k.projectId);

  let route = await MetalRoutingAnalysisModel.findOne({
    projectId: k.projectObjectId,
    fromCell: k.fromCell,
    toCell: k.toCell,
    fromSignal: k.fromSignal,
    toSignal: k.toSignal,
  });

  if (!route) {
    route = await MetalRoutingAnalysisModel.create({
      projectId: k.projectObjectId,
      fromCell: k.fromCell,
      toCell: k.toCell,
      fromSignal: k.fromSignal,
      toSignal: k.toSignal,
      metals: [],
      minimumMetalCurrentCapacity: 0,
      totalImpedance: 0,
      createdBy,
      createdByName,
    });
  }
  return serializeRouteForClient(route.toObject() as unknown as Record<string, unknown>);
}

export function computeMetalEntry(
  input: MetalInput,
  module: { _id: Types.ObjectId; name: string },
  spec: { currentDensityAt110: number; sheetResistance: number },
): ComputedMetalEntry {
  const width = Number(input.width);
  const length = Number(input.length);
  const givenCurrentDensity = spec.currentDensityAt110;
  const sheetResistance = spec.sheetResistance;

  return {
    metalType: String(input.metalType).trim(),
    width,
    length,
    pdkModuleId: module._id,
    pdkModuleName: module.name,
    givenCurrentDensity,
    sheetResistance,
    implementedCurrentMetalCapacity: width * givenCurrentDensity,
    routingMetalImpedance: width > 0 ? (length / width) * sheetResistance : 0,
  };
}

export async function previewMetal(input: MetalInput): Promise<ComputedMetalEntry> {
  const { module, spec } = await resolvePdkMetalSpec(input.projectId, input.metalType);
  return computeMetalEntry(input, { _id: module._id, name: module.name }, spec);
}

export function summarizeMetals(metals: ComputedMetalEntry[]): AnalysisSummary {
  if (metals.length === 0) {
    return {
      minimumMetalCurrentCapacity: 0,
      totalImpedance: 0,
      minCapacityMetalIndex: -1,
      highestImpedanceMetalIndex: -1,
    };
  }

  let minCapacity = metals[0].implementedCurrentMetalCapacity;
  let minIndex = 0;
  let maxImpedance = metals[0].routingMetalImpedance;
  let maxIndex = 0;
  let totalImpedance = 0;

  metals.forEach((metal, index) => {
    totalImpedance += metal.routingMetalImpedance;
    if (metal.implementedCurrentMetalCapacity < minCapacity) {
      minCapacity = metal.implementedCurrentMetalCapacity;
      minIndex = index;
    }
    if (metal.routingMetalImpedance > maxImpedance) {
      maxImpedance = metal.routingMetalImpedance;
      maxIndex = index;
    }
  });

  return {
    minimumMetalCurrentCapacity: minCapacity,
    totalImpedance,
    minCapacityMetalIndex: minIndex,
    highestImpedanceMetalIndex: maxIndex,
  };
}

function applySummaryToMetals(metals: MetalEntrySubdoc[], summary: AnalysisSummary) {
  return {
    minimumMetalCurrentCapacity: summary.minimumMetalCurrentCapacity,
    totalImpedance: summary.totalImpedance,
    minCapacityMetalId:
      summary.minCapacityMetalIndex >= 0 ? metals[summary.minCapacityMetalIndex]._id : null,
    highestImpedanceMetalId:
      summary.highestImpedanceMetalIndex >= 0 ? metals[summary.highestImpedanceMetalIndex]._id : null,
  };
}

function toComputed(m: MetalEntrySubdoc): ComputedMetalEntry {
  return {
    metalType: m.metalType,
    width: m.width,
    length: m.length,
    pdkModuleId: m.pdkModuleId,
    pdkModuleName: m.pdkModuleName,
    givenCurrentDensity: m.givenCurrentDensity,
    sheetResistance: m.sheetResistance,
    implementedCurrentMetalCapacity: m.implementedCurrentMetalCapacity,
    routingMetalImpedance: m.routingMetalImpedance,
  };
}

export async function addMetalToRoute(
  key: RoutingKey,
  input: Omit<MetalInput, 'projectId'>,
  createdBy?: string,
  createdByName?: string,
) {
  const k = normalizeKey(key);
  const computed = await previewMetal({ ...input, projectId: k.projectId });

  let route = await MetalRoutingAnalysisModel.findOne({
    projectId: k.projectObjectId,
    fromCell: k.fromCell,
    toCell: k.toCell,
    fromSignal: k.fromSignal,
    toSignal: k.toSignal,
  });

  if (!route) {
    route = new MetalRoutingAnalysisModel({
      projectId: k.projectObjectId,
      fromCell: k.fromCell,
      toCell: k.toCell,
      fromSignal: k.fromSignal,
      toSignal: k.toSignal,
      metals: [],
      createdBy,
      createdByName,
    });
  }

  route.metals.push({ _id: new Types.ObjectId(), ...computed });
  const summary = summarizeMetals(route.metals.map(toComputed));
  Object.assign(route, applySummaryToMetals(route.metals, summary));
  await route.save();

  return {
    route: serializeRouteForClient(route.toObject() as unknown as Record<string, unknown>),
    summary,
  };
}

export async function upsertRouteWithMetals(
  key: RoutingKey,
  metalInputs: Array<{ metalType: string; width: number; length: number }>,
  createdBy?: string,
  createdByName?: string,
) {
  const k = normalizeKey(key);
  await getProjectPdkModule(k.projectId);

  if (!metalInputs.length) {
    throw new Error('At least one metal row is required per route');
  }

  const computedMetals: MetalEntrySubdoc[] = [];
  for (const input of metalInputs) {
    const computed = await previewMetal({
      projectId: k.projectId,
      metalType: input.metalType,
      width: input.width,
      length: input.length,
    });
    computedMetals.push({ _id: new Types.ObjectId(), ...computed });
  }

  const summary = summarizeMetals(computedMetals.map(toComputed));

  let route = await MetalRoutingAnalysisModel.findOne({
    projectId: k.projectObjectId,
    fromCell: k.fromCell,
    toCell: k.toCell,
    fromSignal: k.fromSignal,
    toSignal: k.toSignal,
  });

  if (!route) {
    route = new MetalRoutingAnalysisModel({
      projectId: k.projectObjectId,
      fromCell: k.fromCell,
      toCell: k.toCell,
      fromSignal: k.fromSignal,
      toSignal: k.toSignal,
      metals: [],
      createdBy,
      createdByName,
    });
  }

  route.metals = computedMetals;
  route.markModified('metals');
  Object.assign(route, applySummaryToMetals(route.metals, summary));
  await route.save();

  const saved = await MetalRoutingAnalysisModel.findById(route._id).lean();
  if (!saved) {
    throw new Error('Route save verification failed: document not found after insert');
  }
  if (saved.projectId.toString() !== k.projectId) {
    throw new Error(
      `Route save verification failed: project mismatch (expected ${k.projectId}, got ${saved.projectId.toString()})`,
    );
  }
  if (!saved.metals?.length) {
    throw new Error('Route save verification failed: metals array is empty after save');
  }

  console.log(IMPORT_LOG_PREFIX, 'upsertRouteWithMetals saved', {
    routeId: saved._id.toString(),
    projectId: saved.projectId.toString(),
    fromCell: saved.fromCell,
    toCell: saved.toCell,
    fromSignal: saved.fromSignal,
    toSignal: saved.toSignal,
    metalCount: saved.metals.length,
  });

  return serializeRouteForClient(saved as unknown as Record<string, unknown>);
}

export async function removeMetalFromRoute(key: RoutingKey, metalId: string) {
  const k = normalizeKey(key);
  if (!Types.ObjectId.isValid(metalId)) return null;

  const route = await MetalRoutingAnalysisModel.findOne({
    projectId: k.projectObjectId,
    fromCell: k.fromCell,
    toCell: k.toCell,
    fromSignal: k.fromSignal,
    toSignal: k.toSignal,
  });
  if (!route) return null;

  route.metals = route.metals.filter((m) => m._id.toString() !== metalId);
  const summary = summarizeMetals(route.metals.map(toComputed));
  Object.assign(route, applySummaryToMetals(route.metals, summary));
  await route.save();

  return serializeRouteForClient(route.toObject() as unknown as Record<string, unknown>);
}

export async function listPdkModules() {
  return PdkModuleModel.find().sort({ name: 1 }).lean();
}

export async function getPdkModuleById(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return PdkModuleModel.findById(id).lean();
}

export async function createPdkModule(data: {
  name: string;
  technologyNode?: string;
  notes?: string;
  metals: Array<{ metalType: string; currentDensityAt110: number; sheetResistance: number }>;
}) {
  return PdkModuleModel.create({
    name: data.name.trim(),
    technologyNode: data.technologyNode?.trim() ?? '',
    notes: data.notes?.trim() ?? '',
    metals: (data.metals ?? []).map((m) => ({
      metalType: m.metalType.trim(),
      currentDensityAt110: Number(m.currentDensityAt110),
      sheetResistance: Number(m.sheetResistance),
    })),
  });
}

export async function getPdkTemplateExcel() {
  return buildPdkTemplateExcelBuffer();
}

export async function importPdkModuleFromExcel(
  buffer: Buffer,
  options: { name?: string; technologyNode?: string; notes?: string },
) {
  const parsed = await parsePdkExcelBuffer(buffer);

  const name = (options.name?.trim() || parsed.metadata.pdkName?.trim() || '').trim();
  if (!name) {
    throw new Error('PDK module name is required. Provide a name in the import form or in the spreadsheet metadata.');
  }

  const technologyNode = (options.technologyNode?.trim() || parsed.metadata.technologyNode?.trim() || '').trim();
  const notes = (options.notes?.trim() || parsed.metadata.notes?.trim() || 'Imported from Excel').trim();

  const module = await createPdkModule({
    name,
    technologyNode,
    notes,
    metals: parsed.metals.map((m) => ({
      metalType: m.metalType,
      currentDensityAt110: m.currentDensityAt110,
      sheetResistance: m.sheetResistance,
    })),
  });
  return typeof module.toObject === 'function' ? module.toObject() : module;
}

export async function updatePdkModule(
  id: string,
  data: Partial<{
    name: string;
    technologyNode: string;
    notes: string;
    metals: Array<{ metalType: string; currentDensityAt110: number; sheetResistance: number }>;
  }>,
) {
  if (!Types.ObjectId.isValid(id)) return null;
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.technologyNode !== undefined) update.technologyNode = data.technologyNode.trim();
  if (data.notes !== undefined) update.notes = data.notes.trim();
  if (data.metals !== undefined) {
    update.metals = data.metals.map((m) => ({
      metalType: m.metalType.trim(),
      currentDensityAt110: Number(m.currentDensityAt110),
      sheetResistance: Number(m.sheetResistance),
    }));
  }
  return PdkModuleModel.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
}

export async function deletePdkModule(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return PdkModuleModel.findByIdAndDelete(id).lean();
}

export async function getRouteById(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return MetalRoutingAnalysisModel.findById(id).lean();
}

export async function deleteRoute(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return MetalRoutingAnalysisModel.findByIdAndDelete(id).lean();
}

function toRouteExcelRecord(route: Record<string, unknown>): RouteExcelRecord {
  const metals = (route.metals as MetalEntrySubdoc[]) ?? [];
  return {
    fromCell: String(route.fromCell ?? ''),
    toCell: String(route.toCell ?? ''),
    fromSignal: String(route.fromSignal ?? ''),
    toSignal: String(route.toSignal ?? ''),
    metals: metals.map((metal) => ({
      metalType: metal.metalType,
      width: metal.width,
      length: metal.length,
      givenCurrentDensity: metal.givenCurrentDensity,
      implementedCurrentMetalCapacity: metal.implementedCurrentMetalCapacity,
      routingMetalImpedance: metal.routingMetalImpedance,
    })),
    minimumMetalCurrentCapacity: Number(route.minimumMetalCurrentCapacity ?? 0),
    totalImpedance: Number(route.totalImpedance ?? 0),
  };
}

export async function getMetalRoutingTemplateExcel() {
  return buildMetalRoutingTemplateExcelBuffer();
}

export async function getMetalRoutingTemplateExcelForProject(projectId: string) {
  const normalizedProjectId = projectId.trim();
  if (!Types.ObjectId.isValid(normalizedProjectId)) {
    throw new Error('Invalid project id');
  }

  const { module } = await getProjectPdkModule(normalizedProjectId);
  const metalTypes = (module.metals ?? []).map((metal) => metal.metalType).filter(Boolean);
  if (!metalTypes.length) {
    throw new Error(`Assigned PDK "${module.name}" has no metal types defined`);
  }

  return {
    buffer: await buildMetalRoutingTemplateExcelBuffer(metalTypes),
    pdkModuleName: module.name,
    metalTypes,
  };
}

export async function exportProjectRoutesExcel(projectId: string, routeId?: string) {
  if (!Types.ObjectId.isValid(projectId)) return null;

  const project = await ProjectModel.findById(projectId).lean();
  if (!project) return null;

  let routes: Record<string, unknown>[];
  if (routeId) {
    const route = await getRouteById(routeId);
    if (!route || route.projectId.toString() !== projectId) return null;
    routes = [route as Record<string, unknown>];
  } else {
    routes = await MetalRoutingAnalysisModel.find({ projectId: new Types.ObjectId(projectId) })
      .sort({ fromCell: 1, toCell: 1, fromSignal: 1, toSignal: 1 })
      .lean() as Record<string, unknown>[];
  }

  const records = routes.map(toRouteExcelRecord);
  const buffer = await buildMetalRoutingExcelBuffer(records);

  const filename = routeId && routes[0]
    ? `metal-routing_${String(routes[0].fromCell)}_${String(routes[0].toCell)}.xlsx`.replace(/\s+/g, '_')
    : `${String(project.projectName || 'project').replace(/\s+/g, '_')}_metal-routing.xlsx`;

  return { buffer, filename, routeCount: records.length };
}

export function serializeRouteForClient(route: Record<string, unknown>) {
  const metals = ((route.metals as MetalEntrySubdoc[]) ?? []).map((metal) => ({
    ...metal,
    _id: metal._id?.toString() ?? '',
    pdkModuleId: metal.pdkModuleId?.toString() ?? '',
  }));

  return {
    ...route,
    _id: (route._id as Types.ObjectId)?.toString?.() ?? String(route._id ?? ''),
    projectId: (route.projectId as Types.ObjectId)?.toString?.() ?? String(route.projectId ?? ''),
    minCapacityMetalId: route.minCapacityMetalId
      ? (route.minCapacityMetalId as Types.ObjectId).toString()
      : null,
    highestImpedanceMetalId: route.highestImpedanceMetalId
      ? (route.highestImpedanceMetalId as Types.ObjectId).toString()
      : null,
    metals,
  };
}

export interface MetalRoutingImportFailure {
  routeLabel: string;
  fromCell: string;
  toCell: string;
  fromSignal: string;
  toSignal: string;
  metalRows: number;
  reason: string;
}

export interface MetalRoutingImportResultPayload {
  success: boolean;
  projectId: string;
  projectName: string;
  routesParsed: number;
  routesImported: number;
  metalsImported: number;
  routesFailed: number;
  failures: MetalRoutingImportFailure[];
  routes: ReturnType<typeof serializeRouteForClient>[];
  savedRoutes: ReturnType<typeof serializeRouteSummaryForClient>[];
  parseDiagnostics: {
    worksheetName: string;
    headerRow: number;
    mergeRangeCount: number;
    dataRowsScanned: number;
    totalMetalRows: number;
  };
}

export async function importProjectRoutesFromExcel(
  projectId: string,
  buffer: Buffer,
  createdBy?: string,
  createdByName?: string,
): Promise<MetalRoutingImportResultPayload> {
  const normalizedProjectId = projectId.trim();
  if (!Types.ObjectId.isValid(normalizedProjectId)) {
    throw new Error('Invalid project id');
  }

  const project = await ProjectModel.findById(normalizedProjectId).lean();
  if (!project) {
    throw new Error('Project not found');
  }

  const { module } = await getProjectPdkModule(normalizedProjectId);

  console.log(IMPORT_LOG_PREFIX, 'starting import', {
    projectId: normalizedProjectId,
    projectName: project.projectName,
    pdkModule: module.name,
  });

  const parseResult = await parseMetalRoutingExcelWithDiagnostics(buffer, { log: true });
  const blocks = parseResult.routeBlocks;

  let routesImported = 0;
  let metalsImported = 0;
  const routes: ReturnType<typeof serializeRouteForClient>[] = [];
  const failures: MetalRoutingImportFailure[] = [];

  for (const block of blocks) {
    const routeLabel = `${block.fromCell} → ${block.toCell} · ${block.fromSignal} → ${block.toSignal}`;
    try {
      const route = await upsertRouteWithMetals(
        {
          projectId: normalizedProjectId,
          fromCell: block.fromCell,
          toCell: block.toCell,
          fromSignal: block.fromSignal,
          toSignal: block.toSignal,
        },
        block.metals,
        createdBy,
        createdByName,
      );
      routes.push(route);
      routesImported += 1;
      metalsImported += block.metals.length;
      console.log(IMPORT_LOG_PREFIX, 'route imported', {
        routeLabel,
        routeId: route._id,
        projectId: route.projectId,
        metalCount: route.metals.length,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Import failed';
      const failure: MetalRoutingImportFailure = {
        routeLabel,
        fromCell: block.fromCell,
        toCell: block.toCell,
        fromSignal: block.fromSignal,
        toSignal: block.toSignal,
        metalRows: block.metals.length,
        reason: `${reason}. Assigned PDK: "${module.name}".`,
      };
      failures.push(failure);
      console.error(IMPORT_LOG_PREFIX, 'route failed', failure);
    }
  }

  const savedRoutes = await fetchSavedRouteSummariesForProject(normalizedProjectId);

  console.log(IMPORT_LOG_PREFIX, 'import complete', {
    projectId: normalizedProjectId,
    routesParsed: blocks.length,
    routesImported,
    metalsImported,
    routesFailed: failures.length,
    savedRoutesVisible: savedRoutes.length,
  });

  const success = routesImported > 0 && savedRoutes.length > 0;

  if (routesImported > 0 && savedRoutes.length === 0) {
    throw new Error(
      `Routes were saved during import but none are visible for project "${project.projectName}" (${normalizedProjectId}). Check database linkage.`,
    );
  }

  if (routesImported === 0 && failures.length > 0) {
    const summary = failures.map((f) => `${f.routeLabel}: ${f.reason}`).join(' | ');
    throw new Error(`Import failed for all ${failures.length} route(s). ${summary}`);
  }

  return {
    success,
    projectId: normalizedProjectId,
    projectName: project.projectName,
    routesParsed: blocks.length,
    routesImported,
    metalsImported,
    routesFailed: failures.length,
    failures,
    routes,
    savedRoutes,
    parseDiagnostics: {
      worksheetName: parseResult.worksheetName,
      headerRow: parseResult.headerRow,
      mergeRangeCount: parseResult.mergeRangeCount,
      dataRowsScanned: parseResult.dataRowsScanned,
      totalMetalRows: parseResult.totalMetalRows,
    },
  };
}

export async function exportRouteExcel(id: string) {
  const route = await getRouteById(id);
  if (!route) return null;
  const projectId = route.projectId.toString();
  const result = await exportProjectRoutesExcel(projectId, id);
  if (!result) return null;
  return { route, buffer: result.buffer, filename: result.filename };
}
