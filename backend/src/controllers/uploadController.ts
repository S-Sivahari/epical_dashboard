import { Response } from 'express';
import * as employeeService from '../services/employeeService';
import { AuthRequest } from '../middleware/authMiddleware';
import { rejectUnlessAdmin, rejectUnlessAdminOrSelf } from '../utils/accessControl';
import { IMAGE_UPLOAD_ERROR, isAllowedImageUpload } from '../utils/imageUploadFilter';

export const uploadController = {
  listDocuments: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      if (!(await rejectUnlessAdminOrSelf(req, res, id))) return;

      const employee = await employeeService.getEmployeeProfileById(id);
      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const documents = Object.entries(employee.documents ?? {})
        .filter(([, doc]) => Boolean(doc))
        .map(([key, doc]: [string, any]) => ({
          key,
          name: doc.filename,
          uploadedAt: doc.uploadedAt,
          url: `/employees/${id}/documents/${key}`,
        }));

      res.json(documents);
    } catch (error: any) {
      console.error('Error listing documents:', error);
      res.status(500).json({ error: error?.message ?? 'Failed to list documents' });
    }
  },

  uploadDocuments: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!rejectUnlessAdmin(req, res)) return;
      const { id } = req.params as { id: string };
      const files = (req as any).files as { [fieldname: string]: Express.Multer.File[] };

      if (!files || Object.keys(files).length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const documents: any = {};

      for (const [fieldName, fileArray] of Object.entries(files)) {
        const file = fileArray[0];
        if (file) {
          documents[fieldName] = {
            filename: file.originalname,
            data: file.buffer.toString('base64'),
            contentType: file.mimetype,
            uploadedAt: new Date(),
          };
        }
      }

      const existingEmployee = await employeeService.getEmployeeById(id, { includeBlobs: true });

      if (!existingEmployee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const employee = await employeeService.updateEmployee(id, {
        documents: {
          ...(existingEmployee.documents ?? {}),
          ...documents,
        },
      });

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json({ message: 'Documents uploaded successfully', documents: employee.documents });
    } catch (error: any) {
      console.error('Error uploading documents:', error);
      res.status(500).json({ error: error?.message ?? 'Failed to upload documents' });
    }
  },

  uploadPhoto: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      if (!(await rejectUnlessAdminOrSelf(req, res, id))) return;
      const file = (req as any).file;

      if (!file) {
        res.status(400).json({ error: 'No photo uploaded' });
        return;
      }

      if (!isAllowedImageUpload(file)) {
        res.status(400).json({ error: IMAGE_UPLOAD_ERROR });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        res.status(400).json({ error: 'Photo must be under 2 MB' });
        return;
      }

      const photo = {
        filename: file.originalname,
        data: file.buffer.toString('base64'),
        contentType: file.mimetype,
        uploadedAt: new Date(),
      };

      const employee = await employeeService.updateEmployee(id, { photo });

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const hasPhoto = Boolean((employee as any).photo?.data || (employee as any).photo?.filename);
      res.json({ message: 'Photo uploaded successfully', hasPhoto });
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      res.status(500).json({ error: error?.message ?? 'Failed to upload photo' });
    }
  },

  getDocument: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id, docType } = req.params as { id: string; docType: string };
      if (!(await rejectUnlessAdminOrSelf(req, res, id))) return;

      const doc = await employeeService.getEmployeeDocumentBlob(id, docType);

      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const buffer = Buffer.from(doc.data, 'base64');
      res.setHeader('Content-Type', doc.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error('Error fetching document:', error);
      res.status(500).json({ error: error?.message ?? 'Failed to fetch document' });
    }
  },

  deleteDocument: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!rejectUnlessAdmin(req, res)) return;
      const { id, docType } = req.params as { id: string; docType: string };
      const deleted = await employeeService.deleteEmployeeDocument(id, docType);

      if (!deleted) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting document:', error);
      res.status(500).json({ error: error?.message ?? 'Failed to delete document' });
    }
  },

  getPhoto: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      if (!(await rejectUnlessAdminOrSelf(req, res, id))) return;

      const employee = await employeeService.getEmployeeById(id, { includeBlobs: true });

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      if (!employee.photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      const photoData = (employee.photo as any).data;
      const photoFilename = (employee.photo as any).filename;
      const photoContentType = (employee.photo as any).contentType;

      if (!photoData) {
        res.status(500).json({ error: 'Photo data is corrupted or missing' });
        return;
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(photoData, 'base64');
      } catch {
        res.status(500).json({ error: 'Failed to process photo data' });
        return;
      }

      res.setHeader('Content-Type', photoContentType || 'image/jpeg');
      res.setHeader('Content-Disposition', `inline; filename="${photoFilename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (error: any) {
      console.error('Error fetching photo:', error);
      res.status(500).json({ error: error?.message ?? 'Failed to fetch photo' });
    }
  },
};
