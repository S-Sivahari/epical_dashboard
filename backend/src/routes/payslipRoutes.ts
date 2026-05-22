import { Router } from 'express'
import multer from 'multer'
import { payslipController } from '../controllers/payslipController'
import { authMiddleware } from '../middleware/authMiddleware'

export const payslipRoutes = Router()

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ]
    const ext = file.originalname.toLowerCase()
    if (
      allowed.includes(file.mimetype) ||
      ext.endsWith('.xlsx') ||
      ext.endsWith('.xls')
    ) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) files are allowed.'))
    }
  },
})

// Employee dashboard payslips (authenticated)
payslipRoutes.get('/my-payslips', authMiddleware, payslipController.getMyPayslips)
payslipRoutes.get(
  '/my-payslips/:payslipId/download',
  authMiddleware,
  payslipController.downloadMyPayslip
)

// Demo template (always available)
payslipRoutes.get('/template', payslipController.downloadTemplate)

// Upload payroll Excel and auto-generate PDF payslips
payslipRoutes.post('/upload', excelUpload.single('payroll'), payslipController.uploadAndProcess)

// Batch management
payslipRoutes.get('/batches', payslipController.listBatches)
payslipRoutes.get('/batches/latest', payslipController.getLatestBatch)
payslipRoutes.get('/batches/:batchId', payslipController.getBatch)
payslipRoutes.get('/batches/:batchId/excel', payslipController.downloadUploadedExcel)
payslipRoutes.get('/batches/:batchId/payslips/:fileName', payslipController.downloadPayslipPdf)
payslipRoutes.delete('/batches/:batchId', payslipController.deleteBatch)
payslipRoutes.delete(
  '/batches/:batchId/payslips/:fileName',
  payslipController.deletePayslip
)

// Send payslip to employee dashboard
payslipRoutes.post('/send', payslipController.sendPayslip)
payslipRoutes.post('/send-all', payslipController.sendAllPayslips)

// Regenerate single payslip from batch Excel
payslipRoutes.post('/generate', payslipController.generatePayslip)

// Legacy path-based batch (optional)
payslipRoutes.post('/generate-all', payslipController.generatePayslips)
