import { Router } from 'express'
import { payslipController } from '../controllers/payslipController'

export const payslipRoutes = Router()

// Generate payslips for all employees
payslipRoutes.post('/generate-all', payslipController.generatePayslips)

// Generate payslip for a single employee
payslipRoutes.post('/generate', payslipController.generatePayslip)
