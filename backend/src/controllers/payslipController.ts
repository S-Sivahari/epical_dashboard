import { Request, Response } from 'express'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { COMPANY_LOGO_PATH, PAYROLL_TEMPLATE_DIR } from '../config/paths'
import { resolveLogoPath } from '../services/payslipPdfGenerator'
import { savePayslipAsPdf } from '../services/payslipPdfGenerator'
import {
  generatePayrollTemplateBuffer,
  PAYROLL_TEMPLATE_FILENAME,
} from '../services/payrollTemplate'
import {
  processPayrollUpload,
  findBatchByPayPeriod,
  findOverlappingEmpIds,
  getPayrollBatch,
  getLatestPayrollBatch,
  listPayrollBatches,
  readBatchExcel,
  getPayslipFilePath,
  ensurePayslipPdfExists,
  getPayslipsDir,
  deletePayrollBatch,
  deletePayslipFromBatch,
  sendAllPayslipsInBatch,
  mergeBatchPayslipPdfs,
  type PayrollBatch,
} from '../services/payrollBatchService'
import {
  formatAllPayslipsDownloadFileName,
  formatPayslipDownloadFileName,
  payrollMasterTemplateFileName,
  payrollUploadExcelFileName,
} from '../services/payslipDownloadName'
import { AuthRequest } from '../middleware/authMiddleware'
import {
  sendPayslipToEmployee,
  getPayslipsForAuthUser,
  getAllSentPayslips,
  resendPayslipEmailToEmployee,
  toEmployeePayslipSummary,
} from '../services/employeePayslipService'
import { getPayrollBatch as fetchBatch } from '../services/payrollBatchService'
import { createNotification, notifyAllAdmins } from '../services/notificationService'
import { getDB } from '../config/db'

function getUserCollection() {
  return getDB().collection('users')
}

const TEMPLATE_DIR = PAYROLL_TEMPLATE_DIR
const TEMPLATE_PATH = join(TEMPLATE_DIR, 'active_template.xlsx')

function templateMetaCollection() {
  return getDB().collection<{ name: string; uploadedAt: Date; size: number }>('payroll_template_meta')
}

function payslipDownloadNameForBatch(batch: PayrollBatch, storageFileName: string): string {
  const row = batch.results.find((r) => r.fileName === storageFileName)
  return formatPayslipDownloadFileName(row?.name ?? 'employee', batch.payMonth, batch.payPeriodKey)
}

async function notifyAdminsAndEmployee(params: {
  employeeDbId: string
  /** HR / payroll employee ID shown in emails (e.g. EPL-001) — not the internal users.id */
  employeeHrId: string
  employeeName: string
  employeeEmail: string
  payMonth: string
  payslipId: string
  batchId: string
  fileName?: string
  regenerated?: boolean
}): Promise<void> {
  const {
    employeeDbId,
    employeeHrId,
    employeeName,
    employeeEmail,
    payMonth,
    payslipId,
    batchId,
    fileName,
    regenerated,
  } = params

  const employeeType = regenerated ? 'PayslipRegenerated' : 'PayslipSent'
  const employeeTitle = regenerated ? 'Payslip Regenerated' : 'Payslip Received'
  const employeeMessage = regenerated
    ? `Your payslip for ${payMonth} has been regenerated. Check your email for the updated PDF, or use Send to email on the Payslips page if you need another copy.`
    : `Your payslip for ${payMonth} has been published. Check your email inbox for the PDF. You can request another copy from the Payslips section if needed.`

  await createNotification({
    recipientId: employeeDbId,
    recipientType: 'Employee',
    type: employeeType,
    title: employeeTitle,
    message: employeeMessage,
    relatedData: {
      employeeId: employeeHrId,
      employeeName,
      employeeEmail,
      payslipId,
      batchId,
      payMonth,
      fileName,
    },
  })

  await notifyAllAdmins({
    type: employeeType,
    title: regenerated ? 'Payslip Regenerated' : 'Payslip Sent',
    message: regenerated
      ? `Regenerated payslip for ${employeeName} (${payMonth}) has been sent to the employee dashboard.`
      : `Payslip for ${employeeName} (${payMonth}) has been sent successfully.`,
    relatedData: {
      employeeId: employeeHrId,
      employeeName,
      employeeEmail,
      payslipId,
      batchId,
      payMonth,
      fileName,
    },
  })
}

