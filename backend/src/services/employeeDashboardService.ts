import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { TimesheetModel } from '../models/Timesheet';
import { getUserById } from '../services/authService';
import { getEmployeeProfileById } from '../services/employeeService';
import * as leaveService from '../services/leaveService';
import * as documentRequestService from '../services/documentRequestService';
import { listEnrollments } from '../services/courseService';
import { resolveEmployeeForAuthUser } from '../utils/employeeAuth';
import { calculateBalances } from '../utils/leaveCalculator';
import { buildAssignmentIdentityTokens } from '../utils/assignedTaskSync';
import {
  getAssignedProjectsForUser,
  sumSessionHours,
  toFrontendTimesheetRow,
} from '../utils/assignedProjectsHelper';
import { sanitizeEmployeeForDetail } from '../utils/sanitizeEmployee';

function startOfMonthISO(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildAttendancePayload(
  openAttendance: {
    checkInTime?: Date;
    checkOutTime?: Date | null;
    date?: string;
    sessionStatus?: string;
    reminderSent?: boolean;
    autoCheckedOut?: boolean;
    expectedCheckoutTime?: Date;
    autoCheckoutTime?: Date;
    autoCheckoutEnabled?: boolean;
  } | null,
  latestAttendance: typeof openAttendance,
) {
  const date = todayISO();
  const attendance = openAttendance ?? latestAttendance;
  return {
    checkedIn: !!openAttendance,
    checkInTime: openAttendance?.checkInTime?.toISOString() ?? null,
    checkOutTime: attendance?.checkOutTime?.toISOString() ?? null,
    date: openAttendance?.date ?? attendance?.date ?? date,
    sessionStatus: openAttendance?.sessionStatus ?? attendance?.sessionStatus ?? null,
    reminderSent: openAttendance?.reminderSent ?? attendance?.reminderSent ?? false,
    autoCheckedOut: attendance?.autoCheckedOut ?? false,
    expectedCheckoutTime: openAttendance?.expectedCheckoutTime?.toISOString() ?? null,
    autoCheckoutTime: openAttendance?.autoCheckoutTime?.toISOString() ?? null,
    autoCheckoutEnabled: openAttendance?.autoCheckoutEnabled ?? attendance?.autoCheckoutEnabled ?? true,
  };
}

export async function getEmployeeDashboardBundle(userId: string, userEmail?: string) {
  const user = await getUserById(userId);
  if (!user) return null;

  const employeeRecord = await resolveEmployeeForAuthUser(user.id, user.email ?? userEmail);
  if (!employeeRecord) return null;

  const employeeDbId = String(employeeRecord.id);
  const employeeName = [employeeRecord.firstName, employeeRecord.middleName, employeeRecord.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || user.name;

  const identityTokens = buildAssignmentIdentityTokens(
    { id: user.id, name: user.name, email: user.email, employeeId: employeeRecord.employeeId },
    employeeRecord as any,
  );

  const monthFrom = startOfMonthISO();
  const weekFrom = startOfWeekISO();
  const today = todayISO();

  const sessionMatch = {
    $or: [
      { employeeId: { $in: identityTokens } },
      { employee: { $in: identityTokens } },
    ],
    date: { $gte: monthFrom, $lte: today },
  };

  const [
    profile,
    leaves,
    compBonus,
    holidays,
    documents,
    enrollments,
    openAttendance,
    latestAttendance,
    monthSessions,
    projects,
  ] = await Promise.all([
    getEmployeeProfileById(employeeDbId),
    leaveService.getAllLeaves(employeeDbId),
    leaveService.getCompensationEarnedLeaveBonusForYear(employeeDbId),
    leaveService.getAllHolidays(),
    documentRequestService.listForEmployee(userId),
    listEnrollments({ employee: employeeDbId }),
    EmployeeAttendanceModel.findOne({
      employeeId: user.id,
      checkOutTime: { $exists: false },
    })
      .sort({ checkInTime: -1 })
      .lean(),
    EmployeeAttendanceModel.findOne({ employeeId: user.id })
      .sort({ checkInTime: -1 })
      .lean(),
    TimesheetModel.find(sessionMatch)
      .select('date loginTime logoutTime overriddenHours totalHours')
      .sort({ loginTime: -1 })
      .lean(),
    getAssignedProjectsForUser(
      { id: user.id, name: user.name, email: user.email },
      employeeRecord as any,
      { syncTasks: false },
    ),
  ]);

  const balances = calculateBalances(leaves, employeeRecord.joinedAt as string | undefined, {
    compensationEarnedBonus: compBonus,
    employeeAllocations: (employeeRecord as { leaveAllocations?: Record<string, number> }).leaveAllocations,
  });

  const sessionRows = monthSessions.map((s) => toFrontendTimesheetRow(s as any));
  const weekSessions = sessionRows.filter((s) => s.date && s.date >= weekFrom && s.date <= today);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const holidayWindowEnd = new Date(todayStart);
  holidayWindowEnd.setDate(holidayWindowEnd.getDate() + 30);
  const upcomingHolidays = holidays
    .filter((h) => {
      const d = new Date(h.date);
      return (
        !Number.isNaN(d.getTime()) &&
        d >= todayStart &&
        d <= holidayWindowEnd &&
        !h.skipped
      );
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    profile: profile ? sanitizeEmployeeForDetail(profile) : null,
    balances,
    leaves: leaves.filter((l) => l.status !== 'Cancelled'),
    holidays: upcomingHolidays,
    documents,
    enrollments,
    attendance: buildAttendancePayload(openAttendance, latestAttendance),
    monthlyHours: sumSessionHours(sessionRows),
    weeklyHours: sumSessionHours(weekSessions),
    projects,
    employeeName,
  };
}
