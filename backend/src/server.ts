import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { connectDB, closeDB } from './config/db';
import { env } from './config/env';
import { initializePassport } from './config/oauth';

// Routes
import { authRoutes } from './routes/authRoutes';
import { employeeRoutes } from './routes/employeeRoutes';
import { leaveRoutes } from './routes/leaveRoutes';
import { holidayRoutes } from './routes/holidayRoutes';
import { ticketRoutes } from './routes/ticketRoutes';
import { timesheetRoutes } from './routes/timesheetRoutes';
import { uploadRoutes } from './routes/uploadRoutes';
import { oauthRoutes } from './routes/oauthRoutes';
import { notificationRoutes } from './routes/notificationRoutes';
import { payslipRoutes } from './routes/payslipRoutes';

// Seed helpers
import { seedDefaultUsers } from './services/authService';
import { seedLeaves, seedHolidays } from './services/leaveService';
import { seedTickets } from './services/ticketService';
import { getDB } from './config/db';

const app = express();

// ── CORS Configuration ────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

// ── Middleware ────────────────────────────────────────────────
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Session & Passport ────────────────────────────────────────
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax' },
  })
);

// Initialize OAuth only if credentials are available
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  initializePassport();
  app.use(passport.initialize());
  app.use(passport.session());
} else {
  console.log('⚠ Google OAuth disabled (missing credentials)');
}

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api', uploadRoutes);

// ── Stats endpoint (admin dashboard) ─────────────────────────
app.get('/api/stats', async (_req, res) => {
  try {
    const db = getDB();
    const [totalEmployees, activeEmployees, pendingLeaves, openTickets] = await Promise.all([
      db.collection('employees').countDocuments(),
      db.collection('employees').countDocuments({ status: 'Active' }),
      db.collection('leaves').countDocuments({ status: 'Pending' }),
      db.collection('tickets').countDocuments({ status: { $in: ['Pending', 'In Progress'] } }),
    ]);
    res.json({ totalEmployees, activeEmployees, pendingLeaves, openTickets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Full seed endpoint ────────────────────────────────────────
app.post('/api/seed', async (_req, res) => {
  try {
    const users = await seedDefaultUsers();
    await seedLeaves();
    await seedHolidays();
    await seedTickets();

    // Note: Employee seeding removed - add employees manually through the admin panel
    res.json({ message: 'Database seeded successfully', users });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Seeding failed' });
  }
});

// ── Clear all employees ───────────────────────────────────────
app.post('/api/clear-employees', async (_req, res) => {
  try {
    const db = getDB();
    const result = await db.collection('employees').deleteMany({});
    res.json({ message: 'All employees cleared', deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear employees' });
  }
});

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────────
export async function startServer() {
  try {
    await connectDB();
    app.listen(env.port, () => {
      console.log(`✓ Server running on http://localhost:${env.port}`);
      console.log(`✓ API base:    http://localhost:${env.port}/api`);
      console.log(`✓ Seed data:   POST http://localhost:${env.port}/api/seed`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await closeDB();
  process.exit(0);
});

// Start server if this is the main module
startServer();
