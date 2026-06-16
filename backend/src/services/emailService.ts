import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { formatDurationFromMs } from '../utils/durationFormat';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || env.smtpHost,
      port: env.SMTP_PORT || env.smtpPort,
      secure: env.SMTP_SECURE || (env.smtpPort === 465),
      auth:
        (env.SMTP_USER && env.SMTP_PASS)
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : (env.smtpUser && env.smtpPass)
            ? { user: env.smtpUser, pass: env.smtpPass }
            : undefined,
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return !!((env.SMTP_USER && env.SMTP_PASS) || (env.smtpUser && env.smtpPass));
}

interface ReminderEmailParams {
  to: string;
  employeeName: string;
  checkInTime: Date;
  autoCheckoutTime: string;
  projectName: string;
  activeDurationMs: number;
}

const HRMS_COMPANY_NAME = 'Epical Layouts';
const HRMS_PRODUCT_NAME = 'Epical EMS';

/** Brand palette — matches frontend tailwind.config.js + index.css (--emerald-*) */
const EMAIL_COLORS = {
  primary: '#266b1c',
  primaryFresh: '#2f7d24',
  primaryDark: '#1f5516',
  surface: '#e8f2e6',
  sage: '#cfe5cb',
  bg: '#F8FAF8',
  bgSoft: '#dff0e4',
  border: 'rgba(38, 107, 28, 0.22)',
  textMuted: '#64748b',
  textDark: '#0f172a',
  white: '#ffffff',
  statusApproved: '#16a34a',
  statusRejected: '#dc2626',
  statusCancelled: '#64748b',
} as const;

export function frontendUrl(path: string = ''): string {
  const base = (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function formatEmailTime(d: Date | string): string {
  const dateObj = typeof d === 'string' || typeof (d as any).getMonth !== 'function' ? new Date(d) : d;
  return dateObj.toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: env.schedulerTimezone,
  });
}

function formatEmailDateTime(d: Date | string): string {
  const dateObj = typeof d === 'string' || typeof (d as any).getMonth !== 'function' ? new Date(d) : d;
  return dateObj.toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: env.schedulerTimezone,
  });
}

