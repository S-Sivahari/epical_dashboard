/**
 * Read-only Excel parse check + optional full import smoke test.
 *
 * Parse only (safe, no DB writes):
 *   npx tsx src/scripts/verifyMetalRoutingImport.ts path/to/file.xlsx
 *
 * Full import against a project (writes routes):
 *   npx tsx src/scripts/verifyMetalRoutingImport.ts path/to/file.xlsx --project-id <mongoId>
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseMetalRoutingExcelWithDiagnostics } from '../utils/metalRoutingExcel';

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((arg) => !arg.startsWith('--'));
  const projectIdFlag = args.findIndex((arg) => arg === '--project-id');
  const projectId = projectIdFlag >= 0 ? args[projectIdFlag + 1] : undefined;

  if (!fileArg) {
    console.error('Usage: npx tsx src/scripts/verifyMetalRoutingImport.ts <file.xlsx> [--project-id <id>]');
    process.exit(1);
  }

  const filePath = path.resolve(fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  console.log('\n=== Step 1: Parse Excel (no database) ===');
  console.log('File:', filePath, `(${buffer.byteLength} bytes)`);

  const parsed = await parseMetalRoutingExcelWithDiagnostics(buffer, { log: true });
  console.log('Worksheet:', parsed.worksheetName);
  console.log('Header row:', parsed.headerRow);
  console.log('Merge ranges:', parsed.mergeRangeCount);
  console.log('Route blocks:', parsed.routeBlocks.length);
  console.log('Metal rows:', parsed.totalMetalRows);
  parsed.routeBlocks.forEach((block, index) => {
    console.log(
      `  [${index + 1}] ${block.fromCell} → ${block.toCell} · ${block.fromSignal} → ${block.toSignal} (${block.metals.length} metals)`,
    );
  });

  if (!projectId) {
    console.log('\nParse check passed. To test DB import, rerun with --project-id <mongoProjectId>');
    return;
  }

  console.log('\n=== Step 2: Import into MongoDB ===');
  console.log('Project ID:', projectId);
  const mongoose = (await import('mongoose')).default;
  const { env } = await import('../config/env');
  const { importProjectRoutesFromExcel, getProjectContext } = await import('../services/pdkMetalRoutingService');
  await mongoose.connect(env.mongodbUri, { dbName: 'Production' });

  try {
    const before = await getProjectContext(projectId);
    console.log('Saved routes before import:', before.routes.length);

    const result = await importProjectRoutesFromExcel(projectId, buffer);
    console.log('Import success:', result.success);
    console.log('Routes imported:', result.routesImported);
    console.log('Metals imported:', result.metalsImported);
    console.log('Routes failed:', result.routesFailed);
    console.log('Saved routes in response:', result.savedRoutes.length);

    const after = await getProjectContext(projectId);
    console.log('Saved routes after import:', after.routes.length);
    after.routes.forEach((route) => {
      console.log(`  - ${route.fromCell} → ${route.toCell} · ${route.fromSignal} → ${route.toSignal} (${route.metalCount} metals)`);
    });

    if (!result.success || after.routes.length === 0) {
      console.error('\nVERIFY FAILED: import did not produce visible saved routes.');
      process.exit(1);
    }

    console.log('\nVERIFY PASSED: routes are visible for this project.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\nVERIFY ERROR:', err instanceof Error ? err.message : err);
  process.exit(1);
});
