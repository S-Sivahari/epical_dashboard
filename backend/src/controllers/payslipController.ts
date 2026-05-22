import { Request, Response } from 'express'
import { existsSync } from 'fs'
import { readMasterExcel, buildPayslip, savePayslipToBuffer } from '../services/payslipGenerator'
import { EmployeePayslip } from '../models/EmployeePayslip'

export const payslipController = {
  // Generate payslips for all employees from Excel master file → save to MongoDB
  generatePayslips: async (req: Request, res: Response): Promise<void> => {
    try {
      const { excelPath } = req.body

      if (!excelPath) {
        res.status(400).json({ error: 'Excel path is required' })
        return
      }

      if (!existsSync(excelPath)) {
        res.status(400).json({ error: `Excel file not found: ${excelPath}` })
        return
      }

      const { company, structure, employees } = readMasterExcel(excelPath)

      if (employees.length === 0) {
        res.status(400).json({ error: 'No employees found in Excel file' })
        return
      }

      const results = []
      for (const emp of employees) {
        try {
          const doc = buildPayslip(company, structure, emp)
          const empId = String(emp['Emp ID'] || 'Unknown')
          const payMonth = String(company['Pay Month'] || '')
          const fileName = `Payslip_${empId}_${payMonth.replace(/\s+/g, '_')}.docx`

          const buffer = await savePayslipToBuffer(doc)
          const fileData = buffer.toString('base64')

          // Build earnings/deductions summaries
          const earnings = Object.entries({
            'Basic Salary': emp['Basic Salary'],
            HRA: emp['HRA'],
            Conveyance: emp['Conveyance'],
            'Sundry Medical': emp['Sundry Medical'],
            LTA: emp['LTA'],
            'Variable Allowance': emp['Variable Allowance'],
            'Personal Allowance': emp['Personal Allowance'],
            'Special Allowance': emp['Special Allowance'],
            Reimbursements: emp['Reimbursements'],
          }).map(([name, amount]) => ({ name, amount: parseFloat(String(amount || 0)) }))

          const deductions = Object.entries({
            PT: emp['PT'],
            TDS: emp['TDS'],
            'Loan Recovery': emp['Loan Recovery'],
            'Loss of Pay': emp['LOP Days'],
          }).map(([name, amount]) => ({ name, amount: parseFloat(String(amount || 0)) }))

          const grossEarnings = earnings.reduce((s, e) => s + e.amount, 0)
          const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
          const netPay = grossEarnings - totalDeductions

          // Upsert: replace if same empId + payMonth already exists
          await EmployeePayslip.findOneAndUpdate(
            { empId, payMonth },
            {
              empId,
              name: emp['Name'],
              payMonth,
              payDate: String(company['Pay Date'] || ''),
              grossEarnings,
              totalDeductions,
              netPay,
              earnings,
              deductions,
              fileData,
              fileName,
              generatedAt: new Date(),
            },
            { upsert: true, new: true }
          )

          results.push({ empId, name: emp['Name'], status: 'success', fileName })
        } catch (error: any) {
          results.push({ empId: emp['Emp ID'], name: emp['Name'], status: 'error', error: error.message })
        }
      }

      res.json({
        message: 'Payslips generated and saved to MongoDB (employee_payslip)',
        results,
        totalGenerated: results.filter((r) => r.status === 'success').length,
        totalFailed: results.filter((r) => r.status === 'error').length,
      })
    } catch (error: any) {
      console.error('Error generating payslips:', error)
      res.status(500).json({ error: error.message || 'Failed to generate payslips' })
    }
  },

  // Generate single payslip for an employee → save to MongoDB
  generatePayslip: async (req: Request, res: Response): Promise<void> => {
    try {
      const { excelPath, empId } = req.body

      if (!excelPath || !empId) {
        res.status(400).json({ error: 'Excel path and employee ID are required' })
        return
      }

      if (!existsSync(excelPath)) {
        res.status(400).json({ error: `Excel file not found: ${excelPath}` })
        return
      }

      const { company, structure, employees } = readMasterExcel(excelPath)

      const emp = employees.find((e) => String(e['Emp ID']) === String(empId))
      if (!emp) {
        res.status(404).json({ error: `Employee ${empId} not found` })
        return
      }

      const doc = buildPayslip(company, structure, emp)
      const payMonth = String(company['Pay Month'] || '')
      const fileName = `Payslip_${empId}_${payMonth.replace(/\s+/g, '_')}.docx`

      const buffer = await savePayslipToBuffer(doc)
      const fileData = buffer.toString('base64')

      const earnings = Object.entries({
        'Basic Salary': emp['Basic Salary'],
        HRA: emp['HRA'],
        Conveyance: emp['Conveyance'],
        'Sundry Medical': emp['Sundry Medical'],
        LTA: emp['LTA'],
        'Variable Allowance': emp['Variable Allowance'],
        'Personal Allowance': emp['Personal Allowance'],
        'Special Allowance': emp['Special Allowance'],
        Reimbursements: emp['Reimbursements'],
      }).map(([name, amount]) => ({ name, amount: parseFloat(String(amount || 0)) }))

      const deductions = Object.entries({
        PT: emp['PT'],
        TDS: emp['TDS'],
        'Loan Recovery': emp['Loan Recovery'],
        'Loss of Pay': emp['LOP Days'],
      }).map(([name, amount]) => ({ name, amount: parseFloat(String(amount || 0)) }))

      const grossEarnings = earnings.reduce((s, e) => s + e.amount, 0)
      const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
      const netPay = grossEarnings - totalDeductions

      const saved = await EmployeePayslip.findOneAndUpdate(
        { empId: String(empId), payMonth },
        {
          empId: String(empId),
          name: emp['Name'],
          payMonth,
          payDate: String(company['Pay Date'] || ''),
          grossEarnings,
          totalDeductions,
          netPay,
          earnings,
          deductions,
          fileData,
          fileName,
          generatedAt: new Date(),
        },
        { upsert: true, new: true }
      )

      res.json({
        message: 'Payslip generated and saved to MongoDB (employee_payslip)',
        empId,
        name: emp['Name'],
        payMonth,
        fileName,
        _id: saved._id,
      })
    } catch (error: any) {
      console.error('Error generating payslip:', error)
      res.status(500).json({ error: error.message || 'Failed to generate payslip' })
    }
  },

  // Get all payslips (optionally filter by empId)
  getPayslips: async (req: Request, res: Response): Promise<void> => {
    try {
      const { empId, payMonth } = req.query
      const filter: any = {}
      if (empId) filter.empId = String(empId)
      if (payMonth) filter.payMonth = String(payMonth)

      const payslips = await EmployeePayslip.find(filter)
        .select('-fileData') // exclude the heavy Base64 blob from list
        .sort({ generatedAt: -1 })

      res.json({ payslips, total: payslips.length })
    } catch (error: any) {
      console.error('Error fetching payslips:', error)
      res.status(500).json({ error: error.message || 'Failed to fetch payslips' })
    }
  },

  // Download a single payslip .docx by its MongoDB _id
  downloadPayslip: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const payslip = await EmployeePayslip.findById(id)

      if (!payslip) {
        res.status(404).json({ error: 'Payslip not found' })
        return
      }

      const buffer = Buffer.from(payslip.fileData, 'base64')
      res.setHeader('Content-Type', payslip.contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${payslip.fileName}"`)
      res.send(buffer)
    } catch (error: any) {
      console.error('Error downloading payslip:', error)
      res.status(500).json({ error: error.message || 'Failed to download payslip' })
    }
  },
}
