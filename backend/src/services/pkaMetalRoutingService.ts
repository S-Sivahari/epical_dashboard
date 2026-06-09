import ExcelJS from 'exceljs';
import { Types } from 'mongoose';
import { PkaModuleModel } from '../models/PkaModule';
import { ProjectCellModel } from '../models/ProjectCell';
import {
  MetalRoutingAnalysisModel,
  type MetalEntrySubdoc,
  type MetalRoutingAnalysisDocument,
} from '../models/MetalRoutingAnalysis';

export interface RoutingKey {
  fromCell: string;
  toCell: string;
  fromSignal: string;
  toSignal: string;
}

export interface MetalInput {
  metalType: string;
  width: number;
  length: number;
  pkaModuleId: string;
}

export interface ComputedMetalEntry {
  metalType: string;
  width: number;
  length: number;
  pkaModuleId: Types.ObjectId;
  pkaModuleName: string;
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

function normalizeKey(key: RoutingKey): RoutingKey {
  return {
    fromCell: key.fromCell.trim(),
    toCell: key.toCell.trim(),
    fromSignal: key.fromSignal.trim(),
    toSignal: key.toSignal.trim(),
  };
}

export async function listCellsContext() {
  const cells = await ProjectCellModel.find()
    .select('name cellType technologyNode projectId views')
    .sort({ name: 1 })
    .lean();

  const cellNames = [...new Set(cells.map((c) => c.name).filter(Boolean))].sort();
  const signalSet = new Set<string>();

  for (const cell of cells) {
    if (cell.name) {
      signalSet.add(`${cell.name}_OUT`);
      signalSet.add(`${cell.name}_IN`);
    }
    const views = cell.views as { layout?: string; symbol?: string; schematic?: string } | undefined;
    if (views?.layout) signalSet.add(views.layout);
    if (views?.symbol) signalSet.add(views.symbol);
    if (views?.schematic) signalSet.add(views.schematic);

    const type = String(cell.cellType || '').toLowerCase();
    if (type === 'iop') {
      signalSet.add('PAD_TX');
      signalSet.add('PAD_RX');
    } else if (type === 'esd') {
      signalSet.add('ESD_CLAMP');
    } else if (type === 'top') {
      signalSet.add('CLK_MAIN');
      signalSet.add('VDD_CORE');
    } else {
      signalSet.add('DATA_BUS');
      signalSet.add('CLK');
    }
  }

  const signals = [...signalSet].sort();
  const routes = await MetalRoutingAnalysisModel.find()
    .select('fromCell toCell fromSignal toSignal updatedAt metals')
    .sort({ updatedAt: -1 })
    .lean();

  return { cells, cellNames, signals, routes };
}

export async function findRouteByKey(key: RoutingKey) {
  const k = normalizeKey(key);
  return MetalRoutingAnalysisModel.findOne(k).lean();
}

export async function getOrCreateRoute(
  key: RoutingKey,
  createdBy?: string,
  createdByName?: string,
) {
  const k = normalizeKey(key);
  let route = await MetalRoutingAnalysisModel.findOne(k);
  if (!route) {
    route = await MetalRoutingAnalysisModel.create({
      ...k,
      metals: [],
      minimumMetalCurrentCapacity: 0,
      totalImpedance: 0,
      createdBy,
      createdByName,
    });
  }
  return route.toObject();
}

async function resolvePkaMetalSpec(pkaModuleId: string, metalType: string) {
  if (!Types.ObjectId.isValid(pkaModuleId)) {
    throw new Error('Invalid PKA module id');
  }
  const mod = await PkaModuleModel.findById(pkaModuleId).lean();
  if (!mod) throw new Error('PKA module not found');

  const type = metalType.trim();
  const spec = mod.metals?.find(
    (m) => m.metalType.toLowerCase() === type.toLowerCase(),
  );
  if (!spec) {
    throw new Error(`Metal "${type}" not found in PKA module "${mod.name}"`);
  }

  return { module: mod, spec };
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
    pkaModuleId: module._id,
    pkaModuleName: module.name,
    givenCurrentDensity,
    sheetResistance,
    implementedCurrentMetalCapacity: width * givenCurrentDensity,
    routingMetalImpedance: width > 0 ? (length / width) * sheetResistance : 0,
  };
}

