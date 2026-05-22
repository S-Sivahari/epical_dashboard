import { employeeTimesheetController } from '../controllers/employeeTimesheetController';
import { connectDB } from '../config/db';
import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { TimesheetModel } from '../models/Timesheet';
import { ProjectModel } from '../models/Project';

function makeMockRes() {
  const res: any = {
    statusCode: 200,
    data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(obj: any) {
      this.data = obj;
      return this;
    }
  };
  return res;
}

async function runTest() {
  try {
    await connectDB();
    console.log('✓ Connected to Database');

    const testEmployeeId = 'EMP-2024-0847';
    
    // Clean existing attendance for the test employee
    console.log('Cleaning up existing attendance records for employee...');
    await EmployeeAttendanceModel.deleteMany({ employeeId: testEmployeeId });
    await TimesheetModel.deleteMany({ employeeId: testEmployeeId });

    // Mock request
    const req: any = {
      user: {
        id: testEmployeeId,
        email: 'employee@company.com',
        role: 'Employee'
      }
    };

    console.log('\n--- Test 1: Fetch attendance on clean setup (Expected: checkedIn=false) ---');
    let res = makeMockRes();
    await employeeTimesheetController.getMyAttendance(req, res);
    console.log('Result:', res.data);
    if (res.data.checkedIn !== false) throw new Error('Test 1 failed');

    console.log('\n--- Test 2: Check-in first time (Expected: checkedIn=true) ---');
    res = makeMockRes();
    await employeeTimesheetController.checkIn(req, res);
    console.log('Result:', res.data);
    if (res.data.checkedIn !== true) throw new Error('Test 2 failed');

    console.log('\n--- Test 3: Fetch attendance after check-in (Expected: checkedIn=true) ---');
    res = makeMockRes();
    await employeeTimesheetController.getMyAttendance(req, res);
    console.log('Result:', res.data);
    if (res.data.checkedIn !== true) throw new Error('Test 3 failed');

    console.log('\n--- Test 4: Try double check-in (Expected: Already checked in) ---');
    res = makeMockRes();
    await employeeTimesheetController.checkIn(req, res);
    console.log('Result:', res.data);
    if (res.data.message !== 'Already checked in') throw new Error('Test 4 failed');

    console.log('\n--- Test 5: Check-out (Expected: checkedIn=false) ---');
    res = makeMockRes();
    await employeeTimesheetController.checkOut(req, res);
    console.log('Result:', res.data);
    if (res.data.checkedIn !== false) throw new Error('Test 5 failed');

    console.log('\n--- Test 6: Fetch attendance after check-out (Expected: checkedIn=false) ---');
    res = makeMockRes();
    await employeeTimesheetController.getMyAttendance(req, res);
    console.log('Result:', res.data);
    if (res.data.checkedIn !== false) throw new Error('Test 6 failed');

    console.log('\n--- Test 7: Check-in second time today (Expected: checkedIn=true) ---');
    res = makeMockRes();
    await employeeTimesheetController.checkIn(req, res);
    console.log('Result:', res.data);
    if (res.data.checkedIn !== true) throw new Error('Test 7 failed');

    console.log('\n--- Test 8: Fetch attendance after second check-in (Expected: checkedIn=true) ---');
    res = makeMockRes();
    await employeeTimesheetController.getMyAttendance(req, res);
    console.log('Result:', res.data);
    if (res.data.checkedIn !== true) throw new Error('Test 8 failed');

    console.log('\n--- Test 9: Check-out second time (Expected: checkedIn=false) ---');
    res = makeMockRes();
    await employeeTimesheetController.checkOut(req, res);
    console.log('Result:', res.data);
    if (res.data.checkedIn !== false) throw new Error('Test 9 failed');

    console.log('\n✓ All backend tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

runTest();
