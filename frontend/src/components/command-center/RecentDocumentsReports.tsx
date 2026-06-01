import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { Download, Eye, FileSpreadsheet, FileText, Receipt } from 'lucide-react'
import { GlassCard, SectionHeader, SkeletonBlock } from './shared'
import { ROUTES } from '@constants/routes'

interface DocItem {
  id: string
  title: string
  type: 'payslip' | 'report' | 'attendance' | 'hr'
  date: string
  status?: string
}

export function RecentDocumentsReports({
  documentRequests,
  payslipBatches,
  loading,
}: {
  documentRequests: any[]
  payslipBatches: any[]
  loading: boolean
}) {
  const items: DocItem[] = []

  payslipBatches.slice(0, 2).forEach((b: any) => {
    items.push({
      id: `batch-${b._id || b.id}`,
      title: b.fileName || `Payroll batch — ${b.payMonth || 'Recent'}`,
      type: 'payslip',
      date: b.createdAt || b.uploadedAt || new Date().toISOString(),
      status: b.status,
    })
  })

  documentRequests.slice(0, 4).forEach((d: any) => {
    items.push({
      id: `doc-${d._id || d.id}`,
      title: `${d.documentType || 'Document'} — ${d.employeeName || 'Employee'}`,
      type: d.documentType?.toLowerCase().includes('attendance') ? 'attendance' : 'hr',
      date: d.createdAt || d.requestedAt,
      status: d.status,
    })
  })

  if (items.length < 4) {
    items.push({
      id: 'attendance-export',
      title: 'Weekly attendance export',
      type: 'attendance',
      date: new Date().toISOString(),
      status: 'Ready',
    })
  }

  const iconMap = {
    payslip: Receipt,
    report: FileSpreadsheet,
    attendance: FileSpreadsheet,
    hr: FileText,
  }

  return (
    <section>
      <SectionHeader
        title="Documents & Reports"
        subtitle="Quick preview without leaving the dashboard"
        action={
          <Link to={ROUTES.DOCUMENTS} className="cmd-hero-link text-sm font-semibold">
            View all →
          </Link>
        }
      />
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.slice(0, 6).map((item, i) => {
            const Icon = iconMap[item.type]
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard padding="sm" className="cmd-doc-card group">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--emerald-sage)] text-[var(--text-brand)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                        {item.status && ` · ${item.status}`}
                      </p>
                      <div className="mt-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" className="cmd-doc-action flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold">
                          <Eye className="h-3 w-3" /> Preview
                        </button>
                        <Link
                          to={item.type === 'payslip' ? ROUTES.PAYSLIPS : ROUTES.DOCUMENTS}
                          className="cmd-doc-action flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold"
                        >
                          <Download className="h-3 w-3" /> Open
                        </Link>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      )}
    </section>
  )
}
