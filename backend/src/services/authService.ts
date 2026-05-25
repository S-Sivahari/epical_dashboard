import bcrypt from 'bcryptjs';
import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { User, CreateUserPayload } from '../models/User';
import { generateToken } from '../utils/generateToken';

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
  const col = getUserCollection();
  const normalizedEmail = email.toLowerCase().trim();

  let user = await col.findOne({ email: normalizedEmail });

  // Personal email fallback: if no user found with the given email,
  // check if an employee has this as their personalEmail.
  if (!user) {
    const employeeCol = getDB().collection('employees');
    const employee = await employeeCol.findOne({ personalEmail: normalizedEmail });

    if (employee) {
      // If the employee has been assigned a company email, reject personal email login
      if (employee.email && employee.email.trim() !== '') {
        throw Object.assign(
          new Error(`Your company email has been set. Please sign in using your company email.`),
          { status: 401 }
        );
      }
      // No company email assigned — allow login via personal email
      user = await col.findOne({ email: normalizedEmail });
    }
  }

  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const token = generateToken({ id: user.id, email: user.email, role: String(user.role) });

  const { passwordHash, _id, ...safeUser } = user;
  return {
    token,
    user: safeUser,
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
      name: 'Priya Nair',
      email: 'admin@company.com',
      password: 'admin123',
      role: 'Admin',
      designation: 'HR Director',
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
