import { connectDB, closeDB } from '../config/db';
import { setAllEmployeesPublicView } from '../services/employeeService';

/**
 * One-time migration: set view=Public on all existing employees.
 *
 * Run with: npx tsx src/scripts/migrateEmployeesToPublicView.ts
 */
async function main() {
  try {
    console.log('Setting view=Public on all employees...\n');
    await connectDB();
    const updated = await setAllEmployeesPublicView();
    console.log(`Done. Updated ${updated} employee(s).`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
}

void main();