function buildHrmsTimesheetEmailHtml(options: {
  eyebrow: string;
  title: string;
  greetingName: string;
  intro: string;
  highlightTitle: string;
  detailRows: Array<{ label: string; value: string }>;
  notice?: string;
  accentColor?: string;
}): string {
  const accent = options.accentColor || EMAIL_COLORS.primary;
  const detailRowsHtml = options.detailRows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;color:${EMAIL_COLORS.textDark};font-size:16px;font-weight:500;width:38%;vertical-align:top;">${row.label}</td>
          <td style="padding:10px 0 10px 16px;color:${EMAIL_COLORS.textDark};font-size:16px;font-weight:600;vertical-align:top;">${row.value}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_COLORS.bg};font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:${EMAIL_COLORS.textDark};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:${EMAIL_COLORS.white};border:1px solid ${EMAIL_COLORS.border};border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(38,107,28,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg, ${accent} 0%, ${EMAIL_COLORS.primaryDark} 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0 0 8px 0;color:rgba(255,255,255,0.88);font-size:14px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${options.eyebrow}</p>
              <h1 style="margin:0;color:${EMAIL_COLORS.white};font-size:26px;font-weight:700;line-height:1.3;">${options.title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:${EMAIL_COLORS.textDark};">Hello ${options.greetingName},</p>
              <p style="margin:0 0 24px 0;font-size:17px;line-height:1.7;color:${EMAIL_COLORS.textDark};">${options.intro}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.surface};border:1px solid ${EMAIL_COLORS.sage};border-radius:12px;padding:4px 20px;margin:0 0 24px 0;">
                <tr>
                  <td>
                    <p style="margin:16px 0 8px 0;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${accent};">${options.highlightTitle}</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${detailRowsHtml}</table>
                  </td>
                </tr>
              </table>
              ${
                options.notice
                  ? `<div style="background:${EMAIL_COLORS.bgSoft};border-left:4px solid ${EMAIL_COLORS.primary};padding:16px 18px;border-radius:8px;margin:0 0 8px 0;">
                      <p style="margin:0;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.primaryDark};">${options.notice}</p>
                    </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="background:${EMAIL_COLORS.surface};border-top:1px solid ${EMAIL_COLORS.sage};padding:20px 32px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:${EMAIL_COLORS.primary};">${HRMS_COMPANY_NAME}</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:${EMAIL_COLORS.textDark};">This is an automated ${HRMS_PRODUCT_NAME} workforce notification. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendCheckoutReminderEmail(params: ReminderEmailParams): Promise<boolean> {
  const activeDuration = formatDurationFromMs(params.activeDurationMs, true);
  const html = buildHrmsTimesheetEmailHtml({
    eyebrow: 'Work Session Reminder',
    title: 'Active Work Session Pending Checkout',
    greetingName: params.employeeName,
    intro:
      'You currently have an active work session that has not been checked out. Please complete checkout before midnight to keep your timesheet accurate.',
    highlightTitle: 'Active Session Summary',
    accentColor: EMAIL_COLORS.primaryFresh,
    detailRows: [
      { label: 'Employee', value: params.employeeName },
      { label: 'Project', value: params.projectName },
      { label: 'Check-in Time', value: formatEmailTime(params.checkInTime) },
      { label: 'Active Duration', value: activeDuration },
      { label: 'Auto-Checkout At', value: params.autoCheckoutTime },
    ],
    notice:
      'If you do not check out manually, the system will automatically close your session at the scheduled auto-checkout time.',
  });

  const subject = 'Reminder: Active Work Session Pending Checkout';

  if (!env.enableEmailNotifications || !isEmailConfigured()) {
    console.log(`[Email Service] [MOCK MODE] Email notifications disabled or credentials missing. Reminder email to: ${params.to}`);
    console.log(`----------------------------------------------------------------------`);
    console.log(`TO:       ${params.to}`);
    console.log(`SUBJECT:  ${subject}`);
    console.log(`HTML BODY PREVIEW (first 300 chars):`);
    console.log(html.substring(0, 300) + '...');
    console.log(`----------------------------------------------------------------------`);
    return true;
  }

  try {
    await getTransporter().sendMail({
      from: `"${HRMS_PRODUCT_NAME}" <${env.SMTP_FROM || env.smtpFrom}>`,
      to: params.to,
      subject,
      html,
    });
    console.log(`✓ Reminder email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to send reminder to ${params.to}:`, error);
    return false;
  }
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Core sendEmail function that handles SMTP dispatch or mock logs.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, html, text, attachments } = options;

  console.log(`[Email Service] Preparing to send email to: ${to} (Subject: "${subject}")`);

  if (!env.enableEmailNotifications) {
    console.log(`[Email Service] [MOCK MODE] Email notifications are disabled in config.`);
    console.log(`----------------------------------------------------------------------`);
    console.log(`TO:       ${to}`);
    console.log(`SUBJECT:  ${subject}`);
    console.log(`TEXT:     ${text || 'No text fallback provided'}`);
    if (attachments?.length) {
      console.log(`ATTACHMENTS: ${attachments.map((a) => a.filename).join(', ')}`);
    }
    console.log(`HTML BODY PREVIEW (first 300 chars):`);
    console.log(html.substring(0, 300) + '...');
    console.log(`----------------------------------------------------------------------`);
    return true;
  }

  if (!env.smtpUser && !env.SMTP_USER) {
    console.warn(`[Email Service] [WARNING] Email is enabled, but SMTP credentials are missing! Skipping send.`);
    return false;
  }

  try {
    const mailOptions = {
      from: env.smtpFrom || env.SMTP_FROM,
      to,
      subject,
      text: text || '',
      html,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? 'application/octet-stream',
      })),
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[Email Service] Email sent successfully: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email Service] [ERROR] Failed to send email to ${to}:`, error);
    return false;
  }
}

