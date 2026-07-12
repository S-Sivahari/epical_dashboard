import { connectDB, closeDB, getDB } from '../config/db';
import type { LeaveRequest } from '../models/Leave';

type ArchivedLeave = LeaveRequest & {
  archiveMonth?: string;
  archivedAt?: Date;
  _id?: unknown;
};

/**
 * One-time recovery: re-insert leave rows from leave_archives into leaves.
 * Skips documents whose id already exists in leaves.
 *
 * Run with: npx tsx src/scripts/restoreLeaveArchives.ts
 */
async function main() {
  try {
    await connectDB();
    const db = getDB();
    const archiveCol = db.collection<ArchivedLeave>('leave_archives');
    const leaveCol = db.collection<LeaveRequest>('leaves');

    const archived = await archiveCol.find({}).toArray();
    if (!archived.length) {
      console.log('No documents in leave_archives — nothing to restore.');
      return;
    }

    const existingIds = new Set(
      (await leaveCol.find({}, { projection: { id: 1 } }).toArray()).map((doc) => doc.id),
    );

    let restored = 0;
    let skipped = 0;
    let invalid = 0;

    for (const doc of archived) {
      const id = doc.id ? String(doc.id) : '';
      if (!id) {
        invalid++;
        continue;
      }
      if (existingIds.has(id)) {
        skipped++;
        continue;
      }

      const { archiveMonth: _archiveMonth, archivedAt: _archivedAt, _id, ...rest } = doc;
      await leaveCol.insertOne(rest as LeaveRequest);
      existingIds.add(id);
      restored++;
    }

    console.log(`leave_archives scanned: ${archived.length}`);
    console.log(`restored: ${restored}`);
    console.log(`skipped (already in leaves): ${skipped}`);
    console.log(`invalid (missing id): ${invalid}`);
  } catch (err) {
    console.error('Restore failed:', err);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
}

void main();
