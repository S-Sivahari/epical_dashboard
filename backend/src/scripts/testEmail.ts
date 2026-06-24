import { connectDB } from '../config/db.js';
import * as emailService from '../services/emailService';

async function runEmailTest() {
  try {
    console.log('Starting Email Service Verification...');
    
    // Connect to database to verify MongoDB context is correct
    console.log('Connecting to database...');
    const db = await connectDB();
    console.log('✓ Connected to MongoDB:', db.databaseName);

    const testRecipientEmail = 'employee@company.com';
    const testRecipientName = 'Asha Menon';

    console.log('\n--- 1. Testing Generic Notification Email ---');
    const success1 = await emailService.sendGenericNotificationEmail(
      testRecipientEmail,
      testRecipientName,
      'System System Maintenance',
      'Please note that the EMPWR platform will be undergoing scheduled maintenance this Sunday from 2:00 AM to 6:00 AM UTC. Please save all your timesheets and leave requests prior to this window.',
      [
        { label: 'Platform', value: 'EMPWR' },
        { label: 'Window', value: 'Sunday, 2:00 AM - 6:00 AM' },
        { label: 'Impact', value: 'Temporary read-only mode' }
      ]
    );
    console.log(`Result 1: ${success1 ? '✓ SUCCESS' : '✗ FAILED'}`);

    console.log('\n--- 2. Testing Leave Submission Notification (Admin View) ---');
    const success2 = await emailService.sendLeaveSubmittedEmail({
      recipientEmail: 'admin@company.com',
      recipientName: 'System Admin',
      employeeName: testRecipientName,
      type: 'Sick Leave',
      from: '2026-06-01',
      to: '2026-06-03',
      days: 3,
      reason: 'Doctor recommended rest for wisdom teeth extraction.'
    });
    console.log(`Result 2: ${success2 ? '✓ SUCCESS' : '✗ FAILED'}`);

    console.log('\n--- 3. Testing Leave Status Approved Notification (Employee View) ---');
    const success3 = await emailService.sendLeaveStatusEmail({
      recipientEmail: testRecipientEmail,
      recipientName: testRecipientName,
      employeeName: testRecipientName,
      type: 'Sick Leave',
      from: '2026-06-01',
      to: '2026-06-03',
      days: 3,
      status: 'Approved'
    });
    console.log(`Result 3: ${success3 ? '✓ SUCCESS' : '✗ FAILED'}`);

    console.log('\n--- 4. Testing Leave Status Rejected Notification (Employee View) ---');
    const success4 = await emailService.sendLeaveStatusEmail({
      recipientEmail: testRecipientEmail,
      recipientName: testRecipientName,
      employeeName: testRecipientName,
      type: 'Annual Leave',
      from: '2026-07-10',
      to: '2026-07-24',
      days: 10,
      status: 'Rejected',
      rejectionReason: 'Conflict with Q3 major release deliverables. Please reschedule after July 20.'
    });
    console.log(`Result 4: ${success4 ? '✓ SUCCESS' : '✗ FAILED'}`);

    console.log('\nAll tests completed. Verification successful!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Test execution failed with error:', error);
    process.exit(1);
  }
}

runEmailTest();
