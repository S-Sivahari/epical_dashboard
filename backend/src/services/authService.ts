import bcrypt from 'bcryptjs';
import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { User, CreateUserPayload } from '../models/User';
import { generateToken, normalizeApiRole } from '../utils/generateToken';
import {
  ensureUserAccountForEmployee,
  getAdminLoginEmail,
  normalizeLoginEmail,
  resolveEmployeeForAuthUser,
  canTogglePortal,
  resolveUserForPasswordLogin,
} from '../utils/employeeAuth';
import { defaultActivePortalForLogin, employeeHasPortalAdmin } from '../utils/portalAccess';
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
): Promise<{ token: string; user: Omit<User, 'passwordHash'>; role: string; portalAdmin: boolean }> {
  const normalized = normalizeLoginEmail(email);
  if (normalized !== getAdminLoginEmail()) {
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
    portalAdmin: false,
  };
}

export async function getUserById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
  const col = getUserCollection();
  const user = await col.findOne({ id });
  if (!user) return null;
  const { passwordHash, _id, ...safeUser } = user;
  return safeUser;
}

export async function resolveSessionPortalAdmin(
  userId: string,
  userEmail?: string,
): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  const employee = await resolveEmployeeForAuthUser(userId, userEmail);
  return canTogglePortal(user, employee);
}

export function buildAuthTokenForUser(
  user: { id: string; email: string; role?: string; portalAdmin?: boolean },
  employee?: { portalAccess?: string; role?: string } | null,
  activePortal?: 'admin' | 'employee',
): string {
  const canToggle = employee ? canTogglePortal(user, employee) : false;
  const role =
    activePortal ??
    defaultActivePortalForLogin(user, employee ?? undefined);
  return generateToken({
    id: user.id,
    email: user.email,
    role,
    portalAdmin: canToggle || undefined,
  });
}

export async function switchUserPortal(
  userId: string,
  userEmail: string,
  targetPortal: 'admin' | 'employee',
): Promise<{ token: string; role: 'admin' | 'employee'; portalAdmin: boolean }> {
  const user = await getUserById(userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const employee = await resolveEmployeeForAuthUser(userId, userEmail);
  const portalAdmin = canTogglePortal(user, employee);

  if (!portalAdmin) {
    throw Object.assign(new Error('Portal switching is not available for this account.'), {
      status: 403,
    });
  }

  if (targetPortal === 'admin' && !employeeHasPortalAdmin(employee)) {
    throw Object.assign(new Error('You do not have admin portal access.'), { status: 403 });
  }

  const role = normalizeApiRole(targetPortal);
  const token = generateToken({
    id: user.id,
    email: userEmail || user.email,
    role,
    portalAdmin: portalAdmin || undefined,
  });

  return { token, role, portalAdmin };
}

export async function updateUserName(
  id: string,
  name: string,
): Promise<Omit<User, 'passwordHash'>> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw Object.assign(new Error('Name is required'), { status: 400 });
  }
  const col = getUserCollection();
  const user = await col.findOne({ id });
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  await col.updateOne({ id }, { $set: { name: trimmed, updatedAt: new Date() } });
  const updated = await getUserById(id);
  if (!updated) throw Object.assign(new Error('User not found'), { status: 404 });
  return updated;
}

/**
 * Update the admin-portal display name independently of the employee name.
 * Called only when the user is acting on the admin portal (JWT role = admin).
 * For pure admin accounts this is the same as their primary name.
 * For Employee+Admin dual-role accounts this keeps the two identities separate.
 */
export async function updateAdminDisplayName(
  id: string,
  adminDisplayName: string,
): Promise<Omit<User, 'passwordHash'>> {
  const trimmed = adminDisplayName.trim();
  if (!trimmed) {
    throw Object.assign(new Error('Name is required'), { status: 400 });
  }
  const col = getUserCollection();
  const user = await col.findOne({ id });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // For the pure system-admin account, keep name and adminDisplayName in sync.
  const isPureAdmin = String(user.role) === 'Admin';
  const patch: Record<string, unknown> = { adminDisplayName: trimmed, updatedAt: new Date() };
  if (isPureAdmin) patch.name = trimmed;

  await col.updateOne({ id }, { $set: patch });
  const updated = await getUserById(id);
  if (!updated) throw Object.assign(new Error('User not found'), { status: 404 });
  return updated;
}

const MAX_PREFERRED_TIMEZONES = 12;

function isValidIanaTimeZone(zone: string): boolean {
  const candidates = [zone]
  // City prefs may be stored as "Europe/Berlin::Munich" — validate the IANA prefix.
  if (zone.includes('::')) {
    candidates.unshift(zone.split('::')[0]!.trim())
  }
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      Intl.DateTimeFormat(undefined, { timeZone: candidate }).format(new Date())
      return true
    } catch {
      /* try next */
    }
  }
  return false
}

export function normalizePreferredTimezones(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw Object.assign(new Error('preferredTimezones must be an array'), { status: 400 });
  }

  const zones: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const zone = String(raw ?? '').trim();
    if (!zone || seen.has(zone)) continue;
    if (!isValidIanaTimeZone(zone)) {
      throw Object.assign(new Error(`Invalid timezone: ${zone}`), { status: 400 });
    }
    seen.add(zone);
    zones.push(zone);
    if (zones.length > MAX_PREFERRED_TIMEZONES) {
      throw Object.assign(
        new Error(`You can save at most ${MAX_PREFERRED_TIMEZONES} timezones`),
        { status: 400 },
      );
    }
  }

  if (zones.length === 0) {
    throw Object.assign(new Error('Add at least one timezone'), { status: 400 });
  }

  return zones;
}

export async function updatePreferredTimezones(
  id: string,
  preferredTimezones: unknown,
): Promise<Omit<User, 'passwordHash'>> {
  const zones = normalizePreferredTimezones(preferredTimezones);
  const col = getUserCollection();
  const user = await col.findOne({ id });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  await col.updateOne(
    { id },
    { $set: { preferredTimezones: zones, updatedAt: new Date() } },
  );
  const updated = await getUserById(id);
  if (!updated) throw Object.assign(new Error('User not found'), { status: 404 });
  return updated;
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

const DEFAULT_ADMIN_NAME = 'Epical Admin';

function defaultAdminPayload(): CreateUserPayload {
  return {
    id: 'ADM-1',
    name: DEFAULT_ADMIN_NAME,
    email: env.ADMIN_EMAIL,
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

/** Legacy employees with role Admin become Employee+Admin portal access. */
async function migrateEmployeeAdminRoles(): Promise<void> {
  await getDB()
    .collection('employees')
    .updateMany({ role: 'Admin' }, {
      $set: { portalAccess: 'Employee+Admin', role: 'Employee', updatedAt: new Date() },
    });
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
    await migrateEmployeeAdminRoles();
    return { created: true, updated: false };
  }

  const updates: Record<string, unknown> = {};

  if (existing.id !== admin.id) {
    updates.id = admin.id;
  }
  if (existing.role !== 'Admin') {
    updates.role = 'Admin';
  }
  // Only set the default name when the record has no name at all — never overwrite
  // a name the admin has already customised via the edit-profile modal.
  if (!existing.name) {
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
  await migrateEmployeeAdminRoles();

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
