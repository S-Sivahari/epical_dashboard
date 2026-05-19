import { ObjectId } from 'mongodb';

export type EmploymentType = 'Full-time' | 'Contract' | 'Intern';
export type EmployeeStatus = 'Active' | 'On Leave' | 'Probation' | 'Inactive';

export interface Employee {
  _id?: ObjectId;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department: string;
  designation: string;
  role: string;
  employmentType: EmploymentType;
  joinedAt: string;
  status: EmployeeStatus;
  avatarUrl?: string;
  reportingManagerId?: string;
  salaryGrade?: string;
  ctc?: number;
  dob?: string;
  gender?: string;
  personalEmail?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  uan?: string;
  pfEsi?: 'on' | 'off';
  aadhaar?: string;
  pan?: string;
  passport?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateEmployeePayload extends Omit<Employee, '_id' | 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export interface UpdateEmployeePayload extends Partial<CreateEmployeePayload> {}
