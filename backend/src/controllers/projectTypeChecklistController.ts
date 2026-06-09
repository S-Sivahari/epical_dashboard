import { Request, Response } from 'express';
import { Types } from 'mongoose';
import ExcelJS from 'exceljs';
import { ProjectModel } from '../models/Project';
import { CELL_TYPES, type CellType } from '../models/ProjectCell';
import { ProjectTypeChecklistModel } from '../models/ProjectTypeChecklist';
import { CellTypeChecklistResponseModel } from '../models/CellTypeChecklistResponse';
import {
  addCustomChecklistItem,
  buildCellChecklistWorkbook,
  clearResponsesForType,
  commentRequiredForAnswer,
  deleteChecklistItem,
  findTypeChecklistDoc,
  getCellTypeChecklistDetail,
  getTypeChecklistItems,
  isValidTypeChecklistAnswer,
  normalizeCellType,
  resolveCellContext,
  toProjectObjectId,
  updateCustomChecklistItemResponse,
} from '../services/projectTypeChecklistService';
import { isAdminRole } from '../utils/generateToken';

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function actorFromReq(req: Request): { userId: string; userName: string } {
  const user = (req as Request & { user?: { id?: string; email?: string; name?: string } }).user;
  return {
    userId: user?.id || 'admin',
    userName: user?.name || user?.email || 'Admin',
  };
}

function isValidCellType(value: string): value is CellType {
  return normalizeCellType(value) === value;
}

function toMeta(doc: {
  cellType: CellType;
  fileName: string;
  contentType: string;
  uploadedAt: Date;
  uploadedByName?: string;
}) {
  return {
    cellType: doc.cellType,
    fileName: doc.fileName,
    contentType: doc.contentType,
    uploadedAt: doc.uploadedAt,
    uploadedByName: doc.uploadedByName || '',
    hasFile: true,
  };
}

