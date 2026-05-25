import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return !!(env.SMTP_USER && env.SMTP_PASS);
}

interface ReminderEmailParams {
  to: string;
  employeeName: string;
  checkInTime: Date;
  autoCheckoutTime: string;
}

export async function sendCheckoutReminderEmail(params: ReminderEmailParams): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.log(`⚠ Email not configured — skipping reminder for ${params.employeeName}`);
    return false;
  }

  const checkInStr = params.checkInTime.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">⏰ Timesheet Checkout Reminder</h1>
      </div>
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 16px;">Hello <strong>${params.employeeName}</strong>,</p>
        <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px;">
          You are still checked in from <strong>${checkInStr}</strong>. Please complete your checkout to ensure accurate timesheet records.
        </p>
        <div style="background: #fef9c3; border-left: 4px solid #eab308; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #854d0e;">
            ⚠️ If you do not check out manually, the system will automatically check you out at <strong>${params.autoCheckoutTime}</strong>.
          </p>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin: 24px 0 0;">
          Please log into the Employee Portal and complete your checkout properly to avoid automatic checkout.
        </p>
      </div>
      <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">This is an automated message from the Employee Portal.</p>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"Employee Portal" <${env.SMTP_FROM}>`,
      to: params.to,
      subject: 'Timesheet Checkout Reminder',
      html,
    });
    console.log(`✓ Reminder email sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to send reminder to ${params.to}:`, error);
    return false;
  }
}

interface AutoCheckoutEmailParams {
  to: string;
  employeeName: string;
  checkInTime: Date;
  checkOutTime: Date;
  totalHours: number;
}

export async function sendAutoCheckoutConfirmationEmail(params: AutoCheckoutEmailParams): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.log(`⚠ Email not configured — skipping auto-checkout confirmation for ${params.employeeName}`);
    return false;
  }

  const fmt = (d: Date) =>
    d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">✅ Automatic Checkout Completed</h1>
      </div>
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 16px;">Hello <strong>${params.employeeName}</strong>,</p>
        <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px;">
          You were automatically checked out because your session remained active past the auto-checkout time.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px; color: #1a1a1a;">
            <tr><td style="padding: 4px 0; color: #6b7280;">Check-in:</td><td style="padding: 4px 0; font-weight: 600;">${fmt(params.checkInTime)}</td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280;">Auto Check-out:</td><td style="padding: 4px 0; font-weight: 600;">${fmt(params.checkOutTime)}</td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280;">Total Hours:</td><td style="padding: 4px 0; font-weight: 600;">${params.totalHours}h</td></tr>
          </table>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin: 24px 0 0;">
          If you need to correct your timesheet, please contact your administrator.
        </p>
      </div>
      <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">This is an automated message from the Employee Portal.</p>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"Employee Portal" <${env.SMTP_FROM}>`,
      to: params.to,
      subject: 'Automatic Checkout Completed — Timesheet Updated',
      html,
    });
    console.log(`✓ Auto-checkout confirmation sent to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to send auto-checkout confirmation to ${params.to}:`, error);
    return false;
  }
}
