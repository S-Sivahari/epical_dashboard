import { env } from './env';

const WEAK_JWT = new Set(['your-secret-key', 'change-me', 'secret']);
const WEAK_SESSION = new Set(['session-secret-key', 'change-me', 'secret']);
const WEAK_ADMIN_PASSWORD = new Set(['admin123', 'password', 'admin']);

export function validateProductionSecrets(): void {
  if (env.nodeEnv !== 'production') {
    return;
  }

  const errors: string[] = [];

  if (!process.env.JWT_SECRET || WEAK_JWT.has(env.jwtSecret)) {
    errors.push('Set a strong JWT_SECRET in production (not the default).');
  }
  if (!process.env.SESSION_SECRET || WEAK_SESSION.has(env.SESSION_SECRET)) {
    errors.push('Set a strong SESSION_SECRET in production (not the default).');
  }
  if (!process.env.ADMIN_EMAIL?.trim()) {
    errors.push('Set ADMIN_EMAIL in production.');
  }
  if (!process.env.ADMIN_PASSWORD || WEAK_ADMIN_PASSWORD.has(env.ADMIN_PASSWORD)) {
    errors.push('Set a strong ADMIN_PASSWORD in production (not admin123).');
  }
  if (env.mongodbUri.includes('localhost') && !process.env.ALLOW_LOCAL_MONGO) {
    errors.push('Use a secured MONGODB_URI in production (or set ALLOW_LOCAL_MONGO=true for local deploy).');
  }

  if (errors.length > 0) {
    throw new Error(`Security configuration error:\n- ${errors.join('\n- ')}`);
  }
}
