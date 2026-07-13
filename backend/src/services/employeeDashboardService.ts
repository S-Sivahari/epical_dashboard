import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { TimesheetModel } from '../models/Timesheet';
import { getUserById } from '../services/authService';
import { getEmployeeProfileById } from '../services/employeeService';
import * as leaveService from '../services/leaveService';
import * as companyCalendarEventService from '../services/companyCalendarEventService';
import * as documentRequestService from '../services/documentRequestService';
import { listEnrollments } from '../services/courseService';
import { resolveEmployeeForAuthUser } from '../utils/employeeAuth';
import { buildAssignmentIdentityTokens } from '../utils/assignedTaskSync';
import {
  getAssignedProjectsForUser,
  sumSessionHours,
  toFrontendTimesheetRow,
} from '../utils/assignedProjectsHelper';
import { sanitizeEmployeeForDetail } from '../utils/sanitizeEmployee';
import { isPublicEmployeeView } from '../utils/employeeView';

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
    holidays,
    calendarEvents,
    documents,
    enrollments,
    openAttendance,
    latestAttendance,
    monthSessions,
    projects,
    leaves,
  ] = await Promise.all([
    getEmployeeProfileById(employeeDbId),
    leaveService.getAllHolidays(),
    companyCalendarEventService.getAllCompanyCalendarEvents(),
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
      .select('date loginTime logoutTime overriddenHours totalHours workedMs totalPausedMs')
      .sort({ loginTime: -1 })
      .lean(),
    getAssignedProjectsForUser(
      { id: user.id, name: user.name, email: user.email },
      employeeRecord as any,
      { syncTasks: false },
    ),
    leaveService.getAllLeaves(employeeDbId),
  ]);

  const balancesWithLop = await leaveService.getLeaveBalances(employeeDbId, new Date(), leaves);

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

  const upcomingCalendarEvents = calendarEvents
    .filter((e) => {
      const d = new Date(e.date);
      return !Number.isNaN(d.getTime()) && d >= todayStart && d <= holidayWindowEnd;
    })
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      description: e.description,
      type: 'Company Event' as const,
    }));

  const upcomingCalendarItems = [...upcomingHolidays, ...upcomingCalendarEvents].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return {
    profile: profile ? sanitizeEmployeeForDetail(profile) : null,
    balances: balancesWithLop,
    leaves: leaves.filter((l) => l.status !== 'Cancelled'),
    leaveHistory: leaves.filter((l) =>
      ['Approved', 'Rejected', 'Cancelled', 'Pending'].includes(l.status),
    ),
    holidays: upcomingCalendarItems,
    documents,
    enrollments,
    attendance: buildAttendancePayload(openAttendance, latestAttendance),
    monthlyHours: sumSessionHours(sessionRows),
    weeklyHours: sumSessionHours(weekSessions),
    projects: isPublicEmployeeView((employeeRecord as { view?: string }).view) ? projects : [],
    employeeName,
  };
}
