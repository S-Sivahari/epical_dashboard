import dotenv from 'dotenv';

dotenv.config();

function envStr(key: string, fallback = ''): string {
  const raw = process.env[key];
  return (raw !== undefined && raw !== '' ? raw : fallback).trim();
}

function resolveGoogleCallbackUrl(): string {
  const explicit = envStr('GOOGLE_CALLBACK_URL');
  if (explicit) return explicit;
  const frontend = envStr('FRONTEND_URL');
  if ((process.env.NODE_ENV || 'development') === 'production' && frontend) {
    return `${frontend.replace(/\/$/, '')}/api/auth/google/callback`;
  }
  return 'http://localhost:3000/api/auth/google/callback';
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/epical',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  GOOGLE_CLIENT_ID: envStr('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: envStr('GOOGLE_CLIENT_SECRET'),
  GOOGLE_CALLBACK_URL: resolveGoogleCallbackUrl(),
  SESSION_SECRET: envStr('SESSION_SECRET', 'session-secret-key'),
  FRONTEND_URL: envStr('FRONTEND_URL', 'http://localhost:5173'),
  GNEWS_API_KEY: process.env.GNEWS_API_KEY || '',
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@company.com').toLowerCase().trim(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // SMTP / Email (Uppercase & Camelcase options for compatibility)
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@company.com',

  // Auto-Checkout defaults (HH:mm 24-hour format)
  DEFAULT_REMINDER_TIME: process.env.DEFAULT_REMINDER_TIME || '21:00',
  DEFAULT_AUTO_CHECKOUT_TIME: process.env.DEFAULT_AUTO_CHECKOUT_TIME || '23:59',

  enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'no-reply@company.com',
  testCronTimings: process.env.TEST_CRON_TIMINGS === 'true',
  schedulerTimezone: process.env.SCHEDULER_TIMEZONE || 'Asia/Kolkata',
};

