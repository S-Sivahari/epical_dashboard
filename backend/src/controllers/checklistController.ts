import { Request, Response } from 'express';
import { Types } from 'mongoose';
import ExcelJS from 'exceljs';
import {
  ChecklistModel,
  ProjectChecklistModel,
  CellChecklistMappingModel,
} from '../models/Checklist';
import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import {
  assignChecklistToProject,
  applyChecklistToAllCells,
  buildChecklistExportRows,
  getProjectChecklistSummary,
  recalcProjectChecklistProgress,
  syncChecklistMappingsForCell,
  getProjectCellsChecklist,
  updateCellChecklistItemResponse,
  actorName,
} from '../services/checklistService';
import {
  buildCellChecklistDetail,
} from '../services/cellTypeChecklistService';
import {
  listCellTypeChecklistDefinitions,
  getCellTypeChecklistDefinition,
} from '../services/cellTypeChecklistDefinitionService';
import {
  buildProjectCellChecklistExportRows,
  importProjectCellChecklistRows,
} from '../services/projectChecklistExportService';
import {
  buildChecklistTemplateExportRows,
  importChecklistTemplateRows,
  resyncMappingsAfterChecklistDefinitionChange,
} from '../services/checklistTemplateService';

function toChecklistDto(c: any) {
  return {
    id: c._id.toString(),
    name: c.name,
    description: c.description || '',
    cellType: c.cellType || '',
    items: (c.items || []).map((item: any) => ({
      id: item._id.toString(),
      itemName: item.itemName,
      order: item.order ?? 0,
    })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function excelCellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join('').trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    return result == null ? '' : String(result).trim();
  }
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text: string }).text).trim();
  }
  return String(value).trim();
}

function findChecklistTemplateHeaderRow(sheet: ExcelJS.Worksheet): number {
  let headerRowNumber = 0;
  sheet.eachRow((row, rowNumber) => {
    if (headerRowNumber > 0) return;
    const normalized: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      normalized.push(excelCellText(cell.value).toLowerCase().replace(/\s+/g, ''));
    });
    if (
      normalized.includes('checklistname') ||
      (normalized.includes('itemname') && normalized.some((cell) => cell.includes('checklist')))
    ) {
      headerRowNumber = rowNumber;
    }
  });
  return headerRowNumber;
}

function isValidChecklistImportName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return false;
  if (/^-+$/.test(trimmed)) return false;
  if (/confidential|system generated report|generated on/i.test(trimmed)) return false;
  return true;
}

