import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';

/**
 * Allow multiple check-in/out segments per day (morning + evening).
 * Older deployments created a unique index on { employeeId, date } — drop it.
 */
export async function ensureAttendanceIndexes(): Promise<void> {
  const collection = EmployeeAttendanceModel.collection;
  const indexes = await collection.indexes();

  for (const idx of indexes) {
    const isEmployeeDate =
      idx.key?.employeeId === 1 && idx.key?.date === 1 && Object.keys(idx.key).length === 2;
    if (isEmployeeDate && idx.unique) {
      const name = idx.name;
      if (name) {
        await collection.dropIndex(name);
        console.log(`✓ Dropped unique attendance index "${name}" (multiple check-ins per day enabled)`);
      }
    }
  }

  await EmployeeAttendanceModel.syncIndexes();
}
