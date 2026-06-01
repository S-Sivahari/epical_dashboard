import bcrypt from 'bcryptjs';
import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { User, CreateUserPayload } from '../models/User';
import { generateToken } from '../utils/generateToken';
import {
  ADMIN_LOGIN_EMAIL,
  ensureUserAccountForEmployee,
  resolveUserForPasswordLogin,
} from '../utils/employeeAuth';
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
  const { user, loginEmail } = await resolveUserForPasswordLogin(email);

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

export async function seedDefaultUsers(): Promise<{ created: string[]; skipped: string[] }> {
  const col = getUserCollection();
  const created: string[] = [];
  const skipped: string[] = [];

  const defaults: CreateUserPayload[] = [
    {
      id: 'ADM-1',
      name: env.ADMIN_NAME || 'Admin User',
      email: ADMIN_LOGIN_EMAIL,
      password: env.ADMIN_PASSWORD || 'admin123',
      role: 'Admin',
      designation: 'Administrator',
      joinedAt: '2019-04-01',
    },
    {
      id: 'EMP-2024-0847',
      name: 'Sarah Mitchell',
      email: 'employee@company.com',
      password: 'employee123',
      role: 'Employee',
      designation: 'Senior Product Designer',
      joinedAt: '2021-03-15',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    },
  ];

  for (const u of defaults) {
    const existing = await col.findOne({ email: u.email });
    if (existing) {
      skipped.push(u.email);
    } else {
      await createUser(u);
      created.push(u.email);
    }
  }

  return { created, skipped };
}

export { ensureUserAccountForEmployee };