export const payslipController = {
  /** Download active template — custom if uploaded, else built-in demo */
  downloadTemplate: async (req: Request, res: Response): Promise<void> => {
    const includeEmployeeData = req.query.includeEmployeeData === 'true'
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    if (existsSync(TEMPLATE_PATH) && !includeEmployeeData) {
      const meta = await templateMetaCollection().findOne({}, { sort: { uploadedAt: -1 } })
      const name = payrollMasterTemplateFileName()
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
      const buffer = readFileSync(TEMPLATE_PATH)
      res.send(buffer)
    } else {
      const buffer = await generatePayrollTemplateBuffer({ includeEmployeeData })
      res.setHeader('Content-Disposition', `attachment; filename="${payrollMasterTemplateFileName()}"`)
      res.send(buffer)
    }
  },

  /** Upload a custom payroll Excel template */
  uploadCustomTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file
      if (!file) {
        res.status(400).json({ error: 'No Excel file uploaded' })
        return
      }
      if (!existsSync(TEMPLATE_DIR)) {
        mkdirSync(TEMPLATE_DIR, { recursive: true })
      }
      writeFileSync(TEMPLATE_PATH, file.buffer)
      await templateMetaCollection().deleteMany({})
      const meta = { name: file.originalname, uploadedAt: new Date(), size: file.size }
      await templateMetaCollection().insertOne(meta)
      res.json({ message: 'Template uploaded successfully', ...meta })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload template'
      res.status(500).json({ error: message })
    }
  },

  /** Upload company logo used on payslip PDFs (PNG/JPG/WebP). */
  uploadCompanyLogo: async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file
      if (!file) {
        res.status(400).json({ error: 'No image file uploaded' })
        return
      }
      if (!existsSync(TEMPLATE_DIR)) {
        mkdirSync(TEMPLATE_DIR, { recursive: true })
      }
      writeFileSync(COMPANY_LOGO_PATH, file.buffer)
      res.json({
        message: 'Company logo uploaded successfully',
        path: COMPANY_LOGO_PATH,
        hasLogo: true,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload logo'
      res.status(500).json({ error: message })
    }
  },

  /** Serve active company logo for admin preview. */
  getCompanyLogo: async (_req: Request, res: Response): Promise<void> => {
    try {
      const logoPath = resolveLogoPath({})
      if (!logoPath) {
        res.status(404).json({ error: 'No company logo uploaded yet' })
        return
      }
      const ext = logoPath.split('.').pop()?.toLowerCase()
      const type =
        ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/png'
      res.setHeader('Content-Type', type)
      res.setHeader('Cache-Control', 'private, max-age=300')
      res.sendFile(logoPath)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load logo'
      res.status(500).json({ error: message })
    }
  },

  /** Whether a payslip logo is configured. */
  getCompanyLogoMeta: async (_req: Request, res: Response): Promise<void> => {
    try {
      const logoPath = resolveLogoPath({})
      res.json({ hasLogo: !!logoPath, path: logoPath ?? undefined })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get logo info'
      res.status(500).json({ error: message })
    }
  },

  /** Get active template metadata */
  getTemplateMeta: async (_req: Request, res: Response): Promise<void> => {
    try {
      if (existsSync(TEMPLATE_PATH)) {
        const meta = await templateMetaCollection().findOne({}, { sort: { uploadedAt: -1 } })
        res.json({ hasCustom: true, name: meta?.name, uploadedAt: meta?.uploadedAt, size: meta?.size })
      } else {
        res.json({ hasCustom: false, name: PAYROLL_TEMPLATE_FILENAME })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get template info'
      res.status(500).json({ error: message })
    }
  },

  /** Upload payroll Excel (template or custom format), generate PDF payslips */
  uploadAndProcess: async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file
      if (!file) {
        res.status(400).json({ error: 'No Excel file uploaded' })
        return
      }

      const templateId = (req.body?.templateId as string) || 'classic'
      const replaceBatchId = String(req.body?.replaceBatchId || '').trim() || undefined
      const allowDuplicatePayPeriod =
        req.body?.allowDuplicatePayPeriod === true ||
        req.body?.allowDuplicatePayPeriod === 'true' ||
        req.body?.allowDuplicatePayPeriod === '1'
      const resendPayslips =
        req.body?.resendPayslips === true ||
        req.body?.resendPayslips === 'true' ||
        req.body?.resendPayslips === '1'

      const { readMasterExcelFromBuffer } = await import('../services/payslipGenerator')
      const parsed = await readMasterExcelFromBuffer(file.buffer)

      let appendToBatchId: string | undefined
      if (!replaceBatchId && !allowDuplicatePayPeriod) {
        const existing = await findBatchByPayPeriod(parsed.company)
        if (existing) {
          const enriched = await getPayrollBatch(existing.id)
          if (enriched) {
            const overlap = findOverlappingEmpIds(enriched, parsed.employees)
            if (overlap.length > 0) {
              res.status(409).json({
                code: 'DUPLICATE_PAY_PERIOD',
                error: `Payroll for ${existing.payMonth || 'this pay period'} already includes employee ID(s): ${overlap.slice(0, 5).join(', ')}${overlap.length > 5 ? '…' : ''}.`,
                payMonth: existing.payMonth,
                existingBatch: enriched,
                overlappingEmpIds: overlap,
              })
              return
            }
            appendToBatchId = existing.id
          }
        }
      }

      let employeeDbIdByEmpId: Record<string, string> = {}
      try {
        const raw = req.body?.employeeDbIdByEmpId
        if (typeof raw === 'string') employeeDbIdByEmpId = JSON.parse(raw) as Record<string, string>
        else if (raw && typeof raw === 'object') employeeDbIdByEmpId = raw as Record<string, string>
      } catch {
        employeeDbIdByEmpId = {}
      }

      const uploadResult = await processPayrollUpload(
        file.buffer,
        file.originalname,
        templateId as 'classic' | 'corporate' | 'minimal',
        {
          replaceBatchId,
          appendToBatchId,
          resendPayslips,
          employeeDbIdByEmpId,
        }
      )
      const { batch, replaced, resent } = uploadResult
      const structure = batch.salaryStructure ?? {}
      const earnings = Object.values(structure).filter((m) => m.section === 'Earnings').length
      const deductions = Object.values(structure).filter((m) => m.section === 'Deductions').length

      for (const record of resent) {
        await notifyAdminsAndEmployee({
          employeeDbId: record.employeeDbId,
          employeeHrId: record.employeeId,
          employeeName: record.employeeName,
          employeeEmail: record.employeeEmail,
          payMonth: record.payMonth,
          payslipId: record.id,
          batchId: record.batchId,
          fileName: record.fileName,
          regenerated: true,
        })
      }

      const { countPayslipsInMongo } = await import('../services/payslipStorageService')
      const storedInMongo = await countPayslipsInMongo(batch.id)

      res.json({
        message: replaced
          ? `Payroll replaced for ${batch.payMonth}${resent.length ? ` — ${resent.length} payslip(s) resent` : ''}`
          : 'Payroll processed successfully',
        batch,
        replaced,
        resentCount: resent.length,
        storedInMongo,
        salaryStructureSummary: {
          totalComponents: Object.keys(structure).length,
          earnings,
          deductions,
          sheet: 'salary structure',
        },
      })
    } catch (error: unknown) {
      console.error('Error processing payroll upload:', error)
      const message = error instanceof Error ? error.message : 'Failed to process payroll'
      res.status(400).json({ error: message })
    }
  },

  getLatestBatch: async (_req: Request, res: Response): Promise<void> => {
    try {
      const batch = await getLatestPayrollBatch()
      if (!batch) {
        res.status(404).json({ error: 'No payroll uploads yet' })
        return
      }
      res.json(batch)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch batch'
      res.status(500).json({ error: message })
    }
  },

  listBatches: async (_req: Request, res: Response): Promise<void> => {
    try {
      const batches = await listPayrollBatches()
      res.json(batches)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to list batches'
      res.status(500).json({ error: message })
    }
  },

  getBatch: async (req: Request, res: Response): Promise<void> => {
    try {
      const batch = await getPayrollBatch(req.params.batchId as string)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }
      res.json(batch)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch batch'
      res.status(500).json({ error: message })
    }
  },

  /** Download the uploaded payroll Excel for a batch */
  downloadUploadedExcel: async (req: Request, res: Response): Promise<void> => {
    try {
      const batch = await getPayrollBatch(req.params.batchId as string)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }
      
      try {
        const buffer = readBatchExcel(req.params.batchId as string)
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        const excelName = payrollUploadExcelFileName(batch.payMonth, batch.payPeriodKey)
        res.setHeader('Content-Disposition', `attachment; filename="${excelName}"`)
        res.send(buffer)
      } catch (error: unknown) {
        // Excel file doesn't exist (old batch), return graceful error
        res.status(404).json({ 
          error: 'Payroll file no longer available',
          details: 'This batch is old and the file may have been archived or removed'
        })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to download Excel'
      res.status(404).json({ error: message })
    }
  },

  /** Download a generated payslip PDF */
  downloadPayslipPdf: async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId } = req.params as any
      const fileName = decodeURIComponent(req.params.fileName as string)
      const batch = await getPayrollBatch(batchId)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }

      const filePath = await ensurePayslipPdfExists(batchId, fileName)
      const downloadName = payslipDownloadNameForBatch(batch, fileName)

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`)
      res.sendFile(filePath)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to download payslip'
      const status =
        message.includes('not found') || message.includes('Invalid payslip') ? 404 : 500
      res.status(status).json({ error: message })
    }
  },

  /** Publish payslip to employee documents dashboard */
  sendPayslip: async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId, empId, fileName, employeeDbId } = req.body

      if (!batchId || !empId || !fileName) {
        res.status(400).json({ error: 'batchId, empId, and fileName are required' })
        return
      }

      const batch = await fetchBatch(batchId)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }

      await ensurePayslipPdfExists(batchId, fileName)

      const { record, replaced } = await sendPayslipToEmployee({
        batchId,
        fileName,
        empId,
        payMonth: batch.payMonth,
        payPeriodKey: batch.payPeriodKey,
        employeeDbId,
      })

      // Fire notifications for employee + admins
      await notifyAdminsAndEmployee({
        employeeDbId: record.employeeDbId,
        employeeHrId: record.employeeId,
        employeeName: record.employeeName,
        employeeEmail: record.employeeEmail,
        payMonth: record.payMonth,
        payslipId: record.id,
        batchId: record.batchId,
        fileName: record.fileName,
        regenerated: replaced,
      })

      const updated = await fetchBatch(batchId)
      res.json({
        message: 'Payslip sent to employee dashboard',
        batch: updated,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send payslip'
      const status =
        message.includes('not found') || message.includes('No employee') ? 404 : 500
      res.status(status).json({ error: message })
    }
  },

  /** Send all unsent payslips in a batch to employee dashboards */
  sendAllPayslips: async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId, employeeDbIdByEmpId } = req.body
      const resend =
        req.body?.resend === true ||
        req.body?.resend === 'true' ||
        req.body?.resend === '1'

      if (!batchId) {
        res.status(400).json({ error: 'batchId is required' })
        return
      }

      const batch = await getPayrollBatch(batchId)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }

      const result = await sendAllPayslipsInBatch(batchId, employeeDbIdByEmpId ?? {}, { resend })

      for (const rec of result.sentRecords) {
        await notifyAdminsAndEmployee({
          employeeDbId: String(rec.employeeDbId),
          employeeHrId: String(rec.employeeId),
          employeeName: String(rec.employeeName),
          employeeEmail: String(rec.employeeEmail),
          payMonth: String(rec.payMonth),
          payslipId: String(rec.id),
          batchId: String(rec.batchId),
          fileName: String(rec.fileName),
          regenerated: resend,
        })
      }

      res.json({
        message: `Sent ${result.sent} payslip(s) to employee dashboards`,
        ...result,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send payslips'
      const status = message.includes('not found') ? 404 : 500
      res.status(status).json({ error: message })
    }
  },

  /** Employee: list payslips sent to their dashboard */
  getMyPayslips: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.email) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      const payslips = await getPayslipsForAuthUser(req.user.id, req.user.email)
      res.json(payslips.map(toEmployeePayslipSummary))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load payslips'
      res.status(500).json({ error: message })
    }
  },

  /** Employee: payslips are delivered by email only — no in-app download. */
  downloadMyPayslip: async (_req: AuthRequest, res: Response): Promise<void> => {
    res.status(403).json({
      error:
        'Payslips are delivered by email only. Check your inbox or use Send to email on the Payslips page.',
    })
  },

  /** Employee: resend payslip PDF to registered email */
  resendMyPayslipEmail: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.email) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      const result = await resendPayslipEmailToEmployee(
        req.params.payslipId as string,
        String(req.user.id),
        String(req.user.email),
      )
      res.json({ message: 'Payslip sent to your email', sentTo: result.sentTo })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send payslip email'
      const status = message === 'Payslip not found' ? 404 : 500
      res.status(status).json({ error: message })
    }
  },

  /** Regenerate payslips for one employee from an existing batch Excel */
  generatePayslip: async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId, empId } = req.body

      if (!batchId || !empId) {
        res.status(400).json({ error: 'batchId and empId are required' })
        return
      }

      const batch = await getPayrollBatch(batchId)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }

      const buffer = readBatchExcel(batchId)
      const { readMasterExcelFromBuffer } = await import('../services/payslipGenerator')
      const { company, structure, employees } = await readMasterExcelFromBuffer(buffer)
      const emp = employees.find((e) => String(e['Emp ID']) === String(empId))

      if (!emp) {
        res.status(404).json({ error: `Employee ${empId} not found in payroll file` })
        return
      }

      const { prepareEmployeeForPayslip } = await import('../services/payrollYtdService')
      const prepared = await prepareEmployeeForPayslip(company, structure, emp, batchId)

      const fileName = `Payslip_${String(empId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
      const filePath = join(getPayslipsDir(batchId), fileName)
      await savePayslipAsPdf(company, structure, prepared, filePath)
      const { upsertPayslipPdf } = await import('../services/payslipStorageService')
      const { readFileSync: readPdf } = await import('fs')
      await upsertPayslipPdf({
        batchId,
        fileName,
        empId: String(empId),
        payPeriodKey: batch.payPeriodKey,
        pdfBuffer: readPdf(filePath),
      })

      res.json({
        message: 'Payslip generated and saved to MongoDB (payslip_documents)',
        empId,
        name: emp['Name'],
        fileName,
        downloadUrl: `/api/payslips/batches/${batchId}/payslips/${fileName}`,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate payslip'
      res.status(500).json({ error: message })
    }
  },

  /** Delete entire batch: uploaded Excel + all generated payslips */
  deleteBatch: async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId } = req.params as any
      await deletePayrollBatch(batchId)
      res.json({ message: 'Payroll upload and payslips deleted successfully' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete payroll batch'
      const status = message.includes('not found') ? 404 : 500
      res.status(status).json({ error: message })
    }
  },

  /** Delete a single generated payslip PDF */
  deletePayslip: async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId, fileName } = req.params as any
      const batch = await deletePayslipFromBatch(batchId, fileName)
      res.json({ message: 'Payslip deleted successfully', batch })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete payslip'
      const status = message.includes('not found') || message.includes('Invalid') ? 404 : 500
      res.status(status).json({ error: message })
    }
  },

  /** Admin: full send history across all batches */
  getSendHistory: async (_req: Request, res: Response): Promise<void> => {
    try {
      const records = await getAllSentPayslips(200)
      res.json(records)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load send history'
      res.status(500).json({ error: message })
    }
  },

  /** Download all payslip PDFs in a batch merged into one file */
  downloadAllPayslipsPdf: async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId } = req.params as any
      const batch = await getPayrollBatch(batchId)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }

      const buffer = await mergeBatchPayslipPdfs(batchId)
      const filename = formatAllPayslipsDownloadFileName(batch.payMonth, batch.payPeriodKey)

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(buffer)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to merge payslips'
      const status =
        message.includes('not found') || message.includes('No payslip') ? 404 : 500
      res.status(status).json({ error: message })
    }
  },

  /** Download payslip PDF as attachment (saves file instead of opening inline) */
  downloadPayslipPdfAttachment: async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId } = req.params as any
      const fileName = decodeURIComponent(req.params.fileName as string)
      const batch = await getPayrollBatch(batchId)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }
      const filePath = await ensurePayslipPdfExists(batchId, fileName)
      const downloadName = payslipDownloadNameForBatch(batch, fileName)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`)
      res.sendFile(filePath)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to download payslip'
      const status =
        message.includes('not found') || message.includes('Invalid payslip') ? 404 : 500
      res.status(status).json({ error: message })
    }
  },

  /** Legacy: generate from server file path (kept for scripts) */
  generatePayslips: async (req: Request, res: Response): Promise<void> => {
    try {
      const { excelPath } = req.body

      if (!excelPath) {
        res.status(400).json({ error: 'excelPath is required, or use POST /api/payslips/upload' })
        return
      }

      if (!existsSync(excelPath)) {
        res.status(400).json({ error: `Excel file not found: ${excelPath}` })
        return
      }

      const { readFileSync } = await import('fs')
      const buffer = readFileSync(excelPath)
      const { batch } = await processPayrollUpload(
        buffer,
        excelPath.split(/[/\\]/).pop() || 'payroll.xlsx'
      )

      res.json({
        message: 'Payslips generated successfully',
        batch,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate payslips'
      res.status(500).json({ error: message })
    }
  },
}