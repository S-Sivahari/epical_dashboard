import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { connectDB, closeDB, getDB } from './config/db';
import { env } from './config/env';
import { validateProductionSecrets } from './config/validateSecurity';
import { initializePassport } from './config/oauth';

import {
  normalizeEmployeesWithSameCompanyAndPersonalEmail,
  removeDepartmentFromDatabase,
} from './services/employeeService';

import { authMiddleware, requireRole } from './middleware/authMiddleware';
import { csrfMiddleware } from './middleware/csrfMiddleware';
import { formatMongoConnectionError, isMongoNetworkError } from './utils/mongoErrors';

// Routes
import { authRoutes } from './routes/authRoutes';
import { employeeRoutes } from './routes/employeeRoutes';
import { leaveRoutes } from './routes/leaveRoutes';
import { holidayRoutes } from './routes/holidayRoutes';
import { ticketRoutes } from './routes/ticketRoutes';
import { timesheetRoutes } from './routes/timesheetRoutes';
import { projectRoutes } from './routes/projectRoutes';
import { checklistRoutes } from './routes/checklistRoutes';
import { uploadRoutes } from './routes/uploadRoutes';
import { oauthRoutes } from './routes/oauthRoutes';
import { notificationRoutes } from './routes/notificationRoutes';
import { payslipRoutes } from './routes/payslipRoutes';
import { compensationRoutes } from './routes/compensationRoutes';
import { courseRoutes } from './routes/courseRoutes';
import { newsRoutes } from './routes/newsRoutes';
import { documentRequestRoutes } from './routes/documentRequestRoutes';
import { companyCalendarEventRoutes } from './routes/companyCalendarEventRoutes';
import { achievementRoutes } from './routes/achievementRoutes';
import { employeeDashboardRoutes } from './routes/employeeDashboardRoutes';
import { pdkMetalRoutingRoutes } from './routes/pdkMetalRoutingRoutes';
import { notesRoutes } from './routes/notesRoutes';
import { projectMgmtRoutes } from './routes/projectMgmtRoutes';

// Seed helpers
import { ensureDefaultAdminUser, seedDefaultUsers } from './services/authService';
import { seedLeaves, seedHolidays } from './services/leaveService';
import { seedTickets } from './services/ticketService';
import {
  seedProjectsAndTimesheets,
  seedAssignedTasksOnly,
} from './scripts/seedTimesheets';

// Scheduler
import { initScheduler, stopScheduler } from './services/timesheetScheduler';
import {
  initLeaveMonthlyResetScheduler,
  stopLeaveMonthlyResetScheduler,
} from './services/leaveMonthlyResetScheduler';
import { ensureFinancialYearSnapshotReset } from './services/payrollYtdService';
import { ensureAttendanceIndexes } from './utils/ensureAttendanceIndexes';

validateProductionSecrets();

const app = express();

if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === 'production' ? 40 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});

// ── CORS Configuration ────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const isDev = env.nodeEnv !== 'production';

// ── Middleware ────────────────────────────────────────────────
app.use(
  cors({
    origin: isDev
      ? true
      : (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(csrfMiddleware);

// ── Session & Passport ────────────────────────────────────────
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

// Initialize OAuth only if credentials are available
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  initializePassport();
  app.use(passport.initialize());
  app.use(passport.session());
  console.log(`✓ Google OAuth enabled — register this redirect URI in Google Cloud Console:`);
  console.log(`  ${env.GOOGLE_CALLBACK_URL}`);
} else {
  console.log('⚠ Google OAuth disabled (missing credentials)');
}

// ── Health check ──────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    if (env.nodeEnv === 'production') {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
      return;
    }
    const db = getDB();
    const employeeCount = await db.collection('employees').countDocuments();

    res.json({
      status: 'OK',
      database: db.databaseName,
      employeeCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      error: env.nodeEnv === 'production' ? 'Database not ready' : error instanceof Error ? error.message : 'Database not ready',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/auth', authRateLimiter, oauthRoutes);

app.use('/api/dashboard', employeeDashboardRoutes);

app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/calendar-events', companyCalendarEventRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/metal-routing', pdkMetalRoutingRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/project-mgmt', projectMgmtRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/compensation', compensationRoutes);
app.use('/api/document-requests', documentRequestRoutes);

app.use('/api', courseRoutes);
app.use('/api', newsRoutes);
app.use('/api', achievementRoutes);
app.use('/api', uploadRoutes);

// Employee routes after upload routes so /:id doesn't catch /employees/:id/photo
app.use('/api/employees', employeeRoutes);

// ── Stats endpoint (admin dashboard) ─────────────────────────
app.get(
  '/api/stats',
  authMiddleware,
  requireRole('Admin'),
  async (_req, res) => {
    try {
      const db = getDB();

      const [
        totalEmployees,
        activeEmployees,
        pendingLeaves,
        openTickets,
      ] = await Promise.all([
        db.collection('employees').countDocuments(),
        db.collection('employees').countDocuments({ status: 'Active' }),
        db.collection('leaves').countDocuments({ status: 'Pending' }),
        db.collection('tickets').countDocuments({
          status: { $in: ['Pending', 'In Progress'] },
        }),
      ]);

      res.json({
        totalEmployees,
        activeEmployees,
        pendingLeaves,
        openTickets,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }
);

// ── Full seed endpoint ────────────────────────────────────────
app.post(
  '/api/seed',
  authMiddleware,
  requireRole('Admin'),
  async (_req, res) => {
    try {
      const users = await seedDefaultUsers();

      await seedLeaves();
      await seedHolidays();
      await seedTickets();
      await seedProjectsAndTimesheets();

      res.json({
        message: 'Database seeded successfully',
        users,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Seeding failed',
      });
    }
  }
);

app.post(
  '/api/seed-assigned-tasks',
  authMiddleware,
  requireRole('Admin'),
  async (_req, res) => {
    try {
      const result = await seedAssignedTasksOnly();

      res.json({
        message: 'Assigned tasks synced from project access',
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Assigned task sync failed',
      });
    }
  }
);

// ── Clear all employees ───────────────────────────────────────
app.post(
  '/api/clear-employees',
  authMiddleware,
  requireRole('Admin'),
  async (_req, res) => {
    try {
      const db = getDB();

      const result = await db.collection('employees').deleteMany({});

      res.json({
        message: 'All employees cleared',
        deletedCount: result.deletedCount,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to clear employees',
      });
    }
  }
);

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: 'Route not found',
  });
});

// ── Error handler ─────────────────────────────────────────────
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);

    if (isMongoNetworkError(err)) {
      res.status(503).json({
        error: formatMongoConnectionError(err),
      });
      return;
    }

    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  }
);