export const checklistController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    try {
      const list = await ChecklistModel.find().sort({ name: 1 });
      res.json(list.map(toChecklistDto));
    } catch (err) {
      console.error('[checklist] list', err);
      res.status(500).json({ error: 'Failed to fetch checklists' });
    }
  },

  listCellTypeDefinitions: async (_req: Request, res: Response): Promise<void> => {
    try {
      const definitions = await listCellTypeChecklistDefinitions();
      res.json(definitions);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch cell type checklists' });
    }
  },

  getCellTypeDefinition: async (req: Request, res: Response): Promise<void> => {
    try {
      const definition = await getCellTypeChecklistDefinition(paramId(req.params.cellType));
      if (!definition) {
        res.status(404).json({ error: 'Checklist not found for this cell type' });
        return;
      }
      res.json(definition);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch cell type checklist' });
    }
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const doc = await ChecklistModel.findById(req.params.id);
      if (!doc) {
        res.status(404).json({ error: 'Checklist not found' });
        return;
      }
      res.json(toChecklistDto(doc));
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch checklist' });
    }
  },

  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, items } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ error: 'Checklist name is required' });
        return;
      }
      const itemDocs = Array.isArray(items)
        ? items
            .filter((i: { itemName?: string }) => i?.itemName?.trim())
            .map((i: { itemName: string }, idx: number) => ({
              itemName: i.itemName.trim(),
              order: idx,
            }))
        : [];

      const doc = await ChecklistModel.create({
        name: name.trim(),
        description: description?.trim() || '',
        items: itemDocs,
        createdBy: actorName(req),
      });
      res.status(201).json(toChecklistDto(doc));
    } catch (err) {
      console.error('[checklist] create', err);
      res.status(500).json({ error: 'Failed to create checklist' });
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const doc = await ChecklistModel.findById(req.params.id);
      if (!doc) {
        res.status(404).json({ error: 'Checklist not found' });
        return;
      }

      if (req.body.name !== undefined) doc.name = String(req.body.name).trim();
      if (req.body.description !== undefined) doc.description = String(req.body.description).trim();

      if (Array.isArray(req.body.items)) {
        doc.items = req.body.items
          .filter((i: { itemName?: string }) => i?.itemName?.trim())
          .map((i: { itemName: string; id?: string }, idx: number) => ({
            _id: i.id && Types.ObjectId.isValid(i.id) ? new Types.ObjectId(i.id) : new Types.ObjectId(),
            itemName: i.itemName.trim(),
            order: idx,
          }));
      }

      await doc.save();
      await resyncMappingsAfterChecklistDefinitionChange(doc._id);
      res.json(toChecklistDto(doc));
    } catch (err) {
      console.error('[checklist] update', err);
      res.status(500).json({ error: 'Failed to update checklist' });
    }
  },

  delete: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const doc = await ChecklistModel.findById(id);
      if (!doc) {
        res.status(404).json({ error: 'Checklist not found' });
        return;
      }

      const inUse = await ProjectChecklistModel.countDocuments({ checklistId: doc._id });
      if (inUse > 0) {
        res.status(409).json({ error: 'Checklist is assigned to projects and cannot be deleted' });
        return;
      }

      await ChecklistModel.findByIdAndDelete(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete checklist' });
    }
  },

  assignToProject: async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, checklistId, applyToAll, selectedItemIds } = req.body;
      if (!projectId || !checklistId) {
        res.status(400).json({ error: 'projectId and checklistId are required' });
        return;
      }
      await assignChecklistToProject(projectId, checklistId, {
        actor: actorName(req),
        actorId: req.user?.id || '',
        selectedItemIds: Array.isArray(selectedItemIds) ? selectedItemIds : undefined,
        applyToAll: Boolean(applyToAll),
      });
      if (applyToAll && (await ProjectCellModel.countDocuments({ projectId })) > 0) {
        const userId = req.user?.id || '';
        await applyChecklistToAllCells(projectId, userId, actorName(req));
      }
      const summary = await getProjectChecklistSummary(projectId);
      res.json(summary);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to assign checklist' });
    }
  },

  getProjectChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const summary = await getProjectChecklistSummary(paramId(req.params.projectId));
      if (!summary) {
        res.json(null);
        return;
      }
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch project checklist' });
    }
  },

  getProjectCellsChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await getProjectCellsChecklist(paramId(req.params.projectId));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch cell checklists' });
    }
  },

  exportProjectCellChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = await buildProjectCellChecklistExportRows(paramId(req.params.projectId));
      res.json(rows);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to export project checklist' });
    }
  },

  importProjectCellChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = req.body?.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: 'rows array is required' });
        return;
      }
      const result = await importProjectCellChecklistRows(
        paramId(req.params.projectId),
        rows,
        req.user?.id || '',
        actorName(req),
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to import project checklist' });
    }
  },

  applyToAll: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id || '';
      const userName = actorName(req);
      const result = await applyChecklistToAllCells(paramId(req.params.projectId), userId, userName);
      const summary = await getProjectChecklistSummary(paramId(req.params.projectId));
      res.json({ ...result, summary });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to apply checklist' });
    }
  },

  exportReport: async (_req: Request, res: Response): Promise<void> => {
    try {
      const rows = await buildChecklistExportRows();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to build export data' });
    }
  },

  exportTemplate: async (_req: Request, res: Response): Promise<void> => {
    try {
      const rows = await buildChecklistTemplateExportRows();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to build checklist template' });
    }
  },

  importTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = req.body?.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: 'rows array is required' });
        return;
      }
      const result = await importChecklistTemplateRows(rows, actorName(req));
      res.json(result);
    } catch (err) {
      console.error('[checklist] importTemplate', err);
      res.status(500).json({ error: 'Import failed' });
    }
  },

  parseTemplateUpload: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer as unknown as ExcelJS.Buffer);
      const sheet = wb.worksheets[0];
      if (!sheet) {
        res.status(400).json({ error: 'Worksheet not found' });
        return;
      }

      const headerRowNumber = findChecklistTemplateHeaderRow(sheet);
      if (!headerRowNumber) {
        res.status(400).json({
          error:
            'Could not find header row. Expected columns: Checklist Name, Cell Type, Description, Item Name, Item Order',
        });
        return;
      }

      const headerRow = sheet.getRow(headerRowNumber);
      const headers: string[] = [];
      headerRow.eachCell((cell, col) => {
        headers[col - 1] = excelCellText(cell.value);
      });

      const normalizeKey = (h: string) => h.toLowerCase().replace(/\s+/g, '');

      const columnIndex = (...candidates: string[]): number => {
        for (let i = 0; i < headers.length; i += 1) {
          const headerNorm = normalizeKey(headers[i] ?? '');
          if (!headerNorm) continue;
          for (const candidate of candidates) {
            if (headerNorm === normalizeKey(candidate)) return i;
          }
        }
        return -1;
      };

      const getVal = (row: ExcelJS.Row, ...candidates: string[]) => {
        const idx = columnIndex(...candidates);
        if (idx < 0) return '';
        return excelCellText(row.getCell(idx + 1).value);
      };

      const rows: Record<string, unknown>[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowNumber) return;
        const checklistName = getVal(row, 'Checklist Name', 'checklistName');
        const cellType = getVal(row, 'Cell Type', 'cellType');
        if (!checklistName && !cellType) return;
        if (checklistName && !isValidChecklistImportName(checklistName)) return;
        const itemName = getVal(row, 'Item Name', 'itemName');
        if (!itemName || itemName === '—') return;
        rows.push({
          checklistName,
          cellType,
          description: getVal(row, 'Description', 'description'),
          itemName,
          itemOrder: getVal(row, 'Item Order', 'itemOrder'),
        });
      });

      if (!rows.length) {
        res.status(400).json({ error: 'No valid checklist rows found in file' });
        return;
      }

      const result = await importChecklistTemplateRows(rows, actorName(req));
      res.json(result);
    } catch (err) {
      console.error('[checklist] parseTemplateUpload', err);
      res.status(500).json({ error: 'Failed to parse Excel file' });
    }
  },

  importReport: async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = req.body?.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: 'rows array is required' });
        return;
      }

      let imported = 0;
      let updated = 0;
      let failed = 0;
      const errors: { row: number; projectName: string; message: string }[] = [];

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        imported += 1;
        const projectName = String(row.projectName || row['Project Name'] || '').trim();
        const checklistName = String(row.checklistName || row['Checklist Name'] || '').trim();
        const statusRaw = String(row.checklistStatus || row['Checklist Status'] || '').trim();
        const completionRaw = row.completionPercentage ?? row['Completion Percentage'];

        if (!projectName) {
          failed += 1;
          errors.push({ row: i + 1, projectName: '(empty)', message: 'Project name is required' });
          continue;
        }

        const project = await ProjectModel.findOne({
          projectName: new RegExp(`^${projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        });

        if (!project) {
          failed += 1;
          errors.push({ row: i + 1, projectName, message: 'Project not found' });
          continue;
        }

        try {
          if (checklistName) {
            let checklist = await ChecklistModel.findOne({
              name: new RegExp(`^${checklistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            });

            const extraItems = row.checklistItems || row['Checklist Items'];
            if (Array.isArray(extraItems) && extraItems.length > 0) {
              if (!checklist) {
                checklist = await ChecklistModel.create({
                  name: checklistName,
                  description: '',
                  items: extraItems.map((name: string, idx: number) => ({
                    itemName: String(name).trim(),
                    order: idx,
                  })).filter((i: { itemName: string }) => i.itemName),
                  createdBy: actorName(req),
                });
              } else {
                const existing = new Set(checklist.items.map((it) => it.itemName.toLowerCase()));
                for (const name of extraItems) {
                  const trimmed = String(name).trim();
                  if (trimmed && !existing.has(trimmed.toLowerCase())) {
                    checklist.items.push({
                      _id: new Types.ObjectId(),
                      itemName: trimmed,
                      order: checklist.items.length,
                    });
                  }
                }
                await checklist.save();
              }
            }

            if (!checklist) {
              failed += 1;
              errors.push({ row: i + 1, projectName, message: `Checklist "${checklistName}" not found` });
              continue;
            }

            await assignChecklistToProject(String(project._id), String(checklist._id), {
              actor: actorName(req),
            });
          }

          const assignment = await ProjectChecklistModel.findOne({ projectId: project._id });
          if (assignment) {
            if (statusRaw) {
              const normalized = statusRaw.toLowerCase();
              if (normalized === 'applied') {
                await applyChecklistToAllCells(String(project._id), req.user?.id || '', actorName(req));
              } else if (normalized === 'partial' || normalized === 'not applied') {
                assignment.status =
                  normalized === 'partial' ? 'Partial' : 'Not Applied';
              }
            }

            if (completionRaw !== undefined && completionRaw !== '' && !Number.isNaN(Number(completionRaw))) {
              const pct = Math.min(100, Math.max(0, Math.round(Number(completionRaw))));
              assignment.completionPercentage = pct;
              if (pct >= 100) assignment.status = 'Applied';
              else if (pct <= 0) assignment.status = 'Not Applied';
              else assignment.status = 'Partial';
              await assignment.save();
            } else {
              await recalcProjectChecklistProgress(project._id);
            }
          }

          updated += 1;
        } catch (e: any) {
          failed += 1;
          errors.push({ row: i + 1, projectName, message: e.message || 'Update failed' });
        }
      }

      res.json({ imported, updated, failed, errors });
    } catch (err) {
      console.error('[checklist] import', err);
      res.status(500).json({ error: 'Import failed' });
    }
  },

  parseUpload: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer as unknown as ExcelJS.Buffer);
      const sheet = wb.worksheets[0];
      if (!sheet) {
        res.status(400).json({ error: 'Worksheet not found' });
        return;
      }

      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, col) => {
        headers[col - 1] = String(cell.value ?? '').trim();
      });

      const normalizeKey = (h: string) => h.toLowerCase().replace(/\s+/g, '');
      const keyMap = new Map(headers.map((h) => [normalizeKey(h), h]));

      const getVal = (row: ExcelJS.Row, ...candidates: string[]) => {
        for (const c of candidates) {
          const idx = headers.indexOf(keyMap.get(normalizeKey(c)) || c);
          if (idx >= 0) {
            const cell = row.getCell(idx + 1);
            return cell.value != null ? String(cell.value).trim() : '';
          }
        }
        return '';
      };

      const rows: Record<string, unknown>[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const projectName = getVal(row, 'Project Name', 'projectName');
        if (!projectName) return;
        rows.push({
          projectName,
          client: getVal(row, 'Client', 'client'),
          projectType: getVal(row, 'Project Type', 'projectType'),
          teamLead: getVal(row, 'Team Lead', 'teamLead'),
          checklistName: getVal(row, 'Checklist Name', 'checklistName'),
          checklistStatus: getVal(row, 'Checklist Status', 'checklistStatus'),
          completionPercentage: getVal(row, 'Completion Percentage', 'completionPercentage'),
          totalCells: getVal(row, 'Total Cells', 'totalCells'),
          appliedCells: getVal(row, 'Applied Cells', 'appliedCells'),
          lastUpdated: getVal(row, 'Last Updated', 'lastUpdated'),
        });
      });

      req.body = { rows };
      await checklistController.importReport(req, res);
    } catch (err) {
      console.error('[checklist] parseUpload', err);
      res.status(500).json({ error: 'Failed to parse Excel file' });
    }
  },

  getCellChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, cellId } = req.params;
      const detail = await buildCellChecklistDetail(paramId(projectId), paramId(cellId));
      res.json(detail);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch cell checklist' });
    }
  },

  updateCellChecklistItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, cellId, mappingId } = req.params;
      const { response, comment } = req.body;
      await updateCellChecklistItemResponse(
        paramId(projectId),
        paramId(cellId),
        paramId(mappingId),
        { response, comment },
        req.user?.id || '',
        actorName(req),
      );

      const detail = await buildCellChecklistDetail(paramId(projectId), paramId(cellId));
      res.json(detail);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update checklist item' });
    }
  },
};