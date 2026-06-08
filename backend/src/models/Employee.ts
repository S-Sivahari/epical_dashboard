import { ObjectId } from 'mongodb';

export type EmploymentType = 'Full-time' | 'Contract' | 'Intern';
export type EmployeeStatus = 'Active' | 'On Leave' | 'Probation' | 'Inactive' | 'Deactivated' | 'Notice Period';

export interface Employee {
  _id?: ObjectId;
  id: string;
  employeeId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  personalEmail?: string;
  phone?: string;
  permanentAddress: string;
  communicationAddress: string;
  dob?: string;
  gender?: string;
  designation?: string;
  role: string;
  managerId?: string; // ID of the employee's manager
  employmentType: EmploymentType;
  joinedAt: string;
  status: EmployeeStatus;
  avatarUrl?: string;
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
  pan: string;
  passport?: string;
  // Emergency Contact
  emergencyContact: {
    name: string;
    phone: string;
    email: string;
    relation: string;
    address: string;
  };
  // Documents (stored as Base64 or file metadata)
  documents?: {
    aadhaarPan?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    aadhaar?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    pan?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    offerLetter?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    certificates?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    certificate10th?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    certificate12th?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    certificateDiploma?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    certificateDegree?: { filename: string; data: string; contentType: string; uploadedAt: Date };
    agreement?: { filename: string; data: string; contentType: string; uploadedAt: Date };
  };
  // Profile photo
  photo?: { filename: string; data: string; contentType: string; uploadedAt: Date };
  /** Per-employee annual leave day allotments (admin-overridable). */
  leaveAllocations?: Partial<Record<'Casual Leave' | 'Sick Leave' | 'Earned Leave', number>>;
  activityHistory?: EmployeeActivityEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type EmployeeActivityType = 'status_change' | 'profile_edit';

export interface EmployeeActivityEntry {
  type: EmployeeActivityType;
  at: Date;
  by: string;
  summary: string;
  reason?: string;
  fromStatus?: EmployeeStatus;
  toStatus?: EmployeeStatus;
  changedFields?: string[];
}

export interface CreateEmployeePayload extends Omit<Employee, '_id' | 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export interface UpdateEmployeePayload extends Partial<CreateEmployeePayload> {}
