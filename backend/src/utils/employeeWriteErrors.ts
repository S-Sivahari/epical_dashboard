import { Response } from 'express';

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 400,
  EMAILS_MUST_DIFFER: 400,
  ADMIN_EMAIL_RESERVED: 400,
  ADMIN_ROLE_NOT_ALLOWED: 400,
  COMPANY_EMAIL_REQUIRED: 400,
  DUPLICATE_EMAIL: 409,
  DUPLICATE_EMPLOYEE_ID: 409,
};

export function sendEmployeeWriteError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
  logLabel?: string,
): void {
  const err = error as { code?: string | number; message?: string };

  if (err?.code === 11000 || err?.message?.includes('E11000')) {
    res.status(409).json({ error: 'A duplicate entry already exists.' });
    return;
  }

  if (typeof err?.code === 'string' && STATUS_BY_CODE[err.code]) {
    res.status(STATUS_BY_CODE[err.code]).json({ error: err.message ?? fallbackMessage });
    return;
  }

  if (logLabel) {
    console.error(logLabel, error);
  }
  res.status(500).json({ error: err?.message ?? fallbackMessage });
}