export const projectTypeChecklistController = {
  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const projectObjectId = toProjectObjectId(projectId);
      if (!projectObjectId) {
        res.status(400).json({ error: 'Invalid project id' });
        return;
      }

      const docs = await ProjectTypeChecklistModel.find({ projectId: projectObjectId }).lean();
      const byType = new Map(docs.map((d) => [d.cellType, d]));

      res.json(
        CELL_TYPES.map((cellType) => {
          const doc = byType.get(cellType);
          return doc
            ? toMeta(doc)
            : { cellType, fileName: '', contentType: '', uploadedAt: null, uploadedByName: '', hasFile: false };
        }),
      );
    } catch (err) {
      console.error('[type-checklist] list', err);
      res.status(500).json({ error: 'Failed to load checklists' });
    }
  },

  downloadTemplate: async (_req: Request, res: Response): Promise<void> => {
    try {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Checklist');
      sheet.columns = [
        { header: 'Item', key: 'item', width: 40 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Notes', key: 'notes', width: 32 },
      ];
      sheet.addRow({ item: 'Example checklist item', status: 'Pending', notes: '' });
      sheet.getRow(1).font = { bold: true };

      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="checklist-template.xlsx"');
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('[type-checklist] downloadTemplate', err);
      res.status(500).json({ error: 'Failed to generate template' });
    }
  },

  download: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellType = normalizeCellType(paramId(req.params.cellType));
      const projectObjectId = toProjectObjectId(projectId);
      if (!projectObjectId) {
        res.status(400).json({ error: 'Invalid project id' });
        return;
      }

      const doc = await ProjectTypeChecklistModel.findOne({ projectId: projectObjectId, cellType });
      if (!doc) {
        res.status(404).json({ error: 'No checklist uploaded for this type' });
        return;
      }

      res.setHeader('Content-Type', doc.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName.replace(/"/g, '')}"`);
      res.send(doc.fileData);
    } catch (err) {
      console.error('[type-checklist] download', err);
      res.status(500).json({ error: 'Failed to download checklist' });
    }
  },

  upload: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAdminRole((req as Request & { user?: { role?: string } }).user?.role || '')) {
        res.status(403).json({ error: 'Only admins can upload checklists' });
        return;
      }

      const projectId = paramId(req.params.projectId);
      const cellType = normalizeCellType(paramId(req.params.cellType));
      const projectObjectId = toProjectObjectId(projectId);
      if (!projectObjectId) {
        res.status(400).json({ error: 'Invalid project id' });
        return;
      }
      if (!isValidCellType(cellType)) {
        res.status(400).json({ error: 'Invalid cell type' });
        return;
      }

      const project = await ProjectModel.findById(projectObjectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const actor = actorFromReq(req);
      await clearResponsesForType(projectObjectId, cellType);

      const doc = await ProjectTypeChecklistModel.findOneAndUpdate(
        { projectId: projectObjectId, cellType },
        {
          projectId: projectObjectId,
          cellType,
          fileName: file.originalname,
          contentType: file.mimetype || 'application/octet-stream',
          fileData: file.buffer,
          uploadedById: actor.userId,
          uploadedByName: actor.userName,
          uploadedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      res.json(toMeta(doc));
    } catch (err) {
      console.error('[type-checklist] upload', err);
      res.status(500).json({ error: 'Failed to upload checklist' });
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAdminRole((req as Request & { user?: { role?: string } }).user?.role || '')) {
        res.status(403).json({ error: 'Only admins can delete checklists' });
        return;
      }

      const projectId = paramId(req.params.projectId);
      const cellType = normalizeCellType(paramId(req.params.cellType));
      const projectObjectId = toProjectObjectId(projectId);
      if (!projectObjectId) {
        res.status(400).json({ error: 'Invalid project id' });
        return;
      }

      const result = await ProjectTypeChecklistModel.findOneAndDelete({ projectId: projectObjectId, cellType });
      if (!result) {
        res.status(404).json({ error: 'No checklist found for this type' });
        return;
      }

      await clearResponsesForType(projectObjectId, cellType);
      res.json({ success: true, cellType });
    } catch (err) {
      console.error('[type-checklist] remove', err);
      res.status(500).json({ error: 'Failed to delete checklist' });
    }
  },

  getForCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const context = await resolveCellContext(projectId, cellId);
      if (!context) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const doc = await findTypeChecklistDoc(context.projectObjectId, context.cellType);
      if (!doc) {
        res.json({
          cellType: context.cellType,
          libraryName: context.library?.name ?? '',
          fileName: '',
          contentType: '',
          uploadedAt: null,
          uploadedByName: '',
          hasFile: false,
        });
        return;
      }

      res.json({
        ...toMeta(doc),
        libraryName: context.library?.name ?? '',
      });
    } catch (err) {
      console.error('[type-checklist] getForCell', err);
      res.status(500).json({ error: 'Failed to load cell checklist' });
    }
  },

  getCellResponses: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const detail = await getCellTypeChecklistDetail(projectId, cellId);
      if (!detail) {
        res.status(404).json({ error: 'Cell not found in this project' });
        return;
      }
      res.json(detail);
    } catch (err) {
      console.error('[type-checklist] getCellResponses', err);
      res.status(500).json({ error: 'Failed to load checklist responses' });
    }
  },

  updateCellResponse: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const itemIndex = Number(paramId(req.params.itemIndex));
      const { response, comment } = req.body as { response?: string; comment?: string };

      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        res.status(400).json({ error: 'Invalid item index' });
        return;
      }

      if (!response || !isValidTypeChecklistAnswer(response)) {
        res.status(400).json({ error: 'Response must be yes, no, or not_applicable' });
        return;
      }

      const trimmedComment = String(comment ?? '').trim();
      if (commentRequiredForAnswer(response) && !trimmedComment) {
        res.status(400).json({ error: 'Comment is required for No and Not applicable' });
        return;
      }

      const context = await resolveCellContext(projectId, cellId);
      if (!context) {
        res.status(404).json({ error: 'Cell not found in this project' });
        return;
      }

      const parsedItems = await getTypeChecklistItems(context.projectObjectId, context.cellType);
      const item = parsedItems.find((entry) => entry.itemIndex === itemIndex);
      if (!item) {
        res.status(404).json({ error: 'Checklist item not found for this cell type' });
        return;
      }

      const actor = actorFromReq(req);
      const doc = await CellTypeChecklistResponseModel.findOneAndUpdate(
        { cellId: context.cellObjectId, itemIndex },
        {
          projectId: context.projectObjectId,
          cellId: context.cellObjectId,
          cellType: context.cellType,
          itemIndex,
          itemName: item.itemName,
          response,
          comment: commentRequiredForAnswer(response) ? trimmedComment : '',
          answeredById: actor.userId,
          answeredByName: actor.userName,
          answeredAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      res.json({
        source: 'template',
        itemKey: `template-${doc.itemIndex}`,
        itemIndex: doc.itemIndex,
        customItemId: null,
        itemName: doc.itemName,
        response: doc.response,
        comment: doc.comment,
        answeredAt: doc.answeredAt,
        answeredByName: doc.answeredByName ?? '',
      });
    } catch (err) {
      console.error('[type-checklist] updateCellResponse', err);
      res.status(500).json({ error: 'Failed to save checklist response' });
    }
  },

  addCustomItem: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAdminRole((req as Request & { user?: { role?: string } }).user?.role || '')) {
        res.status(403).json({ error: 'Only admins can add checklist questions' });
        return;
      }

      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const itemName = String((req.body as { itemName?: string })?.itemName ?? '').trim();

      if (!itemName) {
        res.status(400).json({ error: 'Question text is required' });
        return;
      }

      const item = await addCustomChecklistItem(projectId, cellId, itemName, actorFromReq(req));
      if (!item) {
        res.status(404).json({ error: 'Cell not found in this project' });
        return;
      }

      res.status(201).json(item);
    } catch (err) {
      console.error('[type-checklist] addCustomItem', err);
      res.status(500).json({ error: 'Failed to add checklist question' });
    }
  },

  deleteItem: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAdminRole((req as Request & { user?: { role?: string } }).user?.role || '')) {
        res.status(403).json({ error: 'Only admins can delete checklist questions' });
        return;
      }

      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const itemKey = paramId(req.params.itemKey);

      const result = await deleteChecklistItem(projectId, cellId, itemKey, actorFromReq(req));
      if (!result) {
        res.status(404).json({ error: 'Checklist question not found' });
        return;
      }

      res.json({ success: true, itemKey, source: result });
    } catch (err) {
      console.error('[type-checklist] deleteItem', err);
      res.status(500).json({ error: 'Failed to delete checklist question' });
    }
  },

  updateCustomItemResponse: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const customItemId = paramId(req.params.customItemId);
      const { response, comment } = req.body as { response?: string; comment?: string };

      if (!response || !isValidTypeChecklistAnswer(response)) {
        res.status(400).json({ error: 'Response must be yes, no, or not_applicable' });
        return;
      }

      const trimmedComment = String(comment ?? '').trim();
      if (commentRequiredForAnswer(response) && !trimmedComment) {
        res.status(400).json({ error: 'Comment is required for No and Not applicable' });
        return;
      }

      const item = await updateCustomChecklistItemResponse(
        projectId,
        cellId,
        customItemId,
        {
          response,
          comment: commentRequiredForAnswer(response) ? trimmedComment : '',
        },
        actorFromReq(req),
      );

      if (!item) {
        res.status(404).json({ error: 'Custom checklist question not found' });
        return;
      }

      res.json(item);
    } catch (err) {
      console.error('[type-checklist] updateCustomItemResponse', err);
      res.status(500).json({ error: 'Failed to save checklist response' });
    }
  },

  downloadCellChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const exportData = await buildCellChecklistWorkbook(projectId, cellId);

      if (!exportData) {
        res.status(404).json({ error: 'Cell not found in this project' });
        return;
      }

      if (!exportData.detail.items.length) {
        res.status(400).json({ error: 'No checklist questions to export' });
        return;
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${exportData.fileName.replace(/"/g, '')}"`,
      );
      res.send(exportData.buffer);
    } catch (err) {
      console.error('[type-checklist] downloadCellChecklist', err);
      res.status(500).json({ error: 'Failed to export checklist' });
    }
  },
};
