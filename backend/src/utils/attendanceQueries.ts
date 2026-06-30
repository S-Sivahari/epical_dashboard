import type { FilterQuery } from 'mongoose';
import type { EmployeeAttendance } from '../models/EmployeeAttendance';
import { getUserById } from '../services/authService';
import { findEmployeeByLoginEmail } from './employeeAuth';
import { buildAssignmentIdentityTokens } from './assignedTaskSync';

/** Matches attendance rows that still represent an open check-in session. */
export function openAttendanceFilter(
  extra: FilterQuery<EmployeeAttendance> = {}
): FilterQuery<EmployeeAttendance> {
  return {
    ...extra,
    $and: [
      ...(extra.$and ? (Array.isArray(extra.$and) ? extra.$and : [extra.$and]) : []),
      {
        $or: [{ checkOutTime: { $exists: false } }, { checkOutTime: null }],
      },
      {
        $or: [
          { sessionStatus: { $in: ['Active', 'Paused', 'Session Incomplete'] } },
          { sessionStatus: { $exists: false } },
        ],
      },
      { autoCheckedOut: { $ne: true } },
    ],
  };
}

export function identityTokensFromAttendance(attendance: {
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
}): string[] {
  const tokens = new Set<string>();
  for (const value of [attendance.employeeId, attendance.employeeName, attendance.employeeEmail]) {
    const trimmed = value?.trim();
    if (trimmed) tokens.add(trimmed);
  }
  return Array.from(tokens);
}

export function openTimesheetsIdentityFilter(identityTokens: string[]) {
  return {
    $or: [
      { employeeId: { $in: identityTokens } },
      { employee: { $in: identityTokens } },
    ],
  };
}

export function openTimesheetsForAttendanceFilter(
  identityTokens: string[],
  checkInTime: Date,
  options?: { strictLoginWindow?: boolean }
) {
  const strictLoginWindow = options?.strictLoginWindow !== false;
  const clauses: FilterQuery<unknown>[] = [
    openTimesheetsIdentityFilter(identityTokens),
    {
      $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
    },
  ];
  if (strictLoginWindow) {
    clauses.push({ loginTime: { $gte: checkInTime } });
  }
  return { $and: clauses };
}

/** All timesheet rows logged during one attendance check-in session. */
export function sessionTimesheetsForAttendanceFilter(
  identityTokens: string[],
  checkInTime: Date,
  checkoutTime: Date,
) {
  return {
    $and: [
      openTimesheetsIdentityFilter(identityTokens),
      { loginTime: { $gte: checkInTime, $lte: checkoutTime } },
    ],
  };
}

/** All timesheet rows logged on a calendar day (scheduler timezone date key). */
export function timesheetsForCalendarDayFilter(
  identityTokens: string[],
  dayStart: Date,
  dayEnd: Date,
) {
  return {
    $and: [
      openTimesheetsIdentityFilter(identityTokens),
      { loginTime: { $gte: dayStart, $lte: dayEnd } },
    ],
  };
}

/** Resolve all employee/timesheet identity tokens for an attendance row (auth id, HR id, name, email). */
export async function resolveIdentityTokensForAttendance(attendance: {
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
}): Promise<string[]> {
  const tokens = new Set(identityTokensFromAttendance(attendance));

  if (attendance.employeeId) {
    try {
      const user = await getUserById(attendance.employeeId);
      if (user) {
        for (const t of buildAssignmentIdentityTokens({
          id: user.id,
          name: user.name,
          email: user.email,
          employeeId: user.employeeId,
        })) {
          tokens.add(t);
        }
      }
    } catch {
      /* user lookup optional */
    }
  }

  if (attendance.employeeEmail) {
    try {
      const employeeRecord = await findEmployeeByLoginEmail(attendance.employeeEmail);
      if (employeeRecord) {
        for (const t of buildAssignmentIdentityTokens(
          {
            id: attendance.employeeId,
            name: attendance.employeeName,
            email: attendance.employeeEmail,
            employeeId: employeeRecord.employeeId,
          },
          employeeRecord
        )) {
          tokens.add(t);
        }
      }
    } catch {
      /* employee lookup optional */
    }
  }

  return Array.from(tokens);
}
