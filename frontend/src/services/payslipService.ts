import api from '@services/api'

export type TemplateId = 'classic' | 'corporate' | 'minimal'

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
  /** Present when the API includes payroll breakdown fields */
  status?: 'Paid' | 'Pending'
  netSalary?: number | string
  basicPay?: number | string
  allowances?: number | string
  bonuses?: number | string
  deductions?: number | string
  employeeName?: string
}

export interface PayrollBatch {
  id: string
  originalFileName: string
  uploadedAt: string
  payMonth?: string
  templateId?: TemplateId
  employeeCount: number
  totalGenerated: number
  totalFailed: number
  totalSent?: number
  results: PayslipResult[]
}

export interface SendHistoryEntry {
  id: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  employeeDbId: string
  batchId: string
  fileName: string
  payMonth: string
  sentAt: string
}

const base = '/payslips'

export async function downloadPayrollTemplate(filename?: string): Promise<void> {
  const response = await api.get(`${base}/template`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename || 'payroll_master_template.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function uploadPayroll(file: File, templateId: TemplateId = 'classic'): Promise<PayrollBatch> {
  const formData = new FormData()
  formData.append('payroll', file)
  formData.append('templateId', templateId)
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

export async function listBatches(): Promise<PayrollBatch[]> {
  const response = await api.get<PayrollBatch[]>(`${base}/batches`)
  return response.data
}

export async function openPayslipPdf(batchId: string, fileName: string): Promise<string> {
  const response = await api.get(`${base}/batches/${batchId}/payslips/${encodeURIComponent(fileName)}`, {
    responseType: 'blob',
  })
  return window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
}

export async function downloadAllPayslipPdfs(
  batchId: string,
  payMonth?: string
): Promise<void> {
  const response = await api.get(`${base}/batches/${batchId}/payslips/download-all`, {
    responseType: 'blob',
    timeout: 120000,
  })
  const monthLabel = (payMonth || 'payslips').replace(/[^a-zA-Z0-9_-]/g, '_')
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `All_Payslips_${monthLabel}.pdf`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadPayslipPdf(batchId: string, fileName: string, downloadName?: string): Promise<void> {
  const response = await api.get(
    `${base}/batches/${batchId}/payslips/${encodeURIComponent(fileName)}/download`,
    { responseType: 'blob' }
  )
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', downloadName || fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
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
  const url = await fetchMyPayslipPdfUrl(payslipId)
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function fetchMyPayslipPdfUrl(payslipId: string): Promise<string> {
  const response = await api.get(`${base}/my-payslips/${payslipId}/download`, {
    responseType: 'blob',
  })
  return window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
}

export async function downloadMyPayslipPdf(
  payslipId: string,
  downloadName?: string,
): Promise<void> {
  const response = await api.get(`${base}/my-payslips/${payslipId}/download`, {
    responseType: 'blob',
  })
  const fileName = downloadName || `payslip-${payslipId}.pdf`
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
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

export async function getSendHistory(): Promise<SendHistoryEntry[]> {
  const response = await api.get<SendHistoryEntry[]>(`${base}/send-history`)
  return response.data
}

// ── Template management ───────────────────────────────────────────────────

export interface TemplateMeta {
  hasCustom: boolean
  name?: string
  uploadedAt?: string
  size?: number
}

export async function getTemplateMeta(): Promise<TemplateMeta> {
  const response = await api.get<TemplateMeta>(`${base}/template/meta`)
  return response.data
}

export async function uploadCustomTemplate(file: File): Promise<TemplateMeta> {
  const formData = new FormData()
  formData.append('template', file)
  const response = await api.post<TemplateMeta & { message: string }>(
    `${base}/template/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return {
    hasCustom: true,
    name: response.data.name,
    uploadedAt: response.data.uploadedAt,
    size: response.data.size,
  }
}

export async function previewTemplate(filename?: string): Promise<void> {
  const response = await api.get(`${base}/template`, { responseType: 'blob' })
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename || 'payroll_template_preview.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
