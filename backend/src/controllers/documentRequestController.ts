import { Response } from 'express';
import * as svc from '../services/documentRequestService';
import { DocumentRequestStatus } from '../models/DocumentRequest';
import { AuthRequest } from '../middleware/authMiddleware';
import { getUserById } from '../services/authService';
import { isAdminRole, isEmployeeRole } from '../utils/generateToken';

/** JWT lacks name — resolve from DB for audit fields (approve/reject). */
async function resolveAdminDisplayName(req: AuthRequest): Promise<string> {
  const u = req.user;
  if (!u) return 'Admin';
  const profile = await getUserById(u.id);
  return profile?.name?.trim() || u.email || 'Admin';
}

export const documentRequestController = {
  createMine: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { documentType, documentName, reason } = req.body ?? {};
      const type = String(documentType ?? '').trim();
      const name = String(documentName ?? '').trim();
      const reasonText = String(reason ?? '').trim();
      if (!type || !name || !reasonText) {
        res.status(400).json({ error: 'documentType, documentName, and reason are required' });
        return;
      }
      if (reasonText.length < 5) {
        res.status(400).json({ error: 'Reason must be at least 5 characters' });
        return;
      }
      const profile = await getUserById(req.user.id);
      const fallbackName = profile?.name?.trim() || 'Employee';
      const created = await svc.createDocumentRequest(req.user.id, fallbackName, {
        documentType: type,
        documentName: name,
        reason: reasonText,
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? 'Could not create request' });
    }
  },

  listMine: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !isEmployeeRole(req.user.role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const rows = await svc.listForEmployee(req.user.id);
      res.json(rows);
    } catch {
      res.status(500).json({ error: 'Failed to list requests' });
    }
  },

  /** Admin listing with pagination */
  listAdmin: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit || '10'), 10)));
      const mode = (req.query.mode as string | undefined)?.toLowerCase();
      const status = String(req.query.status ?? '').trim();

      let result;
      if (mode === 'history') {
        result = await svc.listHistory({ page, limit });
      } else if (status && ['Requested', 'Approved', 'Rejected'].includes(status)) {
        result = await svc.listForAdmin({ status: status as DocumentRequestStatus, page, limit });
      } else {
        res.status(400).json({ error: 'Use status=Requested|Approved|Rejected or mode=history' });
        return;
      }

      res.json({ ...result, page, limit });
    } catch {
      res.status(500).json({ error: 'Failed to list document requests' });
    }
  },

  uploadFulfillment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ error: 'File is required' });
        return;
      }
      const updated = await svc.uploadFulfillment(id, {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
      });
      if (!updated) {
        res.status(404).json({ error: 'Request not found or not pending' });
        return;
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Upload failed' });
    }
  },

  approve: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const updated = await svc.approveDocumentRequest(id, await resolveAdminDisplayName(req));
      if (!updated) {
        res.status(404).json({ error: 'Request not found or cannot be approved' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? 'Approve failed' });
    }
  },

  reject: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const rejectionReason =
        typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
      if (!rejectionReason) {
        res.status(400).json({ error: 'Rejection reason is required' });
        return;
      }
      if (rejectionReason.length > 500) {
        res.status(400).json({ error: 'Rejection reason must be under 500 characters' });
        return;
      }
      const updated = await svc.rejectDocumentRequest(
        id,
        await resolveAdminDisplayName(req),
        rejectionReason
      );
      if (!updated) {
        res.status(404).json({ error: 'Request not found or cannot be rejected' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? 'Reject failed' });
    }
  },

  download: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const raw = await svc.getDocumentRequestRawById(id);
      if (!raw || raw.status !== 'Approved') {
        res.status(404).json({ error: 'Document not available' });
        return;
      }

      const isEmp = isEmployeeRole(req.user?.role ?? '');
      const isAdmin = isAdminRole(req.user?.role ?? '');
      if (isEmp && raw.employeeUserId !== req.user?.id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (!isEmp && !isAdmin) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const buf = svc.getFulfillmentForDownload(raw);
      if (!buf || !raw.fulfillmentFile) {
        res.status(404).json({ error: 'File not found on record' });
        return;
      }

      res.setHeader('Content-Type', raw.fulfillmentFile.contentType);
      const { documentDownloadFileName } = await import('../utils/exportFileName');
      const downloadName = documentDownloadFileName(raw.documentName, raw.documentType);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.send(buf);
    } catch {
      res.status(500).json({ error: 'Download failed' });
    }
  },
};
