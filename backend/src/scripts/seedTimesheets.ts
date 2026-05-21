import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ProjectModel } from '../models/Project';
import { TimesheetModel } from '../models/Timesheet';
import { env } from '../config/env';

dotenv.config();

const SEED_PROJECTS = [
  {
    projectName: 'Project Atlas',
    clientName: 'Acme Corp',
    technologyNode: '14nm FinFET',
    accessType: 'private',
    status: 'Active',
    description: 'Next-generation low-power microprocessor layout design and verification pipeline for mobile SoC applications.',
    allowedUsers: ['Asha Menon', 'Rahul Verma', 'Kiran Rao'],
    assignedTeamName: 'Design Team',
    createdBy: 'Admin User'
  },
  {
    projectName: 'Project Beacon',
    clientName: 'Globex Electronics',
    technologyNode: '28nm',
    accessType: 'public',
    status: 'Active',
    description: 'High-speed analog-to-digital converter interface and clock distribution tree for automotive radar systems.',
    allowedUsers: [],
    createdBy: 'Admin User'
  },
  {
    projectName: 'Project Phoenix',
    clientName: 'Initech Systems',
    technologyNode: '65nm',
    accessType: 'private',
    status: 'Active',
    description: 'Legacy chip retrofit and radiation hardening for aerospace telemetry sensors with full MIL-STD compliance.',
    allowedUsers: ['Amit Patel', 'Vikram Singh'],
    assignedTeamName: 'R&D Team',
    createdBy: 'Admin User'
  },
  {
    projectName: 'Project Apollo',
    clientName: 'Internal',
    technologyNode: '180nm',
    accessType: 'public',
    status: 'Completed',
    description: 'Standard cell library characterization and physical design rule verification for internal PDK release.',
    allowedUsers: [],
    createdBy: 'Admin User'
  },
  {
    projectName: 'Project Horizon',
    clientName: 'Umbrella Corp',
    technologyNode: '28nm',
    accessType: 'private',
    status: 'Active',
    description: 'Low-latency packet routing engine for high-performance memory interfaces supporting DDR5 bandwidth targets.',
    allowedUsers: ['Priya Das', 'Asha Menon', 'Meera Nair'],
    assignedTeamName: 'Hardware Team',
    createdBy: 'Admin User'
  },
  {
    projectName: 'Project Titan',
    clientName: 'Acme Corp',
    technologyNode: '7nm',
    accessType: 'private',
    status: 'Active',
    description: 'Server-class GPU compute tile with advanced power delivery network and thermal-aware floorplanning.',
    allowedUsers: ['Asha Menon', 'Sneha Iyer', 'Vikram Singh', 'Kiran Rao', 'Rahul Verma', 'Amit Patel'],
    assignedTeamName: 'Design Team',
    createdBy: 'Admin User'
  },
  {
    projectName: 'Project Orion',
    clientName: 'Globex Electronics',
    technologyNode: '14nm FinFET',
    accessType: 'public',
    status: 'Completed',
    description: 'Multi-channel SerDes transceiver IP qualification and silicon bring-up validation suite.',
    allowedUsers: [],
    createdBy: 'Admin User'
  }
];

