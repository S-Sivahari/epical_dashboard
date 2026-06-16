import bcrypt from 'bcryptjs';
import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { env } from '../config/env';
import {
  assertLoginEmailAllowedForEmployee,
  EmployeeLoginError,
} from './employeeLoginRules';

/** Env-configured admin portal login email (password is ADMIN_PASSWORD). */
export function getAdminLoginEmail(): string {
  return env.ADMIN_EMAIL;
}
/** OAuth-only employees use an unusable password hash when a users row is provisioned. */
export const OAUTH_ONLY_EMPLOYEE_PASSWORD = '';

export function normalizeLoginEmail(email: string): string {
  return email.toLowerCase().trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NO_BLOBS_PROJECTION = { projection: { documents: 0, 'photo.data': 0 } };

/** Case-insensitive match on company or personal email. */
export async function findEmployeeByLoginEmail(email: string): Promise<any> {
  const normalized = normalizeLoginEmail(email);
  if (!normalized) return null;

  const col = getDB().collection('employees');
  const exact = await col.findOne({
    $or: [{ email: normalized }, { personalEmail: normalized }],
  }, NO_BLOBS_PROJECTION);
  if (exact) return exact;

  const pattern = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  return col.findOne({
    $or: [{ email: pattern }, { personalEmail: pattern }],
  }, NO_BLOBS_PROJECTION);
}

export function employeeEmailsInclude(
  employee: { email?: string; personalEmail?: string },
  loginEmail: string,
): boolean {
  const normalized = normalizeLoginEmail(loginEmail);
  if (!normalized) return false;
  return getEmployeeLoginEmails(employee).includes(normalized);
}

export async function resolveEmployeeForAuthUser(userId: string, userEmail?: string): Promise<any> {
  const employeeCol = getDB().collection('employees');
  const trimmed = String(userId ?? '').trim();

  if (trimmed) {
    const byId = await employeeCol.findOne({ id: trimmed }, NO_BLOBS_PROJECTION);
    if (byId) return byId;

    const byEmployeeId = await employeeCol.findOne({
      $or: [{ employeeId: trimmed.toUpperCase() }, { employeeId: trimmed }],
    }, NO_BLOBS_PROJECTION);
    if (byEmployeeId) return byEmployeeId;
  }

  if (userEmail) {
    const byLoginEmail = await findEmployeeByLoginEmail(userEmail);
    if (byLoginEmail) return byLoginEmail;
  }

  if (userEmail) {
    const userCol = getUserCollection();
    const normalized = normalizeLoginEmail(userEmail);
    const user =
      (await userCol.findOne({ id: trimmed })) ??
      (await userCol.findOne({ email: normalized })) ??
      (await userCol.findOne({
        email: { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') },
      }));

    if (user?.id && user.id !== trimmed) {
      const byLinkedUserId = await employeeCol.findOne({ id: user.id }, NO_BLOBS_PROJECTION);
      if (byLinkedUserId) return byLinkedUserId;
    }
  }

  return null;
}

/** True when the logged-in user may view this employee record (own profile). */
export async function employeeBelongsToAuthUser(
  employee: { id: string; employeeId?: string; email?: string; personalEmail?: string },
  userId: string,
  userEmail?: string,
): Promise<boolean> {
  const own = await resolveEmployeeForAuthUser(userId, userEmail);
  if (
    own &&
    (own.id === employee.id ||
      (own.employeeId && own.employeeId === employee.employeeId))
  ) {
    return true;
  }

  const trimmed = String(userId ?? '').trim();
  if (
    trimmed &&
    (employee.id === trimmed ||
      employee.employeeId === trimmed ||
      employee.employeeId === trimmed.toUpperCase())
  ) {
    return true;
  }

  if (userEmail && employeeEmailsInclude(employee, userEmail)) {
    return true;
  }

  return false;
}

function getUserCollection(): Collection<any> {
  return getDB().collection('users');
}

export function getEmployeeLoginEmails(employee: {
  email?: string;
  personalEmail?: string;
}): string[] {
  const emails = [employee.email, employee.personalEmail]
    .filter((value) => value && String(value).trim())
    .map((value) => normalizeLoginEmail(String(value)));
  return [...new Set(emails)];
}

export async function findUserForEmployee(
  employee: { id: string; email?: string; personalEmail?: string },
  loginEmail?: string,
) {
  const col = getUserCollection();
  const byId = await col.findOne({ id: employee.id });
  if (byId) return byId;

  const emails = getEmployeeLoginEmails(employee);
  if (loginEmail) {
    emails.push(normalizeLoginEmail(loginEmail));
  }
  const uniqueEmails = [...new Set(emails)];
  if (!uniqueEmails.length) return null;

  let byEmail = await col.findOne({ email: { $in: uniqueEmails } });
  if (!byEmail && loginEmail) {
    const normalized = normalizeLoginEmail(loginEmail);
    byEmail = await col.findOne({
      email: { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') },
    });
  }
  if (!byEmail) {
    const patterns = uniqueEmails.map((e) => new RegExp(`^${escapeRegex(e)}$`, 'i'));
    byEmail = await col.findOne({ email: { $in: patterns } });
  }
  if (byEmail && byEmail.id !== employee.id) {
    await col.updateOne(
      { _id: byEmail._id },
      { $set: { id: employee.id, updatedAt: new Date() } },
    );
    return { ...byEmail, id: employee.id };
  }

  return byEmail;
}

/** Keep the linked users row aligned with the canonical employee profile. */
export async function syncUserAccountFromEmployee(employee: {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  personalEmail?: string;
  designation?: string;
  joinedAt?: string;
}): Promise<void> {
  const user = await findUserForEmployee(employee);
  if (!user) return;

  const name =
    [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim() ||
    'Employee';
  const loginEmail =
    (employee.email && String(employee.email).trim()) ||
    (employee.personalEmail && String(employee.personalEmail).trim()) ||
    user.email;

  const updates: Record<string, unknown> = {
    id: employee.id,
    name,
    email: normalizeLoginEmail(String(loginEmail)),
    designation: employee.designation || user.designation || 'Employee',
    updatedAt: new Date(),
  };
  if (employee.joinedAt) {
    updates.joinedAt = employee.joinedAt;
  }

  await getUserCollection().updateOne({ _id: user._id }, { $set: updates });
}

export async function ensureUserAccountForEmployee(
  employee: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    personalEmail?: string;
    role?: string;
    designation?: string;
    joinedAt?: string;
  },
  password = OAUTH_ONLY_EMPLOYEE_PASSWORD,
) {
  const col = getUserCollection();
  const existing = await findUserForEmployee(employee);
  if (existing) {
    if (existing.id !== employee.id) {
      await col.updateOne(
        { _id: existing._id },
        { $set: { id: employee.id, updatedAt: new Date() } },
      );
    }
    return existing;
  }

  const loginEmail =
    (employee.email && String(employee.email).trim()) ||
    (employee.personalEmail && String(employee.personalEmail).trim()) ||
    '';
  if (!loginEmail) return null;

  const passwordHash = await bcrypt.hash(password ?? OAUTH_ONLY_EMPLOYEE_PASSWORD, 10);
  const name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Employee';
  const user = {
    id: employee.id,
    name,
    email: normalizeLoginEmail(loginEmail),
    passwordHash,
    role: employee.role === 'Admin' ? 'Admin' : 'Employee',
    designation: employee.designation || 'Employee',
    joinedAt: employee.joinedAt || new Date().toISOString().split('T')[0],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await col.insertOne(user);
  return { ...user, _id: result.insertedId };
}

export async function resolveUserForPasswordLogin(email: string) {
  const normalized = normalizeLoginEmail(email);
  const col = getUserCollection();

  if (normalized === getAdminLoginEmail()) {
    const adminUser = await col.findOne({ role: 'Admin' });
    return { user: adminUser, employee: null, loginEmail: normalized };
  }

  let user =
    (await col.findOne({ email: normalized })) ??
    (await col.findOne({
      email: { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') },
    }));

  // Commented out to allow employee password login in development
  // const employee = await findEmployeeByLoginEmail(normalized);
  // if (employee) {
  //   throw new EmployeeLoginError(
  //     'Employee accounts must sign in with Google. Use Continue with Google below.',
  //     403,
  //   );
  // }

  return { user, employee: null, loginEmail: normalized };
}

export async function resolveUserForOAuthLogin(email: string) {
  const normalized = normalizeLoginEmail(email);

  if (normalized === getAdminLoginEmail()) {
    return { user: await getUserCollection().findOne({ role: 'Admin' }), employee: null };
  }

  const employee = await findEmployeeByLoginEmail(normalized);
  if (!employee) {
    return { user: null, employee: null };
  }

  assertLoginEmailAllowedForEmployee(employee, normalized);

  let user = await findUserForEmployee(employee, normalized);
  if (!user) {
    user = await ensureUserAccountForEmployee(employee, OAUTH_ONLY_EMPLOYEE_PASSWORD);
  }

  return { user, employee };
}

export async function getPayslipEmailCandidates(userId: string, userEmail?: string): Promise<string[]> {
  const employee = await resolveEmployeeForAuthUser(userId, userEmail);
  if (employee) {
    return getEmployeeLoginEmails(employee);
  }
  return userEmail ? [normalizeLoginEmail(userEmail)] : [];
}