interface AutoCheckoutEmailParams {
  to: string;
  employeeName: string;
  checkInTime: Date;
  checkOutTime: Date;
  totalDurationMs: number;
  projectName?: string;
  workDescription?: string;
  autoCheckoutReason: string;
}

export async function sendAutoCheckoutConfirmationEmail(params: AutoCheckoutEmailParams): Promise<boolean> {
  const totalDuration = formatDurationFromMs(params.totalDurationMs, true);
  const detailRows: Array<{ label: string; value: string }> = [
    { label: 'Employee', value: params.employeeName },
    { label: 'Project', value: params.projectName || 'No active project' },
    { label: 'Check-in Time', value: formatEmailDateTime(params.checkInTime) },
    { label: 'Auto Checkout Time', value: formatEmailDateTime(params.checkOutTime) },
    { label: 'Total Worked Duration', value: totalDuration },
    { label: 'Reason', value: params.autoCheckoutReason },
  ];

  if (params.workDescription) {
    detailRows.splice(2, 0, { label: 'Work Description', value: params.workDescription });
  }

  const html = buildHrmsTimesheetEmailHtml({
    eyebrow: 'Automatic Checkout',
    title: 'Automatic Checkout Confirmation',
    greetingName: params.employeeName,
    intro:
      'Your active work session was automatically checked out by the HRMS timesheet system. The session details below have been recorded in your work history.',
    highlightTitle: 'Session Timing Summary',
    accentColor: EMAIL_COLORS.primary,
    detailRows,
    notice:
      'If any detail is incorrect, please contact your administrator to request a timesheet correction.',
  });

  const subject = 'Automatic Checkout Confirmation';

  if (!env.enableEmailNotifications || !isEmailConfigured()) {
    console.log(`[Email Service] [MOCK MODE] Email notifications disabled or credentials missing. Auto-checkout confirmation to: ${params.to}`);
    console.log(`----------------------------------------------------------------------`);
    console.log(`TO:       ${params.to}`);
    console.log(`SUBJECT:  ${subject}`);
    console.log(`HTML BODY PREVIEW (first 300 chars):`);
    console.log(html.substring(0, 300) + '...');
    console.log(`----------------------------------------------------------------------`);
    return true;
  }

  try {
    await getTransporter().sendMail({
      from: `"${HRMS_PRODUCT_NAME}" <${env.SMTP_FROM || env.smtpFrom}>`,
      to: params.to,
      subject,
      html,
    });
    console.log(`✓ Auto-checkout confirmation sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to send auto-checkout confirmation to ${params.to}:`, error);
    return false;
  }
}

interface DetailField {
  label: string;
  value: string;
  valueColor?: 'approved' | 'rejected' | 'cancelled';
}

function statusColor(tone?: DetailField['valueColor']): string {
  if (tone === 'approved') return EMAIL_COLORS.statusApproved;
  if (tone === 'rejected') return EMAIL_COLORS.statusRejected;
  if (tone === 'cancelled') return EMAIL_COLORS.statusCancelled;
  return EMAIL_COLORS.textDark;
}

/**
 * Builds a premium, modern responsive HTML template with glassmorphism touches and beautiful typography.
 */
