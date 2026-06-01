const STORAGE_KEY = 'hrms_payslip_upload_session'

interface PayslipUploadSession {
  userId: string
  batchId: string
}

export function savePayslipUploadSession(userId: string, batchId: string): void {
  const payload: PayslipUploadSession = { userId, batchId }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function readPayslipUploadSession(userId: string): string | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as PayslipUploadSession
    if (parsed.userId !== userId || !parsed.batchId) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed.batchId
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearPayslipUploadSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
