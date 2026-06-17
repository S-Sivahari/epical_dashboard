import ExcelJS from 'exceljs';

const HEADERS = [
  'Employee ID',
  'Employee Name',
  'Project Name',
  'Client',
  'Technology Node',
  'Team Lead',
  'Access Type',
  'Description',
] as const;

const SAMPLE_ROWS = [
  ['EPL-001', 'Asha Menon', 'Project Atlas', 'Acme Corp', '14nm', 'Asha Menon', 'private', 'Layout design and verification pipeline.'],
  ['EPL-002', 'Rahul Verma', 'Project Atlas', 'Acme Corp', '14nm', 'Asha Menon', 'private', 'Layout design and verification pipeline.'],
  ['EPL-003', 'Priya Das', 'Project Beacon', 'Globex Electronics', '28nm', 'Priya Das', 'public', 'ADC interface and clock distribution.'],
];

export async function generateProjectImportTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EPICAL HRMS';
  wb.created = new Date();

  const sheet = wb.addWorksheet('assignments', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { width: 14 },
    { width: 22 },
    { width: 24 },
    { width: 20 },
    { width: 16 },
    { width: 20 },
    { width: 12 },
    { width: 42 },
  ];

  const headerRow = sheet.addRow([...HEADERS]);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF266B1C' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 22;

  for (const row of SAMPLE_ROWS) {
    sheet.addRow(row);
  }

  const readme = wb.addWorksheet('readme');
  readme.getColumn(1).width = 90;
  const lines = [
    'Project bulk import supports TWO Excel formats (auto-detected on upload):',
    '',
    '1) Assignment sheet (this tab) — one row per employee assigned to a project.',
    '   Required: Employee ID or Name, Project Name, Client, Technology Node.',
    '   Optional: Team Lead, Access Type (public/private), Description.',
    '   Same Project Name + Client + Technology Node rows merge into one project.',
    '',
    '2) Timesheet matrix — row 1: EMP_ID | date columns (YYYY-MM-DD).',
    '   Each cell contains JSON task arrays, e.g.',
    '   [{"project":"Sigma","task":"Layout","start":"09:00:00","end":"11:30:00","timestamp":"2025-08-05T..."}]',
    '   start = task check-in time; end = task checkout time for that project (required for duration).',
    '   timestamp is optional — used only when start is omitted.',
    '   Projects are derived from unique project names; timesheet history is imported per cell.',
    '   Client/tech node reuse existing project metadata when names match; otherwise defaults apply.',
    '',
    'Uploading with "Reset" archives ALL active projects (history under Archived Projects),',
    'then recreates projects, assignments, and (for matrix files) timesheet entries.',
  ];
  lines.forEach((line, index) => {
    const cell = readme.getCell(index + 1, 1);
    cell.value = line;
    cell.alignment = { wrapText: true, vertical: 'top' };
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export const PROJECT_IMPORT_TEMPLATE_FILENAME = 'project_assignments_template.xlsx';
