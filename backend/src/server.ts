import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from 'passport';

import { connectDB, closeDB, getDB } from './config/db';
import { env } from './config/env';
import { initializePassport } from './config/oauth';

import {
  normalizeEmployeesWithSameCompanyAndPersonalEmail,
  removeDepartmentFromDatabase,
} from './services/employeeService';
import { purgeCancelledLeavesFromDatabase } from './services/leaveService';

import { authMiddleware, requireRole } from './middleware/authMiddleware';
import { formatMongoConnectionError, isMongoNetworkError } from './utils/mongoErrors';

// Routes
import { authRoutes } from './routes/authRoutes';
import { employeeRoutes } from './routes/employeeRoutes';
import { leaveRoutes } from './routes/leaveRoutes';
import { holidayRoutes } from './routes/holidayRoutes';
import { ticketRoutes } from './routes/ticketRoutes';
import { timesheetRoutes } from './routes/timesheetRoutes';
import { projectRoutes } from './routes/projectRoutes';
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

// Seed helpers
import { seedDefaultUsers } from './services/authService';
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

const app = express();

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
            callback(null, allowedOrigins[0] ?? true);
          }
        },
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
      error: error instanceof Error ? error.message : 'Database not ready',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);

app.use('/api/dashboard', employeeDashboardRoutes);

app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/calendar-events', companyCalendarEventRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/compensation', compensationRoutes);
app.use('/api/document-requests', documentRequestRoutes);

app.use('/api', courseRoutes);
app.use('/api', newsRoutes);
app.use('/api', achievementRoutes);
app.use('/api', uploadRoutes);

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

    // Cleanup cancelled leaves
    try {
      const purgedCount = await purgeCancelledLeavesFromDatabase();

      if (purgedCount > 0) {
        console.log(
          `✓ Purged ${purgedCount} legacy cancelled leave request(s) from database`
        );
      }
    } catch (err) {
      console.warn('⚠ Purging cancelled leaves skipped:', err);
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