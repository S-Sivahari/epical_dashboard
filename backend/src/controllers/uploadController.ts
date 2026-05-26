import { Request, Response } from 'express';
import * as employeeService from '../services/employeeService';

export const uploadController = {
  // List uploaded documents for an employee
  listDocuments: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
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

  // Upload documents for an employee
  uploadDocuments: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const files = (req as any).files as { [fieldname: string]: Express.Multer.File[] };

      if (!files || Object.keys(files).length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const documents: any = {};

      // Process each uploaded file
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

  // Upload profile photo for an employee
  uploadPhoto: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const file = (req as any).file;

      if (!file) {
        res.status(400).json({ error: 'No photo uploaded' });
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

      res.json({ message: 'Photo uploaded successfully', photo: employee.photo });
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      res.status(500).json({ error: error?.message ?? 'Failed to upload photo' });
    }
  },

  // Get a specific document
  getDocument: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, docType } = req.params as { id: string; docType: string };

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

  // Delete a specific document
  deleteDocument: async (req: Request, res: Response): Promise<void> => {
    try {
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

  // Get profile photo
  getPhoto: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };

      const employee = await employeeService.getEmployeeById(id, { includeBlobs: true });

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      if (!employee.photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      const buffer = Buffer.from(employee.photo.data, 'base64');
      res.setHeader('Content-Type', employee.photo.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${employee.photo.filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error('Error fetching photo:', error);
      res.status(500).json({ error: error?.message ?? 'Failed to fetch photo' });
    }
  },
};
