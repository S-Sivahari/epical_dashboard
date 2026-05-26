import { Router } from 'express'
import multer from 'multer'
import { payslipController } from '../controllers/payslipController'
import { authMiddleware, requireRole } from '../middleware/authMiddleware'

export const payslipRoutes = Router()

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    const ext = file.originalname.toLowerCase()
    if (
      allowed.includes(file.mimetype) ||
      ext.endsWith('.png') ||
      ext.endsWith('.jpg') ||
      ext.endsWith('.jpeg') ||
      ext.endsWith('.webp')
    ) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, or WebP images are allowed.'))
    }
  },
})

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

const adminOnly = [authMiddleware, requireRole('Admin')] as const

// Employee dashboard payslips (authenticated)
payslipRoutes.get('/my-payslips', authMiddleware, payslipController.getMyPayslips)
payslipRoutes.get(
  '/my-payslips/:payslipId/download',
  authMiddleware,
  payslipController.downloadMyPayslip
)

// Admin: payslip send history
payslipRoutes.get('/send-history', ...adminOnly, payslipController.getSendHistory)

// Template management
payslipRoutes.get('/template', payslipController.downloadTemplate)
payslipRoutes.get('/template/meta', payslipController.getTemplateMeta)
payslipRoutes.post('/template/upload', excelUpload.single('template'), payslipController.uploadCustomTemplate)
payslipRoutes.get('/template/logo', payslipController.getCompanyLogo)
payslipRoutes.get('/template/logo/meta', payslipController.getCompanyLogoMeta)
payslipRoutes.post(
  '/template/logo/upload',
  imageUpload.single('logo'),
  payslipController.uploadCompanyLogo
)

// Upload payroll Excel and auto-generate PDF payslips
payslipRoutes.post('/upload', ...adminOnly, excelUpload.single('payroll'), payslipController.uploadAndProcess)

// Batch management
payslipRoutes.get('/batches', ...adminOnly, payslipController.listBatches)
payslipRoutes.get('/batches/latest', ...adminOnly, payslipController.getLatestBatch)
payslipRoutes.get('/batches/:batchId', ...adminOnly, payslipController.getBatch)
payslipRoutes.get('/batches/:batchId/excel', ...adminOnly, payslipController.downloadUploadedExcel)
payslipRoutes.get(
  '/batches/:batchId/payslips/download-all',
  ...adminOnly,
  payslipController.downloadAllPayslipsPdf
)
payslipRoutes.get('/batches/:batchId/payslips/:fileName', ...adminOnly, payslipController.downloadPayslipPdf)
payslipRoutes.get(
  '/batches/:batchId/payslips/:fileName/download',
  ...adminOnly,
  payslipController.downloadPayslipPdfAttachment
)
payslipRoutes.delete('/batches/:batchId', ...adminOnly, payslipController.deleteBatch)
payslipRoutes.delete(
  '/batches/:batchId/payslips/:fileName',
  ...adminOnly,
  payslipController.deletePayslip
)

// Send payslip to employee dashboard
payslipRoutes.post('/send', ...adminOnly, payslipController.sendPayslip)
payslipRoutes.post('/send-all', ...adminOnly, payslipController.sendAllPayslips)

// Regenerate single payslip from batch Excel
payslipRoutes.post('/generate', ...adminOnly, payslipController.generatePayslip)

// Legacy path-based batch (optional)
payslipRoutes.post('/generate-all', ...adminOnly, payslipController.generatePayslips)
