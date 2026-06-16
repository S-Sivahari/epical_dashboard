import { Types } from 'mongoose';
import { getDB } from '../config/db';
import {
  DailyNoteBlockModel,
  type DailyNoteBlockDocument,
  type NoteActor,
  type NoteChildBlock,
} from '../models/DailyNoteBlock';
import { sendEmail } from './emailService';
import { getUserById } from './authService';
import { getEmployeeLoginEmails, normalizeLoginEmail } from '../utils/employeeAuth';
import { stripHtml } from '../utils/notesSearchUtils';
import { serializeDailyBlock } from './notesService';

const BLOCKED_EMPLOYEE_STATUSES = ['Deactivated', 'Inactive', 'Archived'] as const;
const PROJECT_RED = '#c0392b';

export type NoteEmailDeliveryStatus = 'sent' | 'failed' | 'partial';

export type NoteEmailRecipient = {
  id: string;
  name: string;
  email: string;
};

export type NoteEmailEmployeeEntry = {
  childBlockId: string;
  employeeName: string;
  lines: string[];
  descriptionText: string;
};

export type NoteEmailProjectGroup = {
  projectId: string;
  projectName: string;
  employees: NoteEmailEmployeeEntry[];
};

export type DailyNotesEmailPreview = {
  subject: string;
  html: string;
  text: string;
  date: string;
  dailyBlockName: string;
  allRecipients: NoteEmailRecipient[];
  recipients: NoteEmailRecipient[];
  recipientEmployeeCount: number;
  recipientEmailCount: number;
  recipientScope: 'all_working_employees' | 'selected_employees';
  projectGroups: NoteEmailProjectGroup[];
  canSend: boolean;
  warnings: string[];
};

export type DailyNotesEmailSendOptions = {
  recipientEmployeeIds?: string[];
};

function employeeNames(child: NoteChildBlock): string {
  if (Array.isArray(child.employees) && child.employees.length > 0) {
    return child.employees.map((employee) => employee.name).filter(Boolean).join('/');
  }
  if (child.employeeName?.trim()) return child.employeeName.trim();
  return '—';
}

function activeChildren(doc: DailyNoteBlockDocument): NoteChildBlock[] {
  return doc.childBlocks.filter((child) => !child.archived);
}

function emailContentChildren(doc: DailyNoteBlockDocument): NoteChildBlock[] {
  return activeChildren(doc)
    .filter((child) => child.includeInEmail)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function employeeDisplayName(employee: {
  firstName?: string;
  lastName?: string;
  email?: string;
}): string {
  const name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
  return name || String(employee.email || 'Employee');
}

function formatDescriptionLines(text: string): string[] {
  if (!text || text === '—') return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('--') ? line : `-- ${line}`));
}

