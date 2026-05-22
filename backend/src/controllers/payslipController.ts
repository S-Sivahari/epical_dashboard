import { Request, Response } from 'express'
import { existsSync } from 'fs'
import { savePayslipAsPdf } from '../services/payslipPdfGenerator'
import {
  generatePayrollTemplateBuffer,
  PAYROLL_TEMPLATE_FILENAME,
} from '../services/payrollTemplate'
import {
  processPayrollUpload,
  getPayrollBatch,
  getLatestPayrollBatch,
  listPayrollBatches,
  readBatchExcel,
  getPayslipFilePath,
  getPayslipsDir,
  deletePayrollBatch,
  deletePayslipFromBatch,
  sendAllPayslipsInBatch,
} from '../services/payrollBatchService'
import { join } from 'path'
import { AuthRequest } from '../middleware/authMiddleware'
import {
  sendPayslipToEmployee,
  getPayslipsForEmployeeEmail,
  getPayslipByIdForEmployee,
} from '../services/employeePayslipService'
import { getPayrollBatch as fetchBatch } from '../services/payrollBatchService'
import { createNotification } from '../services/notificationService'
import { getDB } from '../config/db'

function getUserCollection() {
  return getDB().collection('users')
}

async function notifyAdminsAndEmployee(params: {
  employeeDbId: string
  employeeName: string
  payMonth: string
  payslipId: string
  batchId: string
}): Promise<void> {
  const { employeeDbId, employeeName, payMonth, payslipId, batchId } = params

  // Notify the employee
  await createNotification({
    recipientId: employeeDbId,
    recipientType: 'Employee',
    type: 'PayslipSent',
    title: 'Payslip Received',
    message: `Your payslip for ${payMonth} has been published. You can download it from the Payslips section.`,
    relatedData: { employeeId: employeeDbId, employeeName, payslipId, batchId, payMonth },
  })

  // Notify all admins
  const admins = await getUserCollection().find({ role: 'Admin' }).toArray()
  for (const admin of admins) {
    await createNotification({
      recipientId: String(admin.id),
      recipientType: 'Admin',
      type: 'PayslipSent',
      title: 'Payslip Sent',
      message: `Payslip for ${employeeName} (${payMonth}) has been sent successfully.`,
      relatedData: { employeeId: employeeDbId, employeeName, payslipId, batchId, payMonth },
    })
  }
}

export const payslipController = {
  /** Always-available demo Excel template */
  downloadTemplate: async (_req: Request, res: Response): Promise<void> => {
    const buffer = await generatePayrollTemplateBuffer()
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${PAYROLL_TEMPLATE_FILENAME}"`)
    res.send(buffer)
  },

  /** Upload payroll Excel (template or custom format), generate PDF payslips */
  uploadAndProcess: async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file
      if (!file) {
        res.status(400).json({ error: 'No Excel file uploaded' })
        return
      }

      const batch = await processPayrollUpload(file.buffer, file.originalname)

      res.json({
        message: 'Payroll processed successfully',
        batch,
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
      const batch = await getPayrollBatch(req.params.batchId)
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
      const batch = await getPayrollBatch(req.params.batchId)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }
      
      try {
        const buffer = readBatchExcel(req.params.batchId)
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${batch.originalFileName || 'payroll.xlsx'}"`
        )
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
      const { batchId, fileName } = req.params
      const batch = await getPayrollBatch(batchId)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }

      const filePath = getPayslipFilePath(batchId, fileName)
      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'Payslip file not found' })
        return
      }

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`)
      res.sendFile(filePath)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to download payslip'
      res.status(500).json({ error: message })
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

      const filePath = getPayslipFilePath(batchId, fileName)
      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'Payslip PDF not found' })
        return
      }

      const record = await sendPayslipToEmployee({
        batchId,
        fileName,
        empId,
        payMonth: batch.payMonth,
        employeeDbId,
      })

      // Fire notifications for employee + admins
      await notifyAdminsAndEmployee({
        employeeDbId: record.employeeDbId,
        employeeName: record.employeeName,
        payMonth: record.payMonth,
        payslipId: record.id,
        batchId: record.batchId,
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

      if (!batchId) {
        res.status(400).json({ error: 'batchId is required' })
        return
      }

      const batch = await getPayrollBatch(batchId)
      if (!batch) {
        res.status(404).json({ error: 'Payroll batch not found' })
        return
      }

      const result = await sendAllPayslipsInBatch(
        batchId,
        employeeDbIdByEmpId ?? {}
      )

      // Fire notifications for each successfully sent payslip
      const sentRecords = await getDB()
        .collection('employee_payslips')
        .find({ batchId })
        .toArray()
      for (const rec of sentRecords) {
        await notifyAdminsAndEmployee({
          employeeDbId: String(rec.employeeDbId),
          employeeName: String(rec.employeeName),
          payMonth: String(rec.payMonth),
          payslipId: String(rec.id),
          batchId: String(rec.batchId),
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
      const payslips = await getPayslipsForEmployeeEmail(req.user.email)
      res.json(payslips)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load payslips'
      res.status(500).json({ error: message })
    }
  },

  /** Employee: download a payslip PDF from dashboard */
  downloadMyPayslip: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.email) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      const record = await getPayslipByIdForEmployee(req.params.payslipId, req.user.email)
      if (!record) {
        res.status(404).json({ error: 'Payslip not found' })
        return
      }
      const filePath = getPayslipFilePath(record.batchId, record.fileName)
      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'Payslip file not found' })
        return
      }
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${record.fileName}"`
      )
      res.sendFile(filePath)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to download payslip'
      res.status(500).json({ error: message })
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
      const { company, structure, employees } = readMasterExcelFromBuffer(buffer)
      const emp = employees.find((e) => String(e['Emp ID']) === String(empId))

      if (!emp) {
        res.status(404).json({ error: `Employee ${empId} not found in payroll file` })
        return
      }

      const fileName = `Payslip_${String(empId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
      const filePath = join(getPayslipsDir(batchId), fileName)
      await savePayslipAsPdf(company, structure, emp, filePath)

      res.json({
        message: 'Payslip generated successfully',
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
      const { batchId } = req.params
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
      const { batchId, fileName } = req.params
      const batch = await deletePayslipFromBatch(batchId, fileName)
      res.json({ message: 'Payslip deleted successfully', batch })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete payslip'
      const status = message.includes('not found') || message.includes('Invalid') ? 404 : 500
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
      const batch = await processPayrollUpload(buffer, excelPath.split(/[/\\]/).pop() || 'payroll.xlsx')

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