function buildHtmlTemplate(
  recipientName: string,
  title: string,
  message: string,
  detailFields: DetailField[],
  actionUrl: string = frontendUrl()
): string {
  // Generate rows for the details card
  const detailsHtml = detailFields.length > 0
    ? `
      <div style="background-color: ${EMAIL_COLORS.surface}; border: 1px solid ${EMAIL_COLORS.sage}; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-family: inherit;">
          ${detailFields
            .map(
              (field) => `
            <tr>
              <td style="padding: 8px 0; color: ${EMAIL_COLORS.textDark}; font-size: 16px; font-weight: 600; width: 35%; vertical-align: top;">
                ${field.label}
              </td>
              <td style="padding: 8px 0 8px 12px; color: ${statusColor(field.valueColor)}; font-size: 16px; font-weight: 500; vertical-align: top;">
                ${field.value}
              </td>
            </tr>
          `
            )
            .join('')}
        </table>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    body {
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: ${EMAIL_COLORS.bg};
      color: ${EMAIL_COLORS.textDark};
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    
    .wrapper {
      width: 100%;
      background-color: ${EMAIL_COLORS.bg};
      padding: 40px 20px;
      box-sizing: border-box;
    }
    
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: ${EMAIL_COLORS.white};
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(38, 107, 28, 0.08), 0 8px 10px -6px rgba(38, 107, 28, 0.04);
      border: 1px solid ${EMAIL_COLORS.border};
    }
    
    .header {
      background: linear-gradient(135deg, ${EMAIL_COLORS.primaryFresh} 0%, ${EMAIL_COLORS.primary} 55%, ${EMAIL_COLORS.primaryDark} 100%);
      padding: 35px 40px;
      text-align: center;
      position: relative;
    }
    
    .logo {
      color: ${EMAIL_COLORS.white};
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 0;
      display: inline-block;
    }
    
    .content {
      padding: 40px;
    }
    
    .greeting {
      font-size: 22px;
      font-weight: 600;
      color: ${EMAIL_COLORS.textDark};
      margin-top: 0;
      margin-bottom: 12px;
    }
    
    .message {
      font-size: 18px;
      line-height: 1.6;
      color: ${EMAIL_COLORS.textDark};
      margin-bottom: 24px;
    }
    
    .btn-container {
      text-align: center;
      margin: 32px 0 10px 0;
    }
    
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, ${EMAIL_COLORS.primaryFresh} 0%, ${EMAIL_COLORS.primary} 100%);
      color: ${EMAIL_COLORS.white} !important;
      text-decoration: none;
      font-size: 17px;
      font-weight: 600;
      padding: 14px 30px;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(38, 107, 28, 0.28), 0 2px 4px -1px rgba(38, 107, 28, 0.08);
      transition: all 0.2s ease;
    }
    
    .footer {
      background-color: ${EMAIL_COLORS.surface};
      padding: 24px 40px;
      text-align: center;
      font-size: 15px;
      color: ${EMAIL_COLORS.textDark};
      border-top: 1px solid ${EMAIL_COLORS.sage};
    }
    
    .footer a {
      color: ${EMAIL_COLORS.primary};
      text-decoration: none;
      font-weight: 500;
    }
    
    @media (max-width: 600px) {
      .wrapper {
        padding: 15px 10px;
      }
      .content {
        padding: 25px 20px;
      }
      .header {
        padding: 25px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="logo">Epical EMS</h1>
      </div>
      <div class="content">
        <h2 class="greeting">Hi ${recipientName},</h2>
        <p class="message">${message}</p>
        
        ${detailsHtml}
        
        <div class="btn-container">
          <a href="${actionUrl}" class="btn" target="_blank">View in App</a>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 8px 0;">This is an automated notification from Epical EMS.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Epical Layouts. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Interface for leave requests details
 */
export interface LeaveNotificationData {
  recipientEmail: string;
  recipientName: string;
  employeeName: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason?: string;
  status?: string;
  rejectionReason?: string;
}

/**
 * Send notification for a new leave request (sent to Manager/Admin)
 */
export async function sendLeaveSubmittedEmail(
  data: LeaveNotificationData,
  actionUrl?: string
): Promise<boolean> {
  const subject = `[Epical EMS] New Leave Request - ${data.employeeName}`;
  const message = `A new leave request has been submitted by <strong>${data.employeeName}</strong> and requires your review.`;

  const details: DetailField[] = [
    { label: 'Employee', value: data.employeeName },
    { label: 'Leave Type', value: data.type },
    { label: 'Start Date', value: data.from },
    { label: 'End Date', value: data.to },
    { label: 'Duration', value: `${data.days} Business Day(s)` },
  ];

  if (data.reason) {
    details.push({ label: 'Reason', value: data.reason });
  }

  const url = actionUrl || frontendUrl('/admin/leaves');
  const html = buildHtmlTemplate(data.recipientName, 'New Leave Request', message, details, url);
  const text = `Hi ${data.recipientName},\n\nA new leave request has been submitted by ${data.employeeName}.\n\nDetails:\n- Employee: ${data.employeeName}\n- Leave Type: ${data.type}\n- Dates: ${data.from} to ${data.to}\n- Duration: ${data.days} days\n${data.reason ? `- Reason: ${data.reason}\n` : ''}\nView in app: ${url}`;

  return await sendEmail({ to: data.recipientEmail, subject, html, text });
}

/**
 * Send notification for leave request status update (sent to Employee)
 */
export async function sendLeaveStatusEmail(
  data: LeaveNotificationData,
  actionUrl?: string
): Promise<boolean> {
  const subject = `[Epical EMS] Leave Request ${data.status} - ${data.type}`;
  
  let message = '';
  let statusTone: DetailField['valueColor'];
  if (data.status === 'Approved') {
    message = `Your ${data.type} leave request has been <strong style="color: ${EMAIL_COLORS.statusApproved};">approved</strong> by the administrator.`;
    statusTone = 'approved';
  } else if (data.status === 'Cancelled') {
    message = `Your ${data.type} leave request has been <strong style="color: ${EMAIL_COLORS.statusCancelled};">cancelled</strong>.`;
    statusTone = 'cancelled';
  } else {
    message = `Your ${data.type} leave request has been <strong style="color: ${EMAIL_COLORS.statusRejected};">rejected</strong> by the administrator.`;
    statusTone = 'rejected';
  }

  const details: DetailField[] = [
    { label: 'Leave Type', value: data.type },
    { label: 'Start Date', value: data.from },
    { label: 'End Date', value: data.to },
    { label: 'Duration', value: `${data.days} Business Day(s)` },
    { label: 'Status', value: data.status || 'Processed', valueColor: statusTone },
  ];

  if (data.status === 'Rejected' && data.rejectionReason) {
    details.push({ label: 'Rejection Reason', value: data.rejectionReason });
  }

  const url = actionUrl || frontendUrl('/employee/leave');
  const html = buildHtmlTemplate(data.recipientName, `Leave Request ${data.status}`, message, details, url);
  
  const text = `Hi ${data.recipientName},\n\nYour ${data.type} leave request from ${data.from} to ${data.to} has been ${data.status}.\n\n${data.status === 'Rejected' && data.rejectionReason ? `Reason: ${data.rejectionReason}\n` : ''}\nView in app: ${url}`;

  return await sendEmail({ to: data.recipientEmail, subject, html, text });
}

/**
 * Sends a general email notification with standard styling (catch-all)
 */
export async function sendGenericNotificationEmail(
  toEmail: string,
  recipientName: string,
  title: string,
  message: string,
  detailFields: DetailField[] = [],
  actionUrl?: string
): Promise<boolean> {
  const subject = `[Epical EMS] ${title}`;
  const url = actionUrl || frontendUrl();
  const html = buildHtmlTemplate(recipientName, title, message, detailFields, url);
  
  const detailsText = detailFields.map((d) => `- ${d.label}: ${d.value}`).join('\n');
  const text = `Hi ${recipientName},\n\n${message}\n\n${detailsText ? `Details:\n${detailsText}\n\n` : ''}View in app: ${url}`;

  return await sendEmail({ to: toEmail, subject, html, text });
}

/**
 * Interface for new employee welcome email data
 */
export interface WelcomeEmailData {
  recipientEmail: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  joinedAt: string;
}

/**
 * Send a welcome email to a newly added employee
 */
export async function sendWelcomeEmail(
  data: WelcomeEmailData,
  actionUrl?: string
): Promise<boolean> {
  const fullName = `${data.firstName} ${data.lastName}`;
  const subject = `[Epical EMS] Welcome to the Team, ${data.firstName}! 🎉`;
  const message = `We're thrilled to have you on board! Your employee profile has been created in our system. Below are your onboarding details.`;

  const details: DetailField[] = [
    { label: 'Employee ID', value: data.employeeId },
    { label: 'Full Name', value: fullName },
    { label: 'Date of Joining', value: data.joinedAt },
  ];

  const url = actionUrl || frontendUrl('/employee');
  const html = buildHtmlTemplate(data.firstName, 'Welcome to Epical! 🎉', message, details, url);

  const text = `Hi ${data.firstName},\n\nWelcome to the team! Your employee profile has been successfully created.\n\nDetails:\n- Employee ID: ${data.employeeId}\n- Name: ${fullName}\n- Date of Joining: ${data.joinedAt}\n\nView in app: ${url}`;

  return await sendEmail({ to: data.recipientEmail, subject, html, text });
}

