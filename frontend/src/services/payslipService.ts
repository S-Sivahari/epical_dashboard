import api from '@services/api'

export interface PayslipResult {
  empId: string
  name: string
  status: 'success' | 'error'
  fileName?: string
  error?: string
  sent?: boolean
}

export interface EmployeeDashboardPayslip {
  id: string
  employeeId: string
  payMonth: string
  fileName: string
  sentAt: string
}

export interface PayrollBatch {
  id: string
  originalFileName: string
  uploadedAt: string
  payMonth?: string
  employeeCount: number
  totalGenerated: number
  totalFailed: number
  results: PayslipResult[]
}

const base = '/payslips'

export async function downloadPayrollTemplate(): Promise<void> {
  const response = await api.get(`${base}/template`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'payroll_master_template.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function uploadPayroll(file: File): Promise<PayrollBatch> {
  const formData = new FormData()
  formData.append('payroll', file)
  const response = await api.post<{ batch: PayrollBatch }>(`${base}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
  return response.data.batch
}

export async function getLatestPayrollBatch(): Promise<PayrollBatch | null> {
  try {
    const response = await api.get<PayrollBatch>(`${base}/batches/latest`)
    return response.data
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) return null
    throw err
  }
}

export async function getPayrollBatch(batchId: string): Promise<PayrollBatch> {
  const response = await api.get<PayrollBatch>(`${base}/batches/${batchId}`)
  return response.data
}

export async function openPayslipPdf(batchId: string, fileName: string): Promise<void> {
  const response = await api.get(`${base}/batches/${batchId}/payslips/${encodeURIComponent(fileName)}`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function downloadUploadedExcel(batchId: string, fileName: string): Promise<void> {
  const response = await api.get(`${base}/batches/${batchId}/excel`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(
    new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  )
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export interface SendAllPayslipsResult {
  batch: PayrollBatch
  sent: number
  skipped: number
  failed: { empId: string; name: string; error: string }[]
}

export async function sendAllPayslipsToDashboard(
  batchId: string,
  employeeDbIdByEmpId?: Record<string, string>
): Promise<SendAllPayslipsResult> {
  const response = await api.post<SendAllPayslipsResult>(`${base}/send-all`, {
    batchId,
    employeeDbIdByEmpId,
  })
  return response.data
}

export async function sendPayslipToDashboard(
  batchId: string,
  empId: string,
  fileName: string,
  employeeDbId?: string
): Promise<PayrollBatch> {
  const response = await api.post<{ batch: PayrollBatch }>(`${base}/send`, {
    batchId,
    empId,
    fileName,
    employeeDbId,
  })
  return response.data.batch
}

export async function getMyPayslips(): Promise<EmployeeDashboardPayslip[]> {
  const response = await api.get<EmployeeDashboardPayslip[]>(`${base}/my-payslips`)
  return response.data
}

export async function openMyPayslipPdf(payslipId: string): Promise<void> {
  const response = await api.get(`${base}/my-payslips/${payslipId}/download`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function deletePayrollBatch(batchId: string): Promise<void> {
  await api.delete(`${base}/batches/${batchId}`)
}

export async function deletePayslip(batchId: string, fileName: string): Promise<PayrollBatch> {
  const response = await api.delete<{ batch: PayrollBatch }>(
    `${base}/batches/${batchId}/payslips/${encodeURIComponent(fileName)}`
  )
  return response.data.batch
}
