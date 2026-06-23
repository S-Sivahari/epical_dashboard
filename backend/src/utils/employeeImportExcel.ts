import ExcelJS from 'exceljs';
import type { CreateEmployeePayload, EmploymentType } from '../models/Employee';
import { normalizeEmployeeView } from './employeeView';

/** Column order matches the Add Employee form sections. */
export const EMPLOYEE_IMPORT_HEADERS = [
  'Employee ID',
  'First Name',
  'Middle Name',
  'Last Name',
  'Date of Birth',
  'Gender',
  'Phone',
  'Personal Email',
  'Company Email',
  'View',
  'Permanent Address',
  'Communication Address',
  'Bank Name',
  'Account Number',
  'IFSC',
  'UAN',
  'PF ESI',
  'Joined At',
  'Employment Type',
  'Role',
  'CTC',
  'Aadhaar',
  'PAN',
  'Passport',
  'Emergency Contact Name',
  'Emergency Contact Phone',
  'Emergency Contact Email',
  'Emergency Contact Relation',
  'Emergency Contact Address',
] as const;

const GENDER_OPTIONS = ['Male', 'Female', 'Not prefer to say'] as const;
const EMPLOYMENT_TYPE_OPTIONS = ['Full-time', 'Contract', 'Intern'] as const;
const ROLE_OPTIONS = ['Employee', 'Admin'] as const;
const VIEW_OPTIONS = ['Public', 'Private'] as const;
const PF_ESI_OPTIONS = ['Enabled', 'Disabled'] as const;

const IMPORT_TEMPLATE_DATA_ROWS = 500;

const COMPANY_NAME = 'EPICAL LAYOUTS PVT LTD';
const BRAND_GREEN_ARGB = 'FF06C033';
const TITLE_ROW = 1;
const HEADER_ROW = 2;
const FIRST_DATA_ROW = 3;

const COLUMN_KEYS = {
  employeeId: 'Employee ID',
  firstName: 'First Name',
  middleName: 'Middle Name',
  lastName: 'Last Name',
  personalEmail: 'Personal Email',
  companyEmail: 'Company Email',
  view: 'View',
  phone: 'Phone',
  dob: 'Date of Birth',
  gender: 'Gender',
  permanentAddress: 'Permanent Address',
  communicationAddress: 'Communication Address',
  joinedAt: 'Joined At',
  employmentType: 'Employment Type',
  role: 'Role',
  pan: 'PAN',
  aadhaar: 'Aadhaar',
  passport: 'Passport',
  bankName: 'Bank Name',
  accountNumber: 'Account Number',
  ifsc: 'IFSC',
  uan: 'UAN',
  pfEsi: 'PF ESI',
  ctc: 'CTC',
  emergencyContactName: 'Emergency Contact Name',
  emergencyContactPhone: 'Emergency Contact Phone',
  emergencyContactEmail: 'Emergency Contact Email',
  emergencyContactRelation: 'Emergency Contact Relation',
  emergencyContactAddress: 'Emergency Contact Address',
} as const;

type ColumnKey = keyof typeof COLUMN_KEYS;

const HEADER_ALIASES: Record<string, ColumnKey> = {
  employeeid: 'employeeId',
  epl: 'employeeId',
  employee: 'employeeId',
  firstname: 'firstName',
  middlename: 'middleName',
  lastname: 'lastName',
  personalemail: 'personalEmail',
  companyemail: 'companyEmail',
  email: 'companyEmail',
  view: 'view',
  phone: 'phone',
  mobileno: 'phone',
  mobile: 'phone',
  dateofbirth: 'dob',
  dob: 'dob',
  gender: 'gender',
  permanentaddress: 'permanentAddress',
  communicationaddress: 'communicationAddress',
  joinedat: 'joinedAt',
  joiningdate: 'joinedAt',
  employmenttype: 'employmentType',
  role: 'role',
  pan: 'pan',
  aadhaar: 'aadhaar',
  passport: 'passport',
  bankname: 'bankName',
  accountnumber: 'accountNumber',
  ifsc: 'ifsc',
  uan: 'uan',
  pfesi: 'pfEsi',
  ctc: 'ctc',
  emergencycontactname: 'emergencyContactName',
  emergencycontactphone: 'emergencyContactPhone',
  emergencycontactemail: 'emergencyContactEmail',
  emergencycontactrelation: 'emergencyContactRelation',
  emergencycontactaddress: 'emergencyContactAddress',
};