/**
 * Interface for holiday notification email data
 */
export interface HolidayNotificationData {
  recipientEmail: string;
  recipientName: string;
  holidayTitle: string;
  holidayDate: string;
  eventType: 'added' | 'updated' | 'deleted' | 'skipped' | 'restored';
  skippedReason?: string;
}

/**
 * Send holiday change notification email to an employee
 */
export async function sendHolidayNotificationEmail(
  data: HolidayNotificationData,
  actionUrl?: string
): Promise<boolean> {
  let subject = '';
  let message = '';

  switch (data.eventType) {
    case 'added':
      subject = `[Epical EMS] New Holiday: ${data.holidayTitle}`;
      message = `A new holiday <strong>${data.holidayTitle}</strong> has been added to the company calendar on <strong>${data.holidayDate}</strong>.`;
      break;
    case 'updated':
      subject = `[Epical EMS] Holiday Updated: ${data.holidayTitle}`;
      message = `The holiday <strong>${data.holidayTitle}</strong> on <strong>${data.holidayDate}</strong> has been updated in the company calendar.`;
      break;
    case 'deleted':
      subject = `[Epical EMS] Holiday Removed: ${data.holidayTitle}`;
      message = `The holiday <strong>${data.holidayTitle}</strong> on <strong>${data.holidayDate}</strong> has been removed from the company calendar.`;
      break;
    case 'skipped':
      subject = `[Epical EMS] Working Day Notice: ${data.holidayTitle}`;
      message = `<strong>${data.holidayTitle}</strong> on <strong>${data.holidayDate}</strong> has been designated as a working day. The company will be operational on this date.`;
      break;
    case 'restored':
      subject = `[Epical EMS] Holiday Restored: ${data.holidayTitle}`;
      message = `<strong>${data.holidayTitle}</strong> on <strong>${data.holidayDate}</strong> has been restored as a holiday. Enjoy your day off!`;
      break;
  }

  const details: DetailField[] = [
    { label: 'Holiday', value: data.holidayTitle },
    { label: 'Date', value: data.holidayDate },
  ];

  if (data.eventType === 'skipped' && data.skippedReason) {
    details.push({ label: 'Reason', value: data.skippedReason });
  }

  const url = actionUrl || frontendUrl('/employee/calendar');
  const html = buildHtmlTemplate(data.recipientName, subject.replace('[Epical EMS] ', ''), message, details, url);
  const text = `Hi ${data.recipientName},\n\n${message.replace(/<[^>]+>/g, '')}\n\nPlease check the company calendar for details.`;

  return await sendEmail({ to: data.recipientEmail, subject, html, text });
}

