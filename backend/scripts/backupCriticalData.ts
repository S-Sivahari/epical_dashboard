/**
 * Export critical HRMS collections to JSON files.
 * Run from backend/: npm run backup:data
 *
 * Output: backend/backups/YYYY-MM-DD_HH-mm-ss/*.json
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectDB, closeDB, getDB } from '../src/config/db.js'

const CRITICAL_COLLECTIONS = [
  'employees',
  'users',
  'projects',
  'archivedprojects',
  'assignedtasks',
  'timesheets',
  'employeeattendances',
  'leaves',
  'holidays',
  'compensation_entries',
  'tickets',
  'payroll_batches',
  'employee_payslip',
  'company_calendar_events',
  'notifications',
] as const

function serializeDoc(doc: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(doc, (_key, value) => {
      if (value && typeof value === 'object' && value.constructor?.name === 'ObjectId') {
        return String(value)
      }
      if (value instanceof Date) {
        return value.toISOString()
      }
      return value
    }),
  )
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outDir = path.join(scriptDir, '..', 'backups', stamp)

  await connectDB()
  const db = getDB()

  await mkdir(outDir, { recursive: true })

  const summary: Record<string, number> = {}
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name))

  for (const name of CRITICAL_COLLECTIONS) {
    if (!existing.has(name)) {
      console.warn(`⚠ Collection not found (skipped): ${name}`)
      summary[name] = 0
      continue
    }

    const docs = await db.collection(name).find({}).toArray()
    const serialized = docs.map((doc) => serializeDoc(doc as Record<string, unknown>))
    await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(serialized, null, 2), 'utf8')
    summary[name] = docs.length
    console.log(`✓ ${name}: ${docs.length} document(s)`)
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    database: db.databaseName,
    collections: summary,
    note: 'Store this folder off-site (cloud drive, second machine). Do not commit to git.',
  }
  await writeFile(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  console.log(`\nBackup saved to:\n  ${outDir}`)
  await closeDB()
}

main().catch((err) => {
  console.error('Backup failed:', err)
  process.exit(1)
})
