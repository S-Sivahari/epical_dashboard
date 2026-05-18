import { useState } from 'react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { SelectField } from '@components/forms/SelectField'
import { FileUpload } from '@components/forms/FileUpload'
import { DocumentPreviewModal } from '@components/modals/DocumentPreviewModal'
import type { DocumentItem } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { FileText } from 'lucide-react'

const docs: DocumentItem[] = [
  { id: 'D-1', fileName: 'Offer_Asha.pdf', employeeName: 'Asha Menon', uploadedAt: '2026-05-01', status: 'Approved' },
  { id: 'D-2', fileName: 'ID_Meera.png', employeeName: 'Meera Iyer', uploadedAt: '2026-05-10', status: 'Requested' },
  { id: 'D-3', fileName: 'Contract_Dev.pdf', employeeName: 'Dev Patel', uploadedAt: '2026-04-28', status: 'Rejected' },
]

export function DocumentManagement() {
  const [tab, setTab] = useState<'Approved' | 'Requested' | 'Rejected'>('Approved')
  const [preview, setPreview] = useState<string | null>(null)

  const filtered = docs.filter((d) => d.status === tab)

  return (
    <PageWrapper>
      <PageHeader title="Documents" breadcrumb={<Breadcrumb items={[{ label: 'Documents' }]} />} />
      <section className="mb-6 rounded-xl border border-border bg-surface/60 p-4">
        <p className="mb-3 font-medium text-ink">Upload</p>
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Employee"
            id="doc-employee"
            options={[
              { value: 'E-1001', label: 'Asha Menon' },
              { value: 'E-1002', label: 'Rahul Verma' },
            ]}
            defaultValue="E-1001"
          />
          <FileUpload onUpload={() => undefined} />
        </div>
        <Button className="mt-3">Upload</Button>
      </section>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
        {(['Approved', 'Requested', 'Rejected'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === t ? 'bg-emerald-50 text-emerald-900 ring-1 ring-primary/30' : 'text-muted hover:bg-surface'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((d) => (
          <div key={d.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{d.fileName}</p>
                <p className="text-sm text-muted">{d.employeeName}</p>
                <p className="text-xs text-muted">{formatDate(d.uploadedAt)}</p>
                <div className="mt-2">
                  <Badge variant={d.status === 'Approved' ? 'success' : d.status === 'Rejected' ? 'danger' : 'warning'}>
                    {d.status}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setPreview(d.fileName)}>
                    Preview
                  </Button>
                  <Button size="sm" variant="ghost">
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <DocumentPreviewModal isOpen={Boolean(preview)} title={preview ?? ''} onClose={() => setPreview(null)} />
    </PageWrapper>
  )
}
