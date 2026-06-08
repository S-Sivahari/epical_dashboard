import bcrypt from 'bcryptjs';
import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { User, CreateUserPayload } from '../models/User';
import { generateToken } from '../utils/generateToken';
import {
  ADMIN_LOGIN_EMAIL,
  ensureUserAccountForEmployee,
  normalizeLoginEmail,
  resolveUserForPasswordLogin,
} from '../utils/employeeAuth';
import { EmployeeLoginError } from '../utils/employeeLoginRules';
import { env } from '../config/env';

let userCollection: Collection<any> | null = null;

function getUserCollection(): Collection<any> {
  if (!userCollection) {
    userCollection = getDB().collection('users');
  }
  return userCollection;
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user: Omit<User, 'passwordHash'>; role: string }> {
  const normalized = normalizeLoginEmail(email);
  if (normalized !== ADMIN_LOGIN_EMAIL) {
    throw Object.assign(
      new Error('Employee accounts must sign in with Google. Use Continue with Google.'),
      { status: 403 },
    );
  }

  let user: any;
  let loginEmail: string;
  try {
    const resolved = await resolveUserForPasswordLogin(email);
    user = resolved.user;
    loginEmail = resolved.loginEmail;
  } catch (err) {
    if (err instanceof EmployeeLoginError) {
      throw Object.assign(new Error(err.message), { status: err.status });
    }
    throw err;
  }

  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  if (String(user.role) !== 'Admin') {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const envPassword = env.ADMIN_PASSWORD || 'admin123';
  let valid =
    password === envPassword ||
    (user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false);

  // Keep stored hash aligned when env password changed without a server restart
  if (valid && password === envPassword && user.passwordHash) {
    const hashMatchesEnv = await bcrypt.compare(envPassword, user.passwordHash);
    if (!hashMatchesEnv) {
      await getUserCollection().updateOne(
        { _id: user._id },
        { $set: { passwordHash: await bcrypt.hash(envPassword, 10), updatedAt: new Date() } },
      );
    }
  }

  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const sessionEmail = loginEmail || user.email;
  const token = generateToken({ id: user.id, email: sessionEmail, role: String(user.role) });

  const { passwordHash, _id, ...safeUser } = user;
  return {
    token,
    user: { ...safeUser, email: sessionEmail },
    role: user.role === 'Admin' ? 'admin' : 'employee',
  };
}

export async function getUserById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
  const col = getUserCollection();
  const user = await col.findOne({ id });
  if (!user) return null;
  const { passwordHash, _id, ...safeUser } = user;
  return safeUser;
}

export async function createUser(payload: CreateUserPayload): Promise<Omit<User, 'passwordHash'>> {
  const col = getUserCollection();
  const passwordHash = await bcrypt.hash(payload.password, 10);
  const user: any = {
    ...payload,
    email: payload.email.toLowerCase().trim(),
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  delete user.password;
  await col.insertOne(user);
  const { passwordHash: ph, _id, ...safeUser } = user;
  return safeUser;
}

function defaultAdminPayload(): CreateUserPayload {
  return {
    id: 'ADM-1',
    name: env.ADMIN_NAME || 'Epical Admin',
    email: ADMIN_LOGIN_EMAIL,
    password: env.ADMIN_PASSWORD || 'admin123',
    role: 'Admin',
    designation: 'Administrator',
    joinedAt: '2019-04-01',
  };
}

/** Remove every Admin user except the single env-configured account. */
async function purgeExtraAdminUsers(canonicalEmail: string): Promise<number> {
  const col = getUserCollection();
  const result = await col.deleteMany({
    role: 'Admin',
    email: { $ne: canonicalEmail },
  });
  const duplicates = await col.find({ role: 'Admin' }).toArray();
  if (duplicates.length > 1) {
    const keep = duplicates.find(
      (u) => normalizeLoginEmail(String(u.email ?? '')) === canonicalEmail,
    );
    if (keep) {
      const dupResult = await col.deleteMany({
        role: 'Admin',
        _id: { $ne: keep._id },
      });
      return result.deletedCount + dupResult.deletedCount;
    }
  }
  return result.deletedCount;
}

/** Employees cannot be portal admins — only the env-backed users row is Admin. */
async function demoteEmployeeAdminRoles(): Promise<void> {
  await getDB()
    .collection('employees')
    .updateMany({ role: 'Admin' }, { $set: { role: 'Employee', updatedAt: new Date() } });
}

/** Create the single env admin account, sync credentials, and remove any other admins. */
export async function ensureDefaultAdminUser(): Promise<{ created: boolean; updated: boolean }> {
  const col = getUserCollection();
  const admin = defaultAdminPayload();

  const existing =
    (await col.findOne({ id: admin.id })) ??
    (await col.findOne({ email: admin.email, role: 'Admin' })) ??
    (await col.findOne({ role: 'Admin' }));

  if (!existing) {
    await createUser(admin);
    await purgeExtraAdminUsers(admin.email);
    await demoteEmployeeAdminRoles();
    return { created: true, updated: false };
  }

  const updates: Record<string, unknown> = {};

  if (existing.id !== admin.id) {
    updates.id = admin.id;
  }
  if (existing.role !== 'Admin') {
    updates.role = 'Admin';
  }
  if (existing.name !== admin.name) {
    updates.name = admin.name;
  }
  if (normalizeLoginEmail(String(existing.email ?? '')) !== admin.email) {
    updates.email = admin.email;
  }

  const passwordMatches = existing.passwordHash
    ? await bcrypt.compare(admin.password, existing.passwordHash)
    : false;
  if (!passwordMatches) {
    updates.passwordHash = await bcrypt.hash(admin.password, 10);
  }

  let updated = false;
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await col.updateOne({ _id: existing._id }, { $set: updates });
    updated = true;
  }

  await purgeExtraAdminUsers(admin.email);
  await demoteEmployeeAdminRoles();

  return { created: false, updated };
}

export async function seedDefaultUsers(): Promise<{ created: string[]; skipped: string[]; updated: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const updated: string[] = [];

  const admin = defaultAdminPayload();
  const result = await ensureDefaultAdminUser();
  if (result.created) created.push(admin.email);
  else if (result.updated) updated.push(admin.email);
  else skipped.push(admin.email);

  return { created, skipped, updated };
}

export { ensureUserAccountForEmployee };
