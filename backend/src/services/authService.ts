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

  const valid = await bcrypt.compare(password, user.passwordHash);
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

/** Create the default admin account or sync its display name from env. */
export async function ensureDefaultAdminUser(): Promise<{ created: boolean; updated: boolean }> {
  const col = getUserCollection();
  const admin = defaultAdminPayload();
  const existing = await col.findOne({ email: admin.email });

  if (!existing) {
    await createUser(admin);
    return { created: true, updated: false };
  }

  if (existing.name !== admin.name) {
    await col.updateOne(
      { email: admin.email },
      { $set: { name: admin.name, updatedAt: new Date() } },
    );
    return { created: false, updated: true };
  }

  return { created: false, updated: false };
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
