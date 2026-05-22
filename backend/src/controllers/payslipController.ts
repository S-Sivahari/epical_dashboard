import { Request, Response } from 'express'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { readMasterExcel, buildPayslip, savePayslipAsDocx } from '../services/payslipGenerator'

export const payslipController = {
  // Generate payslip for all employees from Excel master file
  generatePayslips: async (req: Request, res: Response): Promise<void> => {
    try {
      const { excelPath, outputDir } = req.body

      if (!excelPath) {
        res.status(400).json({ error: 'Excel path is required' })
        return
      }

      if (!existsSync(excelPath)) {
        res.status(400).json({ error: `Excel file not found: ${excelPath}` })
        return
      }

      // Read master Excel file
      const { company, structure, employees } = readMasterExcel(excelPath)

      if (employees.length === 0) {
        res.status(400).json({ error: 'No employees found in Excel file' })
        return
      }

      // Create output directory if it doesn't exist
      const outDir = outputDir || join(process.cwd(), 'payslips')
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }

      // Generate payslips
      const results = []
      for (const emp of employees) {
        try {
          const doc = buildPayslip(company, structure, emp)
          const empId = emp['Emp ID'] || 'Unknown'
          const fileName = `Payslip_${empId}_${Date.now()}.docx`
          const filePath = join(outDir, fileName)

          await savePayslipAsDocx(doc, filePath)
          results.push({
            empId,
            name: emp['Name'],
            status: 'success',
            filePath,
            fileName,
          })
        } catch (error: any) {
          results.push({
            empId: emp['Emp ID'],
            name: emp['Name'],
            status: 'error',
            error: error.message,
          })
        }
      }

      res.json({
        message: 'Payslips generated successfully',
        outputDir: outDir,
        results,
        totalGenerated: results.filter((r) => r.status === 'success').length,
        totalFailed: results.filter((r) => r.status === 'error').length,
      })
    } catch (error: any) {
      console.error('Error generating payslips:', error)
      res.status(500).json({ error: error.message || 'Failed to generate payslips' })
    }
  },

  // Generate single payslip for an employee
  generatePayslip: async (req: Request, res: Response): Promise<void> => {
    try {
      const { excelPath, empId, outputDir } = req.body

      if (!excelPath || !empId) {
        res.status(400).json({ error: 'Excel path and employee ID are required' })
        return
      }

      if (!existsSync(excelPath)) {
        res.status(400).json({ error: `Excel file not found: ${excelPath}` })
        return
      }

      // Read master Excel file
      const { company, structure, employees } = readMasterExcel(excelPath)

      // Find employee
      const emp = employees.find((e) => String(e['Emp ID']) === String(empId))
      if (!emp) {
        res.status(404).json({ error: `Employee ${empId} not found` })
        return
      }

      // Create output directory if it doesn't exist
      const outDir = outputDir || join(process.cwd(), 'payslips')
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }

      // Generate payslip
      const doc = buildPayslip(company, structure, emp)
      const fileName = `Payslip_${empId}_${Date.now()}.docx`
      const filePath = join(outDir, fileName)

      await savePayslipAsDocx(doc, filePath)

      res.json({
        message: 'Payslip generated successfully',
        empId,
        name: emp['Name'],
        filePath,
        fileName,
      })
    } catch (error: any) {
      console.error('Error generating payslip:', error)
      res.status(500).json({ error: error.message || 'Failed to generate payslip' })
    }
  },
}
