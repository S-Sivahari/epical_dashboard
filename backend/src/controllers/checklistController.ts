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
  actorName,
} from '../services/checklistService';

function toChecklistDto(c: any) {
  return {
    id: c._id.toString(),
    name: c.name,
    description: c.description || '',
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
      const pid = paramId(projectId);
      const cid = paramId(cellId);
      const entries = await CellChecklistMappingModel.find({ projectId: pid, cellId: cid }).sort({ itemName: 1 });
      const assignment = await ProjectChecklistModel.findOne({ projectId: pid });

      const allApplied = entries.length > 0 && entries.every((e) => e.status === 'Applied');
      const anyApplied = entries.some((e) => e.status === 'Applied');
      let cellStatus: 'Applied' | 'Pending' | 'Not Assigned' = 'Not Assigned';
      if (!assignment) cellStatus = 'Not Assigned';
      else if (allApplied) cellStatus = 'Applied';
      else if (anyApplied || entries.some((e) => e.status === 'Pending')) cellStatus = 'Pending';

      res.json({
        checklistId: assignment ? String(assignment.checklistId) : null,
        cellStatus,
        items: entries.map((e) => ({
          id: e._id.toString(),
          checklistItemId: e.checklistItemId.toString(),
          itemName: e.itemName,
          status: e.status,
          appliedBy: e.appliedByName || e.appliedBy || '',
          appliedDate: e.appliedDate,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch cell checklist' });
    }
  },
};