import mongoose, { Schema, Document } from 'mongoose'

export interface IEmployeePayslip extends Document {
  empId: string
  name: string
  payMonth: string
  payDate: string
  grossEarnings: number
  totalDeductions: number
  netPay: number
  earnings: { name: string; amount: number }[]
  deductions: { name: string; amount: number }[]
  fileData: string       // Base64-encoded .docx
  fileName: string
  contentType: string
  generatedAt: Date
}

const EarningItemSchema = new Schema(
  { name: { type: String }, amount: { type: Number } },
  { _id: false }
)

const EmployeePayslipSchema = new Schema<IEmployeePayslip>(
  {
    empId:            { type: String, required: true, index: true },
    name:             { type: String, required: true },
    payMonth:         { type: String, required: true },
    payDate:          { type: String },
    grossEarnings:    { type: Number, default: 0 },
    totalDeductions:  { type: Number, default: 0 },
    netPay:           { type: Number, default: 0 },
    earnings:         { type: [EarningItemSchema], default: [] },
    deductions:       { type: [EarningItemSchema], default: [] },
    fileData:         { type: String, required: true },   // Base64 .docx content
    fileName:         { type: String, required: true },
    contentType:      { type: String, default: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    generatedAt:      { type: Date, default: Date.now },
  },
  {
    collection: 'employee_payslip',
    timestamps: true,
  }
)

// Compound index: one payslip per employee per pay month
EmployeePayslipSchema.index({ empId: 1, payMonth: 1 })

export const EmployeePayslip = mongoose.model<IEmployeePayslip>(
  'EmployeePayslip',
  EmployeePayslipSchema
)
