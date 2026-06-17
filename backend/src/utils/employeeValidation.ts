import type { CreateEmployeePayload, Employee, UpdateEmployeePayload } from '../models/Employee';

export const EMPLOYEE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMPLOYEE_PHONE_MIN_LENGTH = 10;
export const EMPLOYEE_EMPLOYMENT_TYPES = ['Full-time', 'Contract', 'Intern'] as const;

const PROFILE_UPDATE_KEYS = new Set([
  'employeeId',
  'firstName',
  'middleName',
  'lastName',
  'permanentAddress',
  'communicationAddress',
  'dob',
  'gender',
  'phone',
  'personalEmail',
  'email',
  'bankName',
  'accountNumber',
  'ifsc',
  'uan',
  'pfEsi',
  'employmentType',
  'joinedAt',
  'ctc',
  'aadhaar',
  'pan',
  'passport',
  'emergencyContact',
]);

export function validationError(message: string): Error {
  const err: any = new Error(message);
  err.code = 'VALIDATION_ERROR';
  return err;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw validationError(`${label} is required`);
  }
  return value.trim();
}

function requireValidDate(value: unknown, label: string): string {
  const trimmed = requireNonEmptyString(value, label);
  if (Number.isNaN(Date.parse(trimmed))) {
    throw validationError(`Enter a valid ${label.toLowerCase()}`);
  }
  return trimmed;
}

function requireValidEmail(value: unknown, label: string): string {
  const trimmed = requireNonEmptyString(value, label);
  if (!EMPLOYEE_EMAIL_REGEX.test(trimmed)) {
    throw validationError(`Enter a valid ${label.toLowerCase()}`);
  }
  return trimmed.toLowerCase();
}

function requireOptionalValidEmail(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (!EMPLOYEE_EMAIL_REGEX.test(trimmed)) {
    throw validationError(`Enter a valid ${label.toLowerCase()}`);
  }
  return trimmed.toLowerCase();
}

/** Matches admin add/edit form required fields. */
export function validateEmployeeProfile(data: {
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  permanentAddress?: string;
  communicationAddress?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  personalEmail?: string;
  email?: string;
  joinedAt?: string;
  employmentType?: string;
  pan?: string;
  emergencyContact?: Employee['emergencyContact'];
}): void {
  requireNonEmptyString(data.employeeId, 'Employee ID');
  requireNonEmptyString(data.firstName, 'First name');
  requireNonEmptyString(data.lastName, 'Last name');
  requireNonEmptyString(data.permanentAddress, 'Permanent address');
  requireNonEmptyString(data.communicationAddress, 'Communication address');
  requireNonEmptyString(data.gender, 'Gender');
  requireValidDate(data.dob, 'Date of birth');
  requireValidDate(data.joinedAt, 'Joining date');
  requireValidEmail(data.personalEmail, 'Personal email');
  requireOptionalValidEmail(data.email, 'Company email');

  const phone = requireNonEmptyString(data.phone, 'Phone');
  if (phone.length < EMPLOYEE_PHONE_MIN_LENGTH) {
    throw validationError('Enter a valid phone number');
  }

  const employmentType = requireNonEmptyString(data.employmentType, 'Employment type');
  if (!EMPLOYEE_EMPLOYMENT_TYPES.includes(employmentType as (typeof EMPLOYEE_EMPLOYMENT_TYPES)[number])) {
    throw validationError('Employment type is required');
  }

  requireNonEmptyString(data.pan, 'PAN');

  const emergency = data.emergencyContact;
  if (!emergency || typeof emergency !== 'object') {
    throw validationError('Emergency contact is required');
  }
  requireNonEmptyString(emergency.name, 'Emergency contact name');
  const emergencyPhone = requireNonEmptyString(emergency.phone, 'Emergency contact phone');
  if (emergencyPhone.length < EMPLOYEE_PHONE_MIN_LENGTH) {
    throw validationError('Emergency contact phone is required');
  }
  requireValidEmail(emergency.email, 'Emergency contact email');
  requireNonEmptyString(emergency.relation, 'Emergency contact relation');
  requireNonEmptyString(emergency.address, 'Emergency contact address');
}

export function isProfileFieldUpdate(payload: UpdateEmployeePayload): boolean {
  return Object.keys(payload).some((key) => PROFILE_UPDATE_KEYS.has(key));
}

export function mergeEmployeeProfileForValidation(
  existing: Employee,
  payload: UpdateEmployeePayload,
  emails: { personalEmail?: string; companyEmail?: string },
): Parameters<typeof validateEmployeeProfile>[0] {
  return {
    employeeId:
      payload.employeeId !== undefined
        ? String(payload.employeeId).trim().toUpperCase()
        : existing.employeeId,
    firstName: payload.firstName ?? existing.firstName,
    lastName: payload.lastName ?? existing.lastName,
    permanentAddress: payload.permanentAddress ?? existing.permanentAddress,
    communicationAddress: payload.communicationAddress ?? existing.communicationAddress,
    dob: payload.dob ?? existing.dob,
    gender: payload.gender ?? existing.gender,
    phone: payload.phone ?? existing.phone,
    personalEmail: emails.personalEmail ?? existing.personalEmail,
    email: emails.companyEmail ?? existing.email,
    joinedAt: payload.joinedAt ?? existing.joinedAt,
    employmentType: payload.employmentType ?? existing.employmentType,
    pan: payload.pan ?? existing.pan,
    emergencyContact:
      payload.emergencyContact !== undefined
        ? payload.emergencyContact
        : existing.emergencyContact,
  };
}

export function validateCreateEmployeePayload(payload: CreateEmployeePayload): void {
  validateEmployeeProfile({
    employeeId: payload.employeeId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    permanentAddress: payload.permanentAddress,
    communicationAddress: payload.communicationAddress,
    dob: payload.dob,
    gender: payload.gender,
    phone: payload.phone,
    personalEmail: payload.personalEmail,
    email: payload.email,
    joinedAt: payload.joinedAt,
    employmentType: payload.employmentType,
    pan: payload.pan,
    emergencyContact: payload.emergencyContact,
  });
}