export type ParsedEmployeeImportRow = {
  rowNumber: number;
  payload: CreateEmployeePayload;
  errors: string[];
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function excelCellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join('').trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    return result == null ? '' : String(result).trim();
  }
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text: string }).text).trim();
  }
  return String(value).trim();
}

function parseDateCell(value: ExcelJS.CellValue): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }
  const text = excelCellText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return text;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    if (headerRow > 0) return;
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      cells.push(normalizeHeader(excelCellText(cell.value)));
    });
    if (cells.some((c) => c.includes('firstname') || c.includes('employeeid'))) {
      headerRow = rowNumber;
    }
  });
  return headerRow;
}

function resolveEmployeeImportSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  const employeesSheet = wb.getWorksheet('Employees');
  if (employeesSheet) return employeesSheet;

  for (const sheet of wb.worksheets) {
    if (findHeaderRow(sheet) > 0) return sheet;
  }

  return wb.worksheets[0];
}

function buildColumnIndex(headerRow: ExcelJS.Row): Map<number, ColumnKey> {
  const map = new Map<number, ColumnKey>();
  headerRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(excelCellText(cell.value));
    if (!normalized) return;
    if (HEADER_ALIASES[normalized]) {
      map.set(colNumber, HEADER_ALIASES[normalized]);
      return;
    }
    for (const [key, label] of Object.entries(COLUMN_KEYS)) {
      if (normalizeHeader(label) === normalized) {
        map.set(colNumber, key as ColumnKey);
      }
    }
  });
  return map;
}

function getRowValue(row: ExcelJS.Row, columnIndex: Map<number, ColumnKey>, key: ColumnKey): string {
  for (const [col, mappedKey] of columnIndex.entries()) {
    if (mappedKey !== key) continue;
    const cell = row.getCell(col);
    if (key === 'dob' || key === 'joinedAt') return parseDateCell(cell.value);
    return excelCellText(cell.value);
  }
  return '';
}

function parseEmploymentType(value: string): EmploymentType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'full-time' || normalized === 'full time' || normalized === 'fulltime') return 'Full-time';
  if (normalized === 'contract') return 'Contract';
  if (normalized === 'intern') return 'Intern';
  return null;
}

function validateImportRow(values: Record<ColumnKey, string>): string[] {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!values.employeeId.trim()) errors.push('Employee ID is required');
  if (!values.firstName.trim()) errors.push('First name is required');
  if (!values.lastName.trim()) errors.push('Last name is required');
  if (!values.personalEmail.trim() && !values.companyEmail.trim()) {
    errors.push('At least one email (personal or company) is required');
  }
  if (values.personalEmail && !emailRegex.test(values.personalEmail.trim())) {
    errors.push('Invalid personal email');
  }
  if (values.companyEmail && !emailRegex.test(values.companyEmail.trim())) {
    errors.push('Invalid company email');
  }
  if (values.personalEmail && values.companyEmail &&
    values.personalEmail.trim().toLowerCase() === values.companyEmail.trim().toLowerCase()) {
    errors.push('Personal and company email must differ');
  }
  if (!values.phone.trim()) errors.push('Phone is required');
  if (!values.dob.trim()) errors.push('Date of birth is required');
  if (!values.gender.trim()) errors.push('Gender is required');
  if (!values.permanentAddress.trim()) errors.push('Permanent address is required');
  if (!values.communicationAddress.trim()) errors.push('Communication address is required');
  if (!values.joinedAt.trim()) errors.push('Joined date is required');
  if (!values.employmentType.trim()) errors.push('Employment type is required');
  else if (!parseEmploymentType(values.employmentType)) errors.push('Employment type must be Full-time, Contract, or Intern');
  if (!values.pan.trim()) errors.push('PAN is required');
  if (!values.emergencyContactName.trim()) errors.push('Emergency contact name is required');
  if (!values.emergencyContactPhone.trim()) errors.push('Emergency contact phone is required');
  if (!values.emergencyContactEmail.trim()) errors.push('Emergency contact email is required');
  else if (!emailRegex.test(values.emergencyContactEmail.trim())) errors.push('Invalid emergency contact email');
  if (!values.emergencyContactRelation.trim()) errors.push('Emergency contact relation is required');
  if (!values.emergencyContactAddress.trim()) errors.push('Emergency contact address is required');

  const viewRaw = values.view.trim();
  if (viewRaw && !VIEW_OPTIONS.some((option) => option.toLowerCase() === viewRaw.toLowerCase())) {
    errors.push('View must be Public or Private');
  }

  return errors;
}

