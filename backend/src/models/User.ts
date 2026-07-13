import { ObjectId } from 'mongodb';

export type UserRole = 'Admin' | 'Employee';

export interface User {
  _id?: ObjectId;
  id: string;
  name: string;
  /** Separate display name shown only on the admin portal. Leaves employee-portal name untouched. */
  adminDisplayName?: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  designation: string;
  joinedAt: string;
  avatarUrl?: string;
  employeeId?: string;
  /** IANA timezones for the Ctrl+Left world-clock sidebar (order preserved). */
  preferredTimezones?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateUserPayload {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  designation: string;
  joinedAt: string;
  avatarUrl?: string;
  employeeId?: string;
}
