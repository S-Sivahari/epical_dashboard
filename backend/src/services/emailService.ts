import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465, // true for port 465, false for others
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  }
  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Core sendEmail function that handles SMTP dispatch or mock logs.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, html, text } = options;

  console.log(`[Email Service] Preparing to send email to: ${to} (Subject: "${subject}")`);

  if (!env.enableEmailNotifications) {
    console.log(`[Email Service] [MOCK MODE] Email notifications are disabled in config.`);
    console.log(`----------------------------------------------------------------------`);
    console.log(`TO:       ${to}`);
    console.log(`SUBJECT:  ${subject}`);
    console.log(`TEXT:     ${text || 'No text fallback provided'}`);
    console.log(`HTML BODY PREVIEW (first 300 chars):`);
    console.log(html.substring(0, 300) + '...');
    console.log(`----------------------------------------------------------------------`);
    return true;
  }

  if (!env.smtpUser || !env.smtpPass) {
    console.warn(`[Email Service] [WARNING] Email is enabled, but SMTP credentials are missing! Skipping send.`);
    return false;
  }

  try {
    const mailOptions = {
      from: env.smtpFrom,
      to,
      subject,
      text: text || '',
      html,
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[Email Service] Email sent successfully: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email Service] [ERROR] Failed to send email to ${to}:`, error);
    return false;
  }
}

interface DetailField {
  label: string;
  value: string;
}

/**
 * Builds a premium, modern responsive HTML template with glassmorphism touches and beautiful typography.
 */
function buildHtmlTemplate(
  recipientName: string,
  title: string,
  message: string,
  detailFields: DetailField[],
  actionUrl: string = env.FRONTEND_URL || 'http://localhost:5173'
): string {
  // Generate rows for the details card
  const detailsHtml = detailFields.length > 0
    ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-family: inherit;">
          ${detailFields
            .map(
              (field) => `
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 500; width: 35%; vertical-align: top;">
                ${field.label}
              </td>
              <td style="padding: 8px 0 8px 12px; color: #1e293b; font-size: 14px; font-weight: 600; vertical-align: top;">
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
      background-color: #f1f5f9;
      color: #334155;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(226, 232, 240, 0.8);
    }
    
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      padding: 35px 40px;
      text-align: center;
      position: relative;
    }
    
    .logo {
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin: 0;
      display: inline-block;
    }
    
    .logo span {
      font-weight: 300;
      opacity: 0.85;
    }
    
    .content {
      padding: 40px;
    }
    
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #1e293b;
      margin-top: 0;
      margin-bottom: 12px;
    }
    
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    
    .btn-container {
      text-align: center;
      margin: 32px 0 10px 0;
    }
    
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 14px 30px;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.3), 0 2px 4px -1px rgba(99, 102, 241, 0.06);
      transition: all 0.2s ease;
    }
    
    .footer {
      background-color: #f8fafc;
      padding: 24px 40px;
      text-align: center;
      font-size: 13px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
    }
    
    .footer a {
      color: #6366f1;
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
        <h1 class="logo">Epical<span>EMS</span></h1>
      </div>
      <div class="content">
        <h2 class="greeting">Hi ${recipientName},</h2>
        <p class="message">${message}</p>
        
        ${detailsHtml}
        
        <div class="btn-container">
          <a href="${actionUrl}" class="btn" target="_blank">Open Dashboard</a>
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

  const html = buildHtmlTemplate(data.recipientName, 'New Leave Request', message, details, actionUrl);
  const text = `Hi ${data.recipientName},\n\nA new leave request has been submitted by ${data.employeeName}.\n\nDetails:\n- Employee: ${data.employeeName}\n- Leave Type: ${data.type}\n- Dates: ${data.from} to ${data.to}\n- Duration: ${data.days} days\n${data.reason ? `- Reason: ${data.reason}\n` : ''}\nPlease log in to the dashboard to review.`;

  return await sendEmail({ to: data.recipientEmail, subject, html, text });
}

/**
 * Send notification for leave request status update (sent to Employee)
 */
export async function sendLeaveStatusEmail(
  data: LeaveNotificationData,
  actionUrl?: string
): Promise<boolean> {
  const isApproved = data.status === 'Approved';
  const subject = `[Epical EMS] Leave Request ${data.status} - ${data.type}`;
  
  let message = '';
  if (isApproved) {
    message = `Your ${data.type} leave request has been <strong>approved</strong> by the administrator.`;
  } else {
    message = `Your ${data.type} leave request has been <strong>rejected</strong> by the administrator.`;
  }

  const details: DetailField[] = [
    { label: 'Leave Type', value: data.type },
    { label: 'Start Date', value: data.from },
    { label: 'End Date', value: data.to },
    { label: 'Duration', value: `${data.days} Business Day(s)` },
    { label: 'Status', value: data.status || 'Processed' },
  ];

  if (!isApproved && data.rejectionReason) {
    details.push({ label: 'Rejection Reason', value: data.rejectionReason });
  }

  const html = buildHtmlTemplate(data.recipientName, `Leave Request ${data.status}`, message, details, actionUrl);
  
  const text = `Hi ${data.recipientName},\n\nYour ${data.type} leave request from ${data.from} to ${data.to} has been ${data.status}.\n\n${!isApproved && data.rejectionReason ? `Reason: ${data.rejectionReason}\n` : ''}\nPlease review this on your dashboard.`;

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
  const html = buildHtmlTemplate(recipientName, title, message, detailFields, actionUrl);
  
  const detailsText = detailFields.map((d) => `- ${d.label}: ${d.value}`).join('\n');
  const text = `Hi ${recipientName},\n\n${message}\n\n${detailsText ? `Details:\n${detailsText}\n\n` : ''}Please check your dashboard for details.`;

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
  department: string;
  designation: string;
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
    { label: 'Department', value: data.department },
    { label: 'Designation', value: data.designation },
    { label: 'Date of Joining', value: data.joinedAt },
  ];

  const html = buildHtmlTemplate(data.firstName, 'Welcome to Epical! 🎉', message, details, actionUrl);

  const text = `Hi ${data.firstName},\n\nWelcome to the team! Your employee profile has been successfully created.\n\nDetails:\n- Employee ID: ${data.employeeId}\n- Name: ${fullName}\n- Department: ${data.department}\n- Designation: ${data.designation}\n- Date of Joining: ${data.joinedAt}\n\nPlease log in to your dashboard to complete your profile.`;

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
  actionUrl?: string
): Promise<boolean> {
  const subject = `[Epical EMS] Your Payslip for ${data.payMonth} is Ready`;
  const message = `Your payslip for the pay period of <strong>${data.payMonth}</strong> has been published and is now available for download in your dashboard.`;

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

  const payslipUrl = actionUrl || `${env.FRONTEND_URL || 'http://localhost:5173'}/employee/payslips`;
  const html = buildHtmlTemplate(data.recipientName, 'Payslip Available', message, details, payslipUrl);

  const text = `Hi ${data.recipientName},\n\nYour payslip for ${data.payMonth} is now available.\n\n${data.employeeId ? `Employee ID: ${data.employeeId}\n` : ''}Pay Period: ${data.payMonth}\n${data.fileName ? `Document: ${data.fileName}\n` : ''}\nPlease log in to your dashboard to download your payslip.`;

  return await sendEmail({ to: data.recipientEmail, subject, html, text });
}
