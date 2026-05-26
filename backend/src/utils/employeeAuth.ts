import bcrypt from 'bcryptjs';
import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { env } from '../config/env';

export const ADMIN_LOGIN_EMAIL = (env.ADMIN_EMAIL || 'admin@company.com').toLowerCase().trim();
export const DEFAULT_EMPLOYEE_PASSWORD = 'employee123';

export function normalizeLoginEmail(email: string): string {
  return email.toLowerCase().trim();
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

export async function findEmployeeByLoginEmail(email: string) {
  const normalized = normalizeLoginEmail(email);
  return getDB().collection('employees').findOne({
    $or: [{ email: normalized }, { personalEmail: normalized }],
  });
}

export async function resolveEmployeeForAuthUser(userId: string, userEmail?: string) {
  const employeeCol = getDB().collection('employees');
  const byId = await employeeCol.findOne({ id: userId });
  if (byId) return byId;

  if (userEmail) {
    return findEmployeeByLoginEmail(userEmail);
  }

  return null;
}

function getUserCollection(): Collection<any> {
  return getDB().collection('users');
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

  const byEmail = await col.findOne({ email: { $in: uniqueEmails } });
  if (byEmail && byEmail.id !== employee.id) {
    await col.updateOne(
      { _id: byEmail._id },
      { $set: { id: employee.id, updatedAt: new Date() } },
    );
    return { ...byEmail, id: employee.id };
  }

  return byEmail;
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
  password = DEFAULT_EMPLOYEE_PASSWORD,
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

  const passwordHash =
    password === ''
      ? await bcrypt.hash('', 10)
      : await bcrypt.hash(password ?? DEFAULT_EMPLOYEE_PASSWORD, 10);
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

  if (normalized === ADMIN_LOGIN_EMAIL) {
    const adminUser = await col.findOne({ email: ADMIN_LOGIN_EMAIL, role: 'Admin' });
    return { user: adminUser, employee: null, loginEmail: normalized };
  }

  let user = await col.findOne({ email: normalized });
  const employee = await findEmployeeByLoginEmail(normalized);

  if (employee) {
    const linkedUser = await findUserForEmployee(employee, normalized);
    if (linkedUser) {
      user = linkedUser;
    } else {
      user = await ensureUserAccountForEmployee(employee);
    }
  }

  return { user, employee, loginEmail: normalized };
}

export async function resolveUserForOAuthLogin(email: string) {
  const normalized = normalizeLoginEmail(email);

  if (normalized === ADMIN_LOGIN_EMAIL) {
    return { user: await getUserCollection().findOne({ email: ADMIN_LOGIN_EMAIL, role: 'Admin' }), employee: null };
  }

  const employee = await findEmployeeByLoginEmail(normalized);
  if (!employee) {
    return { user: null, employee: null };
  }

  let user = await findUserForEmployee(employee, normalized);
  if (!user) {
    user = await ensureUserAccountForEmployee(employee, '');
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