const SEED_TIMESHEETS = [
  {
    employee: 'Asha Menon',
    employeeId: 'E-1001',
    project: 'Project Atlas',
    client: 'Acme Corp',
    technologyNode: '14nm FinFET',
    loginTime: new Date('2026-05-21T09:00:00'),
    logoutTime: new Date('2026-05-21T17:00:00'),
    totalHours: 8.0,
    status: 'Approved',
    requestStatus: 'No Request',
    billable: true,
    task: 'Critical path routing design and simulation checks.',
  },
  {
    employee: 'Rahul Verma',
    employeeId: 'E-1002',
    project: 'Project Beacon',
    client: 'Globex Electronics',
    technologyNode: '28nm',
    loginTime: new Date('2026-05-21T08:30:00'),
    totalHours: 0.0,
    status: 'Pending',
    requestStatus: 'No Request',
    billable: true,
    task: 'Physical DRC check execution and report compiling.',
  },
  {
    employee: 'Meera Nair',
    employeeId: 'E-1003',
    project: 'Project Horizon',
    client: 'Umbrella Corp',
    technologyNode: '28nm',
    loginTime: new Date('2026-05-20T09:00:00'),
    logoutTime: new Date('2026-05-20T18:30:00'),
    totalHours: 9.5,
    status: 'Pending',
    requestStatus: 'Pending Review',
    billable: true,
    task: 'Clock tree floorplanning and pin connection verification.',
    correctionRequest: {
      requestedLogin: new Date('2026-05-20T09:00:00'),
      requestedLogout: new Date('2026-05-20T19:15:00'),
      reason: 'LVS sync meeting ran late.',
      message: 'Forgot to logout after review meeting. Please update logout time to 7:15 PM.',
    },
  },
  {
    employee: 'Amit Patel',
    employeeId: 'E-1004',
    project: 'Project Phoenix',
    client: 'Initech Systems',
    technologyNode: '65nm',
    loginTime: new Date('2026-05-19T08:00:00'),
    logoutTime: new Date('2026-05-19T18:00:00'),
    totalHours: 10.0,
    status: 'Pending',
    requestStatus: 'No Request',
    billable: true,
    task: 'Pre-simulation reviews for radiation hardened cell placement.',
  },
  {
    employee: 'Priya Das',
    employeeId: 'E-1005',
    project: 'Project Horizon',
    client: 'Umbrella Corp',
    technologyNode: '28nm',
    loginTime: new Date('2026-05-18T09:30:00'),
    logoutTime: new Date('2026-05-18T18:00:00'),
    totalHours: 8.5,
    status: 'Approved',
    requestStatus: 'No Request',
    billable: false,
    task: 'Weekly cross-team hardware architecture sync meeting.',
  },
  {
    employee: 'Asha Menon',
    employeeId: 'E-1001',
    project: 'Project Atlas',
    client: 'Acme Corp',
    technologyNode: '14nm FinFET',
    loginTime: new Date('2026-05-15T09:00:00'),
    logoutTime: new Date('2026-05-15T17:00:00'),
    totalHours: 8.0,
    status: 'Approved',
    requestStatus: 'No Request',
    billable: true,
    task: 'LVS rule violation diagnostics and cell resizing.',
  },
  {
    employee: 'Rahul Verma',
    employeeId: 'E-1002',
    project: 'Project Beacon',
    client: 'Globex Electronics',
    technologyNode: '28nm',
    loginTime: new Date('2026-05-12T09:00:00'),
    logoutTime: new Date('2026-05-12T16:00:00'),
    totalHours: 7.0,
    status: 'Approved',
    requestStatus: 'No Request',
    billable: true,
    task: 'Block level logical synthesis runs and area report logs.',
  },
  {
    employee: 'Kiran Rao',
    employeeId: 'E-1006',
    project: 'Project Titan',
    client: 'Acme Corp',
    technologyNode: '7nm',
    loginTime: new Date('2026-05-21T08:00:00'),
    logoutTime: new Date('2026-05-21T18:00:00'),
    totalHours: 10.0,
    status: 'Approved',
    requestStatus: 'No Request',
    billable: true,
    task: 'Power delivery network IR drop simulation and grid analysis.',
  },
  {
    employee: 'Sneha Iyer',
    employeeId: 'E-1007',
    project: 'Project Titan',
    client: 'Acme Corp',
    technologyNode: '7nm',
    loginTime: new Date('2026-05-20T09:00:00'),
    logoutTime: new Date('2026-05-20T15:30:00'),
    totalHours: 6.5,
    status: 'Pending',
    requestStatus: 'No Request',
    billable: true,
    task: 'Formal equivalence checking on resynthesized netlist.',
  },
  {
    employee: 'Amit Patel',
    employeeId: 'E-1004',
    project: 'Project Phoenix',
    client: 'Initech Systems',
    technologyNode: '65nm',
    loginTime: new Date('2026-05-05T09:00:00'),
    logoutTime: new Date('2026-05-05T13:00:00'),
    totalHours: 4.0,
    status: 'Rejected',
    requestStatus: 'No Request',
    billable: false,
    task: 'Database script recoveries and structural verification checks.',
  },
  {
    employee: 'Asha Menon',
    employeeId: 'E-1001',
    project: 'Project Apollo',
    client: 'Internal',
    technologyNode: '180nm',
    loginTime: new Date('2026-04-25T09:00:00'),
    logoutTime: new Date('2026-04-25T17:00:00'),
    totalHours: 8.0,
    status: 'Approved',
    requestStatus: 'No Request',
    billable: true,
    task: 'Library characterization modeling configuration.',
  }
];

export async function seedProjectsAndTimesheets() {
  console.log('Clearing Projects collection...');
  await ProjectModel.deleteMany({});
  
  console.log('Clearing Timesheets collection...');
  await TimesheetModel.deleteMany({});
  
  console.log(`Seeding ${SEED_PROJECTS.length} Projects...`);
  await ProjectModel.insertMany(SEED_PROJECTS);
  
  console.log(`Seeding ${SEED_TIMESHEETS.length} Timesheets...`);
  await TimesheetModel.insertMany(SEED_TIMESHEETS);
  
  console.log('✓ Projects & Timesheets seeded successfully!');
}

async function runStandalone() {
  try {
    const mongoUri = env.mongodbUri;
    console.log(`Connecting to database at ${mongoUri}...`);
    await mongoose.connect(mongoUri, { dbName: 'Production' });
    await seedProjectsAndTimesheets();
    await mongoose.disconnect();
    console.log('Connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Check if run directly
if (import.meta.url.startsWith('file:')) {
  const modulePath = new URL(import.meta.url).pathname;
  const scriptPath = process.argv[1];
  
  // Normalize paths for comparison (Windows/Unix differences)
  const normModule = modulePath.replace(/^\/([A-Za-z]:)/, '$1').replace(/\\/g, '/');
  const normScript = scriptPath ? scriptPath.replace(/\\/g, '/') : '';
  
  if (normScript.endsWith('seedTimesheets.ts') || normScript.includes('/seedTimesheets.ts') || normModule === normScript) {
    runStandalone();
  }
}
