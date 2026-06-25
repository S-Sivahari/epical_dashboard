import { Router } from 'express'
import multer from 'multer'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { payslipController } from '../controllers/payslipController'
import { authMiddleware, requireRole } from '../middleware/authMiddleware'
import { createImageUpload } from '../utils/imageUploadFilter'

export const payslipRoutes = Router()

/** Max 10 payslip resend emails per employee per hour. */
const payslipResendEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.id?.trim()
    if (userId) return `payslip-resend:${userId}`
    const ip = req.ip
    if (!ip) return 'payslip-resend:ip:unknown'
    return `payslip-resend:ip:${ipKeyGenerator(ip)}`
  },
  message: {
    error: 'You can only request payslip emails 10 times per hour. Please try again later.',
  },
})

const imageUpload = createImageUpload({ maxFileSize: 2 * 1024 * 1024 })

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
payslipRoutes.post(
  '/my-payslips/:payslipId/resend-email',
  authMiddleware,
  payslipResendEmailLimiter,
  payslipController.resendMyPayslipEmail
)

// Admin: payslip send history
payslipRoutes.get('/send-history', ...adminOnly, payslipController.getSendHistory)

// Template management (admin only)
payslipRoutes.get('/template', ...adminOnly, payslipController.downloadTemplate)
payslipRoutes.get('/template/meta', ...adminOnly, payslipController.getTemplateMeta)
payslipRoutes.post('/template/upload', ...adminOnly, excelUpload.single('template'), payslipController.uploadCustomTemplate)
payslipRoutes.get('/template/logo', ...adminOnly, payslipController.getCompanyLogo)
payslipRoutes.get('/template/logo/meta', ...adminOnly, payslipController.getCompanyLogoMeta)
payslipRoutes.post(
  '/template/logo/upload',
  ...adminOnly,
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