// ── Start server ──────────────────────────────────────────────
export async function startServer() {
  try {
    const db = await connectDB();

    const employeeCount = await db
      .collection('employees')
      .countDocuments();

    console.log(
      `✓ MongoDB database "${db.databaseName}" — ${employeeCount} employee(s) in collection`
    );

    await ensureAttendanceIndexes();

    try {
      const { ensureCellTypeChecklists } = await import('./services/cellTypeChecklistService');
      const checklistSeed = await ensureCellTypeChecklists();
      if (checklistSeed.created > 0) {
        console.log(`✓ Seeded ${checklistSeed.created} cell-type checklist definition(s) in MongoDB`);
      }
    } catch (err) {
      console.warn('⚠ Cell-type checklist seed skipped:', err);
    }

    try {
      const { seedPdkMetalRouting } = await import('./scripts/seedPdkMetalRouting');
      const pdkSeed = await seedPdkMetalRouting();
      if (pdkSeed.modulesCreated > 0) {
        console.log(`✓ Seeded ${pdkSeed.modulesCreated} PDK module(s)`);
      }
    } catch (err) {
      console.warn('⚠ PDK metal routing seed skipped:', err);
    }

    try {
      const adminSync = await ensureDefaultAdminUser();
      if (adminSync.created) {
        console.log('✓ Created default admin account');
      } else if (adminSync.updated) {
        console.log('✓ Synced default admin display name');
      }
    } catch (err) {
      console.warn('⚠ Default admin account sync skipped:', err);
    }

    // Payslip indexes
    const { ensurePayslipStorageIndexes } = await import(
      './services/payslipStorageService'
    );

    await ensurePayslipStorageIndexes();

    const { ensureEmployeePayslipIndexes } = await import(
      './services/employeePayslipService'
    );

    const removedDupes = await ensureEmployeePayslipIndexes();

    if (removedDupes > 0) {
      console.log(
        `✓ Removed ${removedDupes} duplicate employee dashboard payslip(s)`
      );
    }

    try {
      const emailFixes = await normalizeEmployeesWithSameCompanyAndPersonalEmail();
      if (emailFixes > 0) {
        console.log(
          `✓ Cleared duplicate company email on ${emailFixes} employee(s) where it matched personal email`,
        );
      }
    } catch (err) {
      console.warn('⚠ Employee email normalization skipped:', err);
    }

    // Cleanup department field
    try {
      const removed = await removeDepartmentFromDatabase();

      if (removed.employees > 0 || removed.users > 0) {
        console.log(
          `✓ Removed department field from ${removed.employees} employees and ${removed.users} users`
        );
      }
    } catch (err) {
      console.warn('⚠ Department field cleanup skipped:', err);
    }

    app.listen(env.port, () => {
      console.log(`✓ Server running on http://localhost:${env.port}`);
      console.log(`✓ API base:    http://localhost:${env.port}/api`);
      console.log(`✓ Seed data:   POST http://localhost:${env.port}/api/seed`);
    });

    initScheduler().catch((err) =>
      console.error('⚠ Scheduler init failed (non-fatal):', err)
    );
    initLeaveMonthlyResetScheduler().catch((err) =>
      console.error('⚠ Leave monthly reset scheduler failed (non-fatal):', err)
    );

    try {
      await ensureFinancialYearSnapshotReset();
    } catch (err) {
      console.warn('⚠ Payroll FY snapshot reset skipped:', err);
    }
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');

  stopScheduler();
  stopLeaveMonthlyResetScheduler();
  await closeDB();

  process.exit(0);
});

// Start server if this is the main module
startServer();