export async function previewMetal(input: MetalInput): Promise<ComputedMetalEntry> {
  const { module, spec } = await resolvePkaMetalSpec(input.pkaModuleId, input.metalType);
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

function applySummaryToMetals(
  metals: MetalEntrySubdoc[],
  summary: AnalysisSummary,
) {
  const minCapacityMetalId =
    summary.minCapacityMetalIndex >= 0
      ? metals[summary.minCapacityMetalIndex]._id
      : null;
  const highestImpedanceMetalId =
    summary.highestImpedanceMetalIndex >= 0
      ? metals[summary.highestImpedanceMetalIndex]._id
      : null;

  return {
    minimumMetalCurrentCapacity: summary.minimumMetalCurrentCapacity,
    totalImpedance: summary.totalImpedance,
    minCapacityMetalId,
    highestImpedanceMetalId,
  };
}

export async function addMetalToRoute(
  key: RoutingKey,
  input: MetalInput,
  createdBy?: string,
  createdByName?: string,
) {
  const k = normalizeKey(key);
  const computed = await previewMetal(input);

  let route = await MetalRoutingAnalysisModel.findOne(k);
  if (!route) {
    route = new MetalRoutingAnalysisModel({
      ...k,
      metals: [],
      createdBy,
      createdByName,
    });
  }

  const newMetal: MetalEntrySubdoc = {
    _id: new Types.ObjectId(),
    ...computed,
  };

  route.metals.push(newMetal);

  const summary = summarizeMetals(
    route.metals.map((m) => ({
      metalType: m.metalType,
      width: m.width,
      length: m.length,
      pkaModuleId: m.pkaModuleId,
      pkaModuleName: m.pkaModuleName,
      givenCurrentDensity: m.givenCurrentDensity,
      sheetResistance: m.sheetResistance,
      implementedCurrentMetalCapacity: m.implementedCurrentMetalCapacity,
      routingMetalImpedance: m.routingMetalImpedance,
    })),
  );

  Object.assign(route, applySummaryToMetals(route.metals, summary));
  await route.save();

  return { route: route.toObject(), summary };
}

export async function removeMetalFromRoute(key: RoutingKey, metalId: string) {
  const k = normalizeKey(key);
  if (!Types.ObjectId.isValid(metalId)) return null;

  const route = await MetalRoutingAnalysisModel.findOne(k);
  if (!route) return null;

  route.metals = route.metals.filter((m) => m._id.toString() !== metalId);

  const summary = summarizeMetals(
    route.metals.map((m) => ({
      metalType: m.metalType,
      width: m.width,
      length: m.length,
      pkaModuleId: m.pkaModuleId,
      pkaModuleName: m.pkaModuleName,
      givenCurrentDensity: m.givenCurrentDensity,
      sheetResistance: m.sheetResistance,
      implementedCurrentMetalCapacity: m.implementedCurrentMetalCapacity,
      routingMetalImpedance: m.routingMetalImpedance,
    })),
  );

  Object.assign(route, applySummaryToMetals(route.metals, summary));
  await route.save();

  return route.toObject();
}

export async function listPkaModules() {
  return PkaModuleModel.find().sort({ name: 1 }).lean();
}

export async function getPkaModuleById(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return PkaModuleModel.findById(id).lean();
}

export async function createPkaModule(data: {
  name: string;
  technologyNode?: string;
  notes?: string;
  metals: Array<{
    metalType: string;
    currentDensityAt110: number;
    sheetResistance: number;
  }>;
}) {
  return PkaModuleModel.create({
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

export async function updatePkaModule(
  id: string,
  data: Partial<{
    name: string;
    technologyNode: string;
    notes: string;
    metals: Array<{
      metalType: string;
      currentDensityAt110: number;
      sheetResistance: number;
    }>;
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

  return PkaModuleModel.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
}

export async function deletePkaModule(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return PkaModuleModel.findByIdAndDelete(id).lean();
}

export async function listRoutes(limit = 100) {
  return MetalRoutingAnalysisModel.find()
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
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
  routeSheet.addRow([
    route.fromCell,
    route.toCell,
    route.fromSignal,
    route.toSignal,
  ]);
  routeSheet.getRow(1).font = { bold: true };

  const metalsSheet = wb.addWorksheet('Metal Analysis');
  const headers = [
    'Metal Type',
    'Metal Width (µm)',
    'Metal Length (µm)',
    'Given Current Density (mA)',
    'Implemented Metal Current Capacity (mA)',
    'Minimum Metal Current Capacity (mA)',
    'Routing Metal Impedance (Ω)',
    'Total Impedance (Ω)',
    'PKA Module',
  ];
  metalsSheet.addRow(headers);
  metalsSheet.getRow(1).font = { bold: true };
  metalsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' },
  };

  const metals = (route.metals as MetalEntrySubdoc[]) ?? [];
  const minId = route.minCapacityMetalId?.toString();
  const rowCount = Math.max(metals.length, 1);

  metals.forEach((metal, index) => {
    const id = metal._id?.toString();
    const isMin = id && minId && id === minId;
    const row = metalsSheet.addRow([
      metal.metalType,
      metal.width,
      metal.length,
      round4(metal.givenCurrentDensity),
      round4(metal.implementedCurrentMetalCapacity),
      index === 0 ? round4(Number(route.minimumMetalCurrentCapacity ?? 0)) : '',
      round4(metal.routingMetalImpedance),
      index === 0 ? round4(Number(route.totalImpedance ?? 0)) : '',
      metal.pkaModuleName,
    ]);
    if (isMin) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3CD' },
      };
    }
  });

  if (metals.length > 1) {
    metalsSheet.mergeCells(2, 6, rowCount + 1, 6);
    metalsSheet.mergeCells(2, 8, rowCount + 1, 8);
  }

  const pkaModules = await PkaModuleModel.find().sort({ name: 1 }).lean();
  for (const mod of pkaModules) {
    const sheet = wb.addWorksheet(mod.name.slice(0, 31));
    sheet.addRow(['Metal Type', 'Current Density @ 110° (mA)', 'Sheet Resistance (Ω/sq)']);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };
    (mod.metals ?? []).forEach((m) => {
      sheet.addRow([m.metalType, m.currentDensityAt110, m.sheetResistance]);
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportRouteExcel(id: string) {
  const route = await getRouteById(id);
  if (!route) return null;
  const buffer = await buildRouteExcelBuffer(route);
  return { route, buffer };
}
