const STORAGE_KEY = 'hrms_payslip_upload_session'
const LEGACY_SESSION_KEY = 'hrms_payslip_upload_session'

interface PayslipUploadSession {
  userId: string
  batchId: string
}

export function savePayslipUploadSession(userId: string, batchId: string): void {
  const payload: PayslipUploadSession = { userId, batchId }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function readPayslipUploadSession(userId: string): string | null {
  const raw =
    localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(LEGACY_SESSION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as PayslipUploadSession
    if (parsed.userId !== userId || !parsed.batchId) {
      clearPayslipUploadSession()
      return null
    }
    if (!localStorage.getItem(STORAGE_KEY)) {
      savePayslipUploadSession(userId, parsed.batchId)
      sessionStorage.removeItem(LEGACY_SESSION_KEY)
    }
    return parsed.batchId
  } catch {
    clearPayslipUploadSession()
    return null
  }
}

export function clearPayslipUploadSession(): void {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(LEGACY_SESSION_KEY)
}
