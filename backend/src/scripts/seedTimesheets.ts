import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ProjectModel } from '../models/Project';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
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
    teamLead: 'Asha Menon',
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
    projectName: 'Design System',
    clientName: 'Epical Technologies',
    technologyNode: 'Internal',
    accessType: 'private',
    status: 'Active',
    description: 'Company-wide design system tokens, components, and documentation for product teams.',
    allowedUsers: ['Sarah Mitchell'],
    teamLead: 'Sarah Mitchell',
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
    teamLead: 'Amit Patel',
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
    allowedUsers: ['Priya Das', 'Asha Menon', 'Meera Nair', 'Sarah Mitchell'],
    teamLead: 'Meera Nair',
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
    teamLead: 'Asha Menon',
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

const SEED_ASSIGNED_TASKS = [
  {
    employeeId: 'EMP-2024-0847',
    employeeName: 'Sarah Mitchell',
    projectName: 'Design System',
    title: 'Component library audit',
    description: 'Review shared UI components for token consistency and accessibility.',
  },
  {
    employeeId: 'EMP-2024-0847',
    employeeName: 'Sarah Mitchell',
    projectName: 'Design System',
    title: 'Design tokens documentation',
    description: 'Document color, spacing, and typography tokens for product teams.',
  },
  {
    employeeId: 'EMP-2024-0847',
    employeeName: 'Sarah Mitchell',
    projectName: 'Project Horizon',
    title: 'Dashboard wireframes',
    description: 'Low-fidelity wireframes for the routing engine admin views.',
  },
  {
    employeeId: 'E-1001',
    employeeName: 'Asha Menon',
    projectName: 'Project Atlas',
    title: 'Critical path routing design',
    description: 'Complete routing design and simulation checks for Atlas block.',
  },
  {
    employeeId: 'E-1002',
    employeeName: 'Rahul Verma',
    projectName: 'Project Beacon',
    title: 'Physical DRC check execution',
    description: 'Run DRC checks and compile verification reports.',
  },
];

export async function seedProjectsAndTimesheets() {
  console.log('Clearing Projects collection...');
  await ProjectModel.deleteMany({});
  
  console.log('Clearing Timesheets collection...');
  await TimesheetModel.deleteMany({});

  console.log('Clearing Assigned Tasks collection...');
  await AssignedTaskModel.deleteMany({});
  
  console.log(`Seeding ${SEED_PROJECTS.length} Projects...`);
  const insertedProjects = await ProjectModel.insertMany(SEED_PROJECTS);
  const projectIdByName = new Map(
    insertedProjects.map((p) => [p.projectName, p._id])
  );

  console.log(`Seeding ${SEED_TIMESHEETS.length} Timesheets...`);
  const timesheetsWithProjectIds = SEED_TIMESHEETS.map((entry) => ({
    ...entry,
    projectId: projectIdByName.get(entry.project),
    taskStatus: entry.logoutTime ? 'Pending' : 'Session Incomplete',
  }));
  await TimesheetModel.insertMany(timesheetsWithProjectIds);

  const assignedPayload = SEED_ASSIGNED_TASKS.map((entry) => {
    const projectId = projectIdByName.get(entry.projectName);
    const project = insertedProjects.find((p) => p.projectName === entry.projectName);
    if (!projectId || !project) return null;
    return {
      projectId,
      projectName: entry.projectName,
      clientName: project.clientName,
      technologyNode: project.technologyNode,
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
      title: entry.title,
      description: entry.description,
      status: 'assigned',
    };
  }).filter(Boolean);

  if (assignedPayload.length > 0) {
    console.log(`Seeding ${assignedPayload.length} Assigned Tasks...`);
    await AssignedTaskModel.insertMany(assignedPayload);
  }
  
  console.log('✓ Projects, Timesheets & Assigned Tasks seeded successfully!');
}

/** Sync assigned tasks from project membership (does not wipe data). */
export async function seedAssignedTasksOnly() {
  const { syncAssignedTasksForProject, ensureAssignedTasksForEmployee } = await import(
    '../utils/assignedTaskSync'
  );
  const { getDB } = await import('../config/db');

  const projects = await ProjectModel.find({});
  for (const project of projects) {
    await syncAssignedTasksForProject(project);
  }

  const users = await getDB()
    .collection('users')
    .find({ role: { $in: ['Employee', 'employee'] } })
    .toArray();

  for (const user of users) {
    await ensureAssignedTasksForEmployee({
      id: String(user.id),
      name: String(user.name),
      email: user.email,
    });
  }

  const count = await AssignedTaskModel.countDocuments();
  console.log(`✓ Assigned tasks synced (${count} total).`);
  return { total: count, synced: true };
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
