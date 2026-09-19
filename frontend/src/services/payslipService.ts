import api from '@services/api'
import { getApiBaseUrl } from '@/config/apiBase'
import {
  formatAllPayslipsDownloadFileName,
  payrollMasterTemplateFileName,
  payrollUploadExcelFileName,
} from '@/utils/exportFileName'

export type TemplateId = 'classic' | 'corporate' | 'minimal'

export interface PayslipResult {
  empId: string
  name: string
  status: 'success' | 'error'
  fileName?: string
  error?: string
  sent?: boolean
  /** Employee's HR directory status, captured at upload time. */
  employeeStatus?: string
  employeeDbId?: string
}

export interface EmployeeDashboardPayslip {
  id: string
  employeeId: string
  payMonth: string
  payPeriodKey?: string
  fileName: string
  sentAt: string
  /** Present when the API includes payroll breakdown fields */
  status?: 'Uploaded' | 'Pending'
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
  /** Normalized period e.g. 2026-04 */
  payPeriodKey?: string
  payYear?: number
  payMonthNum?: number
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

/** Axios blob responses still return 4xx bodies as blobs — parse errors before treating as PDF. */
async function fetchPdfBlob(url: string, options?: { timeout?: number }): Promise<Blob> {
  const response = await api.get(url, {
    responseType: 'blob',
    validateStatus: () => true,
    ...options,
  })
  const contentType = String(response.headers['content-type'] ?? '')
  if (
    response.status >= 400 ||
    contentType.includes('application/json') ||
    contentType.includes('text/')
  ) {
    let message = 'Failed to load payslip PDF'
    try {
      const text = await (response.data as Blob).text()
      const json = JSON.parse(text) as { error?: string; details?: string }
      message = json.error ?? json.details ?? message
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  return response.data as Blob
}

export async function downloadPayrollTemplate(filename?: string, includeEmployeeData?: boolean): Promise<void> {
  const url = includeEmployeeData ? `${base}/template?includeEmployeeData=true` : `${base}/template`
  const response = await api.get(url, { responseType: 'blob' })
  const urlObject = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = urlObject
  link.setAttribute('download', filename || payrollMasterTemplateFileName())
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(urlObject)
}

export interface DuplicatePayPeriodError {
  code: 'DUPLICATE_PAY_PERIOD'
  error: string
  payMonth?: string
  existingBatch: PayrollBatch
}

export interface UploadPayrollOptions {
  templateId?: TemplateId
  replaceBatchId?: string
  allowDuplicatePayPeriod?: boolean
  resendPayslips?: boolean
  employeeDbIdByEmpId?: Record<string, string>
}

export interface UploadPayrollResult {
  batch: PayrollBatch
  replaced?: boolean
  appended?: boolean
  addedCount?: number
  resentCount?: number
}

export async function uploadPayroll(
  file: File,
  options: UploadPayrollOptions = {}
): Promise<UploadPayrollResult> {
  const formData = new FormData()
  formData.append('payroll', file)
  formData.append('templateId', options.templateId ?? 'classic')
  if (options.replaceBatchId) {
    formData.append('replaceBatchId', options.replaceBatchId)
  }
  if (options.allowDuplicatePayPeriod) {
    formData.append('allowDuplicatePayPeriod', 'true')
  }
  if (options.resendPayslips) {
    formData.append('resendPayslips', 'true')
  }
  if (options.employeeDbIdByEmpId && Object.keys(options.employeeDbIdByEmpId).length > 0) {
    formData.append('employeeDbIdByEmpId', JSON.stringify(options.employeeDbIdByEmpId))
  }
  const response = await api.post<UploadPayrollResult>(`${base}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    validateStatus: () => true,
  })
  if (response.status === 409 && response.data) {
    const body = response.data as unknown as DuplicatePayPeriodError
    if (body.code === 'DUPLICATE_PAY_PERIOD') {
      const err = new Error(body.error || 'Pay period already exists') as Error & {
        duplicatePayPeriod?: DuplicatePayPeriodError
      }
      err.duplicatePayPeriod = body
      throw err
    }
  }
  if (response.status >= 400) {
    const message =
      (response.data as { error?: string })?.error || 'Failed to process payroll file'
    throw new Error(message)
  }
  return response.data
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

function payslipPdfViewUrl(batchId: string, fileName: string): string {
  return `${base}/batches/${batchId}/payslips/${encodeURIComponent(fileName)}`
}

/** Authenticated blob URL for in-app PDF preview (same-origin and cross-origin deploys). */
export async function openPayslipPdf(batchId: string, fileName: string): Promise<string> {
  const blob = await fetchPdfBlob(payslipPdfViewUrl(batchId, fileName))
  return window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
}

/** Blob object URL for merged batch PDF preview (caller should revoke when done). */
export async function openMergedBatchPayslipPdf(batchId: string): Promise<string> {
  const blob = await fetchPdfBlob(`${base}/batches/${batchId}/payslips/download-all`, {
    timeout: 120000,
  })
  return window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
}

export async function downloadAllPayslipPdfs(
  batchId: string,
  payMonth?: string,
  payPeriodKey?: string,
): Promise<void> {
  const blob = await fetchPdfBlob(`${base}/batches/${batchId}/payslips/download-all`, {
    timeout: 120000,
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', formatAllPayslipsDownloadFileName(payMonth, payPeriodKey))
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadPayslipPdf(batchId: string, fileName: string, downloadName?: string): Promise<void> {
  const blob = await fetchPdfBlob(
    `${base}/batches/${batchId}/payslips/${encodeURIComponent(fileName)}/download`
  )
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', downloadName || fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function fetchUploadedExcelBlob(batchId: string): Promise<Blob> {
  const response = await api.get(`${base}/batches/${batchId}/excel`, { responseType: 'blob' })
  return new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function downloadUploadedExcel(
  batchId: string,
  payMonth?: string,
  payPeriodKey?: string,
): Promise<void> {
  const blob = await fetchUploadedExcelBlob(batchId)
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', payrollUploadExcelFileName(payMonth, payPeriodKey))
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
  employeeDbIdByEmpId?: Record<string, string>,
  options?: { resend?: boolean }
): Promise<SendAllPayslipsResult> {
  const response = await api.post<SendAllPayslipsResult>(`${base}/send-all`, {
    batchId,
    employeeDbIdByEmpId,
    ...(options?.resend ? { resend: true } : {}),
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

export async function resendMyPayslipEmail(
  payslipId: string,
): Promise<{ message: string; sentTo: string }> {
  const response = await api.post<{ message: string; sentTo: string }>(
    `${base}/my-payslips/${encodeURIComponent(payslipId)}/resend-email`,
  )
  return response.data
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

export interface CompanyLogoMeta {
  hasLogo: boolean
}

export function getCompanyLogoPreviewUrl(cacheKey = Date.now()): string {
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}/payslips/template/logo?t=${cacheKey}`
}

export async function getCompanyLogoMeta(): Promise<CompanyLogoMeta> {
  const response = await api.get<CompanyLogoMeta>(`${base}/template/logo/meta`)
  return response.data
}

export async function uploadCompanyLogo(file: File): Promise<void> {
  const formData = new FormData()
  formData.append('logo', file)
  await api.post(`${base}/template/logo/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
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
  link.setAttribute('download', filename || payrollMasterTemplateFileName())
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}