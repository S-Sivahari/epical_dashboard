import { PageWrapper } from '@components/layout/PageWrapper'
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
    <PageWrapper fillViewport className="admin-hub-page-wrap relative z-10 !py-3 font-body">
      <div className="crewiq-dashboard admin-settings-view relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-settings-shell relative z-10 flex min-h-0 flex-1 animate-fadeIn flex-col overflow-y-auto overflow-x-hidden">
          <header className="admin-settings-hub-header">
            <div className="admin-settings-hero-top">
              <h1 className="admin-settings-hero-title font-display">Settings Hub</h1>
            </div>
          </header>

          <div className="admin-settings-body space-y-5">
            <section className="admin-settings-panel">
              <h2 className="admin-settings-panel-title font-display">Sign-in</h2>
              <p className="admin-settings-panel-text">
                All users sign in with Google (Gmail). There is no portal password to change.
                If someone cannot access their account, ask them to use the same company Gmail
                registered with admin, or contact IT to verify their employee record email.
              </p>
            </section>

            <section className="admin-settings-panel">
              <h2 className="admin-settings-panel-title font-display">Data protection & backup</h2>
              <p className="admin-settings-panel-text">
                Your HRMS data lives in MongoDB Atlas (database: <strong>Production</strong>).
                The items below are the critical records you asked about — they are not stored in
                the browser; they must be backed up at the database level.
              </p>

              <ul className="admin-settings-list">
                {CRITICAL_DATA.map((item) => (
                  <li key={item.label} className="admin-settings-list-item">
                    <span className="font-semibold admin-settings-text-brand">{item.label}</span>
                    <span className="text-slate-600"> — {item.detail}</span>
                  </li>
                ))}
              </ul>

              <div className="admin-settings-callout space-y-4">
                <div>
                  <p className="font-semibold admin-settings-text-brand">1. Enable MongoDB Atlas Cloud Backup (recommended)</p>
                  <p className="admin-settings-panel-text mt-1">
                    In MongoDB Atlas → your cluster → Backup, turn on Cloud Backup with daily
                    snapshots and point-in-time recovery. This protects against accidental deletes
                    and hardware failure.
                  </p>
                </div>
                <div>
                  <p className="font-semibold admin-settings-text-brand">2. Run a manual export (on demand)</p>
                  <p className="admin-settings-panel-text mt-1">
                    From the <code className="admin-settings-code">backend</code> folder on the server:
                  </p>
                  <pre className="admin-settings-pre">npm run backup:data</pre>
                  <p className="admin-settings-panel-text mt-2">
                    This writes JSON files under <code className="admin-settings-code">backend/backups/</code>{' '}
                    (projects, timesheets, attendance, leaves, employees, and related collections).
                    Copy that folder to cloud storage weekly or before major changes.
                  </p>
                </div>
                <div>
                  <p className="font-semibold admin-settings-text-brand">3. Atlas CLI / mongodump (full database)</p>
                  <p className="admin-settings-panel-text mt-1">
                    For a complete binary dump, use MongoDB&apos;s{' '}
                    <code className="admin-settings-code">mongodump</code> against your Atlas connection string
                    and store the archive off-site.
                  </p>
                </div>
              </div>

              <p className="admin-settings-footnote">
                Uploaded files (documents, payslip PDFs) may live separately on disk or object
                storage — back those up alongside the database.
              </p>
            </section>

            <section className="admin-settings-panel">
              <h2 className="admin-settings-panel-title font-display">Help & support</h2>
              <p className="admin-settings-panel-text">
                {APP_SHORT_NAME} v0.1.0 · {APP_NAME} · Internal use only
              </p>
              <div className="admin-settings-support-box">
                <p>Email: support@company.com</p>
                <p className="mt-2">
                  Sign-in issues: use Google (Gmail) — no password reset in this portal.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
