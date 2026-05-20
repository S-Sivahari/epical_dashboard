import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/epical',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  SESSION_SECRET: process.env.SESSION_SECRET || 'session-secret-key',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@company.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  ADMIN_NAME: process.env.ADMIN_NAME || 'Admin User',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
