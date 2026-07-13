/**
 * One-off: repair Casual/Sick used after past leave archive wiped used but left remaining low.
 *
 * Usage:
 *   npx tsx src/scripts/repairPostArchiveLeaveBalances.ts           # dry-run
 *   npx tsx src/scripts/repairPostArchiveLeaveBalances.ts --apply   # write
 */
import { connectDB, closeDB } from '../config/db';
import { repairPostArchiveLeaveBalances } from '../services/leaveService';

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDB();

  const result = await repairPostArchiveLeaveBalances({
    dryRun: !apply,
    year: new Date().getFullYear(),
  });

  console.log(
    JSON.stringify(
      {
        mode: result.dryRun ? 'DRY_RUN' : 'APPLIED',
        year: result.year,
        scannedEmployees: result.scanned,
        changeCount: result.changed,
        changes: result.changes,
      },
      null,
      2,
    ),
  );

  await closeDB();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await closeDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
