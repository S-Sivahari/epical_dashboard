import ExcelJS from 'exceljs';
import { Types } from 'mongoose';
import { PdkModuleModel } from '../models/PdkModule';
import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import {
  MetalRoutingAnalysisModel,
  type MetalEntrySubdoc,
  type MetalRoutingAnalysisDocument,
} from '../models/MetalRoutingAnalysis';
import { isAdminRole } from '../utils/generateToken';
import {
  buildEmployeeWorkspaceProjectsFilter,
  buildAssignmentIdentityTokens,
} from '../utils/assignedProjectsHelper';
import { getDB } from '../config/db';
import { buildPdkTemplateExcelBuffer, parsePdkExcelBuffer } from '../utils/pdkExcel';

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
  if (!Types.ObjectId.isValid(key.projectId)) {
    throw new Error('Invalid project id');
  }
  return {
    projectId: key.projectId,
    projectObjectId: new Types.ObjectId(key.projectId),
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
    throw new Error(`Metal "${type}" not found in assigned PDK module "${module.name}"`);
  }
  return { module, spec };
}

export async function listDashboardProjects(userId: string, userRole: string) {
  let projects;
  if (isAdminRole(userRole)) {
    projects = await ProjectModel.find().sort({ projectName: 1 }).lean();
  } else {
    const db = getDB();
    const employeeOr: Record<string, unknown>[] = [{ userId }];
    if (Types.ObjectId.isValid(userId)) {
      employeeOr.push({ _id: new Types.ObjectId(userId) });
    }
    const employee = await db.collection('employees').findOne({ $or: employeeOr });
    const tokens = buildAssignmentIdentityTokens({ id: userId }, employee as never);
    const filter = await buildEmployeeWorkspaceProjectsFilter(tokens);
    projects = await ProjectModel.find(filter).sort({ projectName: 1 }).lean();
  }

  const pdkIds = projects.map((p) => p.pdkModuleId).filter(Boolean) as Types.ObjectId[];
  const pdks = pdkIds.length
    ? await PdkModuleModel.find({ _id: { $in: pdkIds } }).lean()
    : [];
  const pdkMap = new Map(pdks.map((p) => [p._id.toString(), p]));

  return projects.map((p) => ({
    id: p._id.toString(),
    projectName: p.projectName,
    clientName: p.clientName,
    technologyNode: p.technologyNode,
    status: p.status,
    pdkModuleId: p.pdkModuleId?.toString() ?? null,
    pdkModuleName: p.pdkModuleId ? pdkMap.get(p.pdkModuleId.toString())?.name ?? null : null,
  }));
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

export async function getProjectContext(projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new Error('Invalid project id');
  }
  const projectOid = new Types.ObjectId(projectId);

  const [project, cells, routes] = await Promise.all([
    ProjectModel.findById(projectId).lean(),
    ProjectCellModel.find({ projectId: projectOid }).select('name cellType views').sort({ name: 1 }).lean(),
    MetalRoutingAnalysisModel.find({ projectId: projectOid })
      .select('fromCell toCell fromSignal toSignal updatedAt metals')
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  if (!project) throw new Error('Project not found');

  const cellNames = cells.map((c) => c.name).filter(Boolean);
  let pdkModule = null;
  if (project.pdkModuleId) {
    pdkModule = await PdkModuleModel.findById(project.pdkModuleId).lean();
  }

  return {
    project: {
      id: project._id.toString(),
      projectName: project.projectName,
      clientName: project.clientName,
      technologyNode: project.technologyNode,
      pdkModuleId: project.pdkModuleId?.toString() ?? null,
    },
    cellNames,
    pdkModule,
    routes,
  };
}

export async function findRouteByKey(key: RoutingKey) {
  const k = normalizeKey(key);
  return MetalRoutingAnalysisModel.findOne({
    projectId: k.projectObjectId,
    fromCell: k.fromCell,
    toCell: k.toCell,
    fromSignal: k.fromSignal,
    toSignal: k.toSignal,
  }).lean();
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
  return route.toObject();
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

  return { route: route.toObject(), summary };
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

  return route.toObject();
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

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export async function buildRouteExcelBuffer(
  route: MetalRoutingAnalysisDocument | Record<string, unknown>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Epical Dashboard';
  wb.created = new Date();

  const routeSheet = wb.addWorksheet('Route');
  routeSheet.addRow(['From Cell', 'To Cell', 'From Signal', 'To Signal']);
  routeSheet.addRow([route.fromCell, route.toCell, route.fromSignal, route.toSignal]);
  routeSheet.getRow(1).font = { bold: true };

  const metalsSheet = wb.addWorksheet('Metal Analysis');
  metalsSheet.addRow([
    'Metal Type', 'Metal Width (µm)', 'Metal Length (µm)', 'Given Current Density (mA)',
    'Implemented Metal Current Capacity (mA)', 'Minimum Metal Current Capacity (mA)',
    'Routing Metal Impedance (Ω)', 'Total Impedance (Ω)', 'PDK Module',
  ]);
  metalsSheet.getRow(1).font = { bold: true };
  metalsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

  const metals = (route.metals as MetalEntrySubdoc[]) ?? [];
  const rowCount = Math.max(metals.length, 1);
  metals.forEach((metal, index) => {
    metalsSheet.addRow([
      metal.metalType, metal.width, metal.length,
      round4(metal.givenCurrentDensity), round4(metal.implementedCurrentMetalCapacity),
      index === 0 ? round4(Number(route.minimumMetalCurrentCapacity ?? 0)) : '',
      round4(metal.routingMetalImpedance),
      index === 0 ? round4(Number(route.totalImpedance ?? 0)) : '',
      metal.pdkModuleName,
    ]);
  });
  if (metals.length > 1) {
    metalsSheet.mergeCells(2, 6, rowCount + 1, 6);
    metalsSheet.mergeCells(2, 8, rowCount + 1, 8);
  }

  const pdkModules = await PdkModuleModel.find().sort({ name: 1 }).lean();
  for (const mod of pdkModules) {
    const sheet = wb.addWorksheet(mod.name.slice(0, 31));
    sheet.addRow(['Metal Type', 'Current Density @ 110° (mA)', 'Sheet Resistance (Ω/sq)']);
    sheet.getRow(1).font = { bold: true };
    (mod.metals ?? []).forEach((m) => {
      sheet.addRow([m.metalType, m.currentDensityAt110, m.sheetResistance]);
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportRouteExcel(id: string) {
  const route = await getRouteById(id);
  if (!route) return null;
  return { route, buffer: await buildRouteExcelBuffer(route) };
}
