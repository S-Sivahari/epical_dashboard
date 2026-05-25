import { useState } from 'react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { toast } from 'sonner'
import { APP_NAME, APP_SHORT_NAME } from '@/utils/constants'

export function Settings() {
  const [restoreOpen, setRestoreOpen] = useState(false)

  return (
    <PageWrapper>
      <PageHeader title="" breadcrumb={<Breadcrumb items={[{ label: 'Settings' }]} />} />

      <div className="space-y-8">
        <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-ink">Database backup</h2>
          <p className="mt-1 text-sm text-muted">Monthly snapshots for compliance.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {['April', 'March', 'February'].map((m) => (
              <div key={m} className="rounded-lg border border-border bg-surface/60 p-4">
                <p className="font-medium text-ink">{m} 2026</p>
                <p className="text-sm text-muted">Size: 128 MB</p>
                <Button size="sm" variant="secondary" className="mt-3">
                  Download
                </Button>
              </div>
            ))}
          </div>
          <Button variant="danger" className="mt-4" onClick={() => setRestoreOpen(true)}>
            Restore database
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-ink">Change password</h2>
          <form className="mt-4 grid max-w-xl gap-3">
            <Input label="Employee ID" />
            <Input label="New password" type="password" />
            <Input label="Confirm password" type="password" />
            <div className="flex gap-2">
              <Button type="button">Update password</Button>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-ink">Help & support</h2>
          <p className="mt-2 text-sm text-muted">
            {APP_SHORT_NAME} v0.1.0 · {APP_NAME} · Internal use only
          </p>
          <div className="mt-4 rounded-lg border border-border bg-surface/60 p-4 text-sm text-muted">
            <p>Email: support@company.com</p>
            <p className="mt-2">
              Docs: <span className="text-primary">https://intranet.company.com/empwr</span>
            </p>
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={restoreOpen}
        title="Restore database?"
        description="This will overwrite current data with the selected snapshot. This action is irreversible."
        confirmLabel="Restore"
        danger
        onClose={() => setRestoreOpen(false)}
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 400))
          toast.success('Restore initiated (demo)')
          setRestoreOpen(false)
        }}
      />
    </PageWrapper>
  )
}
