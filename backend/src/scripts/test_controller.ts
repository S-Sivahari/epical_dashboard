import dotenv from 'dotenv';
import { connectDB, closeDB } from '../config/db';
import { leaveController } from '../controllers/leaveController';

dotenv.config();

async function test() {
  await connectDB();
  
  // Mock request and response for Admin
  const adminReq: any = {
    user: { id: 'admin-id', role: 'Admin', email: 'admin@company.com' },
    query: {}
  };
  
  let adminJsonData: any = null;
  const adminRes: any = {
    json: (data: any) => {
      adminJsonData = data;
    },
    status: (code: any) => {
      console.log('Admin Status Code:', code);
      return adminRes;
    }
  };
  
  await leaveController.getAll(adminReq, adminRes);
  console.log('Admin Leaves Response (length):', adminJsonData ? adminJsonData.length : 0);
  console.log('Admin Leaves:', adminJsonData);
  
  // Mock request and response for Employee (Sivahari S S)
  const employeeReq: any = {
    user: { id: 'E-1779269937162', role: 'Employee', email: 'sivahari@gmail.com' },
    query: {}
  };
  
  let employeeJsonData: any = null;
  const employeeRes: any = {
    json: (data: any) => {
      employeeJsonData = data;
    },
    status: (code: any) => {
      console.log('Employee Status Code:', code);
      return employeeRes;
    }
  };
  
  await leaveController.getAll(employeeReq, employeeRes);
  console.log('Employee Leaves Response (length):', employeeJsonData ? employeeJsonData.length : 0);
  console.log('Employee Leaves:', employeeJsonData);

  await closeDB();
}

test().catch(console.error);
