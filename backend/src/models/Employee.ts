import { ObjectId } from 'mongodb';

export type EmploymentType = 'Full-time' | 'Contract' | 'Intern';
export type EmployeeStatus = 'Active' | 'On Leave' | 'Probation' | 'Inactive' | 'Deactivated' | 'Notice Period';
export type EmployeeView = 'Public' | 'Private';

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
  /** Public — included in projects. Private — company record only, excluded from project/cell allocation. */
  view?: EmployeeView;
  portalAccess?: 'Employee' | 'Employee+Admin';
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
  /** Per-employee annual leave day allotments (admin-overridable). Earned Leave here is legacy-only; see earnedLeaveAccrual. */
  leaveAllocations?: Partial<Record<'Casual Leave' | 'Sick Leave' | 'Earned Leave', number>>;
  /**
   * Persisted earned-leave accrual checkpoint for the current calendar year.
   * `monthsAccrued` is the count of completed employed months already folded into `total`.
   * Recomputed only when a new month completes; manual admin edits rebase `total`/`monthsAccrued`
   * to "now" instead of being overwritten by the next month-end recompute.
   */
  earnedLeaveAccrual?: { year: number; monthsAccrued: number; total: number };
  /** Admin manual used-day adjustments per calendar year (added to approved usage). */
  leaveBalanceAdjustments?: Partial<
    Record<string, Partial<Record<'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Compensation Leave', number>>>
  >;
  /** New joiners: earned leave accrues only after each calendar month ends. */
  earnedLeaveMonthEndAccrual?: boolean;
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