/**
 * Interface for payslip notification email data
 */
export interface PayslipNotificationData {
  recipientEmail: string;
  recipientName: string;
  employeeName: string;
  employeeId?: string;
  payMonth: string;
  fileName?: string;
}

/**
 * Send payslip notification email to employee
 */
export async function sendPayslipEmail(
  data: PayslipNotificationData,
  actionUrl?: string,
  pdfAttachment?: EmailAttachment
): Promise<boolean> {
  const subject = `[Epical EMS] Your Payslip for ${data.payMonth} is Ready`;
  const message = pdfAttachment
    ? `Your payslip for the pay period of <strong>${data.payMonth}</strong> is attached to this email. Open the PDF attachment to view your payslip.`
    : `Your payslip for the pay period of <strong>${data.payMonth}</strong> has been issued. Please contact HR if you need a copy.`;

  const details: DetailField[] = [
    { label: 'Employee Name', value: data.employeeName },
  ];

  if (data.employeeId) {
    details.push({ label: 'Employee ID', value: data.employeeId });
  }

  details.push({ label: 'Pay Period', value: data.payMonth });

  if (data.fileName) {
    details.push({ label: 'Document', value: data.fileName });
  }

  const payslipUrl = actionUrl ?? frontendUrl('/employee/documents?tab=payslips');
  const html = buildHtmlTemplate(data.recipientName, 'Payslip Available', message, details, payslipUrl);

  const attachmentNote = pdfAttachment
    ? '\nYour payslip PDF is attached to this email.\n'
    : '\nPlease contact HR if you need a copy of your payslip.\n';
  const text = `Hi ${data.recipientName},\n\nYour payslip for ${data.payMonth} is now available.${attachmentNote}\n${data.employeeId ? `Employee ID: ${data.employeeId}\n` : ''}Pay Period: ${data.payMonth}\n${data.fileName ? `Document: ${data.fileName}\n` : ''}`;

  return await sendEmail({
    to: data.recipientEmail,
    subject,
    html,
    text,
    attachments: pdfAttachment ? [pdfAttachment] : undefined,
  });
}