function rowToPayload(values: Record<ColumnKey, string>): CreateEmployeePayload {
  const employmentType = parseEmploymentType(values.employmentType) ?? 'Full-time';
  const roleRaw = values.role.trim();
  const role = roleRaw.toLowerCase() === 'admin' ? 'Admin' : 'Employee';
  const pfRaw = values.pfEsi.trim().toLowerCase();
  const pfEsi = pfRaw === 'off' || pfRaw === 'disabled' ? 'off' : 'on';
  const ctcRaw = values.ctc.trim();
  const ctc = ctcRaw ? Number(ctcRaw) : undefined;

  return {
    employeeId: values.employeeId.trim().toUpperCase(),
    firstName: values.firstName.trim(),
    middleName: values.middleName.trim() || undefined,
    lastName: values.lastName.trim(),
    email: values.companyEmail.trim().toLowerCase(),
    personalEmail: values.personalEmail.trim().toLowerCase(),
    view: normalizeEmployeeView(values.view),
    phone: values.phone.trim(),
    dob: values.dob.trim(),
    gender: values.gender.trim(),
    permanentAddress: values.permanentAddress.trim(),
    communicationAddress: values.communicationAddress.trim(),
    joinedAt: values.joinedAt.trim(),
    employmentType,
    role,
    status: 'Active',
    pan: values.pan.trim().toUpperCase(),
    aadhaar: values.aadhaar.trim() || undefined,
    passport: values.passport.trim() || undefined,
    bankName: values.bankName.trim() || undefined,
    accountNumber: values.accountNumber.trim() || undefined,
    ifsc: values.ifsc.trim().toUpperCase() || undefined,
    uan: values.uan.trim() || undefined,
    pfEsi,
    ctc: ctc != null && !Number.isNaN(ctc) && ctc > 0 ? ctc : undefined,
    emergencyContact: {
      name: values.emergencyContactName.trim(),
      phone: values.emergencyContactPhone.trim(),
      email: values.emergencyContactEmail.trim().toLowerCase(),
      relation: values.emergencyContactRelation.trim(),
      address: values.emergencyContactAddress.trim(),
    },
  };
}

function isExampleRow(values: Record<ColumnKey, string>): boolean {
  const employeeId = values.employeeId.trim().toLowerCase();
  return employeeId === 'epl-001' || employeeId === 'example' || employeeId.startsWith('sample');
}

function isEmptyRow(values: Record<ColumnKey, string>): boolean {
  return !values.employeeId.trim() &&
    !values.firstName.trim() &&
    !values.lastName.trim() &&
    !values.personalEmail.trim() &&
    !values.companyEmail.trim();
}

function headerColumn(header: typeof EMPLOYEE_IMPORT_HEADERS[number]): number {
  return EMPLOYEE_IMPORT_HEADERS.indexOf(header) + 1;
}

