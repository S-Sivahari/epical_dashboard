import type { Request } from 'express';
import { isAdminRole } from './generateToken';
import { resolveEmployeeForAuthUser } from './employeeAuth';
import * as notesDelegationService from '../services/notesDelegationService';
import * as notesService from '../services/notesService';

function todayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function employeeRecordId(employee: Record<string, unknown>): string {
  return String(employee.id ?? employee.employeeId ?? '').trim();
}

function employeeDisplayName(employee: Record<string, unknown>): string {
  const direct = String(employee.name ?? '').trim();
  if (direct) return direct;
  const composed = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
  if (composed) return composed;
  return String(employee.employeeId ?? employee.id ?? 'Employee');
}

export async function resolveNotesAuthEmployee(req: Request) {
  if (!req.user) return null;
  const employee = await resolveEmployeeForAuthUser(req.user.id, req.user.email);
  if (!employee) return null;
  return {
    id: employeeRecordId(employee as Record<string, unknown>),
    name: employeeDisplayName(employee as Record<string, unknown>),
  };
}

export function isNotesAdmin(req: Request): boolean {
  return Boolean(req.user && isAdminRole(req.user.role));
}

export async function assertEmployeeCanAccessNotesForDate(req: Request, date: string): Promise<void> {
  await assertEmployeeCanMutateNotesForDate(req, date);
}

export async function assertEmployeeCanMutateNotesForDate(req: Request, date: string): Promise<void> {
  if (isNotesAdmin(req)) return;

  const employee = await resolveNotesAuthEmployee(req);
  if (!employee?.id) {
    throw Object.assign(new Error('Employee profile not found'), { status: 403 });
  }

  const allowed = await notesDelegationService.isEmployeeDelegatedForDate(employee.id, date);
  if (!allowed) {
    throw Object.assign(
      new Error('You are not assigned to manage daily notes for this date'),
      { status: 403 },
    );
  }
}

export async function assertEmployeeCanMutateNotesForBlockId(req: Request, blockId: string): Promise<void> {
  const block = await notesService.getDailyBlockById(blockId);
  if (!block) {
    throw Object.assign(new Error('Daily block not found'), { status: 404 });
  }
  await assertEmployeeCanMutateNotesForDate(req, block.date);
}

export async function getNotesAccessPayload(req: Request, from?: string, to?: string) {
  if (isNotesAdmin(req)) {
    return {
      role: 'admin' as const,
      canAccessToday: true,
      showNotesNav: true,
      delegatedDates: [] as string[],
    };
  }

  const employee = await resolveNotesAuthEmployee(req);
  if (!employee?.id) {
    return {
      role: 'employee' as const,
      canAccessToday: false,
      showNotesNav: false,
      delegatedDates: [] as string[],
    };
  }

  const today = todayDateKey();
  const delegatedDates = await notesDelegationService.getEmployeeDelegatedDateKeys(
    employee.id,
    from,
    to,
  );

  const canAccessToday = delegatedDates.includes(today);

  return {
    role: 'employee' as const,
    canAccessToday,
    showNotesNav: canAccessToday,
    delegatedDates,
  };
}
