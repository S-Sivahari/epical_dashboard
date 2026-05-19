import { ObjectId } from 'mongodb';

export type EmploymentType = 'Full-time' | 'Contract' | 'Intern';
export type EmployeeStatus = 'Active' | 'On Leave' | 'Probation' | 'Inactive' | 'Deactivated' | 'Archived';

export interface Employee {
  _id?: ObjectId;
  id: string;
  employeeId?: string;
  firstName: string;
  lastName?: string;
  email: string;
  personalEmail?: string;
  phone?: string;
  address?: string;
  dob?: string;
  gender?: string;
  department: string;
  designation: string;
  role: string;
  employmentType: EmploymentType;
  joinedAt: string;
  status: EmployeeStatus;
  avatarUrl?: string;
  reportingManagerId?: string;
  reportingManager?: string;
  salaryGrade?: string;
  ctc?: number;
  // Account details
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  uan?: string;
  pfEsi?: 'on' | 'off';
  // ID proof
  aadhaar?: string;
  pan?: string;
  passport?: string;
  // Documents (stored as Base64 or file metadata)
  documents?: {
    aadhaarPan?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    offerLetter?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    certificates?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    agreement?: { filename: string; data: string; contentType: string; uploadedAt: Date };
  };
  // Profile photo
  photo?: { filename: string; data: string; contentType: string; uploadedAt: Date };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateEmployeePayload extends Omit<Employee, '_id' | 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export interface UpdateEmployeePayload extends Partial<CreateEmployeePayload> {}
