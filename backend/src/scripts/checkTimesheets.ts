import { connectDB } from '../config/db.js';

async function check() {
  try {
    const db = await connectDB();
    console.log('✓ Connected to MongoDB');
    
    console.log('\n--- Timesheets ---');
    const timesheets = await db.collection('timesheets').find({}).limit(10).toArray();
    console.log(`Found ${timesheets.length} timesheets:`);
    timesheets.forEach((t) => {
      console.log(`  - Employee: ${t.employee} (${t.employeeId}), Project: ${t.project}, Task: ${t.task}, Hours: ${t.totalHours}, Status: ${t.taskStatus}, Login: ${t.loginTime}, Logout: ${t.logoutTime}`);
    });

    console.log('\n--- Employee Attendance ---');
    const attendance = await db.collection('employeeattendances').find({}).limit(10).toArray();
    console.log(`Found ${attendance.length} attendance records:`);
    attendance.forEach((a) => {
      console.log(`  - Employee: ${a.employeeName} (${a.employeeId}), Date: ${a.date}, CheckIn: ${a.checkInTime}, CheckOut: ${a.checkOutTime}`);
    });

    console.log('\n--- Assigned Tasks ---');
    const assignedTasks = await db.collection('assignedtasks').find({}).limit(10).toArray();
    console.log(`Found ${assignedTasks.length} assigned tasks:`);
    assignedTasks.forEach((a) => {
      console.log(`  - Employee: ${a.employeeName} (${a.employeeId}), Project: ${a.projectName}, Title: ${a.title}, Status: ${a.status}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error);
    process.exit(1);
  }
}

check();
