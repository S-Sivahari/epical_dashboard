import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { APP_NAME, APP_SHORT_NAME } from '@/utils/constants'

const CRITICAL_DATA = [
  { label: 'Projects', detail: 'Active & archived projects, client details, assignments' },
  { label: 'Assigned tasks', detail: 'Which employees work on which project tasks' },
  { label: 'Timesheets', detail: 'Check-in/out, hours logged, task descriptions' },
  { label: 'Attendance', detail: 'Daily attendance sessions and auto check-out records' },
  { label: 'Leaves', detail: 'All leave requests, approvals, balances, holidays' },
  { label: 'Employees', detail: 'Profiles, roles, join dates, employment status' },
]

export function Settings() {
  return (
    <PageWrapper>
      <div className="crewiq-dashboard">
      <PageHeader title="" breadcrumb={<Breadcrumb items={[{ label: 'Settings' }]} />} />

      <div className="space-y-8">
        <section className="rounded-xl border border-border p-5 shadow-sm" style={{backgroundColor:'var(--bg-card)',borderColor:'var(--border-subtle)'}}>
          <h2 className="font-display text-lg font-semibold text-ink">Sign-in</h2>
          <p className="mt-2 text-sm text-muted">
            All users sign in with Google (Gmail). There is no portal password to change.
            If someone cannot access their account, ask them to use the same company Gmail
            registered in HR, or contact IT to verify their employee record email.
          </p>
        </section>

        <section className="rounded-xl border border-border p-5 shadow-sm" style={{backgroundColor:'var(--bg-card)',borderColor:'var(--border-subtle)'}}>
          <h2 className="font-display text-lg font-semibold text-ink">Data protection & backup</h2>
          <p className="mt-2 text-sm text-muted">
            Your HRMS data lives in MongoDB Atlas (database: <strong>Production</strong>).
            The items below are the critical records you asked about — they are not stored in
            the browser; they must be backed up at the database level.
          </p>

          <ul className="mt-4 space-y-2">
            {CRITICAL_DATA.map((item) => (
              <li
                key={item.label}
                className="rounded-lg border border-border bg-surface/60 px-4 py-3 text-sm"
              >
                <span className="font-medium text-ink">{item.label}</span>
                <span className="text-muted"> — {item.detail}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 space-y-4 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4 text-sm text-ink">
            <div>
              <p className="font-semibold">1. Enable MongoDB Atlas Cloud Backup (recommended)</p>
              <p className="mt-1 text-muted">
                In MongoDB Atlas → your cluster → Backup, turn on Cloud Backup with daily
                snapshots and point-in-time recovery. This protects against accidental deletes
                and hardware failure.
              </p>
            </div>
            <div>
              <p className="font-semibold">2. Run a manual export (on demand)</p>
              <p className="mt-1 text-muted">
                From the <code className="rounded bg-white px-1 py-0.5 text-xs">backend</code>{' '}
                folder on the server:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-white px-3 py-2 text-xs">
                npm run backup:data
              </pre>
              <p className="mt-2 text-muted">
                This writes JSON files under <code className="text-xs">backend/backups/</code>{' '}
                (projects, timesheets, attendance, leaves, employees, and related collections).
                Copy that folder to cloud storage weekly or before major changes.
              </p>
            </div>
            <div>
              <p className="font-semibold">3. Atlas CLI / mongodump (full database)</p>
              <p className="mt-1 text-muted">
                For a complete binary dump, use MongoDB&apos;s{' '}
                <code className="text-xs">mongodump</code> against your Atlas connection string
                and store the archive off-site.
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted">
            Uploaded files (documents, payslip PDFs) may live separately on disk or object
            storage — back those up alongside the database.
          </p>
        </section>

        <section className="rounded-xl border border-border p-5 shadow-sm" style={{backgroundColor:'var(--bg-card)',borderColor:'var(--border-subtle)'}}>
          <h2 className="font-display text-lg font-semibold text-ink">Help & support</h2>
          <p className="mt-2 text-sm text-muted">
            {APP_SHORT_NAME} v0.1.0 · {APP_NAME} · Internal use only
          </p>
          <div className="mt-4 rounded-lg border border-border bg-surface/60 p-4 text-sm text-muted">
            <p>Email: support@company.com</p>
            <p className="mt-2">
              Sign-in issues: use Google (Gmail) — no password reset in this portal.
            </p>
          </div>
        </section>
      </div>
      </div>
    </PageWrapper>
  )
}