function groupContentByProject(doc: DailyNoteBlockDocument): NoteEmailProjectGroup[] {
  const map = new Map<string, NoteEmailProjectGroup>();

  for (const child of emailContentChildren(doc)) {
    const projectId = child.projectId || child.title;
    const projectName = child.projectName || child.title || '—';
    const descriptionText = stripHtml(child.description || '') || '—';
    const entry: NoteEmailEmployeeEntry = {
      childBlockId: String(child._id),
      employeeName: employeeNames(child),
      lines: formatDescriptionLines(descriptionText),
      descriptionText,
    };

    const existing = map.get(projectId);
    if (existing) {
      existing.employees.push(entry);
    } else {
      map.set(projectId, { projectId, projectName, employees: [entry] });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
}

/** All working registered employees — company-wide visibility for daily notes. */
async function resolveAllEmployeeRecipients(): Promise<{
  recipients: NoteEmailRecipient[];
  employeeCount: number;
  missingEmailCount: number;
}> {
  const db = getDB();
  const [employeeDocs, userDocs] = await Promise.all([
    db
      .collection('employees')
      .find({ status: { $nin: [...BLOCKED_EMPLOYEE_STATUSES] } })
      .project({ id: 1, firstName: 1, lastName: 1, employeeId: 1, email: 1, personalEmail: 1, status: 1 })
      .toArray(),
    db
      .collection('users')
      .find({ role: { $ne: 'Admin' } })
      .project({ id: 1, email: 1 })
      .toArray(),
  ]);

  const userEmailByEmployeeId = new Map<string, string>();
  for (const user of userDocs) {
    const email = normalizeLoginEmail(String(user.email || ''));
    if (email) userEmailByEmployeeId.set(String(user.id), email);
  }

  const recipients: NoteEmailRecipient[] = [];
  const seenEmails = new Set<string>();
  let missingEmailCount = 0;

  for (const employee of employeeDocs) {
    const id = String(employee.id);
    const name = employeeDisplayName(employee);
    const loginEmails = getEmployeeLoginEmails(employee);

    if (loginEmails.length === 0) {
      const userEmail = userEmailByEmployeeId.get(id);
      if (userEmail) loginEmails.push(userEmail);
    }

    if (loginEmails.length === 0) {
      missingEmailCount += 1;
      continue;
    }

    for (const email of loginEmails) {
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      recipients.push({ id, name, email });
    }
  }

  recipients.sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
  return {
    recipients,
    employeeCount: employeeDocs.length,
    missingEmailCount,
  };
}

function filterRecipients(
  allRecipients: NoteEmailRecipient[],
  recipientEmployeeIds?: string[],
): {
  recipients: NoteEmailRecipient[];
  scope: DailyNotesEmailPreview['recipientScope'];
} {
  if (!recipientEmployeeIds || recipientEmployeeIds.length === 0) {
    return { recipients: allRecipients, scope: 'all_working_employees' };
  }

  const idSet = new Set(recipientEmployeeIds.map((id) => String(id).trim()).filter(Boolean));
  return {
    recipients: allRecipients.filter((recipient) => idSet.has(recipient.id)),
    scope: 'selected_employees',
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildProjectGroupsHtml(projectGroups: NoteEmailProjectGroup[]): string {
  if (projectGroups.length === 0) {
    return '<p style="margin:0;font-size:14px;color:#64748b;font-style:italic;">No work descriptions included.</p>';
  }

  return projectGroups
    .map((group) => {
      const projectLabel = escapeHtml(group.projectName.toUpperCase());
      const employeesHtml = group.employees
        .map((employee) => {
          const linesHtml =
            employee.lines.length > 0
              ? employee.lines
                  .map(
                    (line) =>
                      `<p style="margin:3px 0 3px 16px;font-size:14px;line-height:1.55;color:#111827;">${escapeHtml(line)}</p>`,
                  )
                  .join('')
              : '<p style="margin:3px 0 3px 16px;font-size:14px;color:#64748b;font-style:italic;">No updates recorded.</p>';

          return `
        <div style="margin-bottom:10px;">
          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(employee.employeeName)}</p>
          ${linesHtml}
        </div>`;
        })
        .join('');

      return `
      <div style="margin-bottom:18px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${PROJECT_RED};text-transform:uppercase;">${projectLabel}:</p>
        <div style="padding-left:4px;">
          ${employeesHtml}
        </div>
      </div>`;
    })
    .join('');
}

function buildEmailHtml(doc: DailyNoteBlockDocument, projectGroups: NoteEmailProjectGroup[]): string {
  const projectsBody = buildProjectGroupsHtml(projectGroups);
  const formattedDate = escapeHtml(doc.name || doc.date);

  return `
    <div style="font-family:Segoe UI, Arial, Helvetica, sans-serif;background:#f4f4f5;padding:28px 16px;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:28px 32px;">
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">Dear Team,</p>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#374151;">Please find below the daily project updates for <strong>${formattedDate}</strong>.</p>
        <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:${PROJECT_RED};">Projects:</p>
        ${projectsBody}
        <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#374151;">Regards,<br/><strong>Epical Admin</strong></p>
      </div>
    </div>`;
}

function buildEmailText(doc: DailyNoteBlockDocument, projectGroups: NoteEmailProjectGroup[]): string {
  const lines = [
    `Daily Notes — ${doc.name}`,
    `Date: ${doc.date}`,
    '',
    'Dear Team,',
    '',
    `Please find below the daily project updates for ${doc.name || doc.date}.`,
    '',
    'Projects:',
    '',
  ];

  if (projectGroups.length === 0) {
    lines.push('No work descriptions included.');
  } else {
    projectGroups.forEach((group) => {
      lines.push(`${group.projectName.toUpperCase()}:`);
      group.employees.forEach((employee) => {
        lines.push(employee.employeeName);
        if (employee.lines.length > 0) {
          employee.lines.forEach((line) => lines.push(line));
        } else {
          lines.push('No updates recorded.');
        }
        lines.push('');
      });
    });
  }

  lines.push('Regards,', 'Epical Admin');
  return lines.join('\n');
}

function buildWarnings(
  projectGroups: NoteEmailProjectGroup[],
  recipients: NoteEmailRecipient[],
  allRecipients: NoteEmailRecipient[],
  missingEmailCount: number,
  scope: DailyNotesEmailPreview['recipientScope'],
  recipientEmployeeIds?: string[],
): string[] {
  const warnings: string[] = [];

  if (projectGroups.length === 0) {
    warnings.push('No work descriptions are marked "Include in email".');
  }
  if (recipients.length === 0) {
    if (scope === 'selected_employees') {
      warnings.push('No selected employees have a valid email address on file.');
    } else {
      warnings.push('No working employee email addresses were found.');
    }
  } else if (recipients.length === 1 && allRecipients.length > 1) {
    warnings.push(
      'Only 1 unique email address will receive this message. Multiple employees may share the same inbox, or most employees are missing email on file.',
    );
  }
  if (missingEmailCount > 0 && scope === 'all_working_employees') {
    warnings.push(`${missingEmailCount} working employee(s) have no email on file and will be skipped.`);
  }
  if (scope === 'selected_employees' && recipientEmployeeIds && recipientEmployeeIds.length > 0) {
    const reachableIds = new Set(recipients.map((recipient) => recipient.id));
    const missingSelected = recipientEmployeeIds.filter((id) => !reachableIds.has(String(id)));
    if (missingSelected.length > 0) {
      warnings.push(
        `${missingSelected.length} selected employee(s) have no email on file and will be skipped.`,
      );
    }
  }

  return warnings;
}

export async function buildDailyNotesEmailPreview(
  dailyBlockId: string,
  options: DailyNotesEmailSendOptions = {},
): Promise<DailyNotesEmailPreview> {
  if (!Types.ObjectId.isValid(dailyBlockId)) {
    throw Object.assign(new Error('Daily block not found'), { status: 404 });
  }

  const doc = await DailyNoteBlockModel.findById(dailyBlockId);
  if (!doc) throw Object.assign(new Error('Daily block not found'), { status: 404 });
  if (doc.archived) {
    throw Object.assign(new Error('Archived daily blocks cannot be emailed'), { status: 400 });
  }

  const projectGroups = groupContentByProject(doc);
  const { recipients: allRecipients, employeeCount, missingEmailCount } = await resolveAllEmployeeRecipients();
  const { recipients, scope } = filterRecipients(allRecipients, options.recipientEmployeeIds);
  const warnings = buildWarnings(
    projectGroups,
    recipients,
    allRecipients,
    missingEmailCount,
    scope,
    options.recipientEmployeeIds,
  );

  const subject = `Daily Notes — ${doc.name}`;
  const html = buildEmailHtml(doc, projectGroups);
  const text = buildEmailText(doc, projectGroups);

  return {
    subject,
    html,
    text,
    date: doc.date,
    dailyBlockName: doc.name,
    allRecipients,
    recipients,
    recipientEmployeeCount:
      scope === 'selected_employees'
        ? new Set(options.recipientEmployeeIds?.map((id) => String(id))).size
        : employeeCount,
    recipientEmailCount: recipients.length,
    recipientScope: scope,
    projectGroups,
    canSend: projectGroups.length > 0 && recipients.length > 0,
    warnings,
  };
}

async function resolveActor(userId: string, email?: string): Promise<NoteActor> {
  const user = await getUserById(userId);
  const name = user?.name?.trim() || email?.trim() || userId;
  return { id: userId, name };
}

export async function sendDailyNotesEmail(
  dailyBlockId: string,
  userId: string,
  email?: string,
  options: DailyNotesEmailSendOptions = {},
) {
  if (!Types.ObjectId.isValid(dailyBlockId)) {
    throw Object.assign(new Error('Daily block not found'), { status: 404 });
  }

  const doc = await DailyNoteBlockModel.findById(dailyBlockId);
  if (!doc) throw Object.assign(new Error('Daily block not found'), { status: 404 });
  if (doc.archived) {
    throw Object.assign(new Error('Archived daily blocks cannot be emailed'), { status: 400 });
  }

  const preview = await buildDailyNotesEmailPreview(dailyBlockId, options);
  if (!preview.canSend) {
    throw Object.assign(
      new Error(preview.warnings[0] || 'Daily notes email cannot be sent'),
      { status: 400 },
    );
  }

  const actor = await resolveActor(userId, email);
  let successCount = 0;
  const failures: string[] = [];

  console.log(
    `[Notes Email] Sending "${preview.subject}" to ${preview.recipientEmailCount} email address(es) (${preview.recipientScope}).`,
  );

  for (const recipient of preview.recipients) {
    const sent = await sendEmail({
      to: recipient.email,
      subject: preview.subject,
      html: preview.html,
      text: preview.text,
    });
    if (sent) successCount += 1;
    else failures.push(recipient.email);
  }

  const recipientCount = preview.recipients.length;
  let deliveryStatus: NoteEmailDeliveryStatus = 'sent';
  if (successCount === 0) deliveryStatus = 'failed';
  else if (successCount < recipientCount) deliveryStatus = 'partial';

  doc.lastEmailDelivery = {
    sentBy: actor,
    sentAt: new Date(),
    recipientCount,
    deliveryStatus,
    errorMessage: failures.length > 0 ? `Failed for: ${failures.join(', ')}` : undefined,
  };
  doc.updatedBy = actor;

  if (deliveryStatus === 'sent' || deliveryStatus === 'partial') {
    doc.status = 'email_sent';
  }

  await doc.save();

  return {
    block: serializeDailyBlock(doc.toObject() as unknown as Record<string, unknown>),
    delivery: {
      sentBy: doc.lastEmailDelivery.sentBy,
      sentAt: doc.lastEmailDelivery.sentAt,
      recipientCount: doc.lastEmailDelivery.recipientCount,
      deliveryStatus: doc.lastEmailDelivery.deliveryStatus,
      errorMessage: doc.lastEmailDelivery.errorMessage,
      successCount,
    },
  };
}