function columnLetter(col: number): string {
  let letter = '';
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function writeListColumn(sheet: ExcelJS.Worksheet, col: number, values: readonly string[]): string {
  values.forEach((value, index) => {
    sheet.getCell(index + 1, col).value = value;
  });
  const letter = columnLetter(col);
  return `Lists!$${letter}$1:$${letter}$${values.length}`;
}

function applyListValidation(
  sheet: ExcelJS.Worksheet,
  col: number,
  listRange: string,
  fromRow: number,
  toRow: number,
) {
  const letter = columnLetter(col);
  sheet.dataValidations.add(`${letter}${fromRow}:${letter}${toRow}`, {
    type: 'list',
    allowBlank: true,
    formulae: [listRange],
    showErrorMessage: true,
    errorStyle: 'error',
    errorTitle: 'Invalid value',
    error: 'Choose a value from the dropdown list.',
  });
}

export async function buildEmployeeImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EPICAL HRMS';
  wb.created = new Date();

  const listsSheet = wb.addWorksheet('Lists');
  listsSheet.state = 'veryHidden';

  const genderList = writeListColumn(listsSheet, 1, GENDER_OPTIONS);
  const employmentTypeList = writeListColumn(listsSheet, 2, EMPLOYMENT_TYPE_OPTIONS);
  const roleList = writeListColumn(listsSheet, 3, ROLE_OPTIONS);
  const viewList = writeListColumn(listsSheet, 4, VIEW_OPTIONS);
  const pfEsiList = writeListColumn(listsSheet, 5, PF_ESI_OPTIONS);

  const sheet = wb.addWorksheet('Employees');
  const colCount = EMPLOYEE_IMPORT_HEADERS.length;

  sheet.mergeCells(TITLE_ROW, 1, TITLE_ROW, colCount);
  const titleCell = sheet.getCell(TITLE_ROW, 1);
  titleCell.value = COMPANY_NAME;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_ARGB } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(TITLE_ROW).height = 28;

  sheet.addRow([...EMPLOYEE_IMPORT_HEADERS]);
  sheet.getRow(HEADER_ROW).font = { bold: true, color: { argb: 'FF1A4712' } };
  sheet.getRow(HEADER_ROW).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F2E6' },
  };

  const wideColumns = new Set([
    headerColumn('Permanent Address'),
    headerColumn('Communication Address'),
    headerColumn('Emergency Contact Address'),
  ]);
  EMPLOYEE_IMPORT_HEADERS.forEach((_, index) => {
    sheet.getColumn(index + 1).width = wideColumns.has(index + 1) ? 28 : 18;
  });

  const lastDataRow = FIRST_DATA_ROW + IMPORT_TEMPLATE_DATA_ROWS - 1;
  applyListValidation(sheet, headerColumn('Gender'), genderList, FIRST_DATA_ROW, lastDataRow);
  applyListValidation(sheet, headerColumn('PF ESI'), pfEsiList, FIRST_DATA_ROW, lastDataRow);
  applyListValidation(sheet, headerColumn('Employment Type'), employmentTypeList, FIRST_DATA_ROW, lastDataRow);
  applyListValidation(sheet, headerColumn('Role'), roleList, FIRST_DATA_ROW, lastDataRow);
  applyListValidation(sheet, headerColumn('View'), viewList, FIRST_DATA_ROW, lastDataRow);

  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function parseEmployeeImportWorkbook(buffer: Buffer): Promise<ParsedEmployeeImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = resolveEmployeeImportSheet(wb);
  if (!sheet) {
    throw new Error('Worksheet not found');
  }

  const headerRowNumber = findHeaderRow(sheet);
  if (!headerRowNumber) {
    throw new Error('Could not find header row. Use the downloaded employee import template.');
  }

  const columnIndex = buildColumnIndex(sheet.getRow(headerRowNumber));
  if (!columnIndex.size) {
    throw new Error('No recognizable employee columns found in the uploaded file.');
  }

  const rows: ParsedEmployeeImportRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const values = Object.keys(COLUMN_KEYS).reduce((acc, key) => {
      acc[key as ColumnKey] = getRowValue(row, columnIndex, key as ColumnKey);
      return acc;
    }, {} as Record<ColumnKey, string>);

    if (isEmptyRow(values) || isExampleRow(values)) return;

    const errors = validateImportRow(values);
    rows.push({
      rowNumber,
      payload: rowToPayload(values),
      errors,
    });
  });

  if (!rows.length) {
    throw new Error(
      'No employee rows found. Download the template, add one row per employee below the header row, then upload again.',
    );
  }

  return rows;
}
