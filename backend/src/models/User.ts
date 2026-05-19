import { ObjectId } from 'mongodb';

export type UserRole = 'Admin' | 'Employee';

export interface User {
  _id?: ObjectId;
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  department: string;
  designation: string;
  joinedAt: string;
  avatarUrl?: string;
  employeeId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateUserPayload {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: string;
  designation: string;
  joinedAt: string;
  avatarUrl?: string;
  employeeId?: string;
}
