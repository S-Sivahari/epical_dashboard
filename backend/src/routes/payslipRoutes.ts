import { Router } from 'express'
import { payslipController } from '../controllers/payslipController'

export const payslipRoutes = Router()

// Generate payslips for all employees → saved to MongoDB
payslipRoutes.post('/generate-all', payslipController.generatePayslips)

// Generate payslip for a single employee → saved to MongoDB
payslipRoutes.post('/generate', payslipController.generatePayslip)

// Get all payslips (query params: ?empId=&payMonth=)
payslipRoutes.get('/', payslipController.getPayslips)

// Download a payslip .docx file by MongoDB _id
payslipRoutes.get('/download/:id', payslipController.downloadPayslip)