export interface CellReviewEmailData {
  recipientEmail: string;
  recipientName: string;
  projectId: string;
  cellId: string;
  projectName: string;
  cellName: string;
  reviewPoint: string;
  stageLabel: string;
  outcome: 'approved' | 'rejected';
  returnToStage?: string;
  resolvedByName?: string;
}

export async function sendCellReviewEmail(data: CellReviewEmailData): Promise<boolean> {
  const reviewLabel = data.reviewPoint.toUpperCase();
  const approved = data.outcome === 'approved';
  const subject = approved
    ? `[Epical EMS] ${reviewLabel} review approved — ${data.cellName}`
    : `[Epical EMS] ${reviewLabel} review rejected — ${data.cellName}`;

  const message = approved
    ? `Your <strong>${reviewLabel}</strong> review for <strong>${data.cellName}</strong> in <strong>${data.projectName}</strong> has been approved. You can continue the layout workflow.`
    : `Your <strong>${reviewLabel}</strong> review for <strong>${data.cellName}</strong> in <strong>${data.projectName}</strong> was rejected. Please review admin feedback and update the cell.`;

  const details: DetailField[] = [
    { label: 'Project', value: data.projectName },
    { label: 'Cell', value: data.cellName },
    { label: 'Stage', value: data.stageLabel },
    { label: 'Review', value: reviewLabel },
    { label: 'Outcome', value: approved ? 'Approved' : 'Rejected' },
  ];
  if (data.resolvedByName) {
    details.push({ label: 'Reviewed by', value: data.resolvedByName });
  }
  if (!approved && data.returnToStage) {
    details.push({ label: 'Returned to', value: data.returnToStage });
  }

  const actionUrl = frontendUrl(`/employee/projects/${data.projectId}/cells/${data.cellId}`);
  const html = buildHtmlTemplate(
    data.recipientName,
    approved ? `${reviewLabel} review approved` : `${reviewLabel} review rejected`,
    message,
    details,
    actionUrl,
  );
  const text = `Hi ${data.recipientName},\n\n${message.replace(/<[^>]+>/g, '')}\n\nOpen your cell workflow: ${actionUrl}`;

  return await sendEmail({ to: data.recipientEmail, subject, html, text });
}
